# Developer log

## Investigation
Poses/frames in use today:
- `MASCOTS.finn` (default, the only one that ships visibly): `idle` = `front.png`, `back` = `back.png` (exit pose), `walkFrames` = `right1-4.png` (4-frame cycle, 120ms step, right-facing, mirrored by `fg-mascot-facing-left`). Source `mascots/walk_animation_asset/`, copied to `dist/*/mascots/finn/` by `webpack.config.js`. All 136x179, opaque feet on row 168.
- `MASCOTS.bmo` -> `shime2.png` (BMO) and `MASCOTS.jake` -> `shime3.png` (Jake): single static frame each, used for idle/walk/back. Both are Adventure Time characters too. Only reachable through `settings.mascotId`, which nothing in `src/` writes.
- `shime1.png` (Finn idle, 128x128): copied to dist, referenced nowhere.
- `all_animation.png` (Finn 8x4 sheet): not shipped, not referenced. `split_image.py` reads `shime_animation.png` (not in repo) and is referenced nowhere.
- `MASCOT_POSES` (talking, waving, etc.) are names only; no art is mapped to them.
- "Finn" text also in `src/popup.html` (3 strings, not in my ownership), `getCharacterSVG()` alt, and tests (`tests/mascot.test.js`, path mapping in `tests/reminder-fixture.js`).

So the replacement needs front idle, back, and a right-facing walk cycle from one character.

## Plan
1. Source CC0 art with idle/back/walk from one set. Done: Kenney Toon Characters 1, "Male adventurer".
2. Crop idle, back, walk0-7 from the HD tilesheet (192x256 cells) onto one 172x220 canvas: idle's head centre on the canvas centre (no shift when mirrored), opaque (alpha > 128) feet on the bottom row (walk0 moved down 2px, others already on it). Output in `mascots/scout/` as `front.png`, `back.png`, `right1-8.png` (the names the tests already assert on).
3. Replace `MASCOTS.finn` with `scout` (8 walk frames), drop BMO/Jake, point webpack at `mascots/scout`, drop `image-rendering: pixelated` (the art is smooth vector art that gets scaled). Delete Finn/BMO/Jake art and `split_image.py`.
4. Needs orchestrator: test edits (`tests/mascot.test.js`) and the `src/popup.html` Finn text.

## Decisions
- Asset source (all files in `mascots/scout/`):
  - Pack: Toon Characters 1 by Kenney (www.kenney.nl), CC0 1.0.
  - Source page: https://opengameart.org/content/toon-characters-1 (uploader Kenney, license on page: CC0). Also https://kenney.nl/assets/toon-characters (license on page: Creative Commons CC0). kenney.nl's zip is behind a signed JS download link, so the archive came from OpenGameArt: https://opengameart.org/sites/default/files/kenney_toonCharacters1.zip (SHA-256 `54e58533...5f6297`).
  - Downloaded 2026-10-31. Files: `front.png` (idle), `back.png`, `right1-8.png` (walk0-7) cropped from `Male adventurer/Tilesheet/character_maleAdventurer_sheetHD.png`. License text in `mascots/LICENSE-kenney-toon-characters-1.txt`.
- Chose the HD sheet over the 96x128 pose PNGs: downscaling to the 140x180 box keeps it sharp; upscaling 96x128 would blur.
- Walk frames are drawn facing right (3/4 view), matching the existing flip logic.
- The 8-frame cycle covers two steps (walk0 and walk4 are opposite-leg contact poses), i.e. 4 frames per step vs Finn's 2. Step goes 120 -> 60ms so the leg cadence (240ms/step) still matches feature 01's stride-matched travel.
- Name "Scout" (id `scout`) is a placeholder of my choosing; easy to change.
- BMO/Jake removed rather than replaced: they are copyrighted, unreachable from the UI, and the spec asks for one character.

## Commits
| Hash | Message |
|------|---------|
| e0940ae | doc: start feature 04 and inventory current mascot frames |
| 4e6df82 | feat: add CC0 Kenney adventurer mascot frames aligned on a shared canvas |
| 4563a47 | chore: name adventurer frames front/back/right1-8 to match the mascot frame convention |
| b2ec13b | feat: replace Finn with the CC0 Scout mascot and its 8-frame walk cycle (also deletes Finn/BMO/Jake art, `all_animation.png`, `split_image.py`: they were already staged by `git rm`) |
| 038d94b | feat: name the mascot Scout in the popup settings |

## Tests added
- No new tests. Approved edits to `tests/mascot.test.js` point the existing frame-advance, fallback and sprite size/feet-baseline tests at `MASCOTS.scout`. The test and `tests/reminder-fixture.js` drop the `mascots/finn/` path mapping because the source folder now matches the shipped path.
- `npm test` 66/66. `npm run build:chrome` OK; `dist/chrome/mascots/` holds only `scout/`, and grep finds no finn/shime/bmo/jake in `dist/chrome`.
- `tests/mascot.html` 27/27 at 1280x900 (port 8797). The two console 404s (`favicon.ico`, `video-blocker/break.svg`) are unrelated to the mascot.
- Screenshots (real `MascotAnimator` + `mascot-styles.css`, light and dark backgrounds): `screenshots/01-idle-front.png`, `02-walk-right.png`, `03-walk-left-mirrored.png`, `04-exit-back.png`.

## Round 2+ (responses to review)

## Open questions
- Orchestrator approved the test, `reminder-fixture.js` and `src/popup.html` edits, plus removing BMO/Jake. "Scout" stays for now; the user may rename it.
- `getCharacterSVG()` has no callers (pre-existing dead code). I only removed its Finn name.
- Users with a saved `settings.mascotId` of `finn`/`bmo`/`jake` fall back to Scout via the existing `MASCOTS[id] || MASCOTS[DEFAULT_MASCOT_ID]` lookup.
