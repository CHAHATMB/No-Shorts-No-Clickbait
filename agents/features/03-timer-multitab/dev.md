# Developer log

## Investigation
Line refs are to the pre-fix code (`a5de6a6`).

1. **Every YouTube tab counted and decided reminders independently.** `src/content.js:260-299` runs a 1s loop in each tab; any tab with a playing `<video>` on `/watch` sent `deductTime` (no hidden/focus check). Background playback, a second visible window, or two playing tabs all added time and deducted allowance (`src/background.js:322-335` accepts every message).
2. **Reminder baselines were per tab, in memory.** `lastReminderWatchTime` (`content.js:39,123`) is per tab and reset on page load; when tab A fired the 15-min break, tab B still had the old baseline, so it fired the same reminder as soon as the user switched to it. Mascot triggers had the same issue: `TriggerManager` cooldowns and `lastEvaluatedWatchTime` (`mascot-triggers.js:35,53`) start empty in every tab/reload, so hydration fired right after every reload once total time was past 30 min, and late-night/stop-watching fired once per tab.
3. **Service-worker restart lost or corrupted totals.** `deductTime` mutated in-memory globals (`background.js:322-328`) that are only loaded asynchronously at startup (`background.js:484-486`). A message that woke the worker ran against `totalWatchTimeToday = 0` / `remainingTime = 0` and saved them, which reset watch time and could broadcast a zero allowance (hard lock). `continueReminder`/`takeBreak` had the same race (`background.js:337-350`). No midnight reset happened until the hourly LeetCode alarm.
4. **Site-time tracker lost time on restart and counted unfocused time.** `time-tracker.js:8-10` kept the active tab/start time in module memory, so whatever accumulated before a worker suspend was dropped. It never listened to window focus, so time kept counting after the browser lost focus.

Multi-tab was the main cause of duplicates (1, 2); 3 and 4 explain lost/incorrect totals.

## Plan
1. Background is the only place that counts watch time and picks reminders; persist the reminder state.
2. Content reports ticks only (visible + playing); it shows whatever reminder the background returns.
3. All watch-stat writes queue behind a storage reload.
4. Site tracker state moves to storage and follows window focus.
5. Node tests for the counting rule and reminder dedupe.

## Decisions
- **Counting rule** (`isCountedWatchTab`): `sender.tab.active && focusedWindow.focused && tab.windowId === focusedWindow.id` using `browser.windows.getLastFocused()`. Content additionally skips sending when `document.hidden` or paused. Ticks are clamped to `MAX_WATCH_TICK_MS` (60s).
- **Readiness instead of acknowledgement**: content sends `reminderReady` (no fullscreen, no reminder panel, mascot offscreen). The background only evaluates when ready, so a busy tab defers a reminder instead of losing it. Avoids a second round trip.
- **Break reminder is now global**: one every `timerInterval` minutes of counted watch time per day (previously restarted on every page load). Changing the interval no longer resets the baseline.
- **Eye-strain "session"** is now global: it restarts after `SESSION_GAP_MS` (5 min) without counted watching, instead of on every page load.
- Reused `TriggerManager` in the background via new `exportState`/`restoreState`; mascot controller's local `evaluate` became `showTrigger` (display only).
- `tests/reminder-fixture.js` (not in the ownership list) had to answer `deductTime`, because reminders now come from the background response. It uses the real `selectReminder`.
- Site tracker writes the new start time before adding elapsed time, so a failed write can under-count but never double-count.

## Reminder-dispatch API (for feature 02)
- **Tick** (content → background): `browser.runtime.sendMessage({ action: 'deductTime', amount: ms, reminderReady: boolean })`, sent every `WATCH_TICK_MS` (5s) while a video plays in a visible `/watch` tab.
- **Decision** (`background.js` `recordWatchTick`, run in `queueWatchUpdate`): ignore unless the counting rule holds → reload state (`loadCodingSettings`) → add time/deduct allowance → `continueWatchSession(saved, today)` → if `reminderReady`, `selectReminder(session, stats, settings)` → save `watchSession` + stats in one `storage.local.set` → `broadcastStats` to all tabs.
- **Response** (the only delivery path, so it reaches only the counted tab): `{ counted: false }` or `{ counted: true, totalWatchTimeToday, reminder: null | { category, behavior, sessionStartTime } }`.
- **Display** (`content.js` `handleWatchTick`): if the page can no longer show it (hidden, fullscreen, mascot busy), the reminder is held in `pendingReminder` and shown on the next counted tick; meanwhile ticks send `reminderReady: false`. Then: `BREAK` → `showTimeReminder()` (mascot or text panel); other categories → `mascotController.showTrigger(reminder, watchData)`.
- **Dedupe state**: `storage.local.watchSession = { date, lastBreakWatchTime, sessionStartTime, lastTickTime, triggers: { cooldowns, lastEvaluatedWatchTime } }`; reset each day and by the Test Lab "reset today" command.
- To add an escalation (feature 02): add a branch to `selectReminder` (pure, in `src/modules/watch-reminders.js`) that records its own state in the session and returns a new `category`; handle that category in `handleWatchTick`.

