# DiffFlagWeb (3.R-diff-flag-web, release 0.5.0 row 1b)

Brief `docs/slices/briefs/3.R-diff-flag-web.md`; plan §2 #101; owner #1586.

## Summary

Fixture mode reads `?diff` / `?diff=<case>` (`main.ts`, `fixtureCompare.ts`); app-session `start-app --diff`
(Opening kind `"diff"`, passes `["--diff"]`), `start-fixture --diff` / `--diff-case <case>`; usage, error text, tests
(renamed, same rules) and both AGENTS.md say diff. No alias.

## Evidence

Grep for the old names in `frontend/src`, `frontend/scripts`: none. `pnpm -C frontend typecheck/test (1952)/lint/unused/
fmt:check` pass. WebKit: `--diff-case json-payload` → tab "Compare 1 / Auto · JSON", first lines of the case; `--diff`
→ one empty "Compare 1"; `?raw` → the merge window's file list. Real app `start-app --diff`: needs row 1a's binary,
left to the final run.

## Deviations (accepted)

- `oxfmt` split the renamed `main.ts` line; `firstTabs` parameter `raw` → `diff`; AGENTS.md notes bare `?diff`.

## Leftover found

- `frontend/scripts/app-session/state.test.ts:72-76` "a raw session" test name and `raw` variable (not owned) →
  folded into the next round that owns it.
