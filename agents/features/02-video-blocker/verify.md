# Verification

**Verdict:** VERIFY_FAILED

## Scope
`git diff --stat bef35e8~1 4c00445 -- src tests`: `src/background.js`, `src/content.js`, `src/modules/watch-reminders.js`, `src/modules/video-blocker/{video-blocker.js,video-blocker.css,art/*.svg}`, `tests/watch-time.test.cjs`.
Covered by the escalation tests in `tests/watch-time.test.cjs` and by `tests/reminder-fixture.html` (real `content.js`, `VideoBlocker` and mascot; mocked runtime, video and clock).

Fixture harness, applied at runtime only (no files in `tests/` changed):
- Injected `video-blocker.css`, which the manifest ships but the fixture does not load, and wrapped the `<video>` in a 640×360 `#movie_player`.
- Mapped `getURL('video-blocker/*.svg')` to `src/modules/video-blocker/art/`.
- The fixture's settings enable BREAK only. For water, stretch and stop, `runtime.sendMessage` was replaced by a stand-in background that calls the real `selectReminder` / `selectBlock` / `deferEscalation` / `snoozeStopWatching` with only that category on, and `continueCountToday: 2` for stop.
- Watch time and wall time were advanced with the fixture's `advanceWatch` (5 s ticks). The 20 s countdown ran in real time because the fixture has no timeout clock control.

## Checks run
| Check | Result |
|-------|--------|
| Build (`npm run build:chrome`) | PASS. `dist/chrome` ships `video-blocker.css` and `video-blocker/{water,stretch,break,stop}.svg` |
| Targeted Node tests (`--test-name-pattern "Escalation\|Stop watching\|Blocks are selected\|fullscreen and holds"`) | PASS 13/13 |
| `tests/reminder-fixture.html` on port 8795 via Playwright | All scenarios run; one failure (see Issues) |

## Feature scenarios
| Scenario | Result | Screenshot |
|----------|--------|------------|
| BREAK: mascot at 15 min (video paused) → "Continue Watching" → no block at 40 s → block at 45 s; overlay matches player 640×360 | PASS | 01, 02 |
| BREAK acknowledged: mascot left up 45 s with the video paused (wall time advancing), then 45 s of play → no block | PASS | — |
| Resume after countdown: "Resume in 20s" … "1s"; button hidden until t≈20.0 s after show, then shown and focused; click → overlay gone, video plays, no new block over the next 60 s | PASS | 03 |
| Water (HYDRATION): mascot at 30 min → "Got it" → no block at 40 s → water block at 45 s | PASS | 04, 05 |
| Water acknowledged via "Take a Break" (video paused) → no block | PASS | — |
| Stretch (EYE_STRAIN): mascot at 20 min → "Got it" → stretch block at 45 s | PASS | 06, 07 |
| Play attempts while blocked (`play()` + `play` event) → paused again; checked on break, water, stretch and stop | PASS | — |
| Stop: block at exactly 60 min with no mascot first, and no countdown; play re-paused; "Watch 5 more min" → 1 `snoozeStopWatching`, `stopAllowedUntil` 60→65 min, plays; no block at 64:55; block again at 65:00 | PASS | 09 |
| Reduced motion (emulated `reduce`): overlay `animation-name: none`, 0 animated SVG nodes; with `no-preference` → `fg-video-blocker-in` and `fg-art-pulse` | PASS | 10 |
| Fullscreen on `#movie_player`: after a snooze, the stop block appears inside the fullscreen player (tick `reminderReady: false`, `blockReady: true`) | PASS | 11 |
| Fullscreen on an element outside the player: block shows and fullscreen is exited | PASS | — |
| Review finding 9: mascot left up while playing → water block at 45 s with the mascot still on screen; at 375 px wide the mascot covers the end of the block message | Observed (as review predicted) | 12 |
| Narrow viewport (375×667, 343×193 player): overlay fits the player; layout readable | PASS | 12 |
| SPA navigation, preview video after `#movie_player` in DOM: `yt-navigate-start` removes the block, `yt-navigate-finish` re-shows it on `#movie_player`, countdown restarts at 20 s | PASS | — |
| SPA navigation, preview video before `#movie_player` in DOM (review finding 7) | **FAIL** | 08 |