## Commits
| Hash | Message |
|------|---------|
| d4b27fc | fix: persist site-time tracking across worker restarts and stop counting unfocused windows |
| 8dcb5c7 | fix: count watch time only in the focused tab and dispatch reminders once from the background |
| aaa324c | fix: queue LeetCode bonus and Test Lab stat writes behind watch-time updates |
| 586e357 | fix: hold undelivered reminders, drop tracking with no window open, and cover review gaps in tests |

## Tests added
`tests/watch-time.test.cjs` (Node, no dependencies):
- Counting rule: focused active tab counts; background tab, other window, unfocused browser, missing sender don't. Tick validation/clamp.
- Break reminder fires once per interval across simulated tabs/restarts (JSON round trip of the session); respects disabled settings; new day resets.
- Mascot hydration fires once through restarts; session gap rule.
- Background integration (real `background.js` in a VM): three simultaneous tabs → counted once, reminder delivered once, no repeat on tab switch or after a worker restart, nothing counted when unfocused.
- Site tracker: unfocused time not counted; time before a worker restart is kept.

Results: `npm test` 44/44 pass. `npm run build` OK. `npm run lint` 0 errors. `tests/mascot.html` 27/27 pass. `tests/test-lab.html` 16/17: "Popup fits within the browser action viewport" fails (603px > 600px). This change doesn't touch the popup, `popup.html` or `styles.css`, so the failure is unrelated (environment or another change).

## Round 2+ (responses to review)
Round 1 (review.md, 4be09e8):
1. major, fixed (aaa324c): the write phase of `updateSolvedProblems` (after the fetch) and the Test Lab command body now run in `queueWatchUpdate`; `testCommandQueue` is gone (its separate reload is now done by the queue). Test: "A watch tick overlapping a LeetCode bonus keeps both updates". It fails on 8dcb5c7 (remainingTime 55000) and passes now.
2. minor, fixed without a round trip (586e357): content keeps a reminder it couldn't show in `pendingReminder` and shows it on the next counted tick; `isReminderReady` now also checks `document.hidden`. It is lost only if the tab closes first.
3. minor, fixed: if `getLastFocused` rejects (no window open), the tracker treats it as no active tab and clears `siteTimeTracking`. Covered in the site-tracker test.
4. minor, fixed: removed the empty `updateTimerInterval` branch. The popup's unanswered `tabs.sendMessage` resolves to `undefined` through the polyfill, the same way as other actions this receiver ignores.
5. minor, fixed: `MINUTE_MS` is exported from `watch-reminders.js`. The Test Lab VM harness injects it the same way it already injects `MAX_DAILY_OVERRIDES`.
6. minor, skipped (follow-up): the dead `isPersistentActive`/`setPersistentActive`/`sessionStartTime` on the content-side `TriggerManager`. Removing them reaches into controller code that feature 01 is editing at the same time; this cleanup isn't part of this feature.
7. verify only: left for the verify agent (Firefox, two windows, switching windows).
Tests added: a `reminderReady: false` tick does not use up the reminder; a tick overlapping a bonus keeps both updates; the content loop sends nothing for paused, ended, or hidden tabs, non-`/watch` pages, or a page with no video (real `initializeTimeTracking`, sliced in the same way as `loadListener`); no credit after the browser window has been closed.
Results: `npm test` 52/52, build OK, mascot.html 27/27. test-lab.html 16/17; the same popup-height failure, which predates this feature (review.md).

## Open questions
- `TriggerManager.isPersistentActive`/`setPersistentActive` in the content-side manager are no longer read (the background decides). Left in place; can be removed later.
- Popup sends setting toggles only to the active tab (`popup.js:746-820`). Decisions now read storage so this no longer affects reminders, but other tabs' local display flags can be stale. Out of scope.
- Behavior change to confirm: the break reminder no longer restarts on page reload, and changing the interval doesn't reset its baseline.
