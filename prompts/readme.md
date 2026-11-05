# Prompt log: README.md

Tool: Claude Code (Claude Fable 5.1). Date: 2026-11-04.

## Owner's instruction

> do everything, make it and submit it now

followed by a brief listing the three documentation and validation PRs to produce. The relevant part for this branch:

## Prompt (spec section pasted as given)

> Replace the create-next-app boilerplate with a real README: what MeetFlow AI does (browser-based meeting transcription, AI summaries, workflows), live URL https://meetflow-ai.vercel.app, tools used (from PLAN.md section 5), repo layout, how to run locally (npm install, env vars needed: find them with `grep -rhoE "process.env.[A-Z_]+" app lib proxy.ts | sort -u`, run the supabase/migrations in order in the Supabase SQL editor, `npm run dev`; the Python backend in backend/ for uploads, with its start command), how to run tests (`npm test`, which another agent is adding with Vitest), and links to PLAN.md and schema.md.

## What the agent did

1. Ran the grep above to list the environment variables the app reads, and grepped `backend/` for the variables the Python service reads.
2. Read `backend/start.sh`, `backend/requirements.txt` and the header of `backend/main.py` for the start command and ports.
3. Listed the top-level directories for the repo layout section.
4. Wrote the README with features, tools table, layout, local setup steps, backend steps, test command and links. Corrected one step after noticing `backend/.env.example` does not exist in the repo.
