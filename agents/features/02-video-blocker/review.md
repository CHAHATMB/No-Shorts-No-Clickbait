# Quality review

## Round 1
**Commits reviewed:** bef35e8, d44fe73, 905691c, aa28f58, de53027, 890d091
**Verdict:** CHANGES_REQUESTED

Verified independently:
- `npm test` 60/60. `npm run build` compiles chrome + firefox. Both `dist/*/` ship `video-blocker.css` and `video-blocker/{water,stretch,break,stop}.svg`.
- Escalation rules match the spec: delivery records `{ category, watchTime, deliveredAt }`. 45 s more watch time → one block. 30 s of pause (wall time minus watch time) → acknowledged. Pending holds other reminders, and the triggers stay deferred, not lost. LATE_NIGHT does not escalate.
- Overlay cleanup: `remove()` clears the countdown timeout and removes the video `play` listener and the document `yt-navigate-start` listener. The overlay listeners go with the element. `resume()` removes the overlay before `play()`, so the re-pause listener does not fire. A late `loadArt` appends to a detached node, which is harmless.
- Playing under the overlay: clicks and keydowns inside the overlay stop at the overlay. YouTube's document-level hotkeys (k, space, media keys) and the browser's media controls still call `play()`, but the `play` listener pauses again right away. At most there is a blip of audio. Acceptable.
- SVG safety: the `innerHTML` template is static, and the message is set with `textContent`. The art is fetched from the extension's own bundled files and parsed with `DOMParser` as `image/svg+xml`, so its scripts do not run. Nothing comes from page or user input. The same `innerHTML` pattern is already used in the content script.
- Reduced motion: `animation: none` on the overlay, and each inlined SVG has its own media query. The countdown is text only.
- Multi-tab: escalated blocks come only in the `deductTime` response to the counted tab, and are recorded in the session once. The stop block comes back in whichever tab plays next, as designed.

### Findings
| # | Severity (blocker/major/minor) | File:line | Issue | Suggested fix |
|---|---|---|---|---|
| 1 | major | src/modules/watch-reminders.js:96-98 | "Watch 5 more min" can be cut short to one tick. The `STOP_WATCHING` trigger has a 15 min *wall-clock* cooldown (`mascot-triggers.js:142`). When it fires again, it overwrites `stopAllowedUntil` with the current watch time and blocks. Say the user leaves the stop block up for 15 min or more, which is the behaviour we want, and then clicks "Watch 5 more min". The first tick, 5 s later, blocks again. Reproduced: block at 60 min, wait 16 min, snooze, next tick → `STOP_WATCHING` block, `stopAllowedUntil` = total. The same overwrite cuts any snooze that spans the 15 min mark. | Once `stopAllowedUntil` is finite, the trigger must not reset it. For example, return a stop block from the trigger branch only when there is no limit yet (`!Number.isFinite(session.stopAllowedUntil)`). Add a test: mock `Date`, wait past 15 min, snooze, then no block for `STOP_SNOOZE_MS` - one tick, then a block. |
| 2 | minor | src/modules/watch-reminders.js:76-79, src/content.js:291 | The grace period starts when the background *delivers* the reminder, not when it is *shown*. In fullscreen, content holds the reminder in `pendingReminder` while the video keeps playing. After fullscreen exits, the mascot shows, and the first ready tick blocks right away because more than 45 s has already passed. Similarly, a reminder held in tab A can escalate to a block in tab B, where it was never shown. | Start the grace on the first ready tick after delivery. For example, move `watchTime`/`deliveredAt` forward while ticks report `reminderReady: false` and the reminder hasn't been shown yet. Or confirm with the orchestrator that this is acceptable. |
| 3 | minor | src/modules/video-blocker/video-blocker.js:47, content.js:18 | Ways around the block, beyond the documented fullscreen deferral. (a) Clicking any related video (SPA navigation) removes a water, stretch or break block for good, which skips the countdown. (b) After navigation or reload, the stop block comes back only on the next counted tick, so the new video plays for up to `WATCH_TICK_MS` (5 s). (c) The miniplayer (ticks only on `/watch`) and fullscreen (`isReminderReady` false) never get the stop block. | Orchestrator decision. At minimum, record (a)-(c) as limitations in dev.md. If (a) should hold, keep the pending block and show it again on the next ready tick instead of dropping it. |
| 4 | minor | src/background.js:374-381 | The `snoozeStopWatching` handler accepts the message at any time. A stale stop overlay left in a second tab can extend the limit again after the first tab already snoozed. | Snooze only while blocked: `if (!(totalWatchTimeToday >= session.stopAllowedUntil)) return;`. |
| 5 | minor | tests/watch-time.test.cjs:51, :82 | The two existing tests now filter out `block` results. I checked the timelines, and this does not hide a regression. The filtered entries are the ignored escalations at 29 min (BREAK) and 31 min (HYDRATION), and the break and hydration timings are unchanged. Still, both tests now silently tolerate a block on any tick. | Assert the blocks explicitly instead of filtering. For example, expect `[29 min, 'BREAK', 'block']` in the break timeline, and in the cooldown test record behavior too and expect `[[30, 'HYDRATION', 'transient'], [31, 'HYDRATION', 'block']]`. |
| 6 | minor | src/modules/video-blocker/video-blocker.js:82-92, manifests | The art is fetched at runtime, which needs a `web_accessible_resources` entry that any page can probe. | Optional: import the SVGs as strings with webpack `asset/source` and parse them the same way. That drops the fetch, the async path and the WAR entry. |

