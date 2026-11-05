# Prompts: dashboard stat test

Key prompts used to build the dashboard stat test (PLAN.md section 4, test 2). Recorded honestly: the owner's instruction to the coding agent was "do everything, make it and submit it now", followed by the brief below. The brief text is the prompt the agent worked from.

## Owner instruction

> do everything, make it and submit it now

## Brief given to the agent (relevant part)

> Test 2: Dashboard stat (branch test/dashboard-stat from updated origin/main after Test 1 merges). Given three completed meetings of 30, 60 and 90 minutes, when stats are computed, then totalMeetings is 3, totalHours is 3.0 and avgDuration is 60.
>
> 1. Create `lib/analytics/stats.ts` exporting `computeBasicStats(meetings: Array<{ duration: number | null }>)` returning `{ totalMeetings, totalHours, avgDuration }` with the exact arithmetic from app/api/analytics/route.ts (totalHours = +(seconds/3600).toFixed(1); avgDuration = Math.round(seconds/total/60) or 0). Refactor the route to use it (behaviour unchanged).
> 2. `tests/dashboard-stats.test.ts` asserting the scenario above and an empty-list case (0, 0, 0).
> 3. Red: change the avgDuration divisor or make totalHours use 60 instead of 3600, screenshot; revert; green.
> 4. prompts/test-dashboard-stat.md. Issue, PR, merge. Title "Add dashboard stat test (total meetings, hours, average duration)".

## Mid-task change from the owner's session

> The npm registry is unreachable from this container, so you cannot install Vitest. Use Node's built-in test runner instead. Node is v22.23, which strips TypeScript types natively, so write tests as `tests/*.test.ts` using `import { test } from "node:test"` and `import assert from "node:assert/strict"`, with relative imports (include the .ts extension) instead of the `@/` alias. Do not add devDependencies, do not run npm install.

## What the agent did with these prompts

- Extracted the three basic stat lines from `app/api/analytics/route.ts` into `lib/analytics/stats.ts` (same arithmetic) and made the route destructure the result. The other stats in the route are untouched.
- Wrote `tests/dashboard-stats.test.ts` with the 30/60/90 minute scenario (durations given in seconds, as stored), the empty-list case, and a null-duration case.
- Test runner is Node's built-in `node --test`; `npm test` runs both test files.
- Red evidence: changed the totalHours divisor from 3600 to 60, ran the test, captured the failing output (totalHours 180 instead of 3). Then restored 3600 and captured the passing output.
