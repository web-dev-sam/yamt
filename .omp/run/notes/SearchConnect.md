# SearchConnect — notes (session 35)

Slice brief `docs/slices/briefs/search-connect.md`; web-impl, isolated, 16m55s. Patch `c5461d1` (base `d68ff0f`),
`.omp/run/patches/SearchConnect.patch`.

## Summary (implementer)

- `MergeView.vue`/`RangeView.vue` act on the store's go-to when shown and on its file (select, focus, `took`);
  MergeView registers its live Result with `liveResults` (every view, deleted-side ones too) and calls
  `search.changed(path)` on each `resultVersion` bump; the Result header uses `RESULT_HEADER`.
- `stops.ts`: a new stop clears the search, and searches again once the new list arrived (`listed !== null`).
  `diskChanges.ts`: `search.changed` per changed path. Targets typed as `Pick<Searching<string>, …>`.
- Unused re-exports dropped (`PaneMatch` ×2, `LineChange`, `MergeGoTo`, `RangeGoTo`): `pnpm unused` exit 0.

## Tests

`stops.test.ts` (a new stop clears, then searches the new stop's files for the same query after its list; a failed
list searches nothing), `diskChanges.test.ts` (a change re-searches only that path after the pause).

## Evidence (implementer)

Node 218 files / 2954 tests; typecheck, lint, fmt, unused clean. Stryker `diskChanges.ts` 95.6 %, `stops.ts` 91.5 %, no
survivor on changed lines. WebKit (private Xvfb, `document.hasFocus()` true; probes at +0…1000 ms), collapsing on:
merge fixture dark/light — opened and unopened files by row click, left icon and Enter: the selection equals the
match at +500 and +1000 ms in the right pane, the stretch shown, that pane focused; typing over a match removes the
Result icon, undo brings it back in 418 ms, Reset restores; hide returns the keyboard to the Result. Range fixture
dark/light — the same on the new side and the left icon. Real app, `demo-repo.sh` and `range-repo.sh`, dark/light, real
X clicks: the same. **The selection never shrank to a cursor.** Screenshots `/tmp/sc-shots/`.

## Deviations (accepted)

1. `liveResults.track` for every MergeView (a deleted-side Result is searched too, rule 6). 2. `rerun` only after a
   listed stop. 3. `Pick<Searching<string>, …>` targets. 4. Fixture sessions on its own WebKitWebDriver + Xvfb (`just
   webdriver` put the window on the owner's screen without focus). 5. #1719 worked around in fixture pages with an
   overflow toggle before clicks (test-only); the real app's rows were hittable.

## Open risks (implementer)

#1719 open until the window fix round; each controller build bumps `resultVersion`, so opening a file searches it once
more after 300 ms (cheap); merge app's first Ctrl+Shift+S after start did not show the panel (second did; passed to
`SearchWindowR1`); range fixture dark: hiding returned focus to the gear that had it when the panel showed (as
designed).

## Reviews (round 1)

Mutation run `just mutants d68ff0f`: survivors only on older lines. Boundary pass with #1725 (the go-to watch copied in
both views) and #1726 (ChoiceView's literal "Result"), both promoted. Correctness fail: #1727 (a go-to whose open
never lands stays and fires on a later open), #1728 (a failed new-stop list never searches once the list arrives),
#1729 (a deleted-side file's hidden pane searched with the base text; `mergeSearch.ts`, a window file). Fix round 1
waits for `SearchWindowR1` (it owns `searching.ts`, `opening.ts`, `mergeSearch.ts`, the stores).
