# MeetFlow AI: Database Schema

MeetFlow AI stores everything in Supabase Postgres. `auth.users` is the users table and is managed by Supabase Auth. Every application table carries a `user_id` (or, for `profiles`, an `id`) that points back at `auth.users.id`, and every application table has row-level security (RLS) so a signed-in user can only read and write rows where `auth.uid()` equals that column.

The tables are created by the SQL files in `supabase/migrations/`, run in order (001 to 008) in the Supabase SQL editor.

## Diagram

```
auth.users (Supabase Auth)
   id uuid PK
      |
      | 1
      |
      +---< profiles        (1 to 1)      id uuid PK, FK -> auth.users.id
      |
      +---< meetings        (1 to many)   user_id uuid FK -> auth.users.id
      |        |
      |        | 1
      |        |
      |        +---< stars  (junction)    meeting_id uuid FK -> meetings.id
      |                                   user_id uuid FK -> auth.users.id
      |                                   UNIQUE (user_id, meeting_id)
      |
      +---< user_notes      (1 to many)   user_id uuid FK -> auth.users.id
```

## Tables

### auth.users (managed by Supabase Auth)

Supabase creates and maintains this table. The app never writes to it directly; signup, login and logout go through Supabase Auth, which fills it in. Only the columns the app relies on are listed.

| Column | Type | Notes |
|---|---|---|
| id | uuid | Primary key. Referenced by every application table. |
| email | text | Login email. |
| raw_user_meta_data | jsonb | Signup metadata (`full_name`, `avatar_url`), copied into `profiles` by a trigger. |
| created_at | timestamptz | Set by Supabase. |

### profiles

One row per user, created automatically by the `on_auth_user_created` trigger when a row is inserted into `auth.users`. Holds plan information plus encrypted integration settings. Created in `001_initial.sql`, extended in `002_google_tokens.sql`, `005_workflows.sql` and `006_llm_config.sql`.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | uuid | PK, FK -> auth.users.id ON DELETE CASCADE | Same value as the user's id (1 to 1). |
| full_name | text | | From signup metadata. |
| avatar_url | text | | From signup metadata. |
| plan | text | NOT NULL, DEFAULT 'free', CHECK in (free, pro, team) | |
| meetings_used | integer | NOT NULL, DEFAULT 0 | |
| google_access_token | text | | Google OAuth, stored encrypted. |
| google_refresh_token | text | | Google OAuth, stored encrypted. |
| google_token_expiry | timestamptz | | |
| google_email | text | | |
| google_connected_at | timestamptz | | |
| workflow_config | text | | Encrypted JSON of workflow destinations (Slack, Gmail, Notion, Linear, webhook). |
| llm_config | text | | Encrypted JSON `{ apiKey, model }` for OpenRouter. |
| created_at | timestamptz | NOT NULL, DEFAULT now() | |

RLS: SELECT and UPDATE allowed when `auth.uid() = id`. There is no INSERT policy because the trigger (SECURITY DEFINER) creates the row.

### meetings

One row per recorded or uploaded meeting. Created in `001_initial.sql`, extended in `003_language_tracking.sql`, `004_notes.sql` and `005_workflows.sql`.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | uuid | PK, DEFAULT uuid_generate_v4() | |
| user_id | uuid | NOT NULL, FK -> auth.users.id ON DELETE CASCADE | Owner. |
| title | text | NOT NULL, DEFAULT 'Untitled Meeting' | |
| platform | text | NOT NULL, DEFAULT 'other', CHECK in (google_meet, zoom, teams, other) | |
| language | text | NOT NULL, DEFAULT 'en-US' | Speech recognition language. |
| duration | integer | | Seconds. |
| transcript | text | | Full transcript text, stored encrypted by the API layer. |
| word_count | integer | GENERATED ALWAYS AS word count of transcript, STORED | Computed by Postgres. |
| summary | jsonb | | Structured AI summary (overview, action items, decisions). |
| notes | jsonb | DEFAULT '[]' | User-added notes on the meeting detail page. |
| workflow_runs | jsonb | DEFAULT '{}' | Last run status per workflow. |
| detected_languages | text[] | DEFAULT '{}' | |
| primary_language | text | DEFAULT 'English' | |
| status | text | NOT NULL, DEFAULT 'pending', CHECK in (recording, processing, done, error) | |
| created_at | timestamptz | NOT NULL, DEFAULT now() | |
| updated_at | timestamptz | NOT NULL, DEFAULT now() | Kept current by the `meetings_updated_at` trigger. |

