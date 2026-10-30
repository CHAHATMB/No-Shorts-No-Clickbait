# 02 — Video blocker overlay (escalation)

**Status:** READY_FOR_DEV

## Goal
The mascot reminder alone is easy to ignore. Add a video blocker that pauses the YouTube video and covers the player area with a dim, semi-transparent black overlay plus a simple animated GIF and short message.

## Requirements
- **Reminder types:** drink water, stretch, take a break / go away from screen, stop watching (limit reached).
- **Escalation (user decision):** the mascot reminder shows first. If the user ignores it and keeps watching (video still playing after a short grace period, e.g. ~30–60s — pick a sensible named constant), the blocker appears. "Stop watching" shows the blocker when the daily watch limit is reached.
- **On block:** pause the video; overlay covers the video player area only (not the whole page); dull black translucent background; centered GIF + one-line message.
- **Dismiss (user decision):** a countdown (e.g. 20–30s for water/stretch/break) and then a "Resume" button. For "stop watching", the user must take a deliberate action (e.g. "Watch 5 more min") to continue. The video must not auto-resume and must not play underneath the overlay. If the user tries to play it, pause it again.
- **GIFs:** bundled locally, one per reminder type, small file size. Download only CC0 or permissive-licensed GIFs (record source URL + license in `dev.md`), or build simple CSS/SVG animations instead if suitable licensed GIFs aren't available.
- The blocker appears only in the focused tab (uses the reminder dispatch from feature 03), once per escalation.
- Respect `prefers-reduced-motion` (static image or no animation).
- Works with YouTube SPA navigation and theater/fullscreen mode if feasible; document limitations.

## Acceptance criteria
- [ ] Unit tests cover the escalation decision logic (ignored → block; acknowledged → no block; limit reached → stop block; snooze timing). No UI tests.
- [ ] Build, `npm test`, and browser fixtures pass.
- [ ] Screenshots of each blocker type.

## File ownership
- New module(s) under `src/modules/video-blocker/` (JS + CSS) and new GIF/asset files
- `src/modules/watch-reminders.js`, `src/background.js`, `src/content.js` — escalation wiring only (feature 03 is VERIFIED; build on its reminder-dispatch API in `agents/features/03-timer-multitab/dev.md`)
- `webpack.config.js` / manifests only if needed to ship new assets
- `tests/*.test.cjs` for escalation logic

Feature 01 is still finishing in `mascot-character.js`, `mascot-styles.css`, `mascots/**` — do NOT edit those. If you need a hook in `mascot-controller.js` (e.g. "reminder acknowledged/dismissed" event), note it in dev.md and ask the orchestrator before editing.
