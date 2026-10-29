# SearchFinalFix — notes (session 36)

Brief `docs/slices/briefs/search-final-fix.md` (search core round 2 + window round 4, one slice, #1757); web-impl,
isolated, 8m34s. Patch `2d56b9d` (base `2359eb4`), `.omp/run/patches/SearchFinalFix.patch`.

- #1754: measured in the real range app on a 2 MiB one-line `src/min.js`: digest 6 ms, match 4 ms, WebKit laying out
  the row's text after the match 829–912 ms (capped: 2 ms). `preview.ts` `afterOf` keeps 250 characters after the
  match, then `…`, never ending on a high surrogate; `search/AGENTS.md` names it. Longest frame 813/834 ms → 26/19 ms.
- #1755: `SearchPanel.vue` `focusBack` focuses with `{ preventScroll: true }` (both branches): Result focused, panes
  `783/823/1063` → hide → `0/0/0` before, unchanged after; Local first and the Settings screen unchanged.
- 2990 tests; sfc-order, typecheck, lint, fmt, unused clean. Private bus killed.
- `just mutants 2359eb4`: preview.ts 84.4 %, 5 survivors on module constants: 4 static false survivors (the tests
  assert those values, #732), 1 real gap dropped (#1758).
- Reviews: boundary pass; correctness pass (one should, dropped). Accepted. The release run re-checks both in the
  release binary (#1757).
