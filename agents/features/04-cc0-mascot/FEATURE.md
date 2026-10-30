# 04 — Replace Finn with a CC0 mascot

**Status:** READY_FOR_REVIEW

## Goal
The current mascot (Finn, Adventure Time) is copyrighted — a store-publishing risk. Replace it with a similarly cute, friendly character that is **CC0** licensed.

## Requirements
- Inventory every pose/frame the mascot uses today (walk frames in `mascots/walk_animation_asset/`, `shime*.png`, `all_animation.png`, and whatever `mascot-character.js` references). The replacement must cover all of them from **one consistent character/art set**.
- Source only CC0 art (e.g. Kenney.nl, OpenGameArt filtered to CC0, itch.io CC0 packs). Record source URL, author, license, and download date per file in `dev.md`. Save a copy of the license text/page in `mascots/LICENSE-<pack>.txt`.
- Put downloads in their own new empty directory under the scratchpad first; copy only the needed PNGs into `mascots/` (no scripts/executables from the archive).
- Similar size/proportion and friendly vibe to Finn; readable on both light and dark YouTube themes.
- Process frames like feature 01 did: one canvas size for all walk frames, feet on a shared baseline using an alpha threshold (>128), facing the direction of movement. Keep feature 01's timing (walk 1.6s, 120ms frame step) unless the new cycle's frame count needs a different step.
- Remove Finn's files (and `mascots/split_image.py` only if it exists solely for Finn and nothing references it) once replaced. Update any text that names Finn.
- Respect reduced motion; Chrome + Firefox builds.

## Acceptance criteria
- [ ] No Finn art or name remains in shipped code or `dist/`.
- [ ] Every mascot pose/state renders with the new character.
- [ ] Sprite size + feet-baseline tests pass for the new frames.
- [ ] License files committed; sources listed in `dev.md`.

## File ownership
- `mascots/**`, `src/modules/mascot/mascot-character.js`, `src/modules/mascot/mascot-styles.css`
- `webpack.config.js` / manifests only if asset paths change
- `tests/mascot.test.js`, `tests/mascot.html` — **ask the orchestrator first** (feature 02 is editing them right now)

Do NOT edit `mascot-controller.js`, `video-blocker`, `watch-reminders.js`, `content.js`, `background.js`.

## Edge cases
Light/dark theme, narrow viewport, reduced motion, Firefox, direction flip, frame-size consistency.
