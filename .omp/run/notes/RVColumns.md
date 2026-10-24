All three parts of the brief are in place: `RangeController`, the split column factory, and the list made generic with slots. Node tests, typecheck, lint, format, knip, sfc-order and map-check all pass. One acceptance line is reached by another route: Playwright WebKit cannot launch on this host, so `range.browser.test.ts` never ran itself. I ran the same checks in MiniBrowser through `just webdriver` instead (details under `smoke_evidence`).

## summary
- `editor/range.ts`: `RangeController` shows two read-only columns. It reuses `CompareStrip`/`CompareFrame` (bands, locked scroll, find space), marks both columns once from the reply, takes its language from the path, and moves with `revealDifference`/`keyboardColumn`. It has no format, settle, history, language picker or `holdsText`.
- `editor/internal/compareViews.ts`: one shared `columnState` builds both kinds of column. `editableColumnState` and `createColumnViews` keep the compare window as it was (`"center"` with the byte limit). The new `readOnlyColumnState` and `createReadOnlyColumnViews` (`"readOnlyCenter"`, no byte limit) take an `extensions` input, the seam left for delivery B's threads.
- `ui/fileTree.ts`, `FileTree.vue` and `FileList.vue` are generic over `F extends ListedFile`. They have `#file` and `#footer` slots and a `label` prop, and no longer import `FileEntry`, `FileMark` or `OperationLabel`. `App.vue` fills the slots, and the merge window looks and behaves as before.

## files_changed
- `frontend/src/editor/range.ts` (new)
- `frontend/src/editor/range.browser.test.ts` (new)
- `frontend/src/editor/index.ts` (+2 lines, now 292)
- `frontend/src/editor/internal/compareViews.ts`
- `frontend/src/editor/internal/compareViews.test.ts` (new)
- `frontend/src/ui/fileTree.ts`
- `frontend/src/ui/fileTree.test.ts`
- `frontend/src/ui/FileTree.vue`
- `frontend/src/ui/FileList.vue`
- `frontend/src/ui/App.vue`

## tests_added
Each node test was checked with its one-line hand mutation from the design §10 table; each mutation failed only its own test, and the code was restored afterwards:

| test (`compareViews.test.ts`) | hand mutation | failure seen |
|---|---|---|
| "a read-only column's state refuses a user insert and keeps its text" | `"readOnlyCenter"` → `"center"` in `readOnlyColumnState` | `expected false to be true` at `at.readOnly` |
| "a read-only column holds differenceField, so showDifferences lands" | `differenceField` dropped from the read-only extensions | `expected undefined to deeply equal [ { from: 2, to: 11, … } ]` |
| "an editable column still refuses an insert over its byte limit" | the `columnLimit(...)` lines deleted in the editable path | `expected 'a\nnew \nword\nb\n' to be 'a\nnew word\nb\n'` |

- `ui/fileTree.test.ts` "treeRows: keeps a file row's own type for any listed file": rows built from another `{ path, added }` type keep that type in each file row. The existing merge-row tests are unchanged (`shown` now takes `TreeRow<ListedFile>`).
- `editor/range.browser.test.ts`: five tests — both columns marked from one reply, a `.ts` path loads TypeScript, `moveToChange("down")` with no wrap, typing changes nothing, `destroy()` empties the hosts.

