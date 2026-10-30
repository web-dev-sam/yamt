# Final run MrConflictsVerify — merge-request conflicts: size, readiness, resolve, abort, push

Board "Merge-request conflicts" row 8. Request `docs/slices/request-mr-conflicts.md`. Tree at `HEAD` (after
`265d168`, docs after it). VF11 final: `just check`, then every smoke recipe; no mutation run.

## Steps

1. `just check` (includes `map-check`): paste the last lines of each failing recipe, or the final success line.
2. Every step of `docs/slices/briefs/mr-conflicts-smoke.md` (fixture page, fixture merge window, real app 3.0–3.7),
   in fresh directories under `/tmp` (the rm guard blocks removal under `/var/tmp`). Step 3.2 must now show
   "Continue merging !21" disabled with "Its merge window is already open" right after the Resolve reply and right
   after the Continue reply, without a focus change (#2036).
3. `pgrep -f 'yamt --repo'` empty and `/tmp/yamt-mrc*` removed at the end.

## Report

`gate: pass|fail` with the `just check` evidence; `smoke` per `skill://verification`, each step verbatim with
pass/fail.
