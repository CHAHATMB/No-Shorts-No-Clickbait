# Verification

**Verdict:** VERIFIED

## Scope
Feature commits d4b27fc, 8dcb5c7, aaa324c, 586e357 change: `src/background.js`, `src/content.js`, `src/modules/time-tracker.js`, `src/modules/watch-reminders.js`, `src/modules/mascot/mascot-triggers.js`, `src/modules/mascot/mascot-controller.js` (11 lines), `tests/reminder-fixture.js`, `tests/watch-time.test.cjs`, `tests/test-lab.test.cjs`. (`git diff --stat d4b27fc~1 586e357` also lists mascot-character/styles and `tests/mascot.test.js`. Those changes come from feature 01 commits in the same range, so they are out of scope.)

Covered by: `tests/watch-time.test.cjs`, `tests/test-lab.test.cjs` (background Test Lab commands, now queued), `tests/mascot.html` (includes the reminder-fixture tests), and `tests/reminder-fixture.html` driven directly. `tests/test-lab.html` was not run because it covers the popup and previews, which this feature does not change.

## Checks run
| Check | Result |
|-------|--------|
| Build (affected browser) | `npm run build:chrome`: compiled successfully. Firefox was not built, because no Firefox browser is available to run it. |
| `node --test tests/watch-time.test.cjs tests/test-lab.test.cjs` | 51/51 pass |
| `tests/mascot.html` | 27/27 pass, including "Watch timer shows one walking mascot…" and "Disabling timer reminders or the break category prevents duplicate break triggers" |
| `tests/reminder-fixture.html` (manual drive, Playwright and chrome-devtools) | All scenarios below pass |
| Item #7 simulation (scratch Node script, real `background.js` in a VM with mocked `windows.getLastFocused`) | Pass, see below |

Notes: ports 8765 and 8766 were already held by another agent's server, so I served on 8793 and stopped it afterwards. The Playwright browser was shared with another agent, which navigated it away during one capture. Screenshot 04 was therefore retaken in an isolated chrome-devtools context.

## Feature scenarios
| Scenario | Result | Screenshot |
|----------|--------|------------|
| Two tabs/windows playing at once, only the focused active tab counts | Pass. Node: three simultaneous tabs are counted once (5s, not 15s). Item #7 sim: with both windows playing, only the focused window's tab counts on each tick. | (Node, no screenshot) |
| Paused video is not counted | Pass. Fixture: +60s while paused, 0 `deductTime` sent | 01-paused-hidden-not-counted.png |
| Hidden tab is not counted | Pass. Fixture: `document.hidden = true`, +60s, 0 `deductTime` sent | 01-paused-hidden-not-counted.png |
| Break reminder fires at the threshold | Pass. Total reaches 900s, text panel shows "15 minutes" | 02-break-reminder-at-15min.png |
| Reminder fires once (no repeat after Continue) | Pass. After Continue, 24 ticks of 5s (15:00 to 17:00) show 0 new panels. The next interval at 30:00 fires exactly 1 panel, as designed. | 03-no-repeat-then-next-interval-at-30min.png |
| Mascot path shows one mascot reminder, no legacy panel, video paused | Pass | 04-mascot-break-reminder-at-15min.png |
| Reminder held when the tab is not ready / dedupe through worker restart / tick and LeetCode bonus overlap | Pass (Node tests) | n/a |
| Item #7: two windows, switching, `WINDOW_ID_NONE` gap | Pass within mocks. Window 1 focused: A counts, B does not. Gap (last focused = 1, `focused: false`): neither counts, so 5s is dropped as expected. Window 2 focused: only B counts. Back to window 1: only A counts. Total 15s over 4 ticks, no double count. If focus is never reported (`focused: false` persistently), nothing counts, which confirms the Linux window-manager risk is real but not reproducible here. | n/a |

## Issues found
None blocking.
- By design, one tick (up to 5s) is dropped during a window-switch focus gap.
- On a window manager that never reports focus, no watch time is counted at all. This can only be confirmed on a real browser (see below).

## Needs manual check on live YouTube
- **Firefox window focus (review item #7):** with two Firefox windows, each playing a video, only the focused window's tab adds time. Switching windows moves the counting, with at most about 5s lost. Check Windows and Linux too, including a Linux window manager that may not report `focused`. Watch the popup total and `storage.local.totalWatchTimeToday`.
- Chrome with two tabs and two windows playing: the popup total grows at real-time rate, not 2x.
- Unfocused browser (another app in front) with a video playing: time does not grow.
- With the break reminder at 15 minutes: it shows once in the watched tab only. Switching to another YouTube tab, reloading, or navigating within the SPA does not re-show it.
- Service worker restart (`chrome://serviceworker-internals` → Stop) mid-session: totals are kept, and the reminder does not repeat.
- Fullscreen when the reminder threshold is crossed: the reminder is held and shown after leaving fullscreen.
- Site-time tracker: time is not added while the browser is unfocused or after all windows are closed (macOS).
