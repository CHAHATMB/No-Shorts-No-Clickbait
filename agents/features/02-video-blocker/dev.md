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

## Decisions
- **Category → blocker type:** HYDRATION → water, EYE_STRAIN → stretch (its messages are about resting your eyes and stretching), BREAK → break / step away, STOP_WATCHING → stop. LATE_NIGHT does not escalate (it isn't in the spec).
- **"Daily limit" = the existing STOP_WATCHING trigger** (`stopWatchingThresholdMs` 60 min + 2 dismissals). It blocks straight away, with no mascot first. The block comes back on every play past `stopAllowedUntil`, including after reload or SPA navigation, until "Watch 5 more min". That button adds `STOP_SNOOZE_MS` of *watch time*, not wall-clock time. Disabling the mascot or the stop category lifts the block.
- **Ignored vs acknowledged needs no mascot hook:** grace is `BLOCK_GRACE_MS` = 45 s of counted watch time after delivery. Pausing for `ACKNOWLEDGE_PAUSE_MS` = 30 s in total (wall time minus watch time) counts as acknowledged. Clicking "Got it" or "Continue Watching" and then playing on counts as ignored. `mascot-controller.js` was not touched.
- While an escalation is pending, no other reminder is selected. Triggers are deferred, not lost: TriggerManager compares interval counts.
- **Block delivery** reuses the feature 03 path: `reminder.behavior === 'block'` (`BLOCK_BEHAVIOR`). `isReminderReady` is false while a block shows. Each escalation is delivered once. A water, stretch or break block that SPA navigation removes is not shown again.
- **Overlay:** appended to `#movie_player` (fallback: the video's parent), so it covers only the player in default and theater mode. Background `rgba(0,0,0,0.82)`. It calls `pause()` again on every `play` event, and it stops click/keydown from reaching the player. The countdown (`COUNTDOWN_SECONDS` = 20) uses chained `setTimeout`. The fixture treats every `setInterval(…, 1000)` as the tracking loop, so `setInterval` would break it. Resume / "Watch 5 more min" call `play()` only on that click. It is removed on `yt-navigate-start`.
- **Art (no GIFs):** I found no small CC0 GIFs for these four subjects quickly (a Commons search only turned up unrelated or CC BY-SA files). Per the spec fallback, I drew four original SVG animations: `src/modules/video-blocker/art/{water,stretch,break,stop}.svg`, 0.5–1 KB each. They are my own work, with no third-party source or licence and no characters. They are fetched and inlined rather than used as `<img>`: under emulated `prefers-reduced-motion`, the media query inside an SVG image did not stop its animation. Inlined, it does. Classes, keyframes and ids are `fg-art-`-prefixed because they become page-global.
- **Shipping:** webpack copies `video-blocker.css` and `art/` → `video-blocker/`. Both manifests add `video-blocker.css` to the YouTube content-script CSS and `video-blocker/*` to `web_accessible_resources`.
- **Limitation, fullscreen:** blocks wait until fullscreen ends, because feature 03's `isReminderReady` already defers all reminders in fullscreen. The overlay would render inside the fullscreen player, but changing that gate affects every reminder. Left as is.

## Commits
| Hash | Message |
|------|---------|
| bef35e8 | doc: start feature 02 developer log with escalation plan |
| d44fe73 | feat: escalate ignored reminders and the daily stop limit to a video block |
| 905691c | feat: add player-scoped video blocker overlay with bundled SVG animations |
| aa28f58 | feat: show escalated video blocks and snooze the stop-watching limit |
| de53027 | fix: inline blocker art so reduced motion applies, and keep the countdown off setInterval |

## Tests added
`tests/watch-time.test.cjs` (pure `selectReminder` / `escalateReminder` / `snoozeStopWatching`, with a JSON round trip of the session on every tick):
- Ignored → exactly one block at grace; acknowledged (30 s pause) → no block; a shorter pause still blocks; BREAK uses the same rule (`ignored` / `pending` / `acknowledged` boundaries).
- Stop limit → immediate block, again on the next play; snooze → none for 5 min of watching, then a block; the stop or mascot toggle lifts it; a new day clears the escalation state.
- Two existing dedupe tests now ignore `block` deliveries, since the new escalation correctly fires in their timelines.

Results: `npm test` 60/60. `npm run build` OK. `npm run lint` 0 errors (the 10 warnings are pre-existing `innerHTML`/eval ones; none from the new module).
Self-check (`tests/reminder-fixture.html?mascot=false`, port 8790, stopped afterwards): real content → background path. Break panel → Continue → playing 45 s → BREAK block, video paused, `play` re-paused, countdown 20 → Resume focused → click resumes. Direct module checks: the overlay matches the player rect, stop snooze calls back and resumes, `yt-navigate-start` removes the block and its play listener, LATE_NIGHT is ignored, reduced motion gives `animation-name: none` on the overlay and all art, and the layout works on a 320×180 player. No screenshots were committed (they are the verify agent's job).

## Open questions
- Is the STOP_WATCHING trigger (60 min + 2 dismissals) the intended "daily watch limit", or do you want a configurable limit setting? (That means popup changes, which are out of this feature's ownership.)
- Is it right to treat "Got it" / "Continue Watching" followed by more playback as ignoring? The alternative needs a `mascot-controller.js` hook that tells a user close apart from auto-dismiss (`onUserAction('close')` fires for both). I didn't edit the controller.
- Should blocks be allowed in fullscreen? This needs a fullscreen-specific readiness rule in `content.js`.

## Round 2+ (responses to review)
Orchestrator decisions: (1) keep the STOP_WATCHING trigger as the daily limit; (2) "Got it" / "Continue Watching" and then playing on still counts as ignored, and there is no controller hook; (3) blocks show in fullscreen. Decision 3 replaces the fullscreen limitation and open question above.

Round 1 (review.md, 66d7974):
1. major, fixed (3ad05ff): a re-fired STOP_WATCHING trigger no longer touches a limit that is already set (`selectReminder` returns no reminder when `stopAllowedUntil` is finite; `selectBlock` handles the block). Test "a snooze after the trigger cooldown has passed is not cut short" mocks `Date` via `context.mock.timers` (passed to `playFor` as `clock`). It failed before the fix and passes now.
2. minor, fixed (3ad05ff): a tick now carries `reminderPending` (content still holds an undelivered reminder). The background then moves the escalation baseline forward (`deferEscalation`), so the grace starts once the reminder is shown. In fullscreen, content sends `reminderPending: false`: the mascot can't show there, so the held reminder escalates to a block after the grace (decision 3). A block clears a held reminder of the same category. Remaining edge: a reminder held in tab A, with the user then watching in tab B, can still escalate in B. Fixing that needs a "shown" acknowledgement round trip plus expiry for tabs that close. I judged that over-engineering for a rare case.
3. minor:
   - fullscreen, fixed (3ad05ff, 4c00445): ticks send `blockReady` (no block already up). When the mascot can't show, the background runs `selectBlock` (stop limit + escalations only). The overlay lives in `#movie_player`, so it is inside YouTube's fullscreen element; if the fullscreen element doesn't contain the player, `show()` exits fullscreen.
   - (a) SPA navigation, fixed (4c00445): on `yt-navigate-start` the overlay and its listeners are still cleaned up, then the same block is shown again on `yt-navigate-finish`. The countdown restarts at 20 s.
   - (b) reload, limitation kept: after a full reload the stop block comes back on the first counted tick (≤ `WATCH_TICK_MS`, ~5 s of play). Closing that needs a startup storage check in content; skipped as over-engineering for a 5 s window.
   - (c) miniplayer, limitation kept: an existing block stays with the player into the miniplayer (fix (a)). A *new* block can't start there, because feature 03 counts watch time only on `/watch`, and changing the counting rule is out of scope.
4. minor, fixed (3ad05ff): `snoozeStopWatching` extends the limit only while blocked (`total >= stopAllowedUntil`), so a stale overlay in another tab can't extend an active snooze. Tested.
5. minor, fixed (3ad05ff): the break timeline now expects `BREAK block` at 29 min, and the cooldown test expects `[[30, HYDRATION, transient], [31, HYDRATION, block]]`. Nothing is filtered.
6. optional, skipped: webpack `asset/source` would remove the fetch and the WAR entry. But `tests/reminder-fixture.html` loads `src/` as native ES modules, where an `.svg` import fails, so the fixture would break. The WAR entry only exposes four static SVGs.

Tests added: the cooldown/snooze reproduction, the snooze guard, the grace held while a reminder waits, `selectBlock` (blocks only, never mascot reminders), and a background integration test for `blockReady` / `reminderPending`.
Results: `npm test` 65/65. `npm run build` OK. `npm run lint` 0 errors (10 pre-existing warnings). Fixture self-check (port 8790, stopped): the BREAK block came after 45 s of play, the ticks carry the new flags, and `yt-navigate-start` → overlay gone → `yt-navigate-finish` → BREAK block back with the video paused again.

| Hash | Message |
|------|---------|
| 3ad05ff | fix: keep stop snoozes past the trigger cooldown, start grace on display, and show blocks in fullscreen |
| 4c00445 | fix: put the video block back after SPA navigation and over non-player fullscreen |
