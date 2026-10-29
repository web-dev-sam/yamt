# Slice SearchConnectR1 — fix round 1: stale go-tos dropped, a failed new-stop list searched later, a deleted side never searched, one go-to watch, one "Result" word

Board "Search" row 6, fix round 1 (session 35). Round 1: `SearchConnect`, commit `c5461d1`, brief
`docs/slices/briefs/search-connect.md` (holds), notes `.omp/run/notes/SearchConnect.md`. The window slice's fix round
(`SearchWindowR1`) has landed before you: read its commit too. Verbatim (promoted `should`s marked):

1. **#1727 (correctness, block)** `MergeView.vue:122` — "Nothing removes a go-to request whose open never lands … a
   click on a row for unopened file X sets `search.goTo`, then `pick` starts X's load. If the user clicks file Y in the
   list before X's load returns, `opening.ts` `load` drops X as not current … the request for X stays. Later, when the
   user opens X from the file list, MergeView's `immediate` watch … selects the old match … A failed `loadFile` leaves
   the request the same way." Fix: `searching.ts` `go` awaits `deps.open(path)` (have it return its promise) and calls
   `took(id)` when `deps.shownPath() !== path` afterwards. A store test: click a row for X, pick Y before X loads, then
   open X ⇒ `search.goTo` is null and nothing gets selected.
2. **#1728 (correctness, block)** `stops.ts:63` — "When the new stop's list fails … nothing runs the search once the
   stop's list does arrive (the `refreshFiles` on the next window focus). The box keeps showing the query, with no
   summary and no rows, until the user presses Enter." Fix: record that the search waits for a list (e.g. a flag on
   the stop target); the next landed `refreshFiles` in that stop calls `search.rerun()` and clears it. Test: failed
   list, then a successful list ⇒ the new files' rows.
3. **#1729 (correctness, block)** `mergeSearch.ts` — "for a deleted-side file, `searchedFile` searches
   `data.local`/`data.remote`, and on the deleted side that text is the base text (RK3). That pane is `invisible` in
   MergeView.vue, so a row there can go to a pane the window hides." Fix: the deleted side's pane has no text
   (`null`) for a file with `deleted !== null`; a test.
4. **#1725 (boundary, should → promoted)** `RangeView.vue:49` — "Both views carry their own copy of the go-to rule: act
   only when the view is shown and its path matches, then call `took`." Fix: one composable
   `ui/useSearchGoTo.ts` (`useSearchGoTo(search, () => props.shown, path, goTo)`) next to `searching.ts`, called by
   both views.
5. **#1726 (boundary, should → promoted)** `ChoiceView.vue:112` — the literal "Result" while MergeView and the search
   use `RESULT_HEADER`. Fix: `{{ RESULT_HEADER }}` from `./sideHeaders`.

## Target

Owned: `frontend/src/ui/MergeView.vue`, `RangeView.vue`, `ChoiceView.vue`, `stops.ts`, `stops.test.ts`,
`listing.ts`, `listing.test.ts`, `searching.ts`, `searching.test.ts`, `opening.ts`, `store.ts`, `store.test.ts`,
`mergeSearch.ts`, `mergeSearch.test.ts`, `rangeStore.ts`, `useSearchGoTo.ts` (new) — all under `frontend/src/ui/`.

Read-only: everything else. The contracts of rounds 1 hold (`Searching`, the handles); `deps.open` may return a
promise (an addition).

## Acceptance

- Node: items 1–3 tests fail on round 1's code (paste one failing output each), pass after.
- WebKit, merge fixture page, dark: item 1 by hand (a row for an unopened file, at once another file in the list, then
  the first file from the list: no selection jump, the keyboard stays) — or say why the race cannot be timed there and
  rely on the node test; one go-to per window still lands (the selection equals the match 500 ms later).
- `pnpm -C frontend typecheck`, `lint`, `test`, `fmt:check`, `unused` pass; Stryker on `stops.ts`, `searching.ts`,
  `mergeSearch.ts`, `useSearchGoTo.ts` — no survivor on your changed lines.

## Skills

`skill://vue-conventions`, `skill://ts-conventions`, `skill://verification` (plus your autoloaded ones).
