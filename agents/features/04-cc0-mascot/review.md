# Quality review

## Round 1
**Commits reviewed:** e0940ae, 4e6df82, aea9932, 4563a47, 068e6a8, b2ec13b, 038d94b, a45830e
**Verdict:** APPROVED

### Checks
- Licensing: re-downloaded `kenney_toonCharacters1.zip` from OpenGameArt; SHA-256 matches `dev.md`. The OGA page lists the license as CC0 (Kenney, "All CC0" collection). The pack's `License.txt` matches the first 22 lines of `mascots/LICENSE-kenney-toon-characters-1.txt` (only the trailing newline differs). All 10 shipped PNGs are pixel-exact crops (max channel diff 0) of the `idle`, `back`, `walk0-7` cells of `Male adventurer/Tilesheet/character_maleAdventurer_sheetHD.png`. No other art ships.
- Completeness: `grep -ri "finn\|bmo\|jake"` over src, tests, mascots, webpack.config.js, manifests: no hits. No references to `shime`, `walk_animation_asset`, `split_image` or `all_animation` remain. After `npm run build:chrome` (webpack `clean: true`), `dist/chrome/mascots/` holds only `scout/` and has no Finn/shime strings. `dist/firefox` was stale (`finn/`, `shime1-3.png`) until I ran `npm run build:firefox`; it is clean now. The release zips in `extension/` have no mascot art.
- Frames: all 172x220. The bottom opaque row (alpha > 128) is 219 for every frame. Walk frames face right (screenshot 02), and `fg-mascot-facing-left` mirrors them. 60ms x 8 = 480ms per cycle, the same as Finn's 120ms x 4, so the stride matches the 1.6s walk. In the 140x180 box, `object-fit: contain` scales to about 140x179, close to Finn's 136x179.
- `image-rendering` removal: `.fg-mascot-img` was the only user in `src/`. That is correct for the smooth vector art, which is downscaled.
- Popup text: the three Finn strings are replaced. "Enable mascot" is neutral and survives a rename.
- Tests: `npm test` 66/66. `tests/mascot.html` 27/27 at 1280x900. `tests/test-lab.html` 16/17; the only failure is the known popup height (603px vs 600, unchanged). Console 404s (`favicon.ico`, `video-blocker/break.svg`) are unrelated.

### Findings
| # | Severity (blocker/major/minor) | File:line | Issue | Suggested fix |
|---|---|---|---|---|
| 1 | minor | src/modules/mascot/mascot-character.js:154 | `getCharacterSVG()` has no callers (dead code from before this feature). The change made it generic instead of only swapping the alt text. Harmless. | Optional: delete it in a separate cleanup. |
| 2 | minor | webpack.config.js:58 | The CC0 license text is not copied to `dist/`. CC0 does not require it, so this is informational only. | None required. |
| 3 | minor | dist/firefox | The Firefox bundle held Finn art until it was rebuilt. Verify must build both browsers before checking the "no Finn in dist/" criterion. | Verify: run `npm run build` first. |

No blocker or major findings. The change is small and matches the surrounding style. It adds no comment blocks.

### Test coverage assessment
The existing frame-advance, fallback and sprite size/feet-baseline tests now point at `MASCOTS.scout` and cover all 10 frames. Removing the `mascots/finn/` path remap from `tests/mascot.test.js` and `tests/reminder-fixture.js` is correct, because the source folder now matches the shipped path. No new tests are needed and none are superfluous.
