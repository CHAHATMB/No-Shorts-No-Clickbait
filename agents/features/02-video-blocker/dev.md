# Developer log

## Investigation
- Reminders are picked only in the background (`selectReminder`, `src/modules/watch-reminders.js`) and returned in the `deductTime` response to the counted tab (feature 03). Ticks arrive only while a video plays in the focused, visible `/watch` tab.
- Mascot categories: HYDRATION, EYE_STRAIN, BREAK, STOP_WATCHING, LATE_NIGHT. No separate daily watch limit setting exists. The STOP_WATCHING trigger (60 min watched + 2 dismissed reminders) is the existing "daily limit".
- The mascot's `onUserAction('close')` fires both for a user close and for auto-dismiss. So without a `mascot-controller.js` change, content cannot tell "acknowledged" from "ignored".

## Plan
1. Pure escalation in `watch-reminders.js`: when HYDRATION / EYE_STRAIN / BREAK is delivered, record `session.escalation = { category, watchTime, deliveredAt }`. On later ticks, `escalateReminder` decides:
   - video paused ≥ `ACKNOWLEDGE_PAUSE_MS` since delivery → acknowledged, so no block;
   - ≥ `BLOCK_GRACE_MS` more watch time → return `{ category, behavior: 'block' }` once.
2. STOP_WATCHING blocks straight away: `session.stopAllowedUntil = totalWatchTimeToday`. Any tick at or past it returns a stop block. `snoozeStopWatching` moves the limit by `STOP_SNOOZE_MS` (5 min of watching).
3. Background: new `snoozeStopWatching` message, queued like other watch-stat writes.
4. `src/modules/video-blocker/`: overlay inside `#movie_player`. It pauses the video and pauses it again on `play`. It shows a countdown, then Resume; for stop, it shows "Watch 5 more min". It is removed on `yt-navigate-start`. The CSS ships through the manifest's content-script CSS. The art is SVG with a reduced-motion media query.
5. Content: `behavior === 'block'` → `videoBlocker.show(category)`; while a block shows, the tab is not ready for new reminders.
6. Node tests for the escalation rules and snooze timing.
