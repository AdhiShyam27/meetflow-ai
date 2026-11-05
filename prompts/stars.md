# Prompt log: Stars (feature 5)

Agent: Claude Code. Branch: `feature/stars`. Issue #3.

## Owner instruction (Nov 4, 2026)

> do everything and make it and submit it now
>
> make a couple of agents and work in parallel and do this

Context given to the agent: the Solo app assignment brief and PLAN.md feature 5:

> As a user, I want to star important meetings and see a "Starred" view, with all stars kept in one `stars` junction table (user_id, meeting_id), so that I can find the meetings that matter without scrolling.

## Build prompt

> Add a `stars` junction table (`supabase/migrations/008_stars.sql`): id uuid PK, user_id FK to auth.users, meeting_id FK to meetings, created_at, UNIQUE(user_id, meeting_id), RLS so auth.uid() = user_id for select/insert/delete, indexes on both FKs. Match the style of 001_initial.sql.
>
> Add `app/api/stars/route.ts`: GET returns `{ starred: string[] }` for the current user; POST `{ meeting_id }` toggles the star and returns `{ starred: boolean }`. Follow the auth and demo-mode pattern in `app/api/meetings/route.ts`. Validate meeting_id.
>
> On the dashboard (`app/dashboard/page.tsx`): fetch `/api/stars` with the meetings, show an always-visible star button on each row (filled amber when starred, `preventDefault` + `stopPropagation` because the row is a Link), optimistic toggle with rollback and a toast on failure, a "Starred" filter button next to search, a "Starred" stat card, and an empty state "No starred meetings yet".
>
> Do not touch `app/api/meetings/route.ts` or `app/api/analytics/route.ts` (another agent is refactoring them for tests). Type-check with `npx tsc --noEmit` before opening the PR.

## Notes

- The agent chose a toggle endpoint (one POST) instead of separate POST and DELETE so the UI needs a single call.
- The migration has to be run by hand in the Supabase SQL editor; there is no migration runner in this project.
