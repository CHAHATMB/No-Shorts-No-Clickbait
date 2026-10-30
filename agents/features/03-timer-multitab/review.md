# Quality review

## Round 1
**Commits reviewed:** d4b27fc, 8dcb5c7, 33ebdf3
**Verdict:** CHANGES_REQUESTED

Root-cause analysis is accurate. The design holds up: the background is the only place that counts and selects reminders, state is persisted, and the readiness flag defers reminders instead of dropping them. Counting rule verified: content sends only when visible, playing, and on `/watch`; background accepts only `sender.tab.active` in the focused last-focused window; content scripts run in the top frame only, so a tab cannot double-count through iframes. SPA navigation keeps the same content script, and reminder state is global, so navigation cannot refire a reminder. `npm test` 44/44 and `npm run build` pass.

### Findings
| # | Severity (blocker/major/minor) | File:line | Issue | Suggested fix |
|---|---|---|---|---|
| 1 | major | src/background.js:209, 279-311, 438 | Plan step 3 says all watch-stat writes queue behind a reload, but only ticks, `continueReminder`, and `takeBreak` do. `updateSolvedProblems` and `testCommandQueue` mutate the same globals (`remainingTime`, `totalWatchTimeToday`) outside `watchUpdateQueue`. Each 5s tick now runs `loadCodingSettings()`, which overwrites every global from storage. If a tick's `storage.get` resolves after `remainingTime += newMinutes` (line 309), the global falls back to the pre-bonus value and the tick saves it, so the LeetCode bonus is lost. Test Lab allowance and watch-time edits can be overwritten the same way. | Run the write phase of `updateSolvedProblems` (after the fetch) and the Test Lab command body through `queueWatchUpdate`, or merge `testCommandQueue` into it. Add a Node test: tick and bonus interleaved, then assert both are applied. |
| 2 | minor | src/content.js:283-292 | The background records a reminder as delivered before the tab shows it. If the tab goes fullscreen or hidden, or the mascot leaves `offscreen` between sending and the response, `showTimeReminder`/`showTrigger` return silently and the reminder is lost until the next interval. Rare, and much better than the old behaviour. | Accept and note it in dev.md, or have content report a reminder it could not show so the background rolls it back. Prefer accepting it; the fix adds a round trip. |
| 3 | minor | src/modules/time-tracker.js:183 | `windows.getLastFocused` rejects when no browser windows exist (macOS with the app still running). The queue catches the error, but the stored `{domain, startTime}` is kept. Reopening a window within an hour then credits the closed period to the old domain. | Clear `siteTimeTracking` when `getLastFocused` throws, or treat that as "no active tab". |
| 4 | minor | src/content.js:155-156 | The `updateTimerInterval` branch is now empty apart from a comment. | Remove the branch; nothing reads `timerInterval` in content any more. |
| 5 | minor | src/modules/watch-reminders.js:9, src/background.js:34 | `MINUTE_MS` is defined in both files. | Export it from `watch-reminders.js` and import it in background. |
| 6 | minor | src/modules/mascot/mascot-triggers.js / mascot-controller.js | The content-side `TriggerManager` no longer evaluates anything. `isPersistentActive`, `setPersistentActive` calls, and `sessionStartTime` on the content instance are dead (the developer flagged this). | Fine to defer; track it as follow-up cleanup, not part of this feature. |
| 7 | minor (verify) | src/background.js:219, time-tracker.js:183 | Firefox: not exercised on a real browser. On Windows and Linux, `onFocusChanged` can briefly report `WINDOW_ID_NONE` when you switch between browser windows. The site tracker handles this, because every sync re-reads the current state. A watch tick that lands in that gap is dropped (at most 5s). Some Linux window managers do not report focus reliably, so `focused` may stay false and nothing would count. | Verify agent: check counting on Firefox with two windows and after switching windows. |