## Issues found
1. **Block re-shown after navigation attaches to a hover-preview video (review finding 7 confirmed in the fixture).** `VideoBlocker.show()` uses `document.querySelector('video')` (`src/modules/video-blocker/video-blocker.js:46`). With a preview `<video>` ahead of `#movie_player` in DOM order, the re-shown block was appended to the preview container and paused the preview. The `play` listener was on the preview too, so a `play()` on the main player was **not** re-paused and the main video played with no block over it. Whether live YouTube puts the preview first is unconfirmed, but the code does not guard against it. Suggested fix (per review): select `#movie_player video` first and fall back to `video`.

## Needs manual check on live YouTube
- DOM order of the home/search hover-preview `<video>` against the hidden or miniplayer `#movie_player video`. Start a block, navigate home, hover a thumbnail, navigate again, then check which player gets `#fg-video-blocker` and whether the main video can play.
- The overlay sits above `.ytp-chrome-bottom`, end-screen cards and ads in default, theater and native fullscreen (YouTube's fullscreen element) modes.
- The YouTube hotkeys `k`, space and media keys give at most a brief blip of playback before the re-pause.
- Firefox: the fetched `moz-extension://…/video-blocker/*.svg` loads, and the inlined SVG `<style>` animates under YouTube's CSP.
- Reduced motion with the OS setting (the fixture mocks `matchMedia` to always match).
- After a reload with the stop limit reached, the block returns within one tick (≤5 s), which is an accepted limitation.
- Mascot and block shown together (finding 9): check how it looks on a real narrow player.

## Re-verify (round 3)
**Verdict:** VERIFIED (affected scenarios only)

Run in a worktree at 20e21b3 (node_modules symlinked), served on port 8798, in a fresh Playwright context at 1280×800. No files in `src/` or `tests/` changed.
- `npm test`: 66/66 PASS. `npm run build:chrome`: compiles.
- Fixture harness, applied at runtime the same way as round 1: the CSS is injected, the main `<video>` is wrapped in a 640×360 `#movie_player`, a real hover-preview `<video>` is inserted **before** `#movie_player` in DOM order, and `getURL('video-blocker/*')` is mapped to `src/.../art/`. `runtime.sendMessage` is replaced by a stand-in that follows `background.js` `recordWatchTick`: `deferEscalation` / `selectReminder` / `selectBlock` on `reminderReady` / `blockReady` / `reminderPending`. The stand-in is needed because the stock fixture ignores `blockReady`.

| Scenario | Result | Screenshot |
|----------|--------|------------|
| Preview first: the mascot at 15 min pauses the main video (`_pauseVideo` → `#movie_player video`) | PASS | — |
| Preview first, mascot left up while playing (finding 9): no block at 40 s; BREAK block at 45 s inside `#movie_player`; mascot container gone; main video paused; `play` on the main video re-paused | PASS | 13 |
| Preview first, SPA navigation: `yt-navigate-start` removes the block; `yt-navigate-finish` re-shows it in `#movie_player`; the main `play` is re-paused; the countdown restarts at 20 s | PASS (round 1 FAIL fixed) | 14 |
| Blocker flow, preview first: "Continue Watching" (1 `continueReminder`, main video plays) → no block at 40 s → BREAK block at 45 s → "Resume in 1s" at ~19 s → Resume shown and focused at ~21 s → click resumes → no block over the next 60 s | PASS | 15 |
| `tests/mascot.html` at 1280×800 | PASS 27/27, including "Watch timer shows one walking mascot…" (the escalation assertion) | 16 |

The only console noise is the known fixture 404 for `video-blocker/break.svg` in `mascot.html` (dev.md). It does not affect the block.
The live-YouTube manual checks listed above are still open.
