# Verification

**Verdict:** VERIFY_FAILED

## Scope
Feature commits e9df507, 46be793, 5b1340d:
- `mascots/walk_animation_asset/{right1-4,front,back}.png` (re-padded to 138x179)
- `src/modules/mascot/mascot-character.js`, `mascot-styles.css`, `mascot-controller.js`
- `tests/mascot.test.js`

`git diff --stat e9df507~1 5b1340d` also lists feature 03 files (`background.js`, `content.js`, `time-tracker.js`, `watch-reminders.js`, `mascot-triggers.js`, `reminder-fixture.js`, `*.test.cjs`). Those belong to interleaved feature 03 commits and were not verified here.

Covered by `tests/mascot.html` plus a manual walk probe run in that page: real `MascotController`, real CSS/PNGs, Playwright Chromium.

## Checks run
| Check | Result |
|-------|--------|
| Build `npm run build:chrome` | PASS |
| `tests/mascot.html` 1280x900 | PASS 27/27 |
| `tests/mascot.html` 420x800 | PASS 27/27 |
| `tests/mascot.html` reduced motion | PASS 27/27 |

The only console error is a `favicon.ico` 404 from the static server.

## Feature scenarios
| Scenario | Result | Screenshot |
|----------|--------|------------|
| Grand walk-in, paused mid-walk | Box stays 140x180 on every frame, no rescale | 01, 04 |
| Grand walk-out, paused mid-walk | Box stays 140x180 on every frame, no rescale | 02, 05 |
| Arrival: front pose, walk stops | PASS | 03 |
| Horizontal motion (live rAF log) | PASS. Linear 16.4px per 120ms frame (136.5px/s), 1.6s, frames step every 120ms, ends on `front.png` at about 1610ms | 04, 05 |
| Feet on one baseline across walk frames | **FAIL**. The visible feet bottom (alpha >= 128) is at row 168 in right1, 176 in right2, 174 in right3 and 176 in right4. Rendered, the bottom is at y=243 for right1 and 250-251 for the others: an 8px hop once per 4-frame cycle, every 480ms | 04, 05, 06 |
| Facing matches direction of travel | **FAIL** (pre-existing). The native `right*.png` frames face viewer-left, but `startWalk('left')` adds `fg-mascot-facing-left` (scaleX(-1)), so the entrance moving left faces right, and the exit moving right faces left. Finn walks backwards both ways | 01, 02, 04, 05 |
| Narrow 420px | Sprite 100x130, offset `inset + 100px + 40px`, walks in on-screen | 07 |
| Reduced motion | PASS. No animations, no frame interval, immediate `visible` with `front.png` | 08 |

## Issues found
1. **right1 baseline hop (major for the acceptance criterion "no visible jitter/jumps").** e9df507 aligned the frames on alpha >= 1, but right1 has a faint halo reaching the bottom edge while its opaque feet end about 8px higher (rows 169-178 have no opaque pixels). The review's "every frame's alpha bbox touches the bottom edge" check passed on that halo. dev.md calls this a "body sits ~7px higher" art limit, but the feet sit higher too. Fix: shift right1 down about 8px on its canvas (and right3 about 2px), aligning on the opaque feet row. Optionally strengthen the size test to check the opaque-bottom row.
2. **Backwards walking (fails "Direction changes look correct").** This predates the feature: the flip logic and sprite orientation are unchanged. Fix: either invert the flip (apply scaleX(-1) when walking right) or mirror the PNGs. `tests/mascot.test.js:177,198` assert the class names and would need updating to match.

## Needs manual check on live YouTube
- Walk smoothness under YouTube's main-thread load: 120ms frame interval jitter against the compositor transform.
- Entrance doesn't snap at the 2000ms walk fallback or the 3500ms grand fallback on a busy page.
- Placement and walk at the narrow viewport and in theater/fullscreen mode, plus dark/light theme.
- Firefox build: the same walk, flip and reduced-motion behavior. Only Chrome was built here.
- After issues 1 and 2 are fixed, re-check the hop and the facing visually.

## Screenshots
- `01-grand-walk-in-mid-frame2-facing-left.png`
- `02-grand-walk-out-mid-frame3-facing-right.png`
- `03-arrived-idle.png`
- `04-grand-walk-in-filmstrip-8-frames.png`: t=700-1540ms, one frame per 120ms
- `05-grand-walk-out-filmstrip-8-frames.png`: t=100-940ms
- `06-walk-frames-baseline-red-line.png`: right1-4 at 3x with a red line at the right2/right4 feet row
- `07-narrow-420-grand-walk-in-mid.png`
- `08-reduced-motion-no-walk-instant-arrival.png`

## Re-verify (round 3: ebbd033, 7fe721f)
**Verdict:** VERIFIED. This re-verify covered only the two failures above.

| Check | Result | Screenshot |
|-------|--------|------------|
| `npm run build:chrome` | PASS | |
| `tests/mascot.html` 1280x900 | PASS 27/27 | |
| Opaque-feet baseline, PNGs (alpha >= 128) | PASS. All six frames are 136x179, and the opaque bbox bottom is row 168 in every one | 13 |
| Rendered baseline, paused walk-in/out, 8 frames each | PASS. The lowest outline row is y=240 in all 16 samples, except walk-in t=700ms (238), where the trailing foot is clipped by the viewport edge | 11, 12 |
| Facing, entrance (moves left, `fg-mascot-facing-left`) | PASS. Faces left: eyes left, backpack right | 09, 11 |
| Facing, exit (moves right, unflipped) | PASS. Faces right | 10, 12 |

Linear motion was unchanged: 16.38px per 120ms frame.

Screenshots:
- `09-r3-grand-walk-in-mid-faces-left.png`
- `10-r3-grand-walk-out-mid-faces-right.png`
- `11-r3-grand-walk-in-filmstrip-8-frames.png`
- `12-r3-grand-walk-out-filmstrip-8-frames.png`
- `13-r3-walk-frames-baseline-red-line.png`

Screenshots 01-08 show the pre-fix state.

The "Needs manual check on live YouTube" items still apply, except that the hop and facing are now resolved in the fixture.
