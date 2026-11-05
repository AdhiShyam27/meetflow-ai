# Prompt log: transcript type guard (follow-up to PR #13)

Agent: Claude Code. Branch: `fix/transcript-type-guard`. Issue #21.

## Why

The agent that wrote the data isolation test (PR #13) reported a risk it could not check without a full type-check: after `listMeetingsForUser` was extracted, the row type of `m.transcript` in GET /api/meetings might be inferred as `unknown` instead of `any`, and `decrypt(m.transcript, user.id)` would then fail the Vercel build.

## Prompt

> In `app/api/meetings/route.ts`, replace the truthiness check on `m.transcript` with a `typeof m.transcript === "string" && m.transcript.length > 0` guard before calling `decrypt`, so the route compiles whether the row type is `any` or `Record<string, unknown>`. No behaviour change for real rows.
