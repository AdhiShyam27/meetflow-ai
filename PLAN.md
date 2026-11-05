# PLAN.md: MeetFlow AI

> **Honest timestamp note.** MeetFlow AI was first built in March 2026 (14 direct commits to `main`, March 2 to 18), before this assignment existed and before I had learned the Issue, branch, PR workflow from this course. This plan is written on November 4, 2026 as the first PR in the repo. It records what the app was meant to be, what the course spine requires, and what still has to be added (stars, tests, documentation). Everything merged after this PR follows the feature loop: Issue, branch, prompt log, PR with `closes #N`, merge, deploy. The Plan vs. Reality section at the bottom is written after the remaining features ship.

## 1. Pitch

I'm building **MeetFlow AI** because I spend most of my week in meetings (two clubs, two teaching roles, recruiting, group projects) and I kept losing decisions and action items that were said out loud and never written down. MeetFlow captures a live transcript in the browser (no bot joins the call), stores it per user, and turns each saved meeting into an AI summary with action items and follow-up drafts.

I use it several times a week during the semester, on Google Meet and Zoom calls, and on uploaded recordings of in-person meetings.

## 2. Features

Spine features first, then my three. Numbered in build order.

| # | User story |
|---|------------|
| 1 | As a new visitor, I want to sign up with email and password, log in, and log out, so that my meetings are private to my account. |
| 2 | As a user, I want my data stored in a `users` table plus `meetings` and `user_notes` tables tied to my user id, so that each meeting and note belongs to exactly one account. |
| 3 | As a user, I want to create a meeting (title, platform, language), see my list, open one meeting's detail page with transcript and summary, edit its title and notes, and delete it after an "are you sure?" confirmation, so that I control my own records. |
| 4 | As a user, I want required fields (meeting title, note filename and content, signup email and password) to refuse blanks and show a friendly message, so that I never save an empty record by accident. |
| 5 | As a user, I want to star important meetings and see a "Starred" view, with all stars kept in one `stars` junction table (user_id, meeting_id), so that I can find the meetings that matter without scrolling. |
| 6 | As a user, I want to search meetings by title and transcript text and sort them (newest first, oldest first, longest first, title A to Z), so that I can find a meeting in seconds. |
| 7 | As a user, I want an analytics dashboard with a weekly meetings chart and summary stats (total meetings, total hours, average duration, action items completed), so that I can see how my meeting load changes over the semester. |
| 8 | **(Mine)** As a user, I want to upload an audio recording and get a transcript with speaker labels, so that in-person meetings get the same treatment as online ones. |
| 9 | **(Mine)** As a user, I want AI workflows that send a meeting summary to Slack, Gmail, Notion, Linear, or a webhook, so that follow-ups leave the app without copy-paste. |
| 10 | **(Mine)** As a user, I want a Notes library where I can save text notes and full-text search across them, so that non-meeting notes live next to my meetings. |

## 3. Database

Supabase Postgres. `auth.users` is the users table (managed by Supabase Auth); `profiles` extends it one-to-one.

```
auth.users (Supabase Auth)
   id uuid PK
      │ 1
      │
      ├──< profiles (1:1)        id uuid PK/FK -> auth.users.id
      │                          full_name text, avatar_url text,
      │                          plan text (free|pro|team), meetings_used integer,
      │                          workflow_config text, llm_config text,
      │                          google_access_token text, google_refresh_token text,
      │                          google_token_expiry timestamptz, google_email text,
      │                          google_connected_at timestamptz, created_at timestamptz
      │
      ├──< meetings (1:many)     id uuid PK, user_id uuid FK -> auth.users.id
      │                          title text NOT NULL, platform text (google_meet|zoom|teams|other),
      │                          language text, duration integer (seconds), transcript text (encrypted),
      │                          word_count integer (generated), summary jsonb, notes jsonb,
      │                          workflow_runs jsonb, detected_languages text[], primary_language text,
      │                          status text (recording|processing|done|error),
      │                          created_at timestamptz, updated_at timestamptz
      │
      ├──< user_notes (1:many)   id uuid PK, user_id uuid FK -> auth.users.id
      │                          filename text NOT NULL, content text NOT NULL,
      │                          tsv tsvector (generated, full-text index), created_at timestamptz
      │
      └──< stars (junction, many-to-many users <-> meetings)
                                 id uuid PK, user_id uuid FK -> auth.users.id,
                                 meeting_id uuid FK -> meetings.id,
                                 created_at timestamptz,
                                 UNIQUE (user_id, meeting_id)
```

Relationships: one user has many meetings, many notes, and many stars. One meeting can be starred by many users (many-to-many through `stars`), though in practice only its owner sees it because of row-level security. Every table has RLS policies so `auth.uid()` must equal `user_id`.

## 4. Tests

1. **Data isolation.** Given User A has one saved meeting and User B has none, when User B requests the meetings list, then the result is empty and contains none of User A's meeting ids.
2. **Dashboard stat.** Given three completed meetings of 30, 60 and 90 minutes, when the analytics stats are computed, then `totalMeetings` is 3, `totalHours` is 3.0 and `avgDuration` is 60 minutes.

