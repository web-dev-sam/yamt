# SearchTidy — notes (session 35)

Slice brief `docs/slices/briefs/search-tidy.md`; web-impl, isolated, 6m6s. Patch `da75f8b` (base `cdeaaff`),
`.omp/run/patches/SearchTidy.patch`; 4 files. **Not yet reviewed, no mutation run yet** (session ended at the owner's
handoff, #1733).

- #1730: `SearchResults.vue` passes sfc-order (`useVirtualList` gets `toRef(props, "rows")`).
- #1731: the after-match span keeps leading spaces and tabs (`whitespace-pre` inherited, `overflow-hidden
  text-ellipsis` instead of `truncate`'s `nowrap`). WebKit: 21 rows' innerText equals their textContent (with the old
  `nowrap` all 21 lost the space); preceding spaces and tabs kept, dark and light; the ellipsis still cuts at 240 px.
- #1732: `ChoiceView.vue` takes a keyboard-only go-to through `useSearchGoTo` and focuses its first enabled button
  ("Take left"); the request is cleared. Proven in the real app on `--fresh-repo` (`assets/logo.bin`), dark and light
  (the fixture lists no choice file).
- The five `useSearchGoTo` tests moved unchanged to `useSearchGoTo.test.ts`.
- sfc-order, typecheck, lint, fmt, unused clean; 220 files / 2987 tests.

## Reviews

`just mutants cdeaaff`: nothing to mutate (only `.vue` files and tests). Boundary pass, no findings (deviations
accepted). Correctness fail: #1734 (block) — a keyboard-only request already waiting when a ChoiceView mounts runs
during setup (`useSearchGoTo`'s immediate watch runs synchronously, ignoring `flush: "post"`), so the focus found no
section and the request was taken; reachable by Reset on a choice file while the search hides in its round trip.

## Fix round 1 (`SearchTidyR1`, 5m11s, patch `836ff00`, `.omp/run/patches/SearchTidyR1.patch`)

`void nextTick(focusFirstButton)`. Real app, mount case (a MutationObserver sends the hide key once the old view's
section is removed): before `BODY`, after "Take left", dark and light; the plain case still "Take left". Six frontend
recipes pass, 2987 tests. `just mutants 6b82d6b`: nothing to mutate. Correctness re-check pass. Accepted.
