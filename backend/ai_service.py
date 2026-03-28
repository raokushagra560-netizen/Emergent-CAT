import os
import json
import uuid
import random
from pathlib import Path
from dotenv import load_dotenv
import google.generativeai as genai

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

genai.configure(api_key=os.environ.get('GEMINI_API_KEY'))
model = genai.GenerativeModel('gemini-1.5-flash')

CAT_GENRES = [
    "Philosophy & Abstract Reasoning",
    "Economics & Business",
    "Science & Technology",
    "Social Issues & Culture",
    "Art & Literature",
    "History & Politics",
    "Psychology & Behavioral Science",
    "Environment & Ecology",
    "Law & Governance",
    "Education & Language"
]

CAT_TONES = [
    "Descriptive", "Argumentative", "Analytical", "Narrative",
    "Satirical", "Expository", "Persuasive", "Critical"
]

CAT_STRUCTURES = [
    "Introduction > Arguments > Counterarguments > Conclusion",
    "Thesis > Evidence > Analysis > Implications",
    "Problem > Causes > Effects > Solutions",
    "Historical Context > Current State > Future Outlook",
    "Comparison > Contrast > Synthesis"
]

DIFFICULTY_DESCRIPTIONS = {
    1: "Simple vocabulary, short sentences, clear structure. Suitable for beginners.",
    2: "Moderate vocabulary, varied sentence structure. Some complex ideas.",
    3: "Advanced vocabulary, complex sentences. Abstract concepts and nuanced arguments.",
    4: "Sophisticated vocabulary, intricate sentence construction. Dense, academic-style writing.",
    5: "Elite vocabulary, highly complex syntax. Dense philosophical/academic discourse at CAT topper level."
}

WORD_LIMITS = {1: 200, 2: 500, 3: 800, 4: 1200, 5: 2000}

def _parse_json_response(text):
    text = text.strip()
    if text.startswith("```json"):
        text = text[7:]
    if text.startswith("```"):
        text = text[3:]
    if text.endswith("```"):
        text = text[:-3]
    return json.loads(text.strip())

async def generate_article(genre, difficulty=3, word_limit=800, tone="Analytical", structure="random"):
    if structure == "random" or not structure:
        structure = random.choice(CAT_STRUCTURES)
    if tone == "Random" or not tone:
        tone = random.choice(CAT_TONES)

    difficulty_desc = DIFFICULTY_DESCRIPTIONS.get(difficulty, DIFFICULTY_DESCRIPTIONS[3])

    prompt = f"""You are an expert content creator for CAT exam reading comprehension passages. You create intellectually stimulating articles mirroring actual CAT 2017-2025 exam styles.

Generate a CAT-style reading comprehension article with these specifications:
Genre: {genre}
Difficulty: {difficulty}/5 - {difficulty_desc}
Word Count: approximately {word_limit} words
Tone: {tone}
Structure: {structure}
Style inspiration: Aeon essays, JSTOR articles, NatGeo History, LA Review of Books, academic editorials.

Return ONLY valid JSON, no markdown fences, no extra text:
{{"title":"article title","content":"full article text with paragraphs separated by double newlines","word_count":{word_limit},"genre":"{genre}","difficulty":{difficulty},"tone":"{tone}","structure_used":"{structure}","correct_what":"2-3 sentence summary of what article is about","correct_why":"2-3 sentence explanation of author purpose","correct_structure":"paragraph-by-paragraph breakdown like Para 1: Introduction... Para 2: Evidence...","difficult_words":["word1","word2","word3","word4","word5","word6"]}}"""

    try:
        response = model.generate_content(prompt)
        return _parse_json_response(response.text)
    except json.JSONDecodeError:
        return {"error": "Failed to parse article response"}
    except Exception as e:
        return {"error": f"AI service error: {str(e)[:200]}"}

async def evaluate_answers(article_content, correct_what, correct_why, correct_structure,
                           user_what, user_why, user_structure, reading_time_seconds, word_count):
    reading_wpm = (word_count / reading_time_seconds) * 60 if reading_time_seconds > 0 else 0

    prompt = f"""You are a CAT exam evaluator scoring reading comprehension answers.

ARTICLE EXCERPT: {article_content[:1500]}

CORRECT ANSWERS:
What: {correct_what}
Why: {correct_why}
Structure: {correct_structure}

USER ANSWERS:
What: {user_what}
Why: {user_why}
Structure: {user_structure}

READING METRICS: {reading_wpm:.0f} WPM, {word_count} words, {reading_time_seconds:.0f} seconds

Scoring criteria:
- Reading Speed (0-30): avg adult 200-250 WPM, CAT toppers 350-450+ WPM
- What accuracy (0-25)
- Why accuracy (0-25)
- Structure accuracy (0-20)

Return ONLY valid JSON, no markdown, no extra text:
{{"reading_speed_score":0,"what_score":0,"why_score":0,"structure_score":0,"total_score":0,"reading_speed_feedback":"brief feedback","what_feedback":"brief feedback","why_feedback":"brief feedback","structure_feedback":"brief feedback","overall_feedback":"2-3 sentence assessment","recommended_difficulty":3}}"""

    try:
        response = model.generate_content(prompt)
        return _parse_json_response(response.text)
    except Exception as e:
        return {
            "reading_speed_score": 15,
            "what_score": 12,
            "why_score": 12,
            "structure_score": 10,
            "total_score": 49,
            "reading_speed_feedback": "Could not evaluate precisely",
            "what_feedback": "Could not evaluate precisely",
            "why_feedback": "Could not evaluate precisely",
            "structure_feedback": "Could not evaluate precisely",
            "overall_feedback": "There was an issue with evaluation. Please try again.",
            "recommended_difficulty": 3
        }

async def get_word_meanings(words, article_context):
    prompt = f"""You are a vocabulary expert helping CAT aspirants understand difficult words.

Words to explain: {", ".join(words)}
Article context: {article_context[:1500]}

Return ONLY valid JSON, no markdown, no extra text:
{{"words":[{{"word":"the word","meaning":"clear concise definition","article_sentence":"exact sentence from the passage where word appears","example_sentence":"a different example sentence using the word","memory_trick":"clever mnemonic or association to remember the meaning"}}]}}

Provide entries for ALL listed words."""

    try:
        response = model.generate_content(prompt)
        return _parse_json_response(response.text)
    except Exception as e:
        return {
            "words": [
                {
                    "word": w,
                    "meaning": "Unable to fetch meaning at this time",
                    "article_sentence": "",
                    "example_sentence": "",
                    "memory_trick": ""
                } for w in words
            ]
        }

