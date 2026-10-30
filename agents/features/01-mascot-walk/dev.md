# Developer log

## Investigation
- Finn's PNGs were tightly cropped to different sizes (right1-4: 114x179, 124x171, 115x166, 118x164; front 117x161; back 125x157). `.fg-mascot-img` uses `object-fit: contain` in a 140x180 box, so each frame got a different scale (1.006 to 1.098, about 9%) and was recentred. The character visibly grew, shrank and shifted on every frame. This was the main source of jitter.
- Grand/walk moved the container's `right` with an ease-out (plus overshoot keyframes on grand) while legs stepped at a constant rate. Ground speed didn't match the leg cadence: fast skating at first, then legs walking in place through the settle. Animating `right` also forced layout on every frame.
- `.fg-mascot-character` had its own bob plus a ±2deg rotate on a 400ms period, unsynced with the 560ms frame cycle. That added wobble.
- `.fg-mascot-img` had `transition: transform 0.15s`, so the direction flip squashed through scaleX(0) on arrival.
- Preloaded `Image` objects weren't kept referenced, so the frames could be evicted and blank-flash on swap.
- `mascots/all_animation.png` (8 frames per direction, already in the repo) was evaluated as a source. Its right-row frames have almost no leg motion; frame 1 is an outlier. Not used.

## Plan
1. Pad every Finn PNG onto one 138x179 canvas: feet on the bottom edge, hood centre on the horizontal centre, so mirroring doesn't shift him. Lossless copy, verified pixel-identical to the originals.
2. Grand/walk: animate `transform: translateX` linearly from just offscreen (`--fg-mascot-walk-offset` = inset + character width + 40px glow) to 0. Remove the bob/rotate/settle keyframes and the flip transition.
3. Frame interval 140 -> 120ms (`WALK_FRAME_INTERVAL_MS`), so 2 frames/step is about 34px/step at desktop, matching the stride.

## Decisions
- No downloaded art. The existing frames work once they're aligned. Swapping Finn for a CC0 character would be a product decision.
- Grand lost its spring-settle. The controller keeps the legs cycling until the container's `animationend`, so any settle played with walking legs.
- Durations: grand in/out 1.6s (stride-matched). Walk in 1.4s / out 1.1s, because the controller fallbacks (`mascot-controller.js`: walk 1500ms in / 1200ms out) would cut a longer animation. Walk therefore skates slightly (about 1.15x / 1.45x stride). Matching it needs those fallbacks raised to about 1.8s, but that file isn't in my ownership and has concurrent feature-03 edits.
- Known art limit (superseded in Round 3): right1's body sits about 7px higher than the other walk frames (same scale; eye spacing matches), which gives a small hop once per cycle.
- Narrow viewport: travel and sprite size both shrink by about 0.7x, so cadence stays matched.

## Commits
| Hash | Message |
|------|---------|
| e9df507 | fix: align Finn sprite frames on a shared bottom-anchored canvas |
| 46be793 | fix: walk the mascot at a constant, cadence-matched pace |
| 5b1340d | fix: give the walk entrance the stride-matched pace with safe fallback headroom |
| ebbd033 | fix: align Finn frames on opaque feet and face walk frames right |

## Tests added
- `tests/mascot.test.js`: every Finn sprite must share one natural size (regression guard for the root cause). Frame-advance tests now tick `MASCOTS.finn.walkFrameInterval` instead of a hard-coded 140.
- `tests/mascot.html`: 27/27 pass in fresh Playwright/Chrome contexts at 1280x900, 420x800 and reduced motion.
- Probe: grand walk-in starts offscreen (left 1320 of 1280px) and moves linearly (about 137px/s) to its resting spot.
- `npm run build` OK (chrome + firefox, both ship the new frames/CSS); `npm test` 44/44 pass.

## Round 2+ (responses to review)
- Orchestrator approved editing `mascot-controller.js` (feature 03 done) for review findings 1-3 only.
- Findings 1+2 (5b1340d): `walk` in/out is now 1.6s, the same as grand, so it's stride-matched with no skating. The walk entrance/exit fallbacks go from 1500/1200ms to 2000ms (400ms headroom). The CSS comment is trimmed to the linear-speed caveat.
- Finding 3 (5b1340d): the controller pose comment no longer refers to the removed walk-cycle CSS.
- Finding 4: left as is (acceptable per review).
- Re-ran: `npm run build` OK, `npm test` 52/52, `tests/mascot.html` 27/27 at desktop, 420px and reduced motion.

## Round 3 (verify failures)
- Baseline hop (ebbd033): round 1 aligned on alpha >= 1, and right1's faint halo reached the bottom while its opaque feet ended 8px higher. All frames are re-padded from the originals with the opaque (alpha > 128) feet on row 168 of a 136x179 canvas. Head tops now line up too (rows 11-12), so the earlier "body sits higher" note was wrong. The copy is still lossless (verified).
- Backwards walk (ebbd033): the `right*.png` frames were drawn facing left. They're mirrored in the PNGs so their names and the existing flip logic (`fg-mascot-facing-left` when moving left) are correct. No code change.
- Test: the sprite test now also asserts that every Finn frame has the same lowest opaque (alpha > 128) row. Against the round-1 assets it would fail (167 vs 175).
- Re-ran: `npm run build` OK, `npm test` 52/52, `tests/mascot.html` 27/27 at desktop, 420px and reduced motion.

## Open questions
- Finn is an Adventure Time (Cartoon Network) character. Shipping that likeness is a licensing risk that predates this feature.
