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
3. **Quality control** (clean context) reviews the feature's commits (`git log`/`git show` for the hashes listed in `dev.md`). Checks: correctness/bugs, no over-engineering, simple logic, no comment blocks explaining code, matches surrounding style, tests exist where business logic is critical (and not elsewhere). Writes `review.md`; sets status `APPROVED` or `CHANGES_REQUESTED`. Read-only on code.
4. On `CHANGES_REQUESTED`, the developer addresses findings and the loop repeats.
5. **Verify** is scoped to the feature's changed files only (`git diff --stat` over its commits): build the affected browser(s), run only the tests/fixtures that cover the changed code, exercise the feature's scenarios, save screenshots, write `verify.md`; sets status `VERIFIED` or `VERIFY_FAILED`. No full regression suite — developer and QC already ran `npm test`.

## Rules for all agents

- Work on `main`. Commit messages start with `feat:`, `fix:`, `doc:`, or `chore:`.
- Stage files by explicit path only — never `git add -A` / `git add .`. Other agents may be working in the same tree.
- Only edit files listed under "File ownership" in `FEATURE.md`. If you need another file, note it in your md file and explain why.
- No `git push`, no history rewriting, no branch changes.
- Keep md entries short and factual; append, don't rewrite other agents' sections.
