# Agent Feature Workflow

Each feature lives in `agents/features/<NN-slug>/`, created from `agents/templates/`.

| File | Owner | Purpose |
|------|-------|---------|
| `FEATURE.md` | Orchestrator | Goal, requirements, acceptance criteria, file ownership, status |
| `dev.md` | Developer agent | Plan, decisions, files touched, commits, tests added, open questions |
| `review.md` | Quality-control agent | Findings per review round, verdict (APPROVED / CHANGES_REQUESTED) |
| `verify.md` | Verify agent | What was exercised, results, screenshot index |
| `screenshots/` | Verify agent | PNGs named `<NN>-<what-is-shown>.png` |

## Lifecycle

1. **Orchestrator** writes `FEATURE.md` (status `READY_FOR_DEV`).
2. **Developer** reads `FEATURE.md`, `AGENTS.md`, and any prior `review.md`; implements; writes unit tests for critical business logic only (no UI tests); commits each logical unit; logs in `dev.md`; sets status `READY_FOR_REVIEW`.
   Per round, run only: `npm test` (fast), `npm run build:chrome`, and the one browser fixture covering the changed code (desktop size only). No lint, no Firefox build, no multi-viewport runs — verify does those once.
3. **Quality control** (clean context) reviews the feature's commits (`git log`/`git show` for the hashes listed in `dev.md`). Checks: correctness/bugs, no over-engineering, simple logic, no comment blocks explaining code, matches surrounding style, tests exist where business logic is critical (and not elsewhere). Writes `review.md`; sets status `APPROVED` or `CHANGES_REQUESTED`. Read-only on code.
   In round 1 only, also run the browser fixture of every module the changed code calls into or is called by (e.g. mascot fixture when reminder wiring changes), to catch cross-module regressions early.
4. On `CHANGES_REQUESTED`, the developer addresses findings. Fix rounds are lightweight: a single **re-check** agent reviews the fix commits and re-verifies only the affected scenarios in one pass (updating both `review.md` and `verify.md`). Fixes of ≤10 changed lines skip review and go straight to re-check.
5. **Verify** (first time only) is scoped to the feature: build Chrome + Firefox, `npm run lint`, run the fixtures covering the changed code and the modules it touches, at desktop/narrow/reduced-motion, exercise the feature's scenarios, save screenshots, write `verify.md`; sets status `VERIFIED` or `VERIFY_FAILED`. No full regression suite.

## Orchestrator spec checklist
When writing `FEATURE.md`, list known edge cases up front so they aren't discovered late: YouTube SPA navigation, hover-preview `<video>` elements (always target `#movie_player video`), fullscreen/theater/miniplayer, multiple tabs/windows, MV3 service worker restart, reduced motion, Firefox differences.

## Rules for all agents

- Work on `main`. Commit messages start with `feat:`, `fix:`, `doc:`, or `chore:`.
- Stage files by explicit path only — never `git add -A` / `git add .`. Other agents may be working in the same tree.
- Only edit files listed under "File ownership" in `FEATURE.md`. If you need another file, note it in your md file and explain why.
- No `git push`, no history rewriting, no branch changes.
- Keep md entries short and factual; append, don't rewrite other agents' sections.
