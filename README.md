# MeetFlow AI

Browser-based meeting transcription with AI summaries and follow-up workflows.

MeetFlow AI captures a live transcript in the browser (no bot joins the call), stores every meeting privately per user, and turns each saved meeting into an AI summary with action items. Saved meetings can be starred, searched, sorted and sent on to Slack, Gmail, Notion, Linear or a webhook. A Python backend handles uploaded recordings and adds speaker labels.

**Live app:** https://meetflow-ai.vercel.app

## Features

- Email and password signup, login and logout (Supabase Auth)
- Create, list, open, edit and delete meetings, each tied to the signed-in user
- Live transcription in the browser on Google Meet, Zoom and other calls
- AI summaries, action items, talking points and chat about a meeting (OpenRouter)
- Required-field validation with inline messages
- Star meetings and view a Starred list
- Search meetings by title and transcript, sort by date, duration or title
- Analytics dashboard with a weekly meetings chart and summary stats
- Upload an audio recording and get a transcript with speaker labels
- Workflows that send a summary to Slack, Gmail, Notion, Linear or a webhook
- Notes library with full-text search

The full plan, user stories and database design are in [PLAN.md](PLAN.md). The table-by-table schema is in [schema.md](schema.md).

## Tools used

From PLAN.md section 5:

| Area | Tool |
|---|---|
| Coding agent | Claude Code |
| Framework | Next.js 16 (App Router), React 19, TypeScript |
| Database and auth | Supabase (Postgres + Supabase Auth, row-level security) |
| Hosting | Vercel, auto-deploys `main` |
| Transcription backend | Python FastAPI with faster-whisper, WhisperX and pyannote |
| LLM | OpenRouter (multi-model) |
| UI | Tailwind CSS 4, framer-motion, lucide-react, sonner |
| Testing | Node's built-in test runner (`node --test`) |

## Repo layout

```
app/                 Next.js App Router pages and API routes
  api/               Server routes (meetings, notes, stars, analytics, summarize, workflows, google, llm)
  dashboard/         Signed-in pages (meetings list, new meeting, meeting detail, notes, analytics)
  login/ signup/     Auth pages
backend/             Python FastAPI transcription service (uploads, speaker diarization)
chrome-extension/    Companion extension for capturing tab audio
components/          Shared React components (landing page, dashboard, meeting view)
lib/                 Supabase clients, encryption, LLM, Gmail and transcription helpers
prompts/             Prompt logs, one file per feature
supabase/migrations/ SQL migrations, run in numeric order
types/               Shared TypeScript types
PLAN.md              Project plan (pitch, features, database, tests, tools)
schema.md            Database schema reference
```

## Run locally

### 1. Install dependencies

```bash
npm install
```

### 2. Set environment variables

Create `.env.local` in the repo root. Variables read by the app:

| Variable | Required | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes | Supabase anon (public) key |
| `ENCRYPTION_KEY` | yes | 64-character hex string (32 bytes) used to encrypt transcripts and stored tokens |
| `OPENROUTER_API_KEY` | yes for AI features | OpenRouter key for summaries, chat and talking points |
| `NEXT_PUBLIC_APP_URL` | recommended | Public URL of the app (defaults to `http://localhost:3000`); used for Google OAuth redirects |
| `GOOGLE_CLIENT_ID` | for Gmail workflow | Google OAuth client id |
| `GOOGLE_CLIENT_SECRET` | for Gmail workflow | Google OAuth client secret |
| `NEXT_PUBLIC_BACKEND_URL` | for uploads | URL of the Python backend (defaults to `http://localhost:8000`) |
| `NEXT_PUBLIC_TRANSCRIPTION_API` | for uploads | Same backend URL, used by `lib/transcription-api.ts` (defaults to `http://localhost:8000`) |

`NODE_ENV` is set by Next.js and does not need to be configured.

### 3. Create the database

In the Supabase dashboard open the SQL editor and run each file in `supabase/migrations/` in numeric order (`001_initial.sql`, then `002_...`, through to the highest number). Each migration builds on the previous one.

### 4. Start the web app

```bash
npm run dev
```

Open http://localhost:3000.

### 5. (Optional) Start the Python backend for uploads

The backend in `backend/` transcribes uploaded recordings and labels speakers. It needs Python 3.11+, ffmpeg and (for speaker labels) a Hugging Face token.

```bash
cd backend
echo "HF_TOKEN=hf_..." > .env   # optional, enables speaker diarization
./start.sh
```

`start.sh` creates a virtual environment, installs the dependencies from `requirements.txt` and runs `uvicorn main:app --host 0.0.0.0 --port 8000 --reload`. The API docs are at http://localhost:8000/docs and the health check at http://localhost:8000/api/health. Backend environment variables: `HF_TOKEN`, `WHISPER_MODEL`, `DEVICE`, `FFMPEG_PATH`, `TEMP_DIR`, `ALLOWED_ORIGINS`.

## Run tests

```bash
npm test
```

`npm test` runs `node --test tests/`, Node's built-in test runner, with no extra test dependency. The tests cover the two scenarios in PLAN.md section 4: data isolation between users, and the analytics summary stats. (PLAN.md section 5 names Vitest; the tests were written against Node's runner instead so they run without installing anything beyond Node.)

## Workflow

Every change after PLAN.md follows the course loop: GitHub Issue, feature branch, commits with a prompt log in `prompts/`, pull request into `main` with `closes #N`, squash merge, Vercel deploy.
