```json
{
  "verdict": "pass",
  "findings": [
    {
      "severity": "should",
      "rule_id": "VF7",
      "file": "frontend/src/ui/useRangeController.ts",
      "line": 113,
      "problem": "`shownHosts` decides that no controller is built until all three hosts exist. No node test covers it (19 NoCoverage mutants at 112–129). If `||` became `&&`, a column would be built against a half-mounted host as soon as the first template ref lands. Only the WebKit steps would notice. Beyond that, nothing gets harder as the app grows, since only this file uses the guard.",
      "fix": "Export `shownHosts` generic over the element types (`<D, S>(refs: { left: Host<D>; right: Host<D>; strip: Host<S> })`) and add a `useRangeController.test.ts` case where any one null ref gives `null` and three set refs give the hosts."
    },
    {
      "severity": "should",
      "rule_id": "VF7",
      "file": "frontend/scripts/app-session/start.ts",
      "line": 80,
      "problem": "No test covers the new `opens.kind === \"range\"` branch, which builds `--diff=<range> --repo <dir>` (survivors at 80/82/83). A swapped or dropped argument would launch a merge or compare window and would only show up in a manual real-app run. Beyond that, nothing gets harder as the app grows.",
      "fix": "Move the argv choice for each `Opening` into a pure exported function in `startArgs.ts` (e.g. `appArgs(opens, repoDir)`), call it from `prepareApp`, and assert the range, diff and dir argv in `args.test.ts`."
    }
  ],
  "checked": [
    "Brief, patch (git show 50444c3), implementer notes, boundary review (none of its 7 findings repeated), design §3–§7, plan §2 #103/#105/#106 and request A rules 3–5 all read; the current RangeApp.vue, RangeView.vue, RangeFileRow.vue, rangeStore.ts, rangeText.ts, useRangeController.ts, main.ts, fences.ts and startArgs.ts read in full.",
    "main.ts root choice: in the app, data-window compare|range is passed through and anything else is merge. In fixture mode `?range` is checked before `?diff`, and the switch has an exhaustive `never` default. startRange builds only the range source, the store and RangeApp. The real app's `<html data-window=\"range\">` and its title were observed in the implementer's smoke.",
    "First file shown: startUp shows `files[0]` (Rust's sorted order is the list view's order, design §5). Empty range → shown null, visited []. Both are pinned in rangeStore.test.ts, and the screenshots /tmp/rvwin-shots/01-list.png and app-three-dots.png show `config` selected and displayed.",
    "16-view eviction traced by hand: `recent` and `visited` always hold the same ids. The newly shown id is last in `recent`, so it is never the one evicted, and the shown file is never dropped. `visited` keeps first-visit order (keyed v-for, no DOM moves). The eviction test reshows file 0 and then expects file 1 dropped and 0 kept, which tells LRU apart from FIFO. Its length-16 check catches a `>=` off-by-one. Stryker: rangeStore.ts 100 %.",
    "Failed load and retry: `forget` removes the file from visited and recent, `shown` keeps its id, and the problem names the path. FileList.vue:91 and FileTree.vue:45 emit `select` even on the active row, so clicking the selected row remounts the view and loads again. A success clears only that path's problem. The test covers the problem staying after another file's success, the eviction order after a failure, and the problem clearing on the same file's success.",
    "Ctrl/Cmd+B: the shared `fileListKey` is checked against the store state (asking, settings.keys, fileListShown). The test toggles once, does nothing while a clash question waits, and toggles again after dismiss, with preventDefault counted. WebKit step 4 observed the window keydown wiring.",
    "Settings seam: `registerSettingsStore(created)`; the test asserts `useSettingsStore() === store`; focus → loadSettings mirrors CompareApp; startUp loads settings in parallel exactly as compareStore.ts:177; WebKit step 14 shows SettingsView without the servers section.",
    "Sentences: rangeText.test.ts pins every RangeFile case (13), the merge-base and HEAD labels, short-id headings, the empty-range wording from the brief, `+n −m` with U+2212, the mode note, and the `an executable file` article. The words match design §7. Stryker: 59 killed. The 2 at rangeText.ts:94 are the `never` default (VF7 (a) equivalent, unreachable by types).",
    "useRangeController.ts:88 flush:'post' → {} / '' (2 survivors) dropped as VF7 (a) equivalent: the host refs are watch sources. Template refs are written in Vue's post-render queue, so a pre-flush run that finds them null runs again when they land and builds once, because `waiting` is cleared on build.",
    "followRange tests catch real bugs: a missing `waiting = null` fails the 'again' hosts case (one build); building with live rather than at-build preferences fails the 'preferences before build' case; a missing `disposed` check fails the after-unmount case; a missing destroy or a move after stop fails the calls list.",
    "fences.ts 121/122 survivors dropped as VF7 (a): the second `?.` is unreachable because group 1 is mandatory when the regex matches, and `false ? … : WINDOW_RULES[root]` reads `WINDOW_RULES[\"undefined\"]`, which is undefined. The constants that `--ignoreStatic` leaves unmutated (ROOT_FILES' six keys, WINDOW_FILE's `(?:use)?`, `/i` and `.vue`, WINDOW_RULES) are each exercised by a positive fence test (PM9 test: ./store, ./App.vue, ./compareStore, ./CompareApp.vue, useRangeController.ts, RangeApp.vue; PM7 test: ./rangeStore, ./RangeApp.vue) and a negative one (storeRange.ts, shared imports).",
    "The startArgs.ts survivors (38, 39×3, 84, 97, 99, 106) and the args.ts survivors (119–211) are pre-existing: size/recording/settingsText/noPositionals moved unchanged from the old args.ts (checked against git show 8857999). The new `opening`/`fixtureSearch` range branches (45–73) have no survivor, and args.test.ts covers `--range` needing `--repo` plus refusing `--fresh-repo`/`--diff`, and `--range-case` encoding, its refusals and a missing value.",
    "Other start.ts survivors are on pre-existing lines (the file has no test at all). Only 80–84 are this patch's, and they became the second finding.",
    "Behaviour of the special files: sentence kinds build no controller (6-case test.each) and the arrows are disabled while a file is loading or shows a sentence. Added and deleted files show empty columns, and the header shows the mode note (WebKit steps 7–8). A renamed file's header is old → new (rangeText test plus WebKit step 6).",
    "No targeted test run: no block depended on one."
  ]
}
```