### Notes for verify
- Firefox on real YouTube: check that the inlined SVG `<style>` animates. Page CSP could block inline styles that content scripts inject, though YouTube doesn't restrict `style-src` today. Check that `fetch(moz-extension://…)` works too.
- Check that the overlay sits above `.ytp-chrome-bottom` and the end-screen cards in default and theater mode on real YouTube. The dev only checked the fixture.

### Test coverage assessment
The escalation tests are meaningful. They cover the ignored, acknowledged and short-pause cases, BREAK at its exact boundaries, the stop block coming back, snooze timing, toggles, and a new day, with a JSON round trip on every tick. The gaps:
- Snooze across the trigger cooldown (finding 1). The fake `now` passed to `selectReminder` doesn't reach `TriggerManager.isInCooldown`, which reads `Date.now()`, so the current tests can't see the bug. Use `context.mock.timers` for `Date`.
- The snooze guard (finding 4) has no test.
- No UI tests for `VideoBlocker`, per the README.

## Round 2
**Commits reviewed:** 3ad05ff, 4c00445, 7792b3f
**Verdict:** APPROVED

Verified independently: `npm test` 65/65 and `npm run build` compile chrome + firefox. Orchestrator decisions taken as given: blocks show in fullscreen, "Got it" counts as ignored, and the stop trigger is kept.

### Round 1 findings
| # | Status | Notes |
|---|---|---|
| 1 | fixed | When `stopAllowedUntil` is already finite, a re-fired STOP_WATCHING trigger no longer resets it, and `selectBlock` owns the block. The new test drives `TriggerManager` through mocked `Date`. My round-1 repro now gives no block for the full snooze. |
| 2 | fixed, with one skip | `reminderPending` moves the grace baseline forward while content holds the reminder. Fullscreen sends `false`, so a held reminder escalates there, which matches decision 3. **The tab A → tab B skip is acceptable.** A reminder is held only if the page stops being ready between the tick and its response, or in fullscreen. Hidden tabs don't tick, and switching tabs exits fullscreen. So the window is small, and the cost is one block without the mascot first, not a lost or repeated block. A "shown" acknowledgement round trip is not worth it. |
| 3 | fixed / limitations accepted | Fullscreen goes through `blockReady` → `selectBlock`, and the overlay sits inside `#movie_player`. Navigation now removes the block and shows it again on `yt-navigate-finish`. Listeners are still cleaned up, and the `once` listener can't stack, because the start listener is removed in `remove()`. Keeping the reload gap (≤5 s) and the miniplayer gap is reasonable. |
| 4 | fixed | `snoozeStopWatching` is a no-op unless the user is blocked now, including when no limit is set (`undefined` → no-op). Tested. |
| 5 | fixed | Both timelines now assert the block explicitly. Nothing is filtered. |
| 6 | skipped, sound | The native-ESM fixture can't import `.svg`. The WAR entry exposes only four static SVGs. |

### New findings
| # | Severity | File:line | Issue | Suggested fix |
|---|---|---|---|---|
| 7 | minor | src/modules/video-blocker/video-blocker.js:30-34, :47 | The block is shown again on `yt-navigate-finish` against `document.querySelector('video')`. After navigation to home or search, that may be the miniplayer or hidden main player, as intended. It may also be the thumbnail hover-preview video, depending on DOM order. | Verify should check this on real YouTube. If it lands on the preview, scope the query to `#movie_player video`. |
| 8 | minor | src/modules/watch-reminders.js:114-117 | During a snooze, the stop trigger still fires every 15 min of wall time. It has priority 100, so that tick returns no reminder. A HYDRATION interval crossing on the same tick is lost, because the trigger state is saved with `lastEvaluatedWatchTime` advanced. This is rare, since it needs the same 5 s tick. | Acceptable. Optionally disable STOP_WATCHING in the `TriggerManager` once `stopAllowedUntil` is set, so lower-priority triggers can still win. |
| 9 | minor | src/content.js:271 | While the mascot shows the reminder, `blockReady` is true. So if the user keeps playing with the mascot up for 45 s, the block appears while the mascot is still on screen. That's consistent with "ignored", but two overlays show at once. | Verify should screenshot it. No code change unless the orchestrator objects. |

## Round 3 (re-check)
**Commits reviewed:** 2a49c41, 6d584a0, 69af02c, 4111f6b (6d584a0's message is wrong: it changes `watch-reminders.js` only; the mascot dismiss is in 2a49c41, as dev.md says)
**Verdict:** APPROVED

| # | Status | Notes |
|---|---|---|
| 7 | fixed | `findPlayerVideo()` (`#movie_player video`, falling back to `video`) is used by `VideoBlocker.show()`, the content tick loop, the text-panel pause and the mascot's `_pauseVideo`/`_resumeVideo` (69af02c, three lines). The only other generic queries left are `content.js:220` and `productivity-content.js:423`, which pause *all* videos, so they are fine. |
| 8 | fixed | Once `stopAllowedUntil` is finite, STOP_WATCHING is disabled in that call's `TriggerManager`, so a lower-priority trigger can win the tick. `selectBlock` still owns the limit. The manager is rebuilt on each call, so this does not persist past a new day. Removing the now-unreachable guard is correct. The new test covers the same-tick HYDRATION case. |
| 9 | fixed | After a block is shown, `mascotController?.dismiss('close')` runs. `'close'` doesn't call `onUserAction` stats, and `dismiss` is a no-op when offscreen. |
| mascot test | sound | 4111f6b pauses for 30 s to acknowledge, then lets the second reminder be ignored and asserts the BREAK block, the paused video, no mascot, and a re-pause on play. That matches escalation decision 2. The count stays at 27. |

No new findings. Note: the `findPlayerVideo` fallback can still pick a preview when `#movie_player` has no `<video>` (it shouldn't on `/watch`). Acceptable.
