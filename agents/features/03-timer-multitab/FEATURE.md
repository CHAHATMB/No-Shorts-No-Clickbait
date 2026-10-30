# 03 — Fix watch timer & duplicate reminders with multiple tabs

**Status:** VERIFIED

## Goal
Watch time is not recorded correctly, and the same notification/reminder fires repeatedly. Likely cause: each open YouTube tab runs its own tracker/reminder logic independently. Confirm the actual root cause before fixing.

## Requirements
- **Counting rule (user decision):** only time in which a video is actually *playing* in the *focused, visible* tab counts. Background tabs, paused videos, and unfocused windows don't count. Two tabs never double-count.
- Reminders/notifications fire **once globally** per trigger, not once per tab, and only in the tab the user is watching.
- No repeated firing of the same reminder (e.g. after re-render, SPA navigation, tab switch, or service worker restart).
- Persisted time must survive the MV3 service worker being suspended/restarted.
- Keep the existing message-routing patterns in `background.js` / `content.js`.

## Acceptance criteria
- [ ] Root cause(s) documented in `dev.md`.
- [ ] Unit tests (Node, `tests/*.test.cjs`) cover the core counting rule and reminder de-duplication: two tabs playing → counted once/only focused; paused/hidden → not counted; reminder threshold crossed → fires once.
- [ ] `npm test` and `npm run build` pass; existing Test Lab tests still pass.

## File ownership
- `src/modules/time-tracker.js`
- `src/background.js`
- `src/content.js` (timer/reminder wiring only)
- `src/modules/mascot/mascot-triggers.js`, `mascot-controller.js` only for reminder-trigger/dedupe wiring
- `tests/*.test.cjs` and new test files for this logic

Do NOT edit `mascot-character.js`, `mascot-styles.css`, `mascots/**` (feature 01 owns them concurrently).

## Out of scope
Mascot visuals, the video blocker (feature 02 builds on this fix).

## Notes / dependencies
Feature 02 (video blocker escalation) depends on reminders firing correctly — keep the reminder-dispatch API clean and describe it in `dev.md` for the next agent.
