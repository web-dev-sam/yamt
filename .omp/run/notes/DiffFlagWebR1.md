# DiffFlagWebR1 (3.R-diff-flag-web, fix round 1: #1587, #1589)

Brief `docs/slices/briefs/3.R-diff-flag-web-rework-1.md` (missing in the worktree; the task text carried the steps).
`state.test.ts`: "a --diff session …", `diff.json`, `compareState`, same assertions; `fixtureCompare.ts` `firstTabs(caseName, …)`.
Greps: no old names left; `diff` in fixtureCompare.ts only the `get("diff")` read. `pnpm -C frontend typecheck/test (1952)/lint/unused/fmt:check` pass.
