from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import uuid
import httpx
from pathlib import Path
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, timezone, timedelta

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")

from ai_service import (
    generate_article, evaluate_answers, get_word_meanings,
    CAT_GENRES, CAT_TONES, CAT_STRUCTURES, WORD_LIMITS, DIFFICULTY_DESCRIPTIONS
)

logger = logging.getLogger(__name__)


# --- Models ---
class AssessmentStartReq(BaseModel):
    strongest_genre: str
    intermediate_genre: str
    weakest_genre: str

class AssessmentGenerateRoundReq(BaseModel):
    assessment_id: str
    round_number: int

class AssessmentSubmitReq(BaseModel):
    assessment_id: str
    round_number: int
    reading_time_seconds: float
    answer_time_seconds: float
    user_what: str
    user_why: str
    user_structure: str

class ArticleGenerateReq(BaseModel):
    genre: str
    difficulty: int = 3
    word_limit_level: int = 3
    tone: str = "Analytical"
    structure: str = "random"

class ReadingCompleteReq(BaseModel):
    session_id: str
    reading_time_seconds: float

class AnswerSubmitReq(BaseModel):
    session_id: str
    user_what: str
    user_why: str
    user_structure: str

class VocabMeaningsReq(BaseModel):
    words: List[str]
    article_content: str

class BookmarkReq(BaseModel):
    word: str
    meaning: str
    article_sentence: str = ""
    example_sentence: str = ""
    memory_trick: str = ""

class SettingsUpdate(BaseModel):
    preferred_genre: Optional[str] = None
    difficulty: Optional[int] = None
    word_limit_level: Optional[int] = None
    tone: Optional[str] = None
    structure: Optional[str] = None


# --- Auth Helper ---
async def get_current_user(request: Request) -> dict:
    session_token = request.cookies.get("session_token")
    if not session_token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            session_token = auth_header[7:]
    if not session_token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    session = await db.user_sessions.find_one({"session_token": session_token}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=401, detail="Invalid session")

    expires_at = session["expires_at"]
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Session expired")

    user = await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


# --- Auth Routes ---
@api_router.post("/auth/session")
async def create_session(request: Request, response: Response):
    body = await request.json()
    session_id = body.get("session_id")
    if not session_id:
        raise HTTPException(status_code=400, detail="session_id required")

    async with httpx.AsyncClient() as http:
        auth_resp = await http.get(
            "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
            headers={"X-Session-ID": session_id}
        )
    if auth_resp.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid session")

    data = auth_resp.json()
    email, name, picture = data["email"], data["name"], data.get("picture", "")
    session_token = data["session_token"]

    existing = await db.users.find_one({"email": email}, {"_id": 0})
    if existing:
        user_id = existing["user_id"]
        await db.users.update_one({"email": email}, {"$set": {"name": name, "picture": picture}})
    else:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        await db.users.insert_one({
            "user_id": user_id, "email": email, "name": name, "picture": picture,
            "assessment_completed": False, "difficulty_level": 3,
            "created_at": datetime.now(timezone.utc).isoformat()
        })

    await db.user_sessions.insert_one({
        "user_id": user_id, "session_token": session_token,
        "expires_at": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat()
    })

    response.set_cookie(
        key="session_token", value=session_token, httponly=True,
        secure=True, samesite="none", path="/", max_age=7 * 24 * 60 * 60
    )

    user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    return user


@api_router.get("/auth/me")
async def get_me(user: dict = Depends(get_current_user)):
    return user


@api_router.post("/auth/logout")
async def logout(request: Request, response: Response):
    token = request.cookies.get("session_token")
    if token:
        await db.user_sessions.delete_one({"session_token": token})
    response.delete_cookie(key="session_token", path="/")
    return {"message": "Logged out"}