## 5. Technologies

- **Coding agent: Claude Code.** It can read the whole repo, run the tests, and open PRs from the terminal.
- **Framework: Next.js 16 (App Router) with React 19 and TypeScript.** One codebase for pages and API routes, and Vercel deploys it with zero config.
- **Database and auth: Supabase (Postgres + Supabase Auth).** Email/password signup and login out of the box, row-level security enforces per-user data isolation at the database layer.
- **Hosting: Vercel** at https://meetflow-ai.vercel.app. Auto-deploys `main` on every merge.
- **Transcription backend: Python FastAPI with faster-whisper, WhisperX and pyannote.** Needed for uploaded recordings with speaker labels; browser speech recognition can't diarize.
- **LLM: OpenRouter (multi-model) for summaries, chat and talking points.** Lets me switch models without code changes.
- **UI libraries: Tailwind CSS 4, framer-motion, lucide-react, sonner.** Styling, small animations, icons, and toast messages for validation feedback.
- **Testing: Vitest.** Fast TypeScript-native unit tests for the data-isolation and dashboard-stat scenarios.

## 6. Design

Clean SaaS dashboard: white cards on a light slate background, indigo (#4F46E5) as the primary color, amber (#F59E0B) for primary actions like "New Meeting", teal for success states. Headings in Inter, body in Plus Jakarta Sans. Rounded 2xl cards, soft shadows, subtle motion on load.

Inspiration: **Tactiq** (the three-panel meeting view: transcript, summary, chat) and **Otter.ai** (the meetings list with inline search hits).

## 7. Risks and cuts

- **Least sure I can build:** the two automated tests with red/green evidence, because the app was built without a test runner and the API routes talk to Supabase directly, so I'll have to pull the query and stat logic into testable functions first.
- **Cut first if out of time:** sort options beyond newest/oldest, then the Starred view (keeping the star toggle itself), then the weekly chart (keeping the summary stats). The three "mine" features already exist and don't depend on anything new.

## Plan vs. Reality

Written November 4, 2026, after the feature PRs above were merged. The original plan sections are untouched.

| Planned feature | Shipped / Changed / Cut | Status | Learning | What changed and why (one line) |
|---|---|---|---|---|
| 1. Sign up and login | Shipped (pre-plan, March 2026) | Done | Supabase Auth handles the hard parts; the signup form still needed inline validation. | Existing feature; only validation messages were added in PR #12. |
| 2. Data model (users + 2 tables) | Shipped (pre-plan) | Done | `profiles`, `meetings`, `user_notes` already matched the plan because the plan was written from them. | No change; documented in schema.md (PR #5). |
| 3. CRUD with delete confirmation | Shipped (pre-plan) | Done | Delete used `window.confirm`, which meets the "are you sure?" requirement without extra UI. | No change. |
| 4. Validation | Changed | Done | Toasts alone are not "a friendly message at the field"; inline helper text was missing everywhere. | PR #12 added inline messages on new meeting, notes and signup; the notes page also gained a write form because it only accepted uploads before. |
| 5. Stars (junction table + Starred view) | Shipped | Done | Keep a toggle in one POST endpoint so the UI needs a single call; RLS makes the junction table per-user automatically. | PR #8; the migration must be run by hand in Supabase since the project has no migration runner. |
| 6. Find things (search + sort) | Shipped | Done | Search already existed; sort was a pure helper plus a `<select>`. | PR #14 added Newest, Oldest, Longest, Title A to Z. |
| 7. Dashboard (chart + stats) | Shipped (pre-plan) | Done | Stats logic lived inline in the API route and was untestable until extracted. | PR #18 moved the arithmetic into `lib/analytics/stats.ts`. |
| 8. Upload with speaker labels (mine) | Shipped (pre-plan) | Done | Needs the Python backend running; not available on Vercel alone. | No change. |
| 9. AI workflows (mine) | Shipped (pre-plan) | Done | Integrations need per-user setup in Settings before they work. | No change. |
| 10. Notes library with search (mine) | Changed | Done | The library existed but only via file upload. | PR #12 added a write-a-note form while adding validation. |
| Test 1: data isolation | Changed | Done | A fake query builder is enough to test the filter; RLS is a second layer the test does not cover. | PR #13; runner changed from Vitest to Node's built-in `node --test` because the npm registry was unreachable from the build environment. |
| Test 2: dashboard stat | Changed | Done | Same runner change as Test 1. | PR #18. |
| Technologies: Vitest | Changed | Done | Zero-dependency `node:test` works with TypeScript on Node 22. | Replaced by `node --test` (see tests above). |
| Risks and cuts: sort beyond newest/oldest | Shipped | Done | Nothing had to be cut; the retrofit tests were the slow part as predicted. | No cut was needed. |
| Process: plan merged before features | Changed | Done | The order matters more than the document; a plan written after the fact is a description, not a decision tool. | The app was built March 2 to 18, 2026 with direct commits to `main`; the plan and all PRs date from November 4, 2026. |
