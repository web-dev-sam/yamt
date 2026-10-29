# SearchCore — notes (session 35)

Slice brief `docs/slices/briefs/search-core.md`; web-impl `SearchCoreB` (the first run, `SearchCore`, was interrupted
and left nothing), isolated, 18m46s. Patch `ec191ff` (base `d6ccf9c`), `.omp/run/patches/SearchCore.patch`; 14 files,
+1312 −14.

## Summary (implementer)

- `frontend/src/search/` (pure, framework-free): `index.ts` the only surface (`matcherOf`, `filePlaces`,
  `emptyResults`, `withFile`, `dismissPlace`, `dismissFile`, `listRows`, `summaryOf`, `goToPane`, `MAX_ROWS`, the
  contract types); `internal/match.ts` (matcher, `paneHits`), `preview.ts`, `places.ts` (place rule, order, key),
  `results.ts` (dismissals, the cap), `list.ts` (rows, summary, go-to pane); `AGENTS.md`.
- `scripts/fences.ts`: `search/` framework-free (PM3) and self-contained (PM2) like `jsonrpc/`;
  `FRAMEWORK_FREE_MODULES` values `"framework-free" | "self-contained"`; file at 299 lines.

## Tests

Design §3.6 B2 list in `match`/`preview`/`places`/`results`/`list` tests, plus: a match never covers a line's `\r`;
a cut never splits a surrogate pair; edges of a change are outside it; exact key strings (no line number); a dismissal
never leaks to another file; a re-run under a cut trims dismissals; `fences.test.ts` failing paths. Node 209 files /
2860 tests; typecheck, lint, fmt, knip clean.

## Evidence (implementer)

Stryker over its 7 files: `search/` 97.75 % (342 killed, 5 timeout, 6 survived, 2 no coverage): `match.ts:37`
(initial value overwritten), `:39` (`<` vs `<=` equal only on the first match), `places.ts:39,44,45` (the brand guard's
unreachable throw, as `lsp/internal/spec.ts`), `:98` (ordinal ±1 distinct either way), `results.ts:77` (unique ranks).
`fences.ts` `:134` equivalent, `:145` a moved reason string.

## Deviations (accepted)

1. `summaryOf(null, on, true)` → `searching` (design §4 detail 3). 2. `filteredOut` wins whenever no pane is on.
2. `cut` stays until a full run. 4. Outside hits get a per-pane ordinal too (keeps one hit per pane when a Result edit
   lengthens an unchanged stretch). 5. `Matcher` a class exported as a type only. 6. `fences.ts` compacted to 299 lines.

## Open risks (implementer)

`withFile` O(groups) per call → O(N²) per full run [INFERENCE: tens of ms at 5,000 files]; preview cut is plain, not
VS Code's word-boundary `lcut`; line slices may pin large strings in V8 [INFERENCE].
