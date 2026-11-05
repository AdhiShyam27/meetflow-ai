# Prompt log: Sort (feature 6, "Find things")

Agent: Claude Code. Branch: `feature/sort`. Issue #10.

## Owner instruction (Nov 4, 2026)

> do everything and make it and submit it now

Context given to the agent: PLAN.md feature 6:

> As a user, I want to search meetings by title and transcript text and sort them (newest first, oldest first, longest first, title A to Z), so that I can find a meeting in seconds.

Search by title and transcript already existed on the dashboard. Only the sort control was missing.

## Build prompt

> On `app/dashboard/page.tsx` add a sort control next to the search box and the Starred filter: a `<select>` styled like the search input with four options, Newest first (default), Oldest first, Longest first (duration descending), Title A to Z. Sorting runs after the search and starred filters. Put the comparison logic in a small pure `sortMeetings(list, key)` helper so it is easy to read and test. Keep the existing palette and rounded-xl style.

## Notes

- `localeCompare` with `sensitivity: "base"` is used for the title sort so "apple" and "Apple" sort together.
- The default stays "Newest first", which matches the order the API returns.
