# Prompt log: Vercel build fix (follow-up to PR #13)

Agent: Claude Code. Branch: `fix/build-type-depth`. Issue #23.

## What went wrong

After PR #13 was merged, every Vercel production build failed. The build log said:

> ./app/api/meetings/route.ts:27:35
> Type error: Type instantiation is excessively deep and possibly infinite.
> 27 | const { data, error } = await listMeetingsForUser(supabase, user.id);

The agent that wrote PR #13 had flagged this exact risk in its hand-off ("the only type risk is `listMeetingsForUser(supabase, user.id)` inferring its row type from the real SupabaseClient, which I could not compile against") because the npm registry was unreachable and no local type-check was possible. PR #22 guarded the wrong thing (the `transcript` field) and did not fix it. I found the real error by reading the Vercel deployment log.

## Prompt

> In `lib/meetings/list.ts`, make the exported `MeetingsQueryClient` type shallow (`from(table: string): unknown`) so TypeScript does not try to compare the real `SupabaseClient` against a generic builder chain. Keep the chain shape as an internal type and cast `supabase.from("meetings")` to it. Do not change the query or the tests. Run `npm test` to confirm the fake client still satisfies the function.

## Result

`npm test`: 6 tests, 6 pass. Build verified on Vercel after merge.
