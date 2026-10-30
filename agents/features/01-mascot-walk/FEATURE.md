# 01 — Smooth mascot walk animation

**Status:** READY_FOR_DEV

## Goal
The mascot's walk animation is choppy and feels poor. Make walking look smooth and natural.

## Requirements
- Diagnose why the current walk looks bad (frame count, frame timing, sprite alignment/jitter between frames, movement speed vs. frame rate, CSS vs. JS stepping, etc.). Record root cause in `dev.md`.
- Fix it. Improving the existing frames/timing is preferred if it gets a good result. If the existing frames are fundamentally insufficient, a replacement walk sprite/animation may be downloaded from the internet **only if CC0 or similarly permissive license**; bundle it locally under `mascots/` and the extension source, record source URL + license in `dev.md`. No remote loading at runtime.
- Respect `prefers-reduced-motion` (existing behavior must remain).
- Must work in Chrome and Firefox builds.

## Acceptance criteria
- [ ] Walk cycle has no visible jitter/jumps between frames; horizontal movement is continuous and matches leg cadence.
- [ ] Direction changes (left/right) look correct.
- [ ] Reduced motion still disables/limits animation.
- [ ] `tests/mascot.html` all pass (update tests if behavior intentionally changed).
- [ ] `npm run build` and `npm test` pass.

## File ownership
- `src/modules/mascot/mascot-character.js`
- `src/modules/mascot/mascot-styles.css`
- `mascots/**` and any new mascot asset files
- `tests/mascot.html`, `tests/mascot.test.js`
- `webpack.config.js` only if new assets need copying

Do NOT edit `src/modules/time-tracker.js`, `src/background.js`, `src/content.js` (feature 03 owns them concurrently).

## Out of scope
Reminder content, trigger logic, the video blocker (feature 02).