### Test coverage assessment
- Good: the counting-rule table, the break and hydration dedupe through JSON round-trip restarts, the new-day reset, and the session-gap rule. The background VM integration test, with three simultaneous tabs, a tab switch, a worker restart, and an unfocused browser, is the most valuable test and matches the acceptance criteria. The site-tracker restart and unfocused test covers d4b27fc.
- Missing: (a) a test that `reminderReady: false` does not use up a reminder, even though the deferral design depends on it; (b) a concurrency test for finding 1; (c) the acceptance criterion "paused/hidden → not counted" is only enforced in the content loop (`content.js:257`) and has no test. The background rule covers hidden tabs (inactive tab or unfocused window). It does not cover a paused video. Add a small case using the existing `loadListener`-style slicing, or state in dev.md why it is not unit-tested.
- Unnecessary: none significant. The clamp test is cheap and guards the input validation.
- `tests/reminder-fixture.js` edit: justified. The mascot fixture's reminders now arrive only in the `deductTime` response, so without this the fixture would never show a reminder. It reuses the real `selectReminder`/`continueWatchSession` and does not reimplement them.
- Test Lab "Popup fits within browser action viewport" (603px > 600px): confirmed to predate this feature. `git diff 22805cd HEAD -- src/popup.* src/styles.css tests/test-lab*` is empty, so no popup input changed after 22805cd.

## Round 2
**Commits reviewed:** aaa324c, 586e357, 2d75bc1
**Verdict:** APPROVED

`npm test` 52/52 and `npm run build` pass.

### Round 1 findings
| # | Status | Notes |
|---|---|---|
| 1 | fixed | The LeetCode write phase runs inside `queueWatchUpdate` after the fetch. The outer `loadCodingSettings` is still needed to read the username. The Test Lab body uses the same queue, so `testCommandQueue` and its own reload are gone. All writers to `remainingTime`/`totalWatchTimeToday` are now serialized. The overlap test pauses the tick's storage read while the bonus completes, which is the race described in round 1. Not re-run against 8dcb5c7 here (the scratch copy was blocked); dev.md says it fails there. |
| 2 | fixed | `pendingReminder` holds a reminder the page could not show, and later ticks send `reminderReady: false`, so the background cannot pick a second one in the meantime. Adding `document.hidden` to `isReminderReady` closes the hidden-tab race. This is simpler than the rollback I suggested and adds no round trip. |
| 3 | fixed | `getLastFocused().catch(() => null)` is treated as no active tab. The test covers a 20-minute gap with no window open followed by reopening the window. |
| 4 | fixed | Branch removed. |
| 5 | fixed | `MINUTE_MS` is exported and the other constants are derived from it. The harness injection matches the existing `MAX_DAILY_OVERRIDES` pattern. |
| 6 | skipped, accepted | Feature 01 owns that controller code at the same time. Keep it as a follow-up. |
| 7 | open for verify | Firefox with two windows, and switching between windows. |

### New findings
| # | Severity | File:line | Issue | Suggested fix |
|---|---|---|---|---|
| 1 | minor | src/background.js:207-213, 438 | Test Lab validation `TypeError`s now pass through `queueWatchUpdate`, which also logs them as `[WatchTime] Update failed`. The caller still gets the right response. The only cost is console noise in dev builds. | Optional. Validate before queueing, or accept it. |
| 2 | minor | src/content.js:282-295 | There is no Node test for the `pendingReminder` hold-and-replay in `handleWatchTick`. The logic is small, and the background-side deferral test covers the contract, so this is acceptable. | Optional. Add a test using the same slicing as `contentTrackingLoop`. |

### Tests
The new tests are meaningful. They cover the `reminderReady: false` deferral (round 1 gap a), the tick/bonus overlap (gap b), and the content loop for paused, ended, hidden, non-`/watch` and no-video pages (gap c). The content test runs the real `initializeTimeTracking` source, not a copy. There are no unnecessary tests, and no over-engineering in the fixes.

### Cleanup re-check
- 930b711: `isPersistentActive` and `setPersistentActive` no longer appear anywhere in src/ or tests/. The only `evaluate` caller is `src/modules/watch-reminders.js:116`, which builds a fresh `TriggerManager` each tick and never set the flag, so the removed early return in `evaluate` never fired. The controller's manager is not evaluated anywhere. The `getDebugState` field had no readers. No behaviour change.
- 641f43d: this changes the fixture only. Webpack copies `src/modules/video-blocker/art` to `video-blocker/` (webpack.config.js:42), so the source `getURL('video-blocker/<name>.svg')` stays correct, and the fixture now maps that URL back to the source path.
- `npm test`: 66/66 pass. Round 1 finding #6 is resolved.