## smoke_evidence
- `pnpm -C frontend typecheck` → `$ vue-tsc -b`, exit 0.
- `pnpm -C frontend lint` → `$ oxlint --type-aware && eslint --max-warnings 0 "src/**/*.vue"`, exit 0, nothing reported.
- `pnpm -C frontend test` → `Test Files 152 passed (152)`, `Tests 1978 passed (1978)`.
- `pnpm -C frontend unused` and `sfc-order` → exit 0. `fmt:check` → `All matched files use the correct format.` `just map-check` → `map-check: ok`.
- **WebKit probe:**
  - `pnpm -C frontend exec vitest run --project browser src/editor/range.browser.test.ts` failed to start: `MiniBrowser: error while loading shared libraries: libicudata.so.74` (this host has ICU 78). This is the known failure (#423/#1074). The probe file did not run.
  - Instead: `just app-session start-fixture --name rvafter`, which starts `just webdriver` and MiniBrowser. A throwaway WebDriver script, `/tmp/range-probe/probe.mjs`, imports `/src/editor/index.ts` in the page, builds the real `RangeController` and runs the probe's scenario:
    - Marks: `{"stripBands":["chunk-modified chunk-band d=true","chunk-modified chunk-band d=true"],"columns":[{"bandLines":2,"wordMarks":["old",", b"],"removalBars":1},{"bandLines":2,"wordMarks":["new",", y"],"removalBars":1}]}`
    - Language: `{"keyword":"const","highlightedSpans":[30,30],"lineColour":"rgb(196, 194, 206)","keywordColour":"rgb(224, 152, 107)"}`
    - Moves: `moveToChange {"lines":["const value = old(a, b);","call(x);","call(x);"],"focusInLeft":true}`
    - Typing: `focused left true`, `focused right true`, then after `abc`, Enter, Backspace, Delete: `after typing {…,"same":true,…}`
    - Destroy: `destroy [0,0,0]`
    - Screenshot: `/tmp/range-probe/range-dark.png`
- **Merge window before and after** (fixture mode, MiniBrowser through `just webdriver`; "before" from the main checkout at `b74ca67`, whose `frontend/` matches this tree's base `f1dfcb4`):
  - Both sessions: tree `aria-label` `"Conflicted files"`, 12 tree items, width 240. Dragging "File list width" by +80 gives 320. Ctrl+B hides the panel (`"none"`); a second Ctrl+B shows it again (`["flex",320]`).
  - Screenshots `/tmp/range-probe/{before,after}-{list,tree,hidden,wide}.png`. Pixel difference (`compare -metric AE`): tree 0, hidden 0, wide 0. The list has 304 px, all outside the sidebar (`-trim`: 1129x759 starting at x=260; the sidebar is 0–245 px); the diff image shows they are the editor panes' scrollbars. The "remembered" mark and the MERGE tag are identical.

## deviations_from_brief
- `columnState` takes `{ text, kind, settings, extensions }` without the `column` argument the Change step lists, because it never uses it. The column goes into `editableColumnState`/`readOnlyColumnState({ column, text }, wiring)`, which build the per-column listener and the refusal callback.
- New exports `editableColumnState`, `readOnlyColumnState` and `ReadOnlyWiring`: the node tests need the exact states the two factories build, without a DOM.
- `compareViews.test.ts` stubs `document` as `{ body: {} }`, because `everyPane()` reads `document.body` when the column state is built; node has no `document`.
- Both `FileTree.vue` and `FileList.vue` declare their slots with `defineSlots` so `F` is typed in the slot props.
- **Shared edits needed (not mine to make):**
  - `frontend/src/ui/AGENTS.md` lines 17 and 19 still say `FileList.vue` renders `OperationLabel` and `FileMark`; they now come from `App.vue` through the `#footer` and `#file` slots.
  - The project map's `frontend/src/ui` entry for FileList/FileTree/fileTree.ts and the `frontend/src/editor` entry (compare section) should name the generic list, `range.ts` and the second factory.
  - `frontend/src/editor/AGENTS.md` (Compare paragraph) should name `RangeController` and `createReadOnlyColumnViews`.
- The probe and the before/after shots were run in MiniBrowser through `just app-session` and `just webdriver`, as the brief and earlier notes require when Playwright WebKit cannot launch. `range.browser.test.ts` exists as asked but has never run.

## open_risks
- `frontend/src/editor/range.browser.test.ts` has never run in Playwright WebKit. Its checks were reproduced by the throwaway script, not by the file itself, so its selector and wait details are unproven (for example the `language` facet name `"typescript"` and the first `span` on line 1 being `const`).
- `frontend/src/editor/range.ts:31-35`: the `updated` callback calls `this.#frame` before `#frame` is assigned in the constructor. This is safe because CodeMirror does not call the update listener while building a view, and `CompareController` uses the same pattern.
- In the probe screenshot, the strip's bands are hard to see in the 40 px gap, though `d` is non-empty for both. That probe page has no `PaneFrame` styling, so judge band visibility in the real range view (row 8).