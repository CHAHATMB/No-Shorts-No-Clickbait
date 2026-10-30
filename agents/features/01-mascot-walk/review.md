# Quality review

## Round 1
**Commits reviewed:** e9df507, 46be793, de1477a, 1ff79da
**Verdict:** APPROVED

Verified independently:
- Sprite padding is lossless: each new PNG contains the original pixel-for-pixel (RGBA diff empty) with only transparent padding around it. All six are 138x179 RGBA, and every frame's alpha bbox touches the bottom edge, so the feet share one baseline.
- `--fg-mascot-walk-offset` resolves against the overridden `--fg-mascot-character-width` in the `max-width`/`max-height: 500px` queries, because both are declared on `#fg-mascot-container`. The container has no fixed-position descendants, so the new container `transform` doesn't change layout.
- Reduced motion: `animation: none` on the enter/exit classes also drops the new transform keyframes, and the existing `right` overrides still apply. The controller fallback is 0ms there.
- Direction flip: `scaleX(-1) !important` is now instant, with no squash through 0.
- No orphaned keyframes are left. Every remaining `@keyframes` is referenced.
- `npm test` 44/44, `npm run build` compiles chrome + firefox, and both `dist/*/mascots/finn/` ship the padded frames and the new CSS. `tests/mascot.html` 27/27 in a fresh Chromium context.

### Findings
| # | Severity (blocker/major/minor) | File:line | Issue | Suggested fix |
|---|---|---|---|---|
| 1 | minor | mascot-styles.css:266,298 / mascot-controller.js:246,373 | `walk` is 1.4s in / 1.1s out against fallbacks of 1500 / 1200ms. That leaves 100ms of headroom, where the old durations had 300ms. If YouTube's main thread delays the animation start by more than about 100ms, the entrance fallback fires first: `className = 'fg-mascot-visible'` drops the animation and the mascot snaps about 15px to rest. Exit is harmless, because the mascot is already off-screen by then. | Follow-up in the controller's owner: raise the walk fallbacks to about 2000ms, then give `walk` the same 1.6s as `grand`. See the timer note. |
| 2 | minor | mascot-styles.css:256-260 | A 5-line comment couples the CSS to the controller timers. It's a real caveat, but it goes stale once finding 1 is fixed. | Trim or remove it when the walk durations are unified. |
| 3 | minor | mascot-controller.js:201 (not owned) | The comment "use 'idle' during grand entrance to avoid conflicts with walk cycle CSS" refers to the walk-cycle keyframes this feature removed. | Update it whenever that file is next touched. |
| 4 | minor | tests/mascot.test.js:316 | The size test catches mixed canvas sizes but not misaligned feet on a shared canvas. | Acceptable as is. Optionally also assert that the bottom row is opaque. Not required. |

### Timer note
The bump is needed less for the skating, which is cosmetic, than for the 100ms margin in finding 1. It's safe: the fallback only acts when `animationend` doesn't fire, reduced motion uses 0ms, and the tests dispatch `animationend` themselves, so they won't change. 1.8s against a 1.6s animation leaves only 200ms of margin. Prefer about 2000ms for both walk-in and walk-out, which matches grand's existing at-least-900ms headroom more closely.

### Test coverage assessment
The sprite-size test directly guards the root cause and is cheap. It's the right amount. Replacing the hard-coded 140 with `MASCOTS.finn.walkFrameInterval` is correct. No unnecessary tests were added. Pre-existing and out of scope: Finn's licensing risk, already flagged in dev.md.
