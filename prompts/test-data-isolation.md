# Prompts: data isolation test

Key prompts used to build the data isolation test (PLAN.md section 4, test 1). Recorded honestly: the owner's instruction to the coding agent was "do everything, make it and submit it now", followed by the brief below. The brief text is the prompt the agent worked from.

## Owner instruction

> do everything, make it and submit it now

## Brief given to the agent (relevant part)

> Test 1: Data isolation (branch test/data-isolation). Given User A has one meeting and User B has none, when User B lists meetings, then the list is empty and contains none of A's ids.
>
> 1. Create `lib/meetings/list.ts` exporting `listMeetingsForUser(supabase, userId)` that performs the exact query now inlined in GET /api/meetings (`from("meetings").select("*").eq("user_id", userId).order("created_at", { ascending: false })`) and returns `{ data, error }`. Refactor app/api/meetings/route.ts GET to call it (behaviour unchanged).
> 2. `tests/data-isolation.test.ts`: build a small in-memory fake Supabase query builder (from/select/eq/order chain) seeded with meetings for user A and user B; assert B gets [] and that none of A's ids appear; also assert A gets exactly A's meetings.
> 3. Add a test runner and a `"test"` script.
> 4. Red: remove the `.eq("user_id", userId)` line in lib/meetings/list.ts, run, screenshot; revert; green screenshot.
> 5. prompts/test-data-isolation.md. Issue, PR, merge. Title "Add data isolation test (User B cannot see User A's meetings)".

## Mid-task change from the owner's session

> The npm registry is unreachable from this container, so you cannot install Vitest. Use Node's built-in test runner instead. Node is v22.23, which strips TypeScript types natively, so write tests as `tests/*.test.ts` using `import { test } from "node:test"` and `import assert from "node:assert/strict"`, with relative imports (include the .ts extension) instead of the `@/` alias. Do not add devDependencies, do not run npm install.

## What the agent did with these prompts

- Extracted the meetings query into `lib/meetings/list.ts` and made the route call it. No behaviour change.
- Wrote `tests/data-isolation.test.ts` with a chainable in-memory fake (`from().select().eq().order()`) so the test runs the real query function with no database.
- Test runner is Node's built-in `node --test` (PLAN.md named Vitest; it could not be installed because the npm registry is blocked from the build container). `npm test` runs `node --test "tests/**/*.test.ts"`.
- Red evidence: removed the `.eq("user_id", userId)` line, ran the test, captured the failing output. Then restored the line and captured the passing output.
