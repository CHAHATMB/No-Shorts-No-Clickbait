# Verification

**Verdict:** VERIFIED

## Scope
Feature commits 4e6df82, 4563a47, b2ec13b, 038d94b:
- `mascots/scout/{front,back,right1-8}.png`, `mascots/LICENSE-kenney-toon-characters-1.txt`. Finn/BMO/Jake art, `all_animation.png` and `split_image.py` were deleted.
- `src/modules/mascot/mascot-character.js`, `mascot-styles.css`, `webpack.config.js`, `src/popup.html`
- `tests/mascot.test.js`, `tests/reminder-fixture.js`

These are covered by `tests/mascot.html` (served on port 8800, Playwright Chromium, a fresh context per run). Visual probes ran in the same page after its tests finished, using the real `MascotController`, `MascotAnimator`, `VideoBlocker`, CSS and PNGs. The popup check used `dist/chrome/popup.html` with mocked extension APIs.

## Checks run
| Check | Result |
|-------|--------|
| `npm run build` (Chrome + Firefox) | PASS, both compiled |
| `npm run lint` (`dist/firefox`) | PASS: 0 errors, 0 notices, 10 warnings. All warnings are `UNSAFE_VAR_ASSIGNMENT`/`DANGEROUS_EVAL` in bundled JS, and none are mascot-related |
| No Finn/BMO/Jake/shime in `dist/chrome`, `dist/firefox` | PASS. `grep -ril` finds no strings and `find` finds no file names. `dist/*/mascots/` holds only `scout/` with 10 PNGs |
| `tests/mascot.html` 1280x900 | PASS 27/27 |
| `tests/mascot.html` 420x800 | PASS 27/27 |
| `tests/mascot.html` 1280x900, reduced motion | PASS 27/27 |

The only console error is the known fixture 404 for `video-blocker/break.svg`. It comes from the fixture's `getURL` mapping and does not involve the mascot.

## Feature scenarios
| Scenario | Result | Screenshot |
|----------|--------|------------|
| Grand walk-in (live rAF log, 250 samples) | PASS. The image is 140x180 on every sample and top y stays at 72 (no hop). It moves only leftward, about 8.2px per 60ms frame, cycles right1-8 every 60ms and arrives on `front.png` at about 1610ms | 05 |
| Walk-out (live rAF log, 190 samples) | PASS. `back.png` shows for about 300ms, then right1-8 play while moving right. Size and y are constant | 06 |
| Facing matches direction | PASS. Every moving sample has `fg-mascot-facing-left` exactly when x decreases (0 mismatches). Visually he faces left on the way in and right on the way out | 05, 06 |
| Feet baseline | PASS. Every PNG is 172x220 with its bottom opaque row (alpha > 128) at 219. In the filmstrips the feet sit on the red line in every frame | 05, 06 |
| All states: idle/talking, drinking, waving, stern, sleepy, exit back | PASS. Each category renders Scout's `front.png` with its CSS pose. The exit renders `back.png` | 07, 08 |
| Light theme (`#fff`) and dark theme (`html[dark]`, `#0f0f0f`) | PASS. Readable on both. Dark adds the warm glow and a dark bubble | 05-08, 12, 13 |
| Next to the video-blocker overlay (BREAK) | PASS. The 854x480 overlay at x 24-878 and Scout at x 1102-1242 do not overlap. Checked on light and dark | 12, 13 |
| Narrow 420px | PASS. The sprite is 100x130 and arrives at x 304-404 inside the 420px viewport | 09, 10 |
| Reduced motion | PASS. No animations run and no frame interval starts. The state is `visible` at once with `front.png` and the bubble showing | 11 |
| Popup text | PASS. "Scout walks in with friendly reminders..." and "Choose which reminders Scout shows:" | 14 |

## Issues found
None blocking.
- Observation, not a regression: every pose uses the same `front.png` art and differs only by its CSS transform/animation. The same was true of Finn, because `MASCOT_POSES` are names only (see dev.md).

## Needs manual check on live YouTube
- Walk smoothness under YouTube's main-thread load. The frame step is now 60ms, twice as often as Finn's, so frame-swap jitter is more likely.
- Readability against real page content (thumbnails, masthead) in light and dark themes. Here the backgrounds were flat.
- Scout next to the real `#movie_player` in default, theater and miniplayer layouts. Scout should be hidden in fullscreen.
- Firefox: the unpacked extension shows Scout with the same walk, facing and reduced motion behavior. Only the build and lint were checked here.
- After updating, a user with a saved `mascotId` of `finn`/`bmo`/`jake` falls back to Scout.

## Screenshots
- `05-walk-in-filmstrip-light-facing-left.png`: t=120-1380ms in 180ms steps, frames 3,6,1,4,7,2,5,8, with a red line on the feet row
- `06-walk-out-filmstrip-dark-facing-right.png`: same timing for the exit
- `07-states-light-water-eye-break-stop-night-back.png`
- `08-states-dark-water-eye-break-stop-night-back.png`
- `09-narrow-420-walk-in-mid.png`
- `10-narrow-420-arrived.png`
- `11-reduced-motion-instant-arrival.png`
- `12-blocker-light.png`
- `13-blocker-dark.png`
- `14-popup-mascot-section-scout.png`