# --- Assessment Routes ---
@api_router.post("/assessment/start")
async def start_assessment(req: AssessmentStartReq, user: dict = Depends(get_current_user)):
    aid = f"assess_{uuid.uuid4().hex[:12]}"
    await db.assessments.insert_one({
        "assessment_id": aid, "user_id": user["user_id"],
        "strongest_genre": req.strongest_genre,
        "intermediate_genre": req.intermediate_genre,
        "weakest_genre": req.weakest_genre,
        "rounds": [], "overall_score": None, "status": "in_progress",
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    return {"assessment_id": aid}


@api_router.post("/assessment/generate-round")
async def generate_assessment_round(req: AssessmentGenerateRoundReq, user: dict = Depends(get_current_user)):
    assessment = await db.assessments.find_one(
        {"assessment_id": req.assessment_id, "user_id": user["user_id"]}, {"_id": 0}
    )
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found")

    genre_map = {1: "strongest_genre", 2: "intermediate_genre", 3: "weakest_genre"}
    genre = assessment.get(genre_map.get(req.round_number, ""), "")
    if not genre:
        raise HTTPException(status_code=400, detail="Invalid round number")

    article = await generate_article(genre=genre, difficulty=3, word_limit=800, tone="Analytical")
    if "error" in article:
        raise HTTPException(status_code=500, detail="Failed to generate article")

    round_data = {"round_number": req.round_number, "genre": genre, "article": article, "status": "reading"}
    await db.assessments.update_one(
        {"assessment_id": req.assessment_id}, {"$push": {"rounds": round_data}}
    )

    return {"assessment_id": req.assessment_id, "round_number": req.round_number, "genre": genre, "article": article}


@api_router.post("/assessment/submit-round")
async def submit_assessment_round(req: AssessmentSubmitReq, user: dict = Depends(get_current_user)):
    assessment = await db.assessments.find_one(
        {"assessment_id": req.assessment_id, "user_id": user["user_id"]}, {"_id": 0}
    )
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found")

    idx = req.round_number - 1
    if idx >= len(assessment["rounds"]):
        raise HTTPException(status_code=400, detail="Round not found")

    article = assessment["rounds"][idx]["article"]
    evaluation = await evaluate_answers(
        article["content"], article["correct_what"], article["correct_why"],
        article["correct_structure"], req.user_what, req.user_why, req.user_structure,
        req.reading_time_seconds, article.get("word_count", 800)
    )

    await db.assessments.update_one({"assessment_id": req.assessment_id}, {"$set": {
        f"rounds.{idx}.reading_time": req.reading_time_seconds,
        f"rounds.{idx}.answer_time": req.answer_time_seconds,
        f"rounds.{idx}.evaluation": evaluation,
        f"rounds.{idx}.status": "completed"
    }})

    is_final = req.round_number == 3
    overall_score = None
    if is_final:
        updated = await db.assessments.find_one({"assessment_id": req.assessment_id}, {"_id": 0})
        scores = [r["evaluation"]["total_score"] for r in updated["rounds"] if "evaluation" in r]
        overall_score = sum(scores) / len(scores) if scores else 0
        difficulty = 4 if overall_score >= 80 else 3 if overall_score >= 60 else 2 if overall_score >= 40 else 1

        await db.assessments.update_one({"assessment_id": req.assessment_id}, {"$set": {
            "overall_score": overall_score, "status": "completed",
            "completed_at": datetime.now(timezone.utc).isoformat()
        }})
        await db.users.update_one({"user_id": user["user_id"]}, {"$set": {
            "assessment_completed": True, "difficulty_level": difficulty
        }})

    return {"round_number": req.round_number, "evaluation": evaluation,
            "is_final_round": is_final, "overall_score": overall_score}


@api_router.get("/assessment/latest")
async def get_latest_assessment(user: dict = Depends(get_current_user)):
    cursor = db.assessments.find(
        {"user_id": user["user_id"], "status": "completed"}, {"_id": 0}
    ).sort("completed_at", -1).limit(1)
    docs = await cursor.to_list(1)
    return docs[0] if docs else {}


# --- Reading Routes ---
@api_router.post("/reading/generate")
async def generate_reading(req: ArticleGenerateReq, user: dict = Depends(get_current_user)):
    word_limit = WORD_LIMITS.get(req.word_limit_level, 800)
    article = await generate_article(req.genre, req.difficulty, word_limit, req.tone, req.structure)
    if "error" in article:
        raise HTTPException(status_code=500, detail="Failed to generate article")

    sid = f"read_{uuid.uuid4().hex[:12]}"
    await db.reading_sessions.insert_one({
        "session_id": sid, "user_id": user["user_id"], "article": article,
        "settings": req.model_dump(), "reading_time": None, "answers": None,
        "evaluation": None, "status": "reading",
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    return {"session_id": sid, "article": article}


@api_router.post("/reading/complete")
async def complete_reading(req: ReadingCompleteReq, user: dict = Depends(get_current_user)):
    result = await db.reading_sessions.update_one(
        {"session_id": req.session_id, "user_id": user["user_id"]},
        {"$set": {"reading_time": req.reading_time_seconds, "status": "answering"}}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Session not found")
    return {"status": "ok"}


@api_router.post("/reading/submit-answers")
async def submit_answers(req: AnswerSubmitReq, user: dict = Depends(get_current_user)):
    session = await db.reading_sessions.find_one(
        {"session_id": req.session_id, "user_id": user["user_id"]}, {"_id": 0}
    )
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    article = session["article"]
    evaluation = await evaluate_answers(
        article["content"], article["correct_what"], article["correct_why"],
        article["correct_structure"], req.user_what, req.user_why, req.user_structure,
        session.get("reading_time", 60), article.get("word_count", 800)
    )

    await db.reading_sessions.update_one({"session_id": req.session_id}, {"$set": {
        "answers": {"user_what": req.user_what, "user_why": req.user_why, "user_structure": req.user_structure},
        "evaluation": evaluation, "status": "completed",
        "completed_at": datetime.now(timezone.utc).isoformat()
    }})
    return {
        "evaluation": evaluation,
        "correct_answers": {
            "what": article["correct_what"], "why": article["correct_why"],
            "structure": article["correct_structure"]
        }
    }


@api_router.post("/reading/skip-answers")
async def skip_answers(request: Request, user: dict = Depends(get_current_user)):
    body = await request.json()
    session = await db.reading_sessions.find_one(
        {"session_id": body["session_id"], "user_id": user["user_id"]}, {"_id": 0}
    )
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    await db.reading_sessions.update_one({"session_id": body["session_id"]}, {"$set": {
        "status": "skipped", "completed_at": datetime.now(timezone.utc).isoformat()
    }})
    return {
        "correct_answers": {
            "what": session["article"]["correct_what"],
            "why": session["article"]["correct_why"],
            "structure": session["article"]["correct_structure"]
        }
    }


@api_router.get("/reading/history")
async def reading_history(user: dict = Depends(get_current_user)):
    sessions = await db.reading_sessions.find(
        {"user_id": user["user_id"]}, {"_id": 0, "article.content": 0}
    ).sort("created_at", -1).to_list(50)
    return sessions


# --- Vocabulary Routes ---
@api_router.post("/vocabulary/meanings")
async def vocab_meanings(req: VocabMeaningsReq, user: dict = Depends(get_current_user)):
    return await get_word_meanings(req.words, req.article_content)


@api_router.post("/vocabulary/bookmark")
async def bookmark_word(req: BookmarkReq, user: dict = Depends(get_current_user)):
    existing = await db.vocabulary.find_one(
        {"user_id": user["user_id"], "word": req.word.lower()}, {"_id": 0}
    )
    if existing:
        return existing

    vid = f"vocab_{uuid.uuid4().hex[:12]}"
    doc = {
        "vocab_id": vid, "user_id": user["user_id"], "word": req.word.lower(),
        "meaning": req.meaning, "article_sentence": req.article_sentence,
        "example_sentence": req.example_sentence, "memory_trick": req.memory_trick,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.vocabulary.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api_router.get("/vocabulary/bookmarks")
async def get_bookmarks(user: dict = Depends(get_current_user)):
    return await db.vocabulary.find(
        {"user_id": user["user_id"]}, {"_id": 0}
    ).sort("created_at", -1).to_list(500)


@api_router.delete("/vocabulary/bookmark/{vocab_id}")
async def delete_bookmark(vocab_id: str, user: dict = Depends(get_current_user)):
    result = await db.vocabulary.delete_one({"vocab_id": vocab_id, "user_id": user["user_id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Not found")
    return {"message": "Deleted"}


# --- Dashboard Routes ---
@api_router.get("/dashboard/stats")
async def dashboard_stats(user: dict = Depends(get_current_user)):
    uid = user["user_id"]
    total = await db.reading_sessions.count_documents({"user_id": uid})
    completed = await db.reading_sessions.count_documents({"user_id": uid, "status": "completed"})

    completed_list = await db.reading_sessions.find(
        {"user_id": uid, "status": "completed", "evaluation": {"$ne": None}},
        {"_id": 0, "evaluation": 1, "settings": 1}
    ).to_list(100)

    scores = [s["evaluation"]["total_score"] for s in completed_list if s.get("evaluation")]
    avg_score = sum(scores) / len(scores) if scores else 0

    genre_stats = {}
    for s in completed_list:
        genre = s.get("settings", {}).get("genre", "Unknown")
        score = s.get("evaluation", {}).get("total_score", 0)
        if genre not in genre_stats:
            genre_stats[genre] = {"count": 0, "total_score": 0}
        genre_stats[genre]["count"] += 1
        genre_stats[genre]["total_score"] += score
    for g in genre_stats:
        genre_stats[g]["avg_score"] = round(genre_stats[g]["total_score"] / genre_stats[g]["count"], 1)

    vocab_count = await db.vocabulary.count_documents({"user_id": uid})
    recent = await db.reading_sessions.find(
        {"user_id": uid}, {"_id": 0, "article.content": 0}
    ).sort("created_at", -1).to_list(5)

    return {
        "total_sessions": total, "completed_sessions": completed,
        "average_score": round(avg_score, 1), "vocabulary_count": vocab_count,
        "genre_stats": genre_stats, "recent_sessions": recent,
        "difficulty_level": user.get("difficulty_level", 3),
        "assessment_completed": user.get("assessment_completed", False)
    }


@api_router.get("/dashboard/settings")
async def get_settings(user: dict = Depends(get_current_user)):
    settings = await db.user_settings.find_one({"user_id": user["user_id"]}, {"_id": 0})
    return settings or {
        "user_id": user["user_id"], "preferred_genre": "Random",
        "difficulty": user.get("difficulty_level", 3), "word_limit_level": 3,
        "tone": "Random", "structure": "random"
    }


@api_router.put("/dashboard/settings")
async def update_settings(req: SettingsUpdate, user: dict = Depends(get_current_user)):
    data = {k: v for k, v in req.model_dump().items() if v is not None}
    data["user_id"] = user["user_id"]
    await db.user_settings.update_one({"user_id": user["user_id"]}, {"$set": data}, upsert=True)
    return await db.user_settings.find_one({"user_id": user["user_id"]}, {"_id": 0})


# --- Config Routes ---
@api_router.get("/config/genres")
async def get_genres():
    return {"genres": CAT_GENRES}

@api_router.get("/config/tones")
async def get_tones():
    return {"tones": CAT_TONES}

@api_router.get("/config/structures")
async def get_structures():
    return {"structures": CAT_STRUCTURES}

@api_router.get("/config/difficulties")
async def get_difficulties():
    return {"difficulties": DIFFICULTY_DESCRIPTIONS}

@api_router.get("/config/word-limits")
async def get_word_limits():
    return {"word_limits": WORD_LIMITS}


@api_router.get("/")
async def root():
    return {"message": "ComprehendCAT API running"}


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
