# ComprehendCAT - Product Requirements Document

## Original Problem Statement
Build a website for CAT aspirants that provides quality reading comprehension training with AI-curated articles, adaptive assessment, and vocabulary building.

## Architecture
- **Frontend**: React + Tailwind CSS + Shadcn UI + next-themes
- **Backend**: FastAPI + MongoDB (Motor async)
- **AI**: OpenAI GPT-5.2 via Emergent LLM key (emergentintegrations)
- **Auth**: Emergent-managed Google OAuth

## User Personas
1. CAT aspirant wanting to improve reading speed and comprehension
2. Competitive exam student needing diverse genre exposure
3. Vocabulary builder seeking flashcard-based learning

## Core Requirements
- 3-round adaptive reading assessment (strongest/intermediate/weakest genre)
- AI-generated articles mimicking CAT RC patterns (2017-2025 style)
- Customizable reading settings: genre, difficulty (1-5), word limit (200-2000), tone, structure
- CAT-like reading interface with hideable timer
- Post-reading Q&A: What/Why/Structure analysis
- Vocabulary builder: click words for meanings, memory tricks, bookmarking
- Flashcard system for bookmarked words
- Dark/light theme toggle
- Score calculation (0-100) factoring reading speed and comprehension

## What's Been Implemented (March 27, 2026)
- Landing page with hero, features, how-it-works sections
- Google OAuth authentication flow (Emergent Auth)
- Dashboard with stats cards, genre performance, recent sessions, quick actions
- 3-round assessment page with genre selection, reading, Q&A, and scoring
- Practice reading page with full settings panel (genre, difficulty, word limit, tone, structure)
- CAT-like reading interface with hideable timer (turns red after 5 min)
- Post-reading comprehension Q&A with skip option
- Results display with score breakdown and correct answers
- Vocabulary builder: clickable words, AI-powered meanings, memory tricks
- Flashcard mode with flip animation for bookmarked words
- Vocabulary list with search, delete functionality
- Dark/light theme toggle using next-themes
- 10 CAT genres, 8 tones, 5 structures supported
- Backend API: auth, assessment, reading, vocabulary, dashboard, config endpoints
- MongoDB collections: users, user_sessions, assessments, reading_sessions, vocabulary, user_settings

## Known Issues
- AI features require sufficient Emergent LLM key balance (budget exceeded during testing)

## Prioritized Backlog
### P0 (Next)
- Add balance to Emergent LLM key to enable AI features
- Test full end-to-end assessment flow with live AI

### P1
- Live article scraping from specified sources (aeon.co, JSTOR, NatGeo, etc.) with AI rephrasing
- Reading history detail view (review past articles and answers)
- Spaced repetition algorithm for vocabulary flashcards
- Progress tracking charts (recharts integration)

### P2
- GMAT and GRE exam support
- Leaderboard/comparative scoring with other users
- Export vocabulary to PDF/Anki
- Mobile-responsive optimizations
- Email notifications for daily practice reminders
- Article bookmarking and categorization
