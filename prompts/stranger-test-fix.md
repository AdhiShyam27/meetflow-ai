# Prompt log: stranger test fix (Reflection 2)

Agent: Claude Code. Branch: `fix/stranger-test-setup-steps`. Issue #25.

## Owner's stranger-test notes (Nov 4, 2026, a friend not in the class, 10 minutes unaided)

> 1. the voice recognition is a bit slow
> 2. the setup on Google Chrome is a bit lengthy and not clear
> 3. it's good but it needs more languages, it would be better

The owner chose to fix struggle 2 and leave 1 and 3 for now.

## Prompt

> On `app/dashboard/new/page.tsx`, replace the "How it works" paragraph shown for Remote call mode with a numbered 4-step checklist that matches what Chrome actually shows: open the call in another tab, click Start Transcription, choose "Chrome Tab" and pick the meeting tab, tick "Also share tab audio" then Share. Say what happens if step 4 is skipped (the "No audio captured" error). For In-person mode, say that Chrome asks for mic permission once. Keep the amber info-box style and do not change any recording logic.
