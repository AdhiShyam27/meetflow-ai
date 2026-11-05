# Prompt log: required-field validation

Tool: Claude Code (Claude Fable 5.1). Date: 2026-11-04.

## Owner's instruction

> do everything, make it and submit it now

followed by a brief listing the three documentation and validation PRs to produce. The relevant part for this branch:

## Prompt (spec section pasted as given)

> PLAN.md feature 4: required fields can't be left blank and show a friendly inline message. Audit and fix: (a) new meeting page: title required before starting a recording or saving (an inline red helper text under the input, not only a toast); (b) notes page: filename and content required with inline messages, and `app/api/notes/route.ts` POST returns 400 with a message when either is blank after trim; (c) signup: email and password required with inline messages (keep the existing 8-char password rule). Keep changes minimal and in the existing visual style (Tailwind, slate/indigo palette).

Follow-up from the coordinator mid-task: `npx tsc` is not available in the container (npm registry unreachable), so skip type-checking and re-read every edited file end to end before committing.

## What the agent did

1. Read `app/dashboard/new/page.tsx`, `app/dashboard/notes/page.tsx`, `app/signup/page.tsx` and `app/api/notes/route.ts`.
2. New meeting page: added `titleError` state, set it in `startRecording` when the title is blank (the toast stays), clear it on typing, show it on blur, and render a red helper text under the input with a red border.
3. Notes page: the page previously only accepted file uploads and had no filename or content inputs, so a compact "Write a note" form was added (filename input, content textarea, Save button) with inline messages for each blank field. It POSTs JSON to `/api/notes`.
4. Notes API: `POST /api/notes` now also accepts `application/json` `{ filename, content }`, trims both, and returns 400 with "Filename is required", "Content is required" or "Filename and content are required". The multipart upload path is unchanged apart from skipping files with an empty name.
5. Signup: replaced the password-only toast check with a `validate()` that sets inline messages for name, email and password (password keeps the 8-character rule), added `noValidate` to the form so the inline messages show instead of the browser popup.
6. Re-read every edited file end to end instead of running `tsc` (unavailable in the container).
