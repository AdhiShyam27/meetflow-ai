# Prompt log: schema.md

Tool: Claude Code (Claude Fable 5.1). Date: 2026-11-04.

## Owner's instruction

> do everything, make it and submit it now

followed by a brief listing the three documentation and validation PRs to produce. The relevant part for this branch:

## Prompt (spec section pasted as given)

> Write `schema.md` in the repo root: every table (auth.users as managed by Supabase Auth, profiles, meetings, user_notes, stars), each column with type, primary key, foreign keys, and how tables relate in plain English plus a simple ASCII diagram. For `stars`, document it exactly as PLAN.md section 3 specifies (another agent is creating `supabase/migrations/008_stars.sql` to that spec: id uuid PK, user_id FK auth.users, meeting_id FK meetings, created_at, UNIQUE(user_id, meeting_id), RLS on auth.uid() = user_id). End with a short "Compared with PLAN.md section 3" paragraph stating honestly what matches and what differs.

## What the agent did

1. Read PLAN.md section 3 and all seven files in `supabase/migrations/`.
2. Wrote `schema.md` with one table per section, listing every column, type, constraint and default found in the migrations, plus the `stars` table from the PLAN.md spec.
3. Added the relationships paragraph, the ASCII diagram and the comparison paragraph, which notes the `status` default ('pending') that is outside its own CHECK list.