Indexes: `user_id`, `created_at DESC`, `status`.

RLS: SELECT, INSERT, UPDATE and DELETE each require `auth.uid() = user_id`.

### user_notes

The Notes library: free-standing text notes with full-text search. Created in `007_user_notes.sql`.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | uuid | PK, DEFAULT uuid_generate_v4() | |
| user_id | uuid | NOT NULL, FK -> auth.users.id ON DELETE CASCADE | Owner. |
| filename | text | NOT NULL | |
| content | text | NOT NULL | |
| tsv | tsvector | GENERATED ALWAYS AS to_tsvector('english', content), STORED | Full-text index (GIN). |
| created_at | timestamptz | NOT NULL, DEFAULT now() | |

Indexes: `user_id`, GIN on `tsv`.

RLS: SELECT, INSERT and DELETE require `auth.uid() = user_id`.

### stars

Junction table for starred meetings (feature 5). Created in `008_stars.sql`.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | uuid | PK, DEFAULT uuid_generate_v4() | |
| user_id | uuid | NOT NULL, FK -> auth.users.id ON DELETE CASCADE | Who starred. |
| meeting_id | uuid | NOT NULL, FK -> meetings.id ON DELETE CASCADE | Which meeting. |
| created_at | timestamptz | NOT NULL, DEFAULT now() | |

Constraints: `UNIQUE (user_id, meeting_id)` so a user can star a meeting only once.

RLS: every policy requires `auth.uid() = user_id`.

## How the tables relate

- One user (`auth.users`) has exactly one `profiles` row. The profile's `id` is the user's id, so the two tables are joined 1 to 1.
- One user has many `meetings`. Each meeting belongs to exactly one user through `meetings.user_id`.
- One user has many `user_notes`. Each note belongs to exactly one user through `user_notes.user_id`. Notes are not attached to a meeting.
- `stars` is a many-to-many junction between users and meetings: one user can star many meetings, and a meeting could in principle be starred by many users. Each star row names one user and one meeting, and the unique constraint stops duplicates. In practice RLS on `meetings` means only the owner can see a meeting, so only the owner stars it.
- All foreign keys use `ON DELETE CASCADE`: deleting a user removes their profile, meetings, notes and stars; deleting a meeting removes its stars.

## Compared with PLAN.md section 3

Matches: the set of tables (auth.users, profiles, meetings, user_notes, stars), the primary keys, the foreign keys to `auth.users.id` and `meetings.id`, the 1 to 1, 1 to many and junction relationships, the `UNIQUE (user_id, meeting_id)` constraint on `stars`, and RLS on `auth.uid() = user_id` for every application table. Every column PLAN.md lists exists in the migrations.

Differs: the migrations include defaults and CHECK constraints that PLAN.md does not spell out (`title` defaults to 'Untitled Meeting', `platform` to 'other', `language` to 'en-US', `plan` to 'free', `notes` to '[]', `workflow_runs` to '{}', `detected_languages` to '{}', `primary_language` to 'English'). The `status` column's default is 'pending', which is not one of the four values in its own CHECK list or in PLAN.md (recording, processing, done, error); inserts that rely on the default would fail the check, so the app sets `status` explicitly. `profiles` has no INSERT policy because a SECURITY DEFINER trigger creates the row, and `user_notes` has no UPDATE policy because notes are only created and deleted. The `stars` table is documented here from the PLAN.md spec; `008_stars.sql` is being added in a separate PR.
