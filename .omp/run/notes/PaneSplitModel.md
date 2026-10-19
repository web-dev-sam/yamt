The split model, the drag composable, the divider rules, the remembered file-list width and the store's three lines are in place. Lint, typecheck, test and fmt:check exit 0. `pnpm unused` exits 1 because it names `usePaneDividers` and `DotsState`, which row 6 will be the first to import. As the brief says, I left both exported.

```
summary
  ui/paneSplit.ts: PaneSplit/PaneWidths/Gutter/EQUAL_SPLIT, paneColumns (five tracks), dragged (WebStorm proportions, 220 px / a-third minimum, the other pane kept to the pixel), createPaneSplit over storedValue ("yamt.panes.split").
  ui/useColumnDrag.ts: one listener object (pointerdown/move/up/cancel, lostpointercapture, pointerover/leave, mousedown, dblclick), DotsState rest/hover/drag, COLUMN_RESIZING_CLASS = "col-resizing" on <html> while dragging, cleared on scope dispose.
  ui/usePaneDividers.ts: dividerHandle (the accept rule, press measures once, each move → setPaneSplit(dragged(…)), reset → resetPaneSplit) and usePaneDividers → { local, remote }.
  ui/fileListWidth.ts: createFileListWidth ("yamt.files.width", px, valid if finite and ≥ 160, setWidth clamped to [160, windowWidth/2], reset removes the key).
  ui/store.ts: AppStore & PaneSplitState, ...createPaneSplit() (290 → 293 lines).

files_changed
  frontend/src/ui/paneSplit.ts (new), frontend/src/ui/paneSplit.test.ts (new)
  frontend/src/ui/useColumnDrag.ts (new), frontend/src/ui/useColumnDrag.test.ts (new)
  frontend/src/ui/usePaneDividers.ts (new), frontend/src/ui/usePaneDividers.test.ts (new)
  frontend/src/ui/fileListWidth.ts (new), frontend/src/ui/fileListWidth.test.ts (new)
  frontend/src/ui/store.ts (+3 lines: import, `PaneSplitState &`, `...createPaneSplit()`)

tests_added
  paneSplit.test.ts:
    - equal thirds are the starting split; a missing key gives thirds and writes nothing; a stored split is read back.
    - 18 invalid stored values give thirds without a warning: "", not JSON, null, a number, [], {}, string numbers, local or remote a string, no remote, no local, a zero Result, a Result under 1 %, a negative share on either side, under 1 % on either side, 1e400.
    - the edges 0.01/0.98 and 0.98/0.01 are kept.
    - set → written → a second instance reads it; reset gives thirds.
    - a throwing storage gives thirds, still sets the split in memory, and warns.
    - dragged: {300,400,300} +100 → {0.4, 0.3} with remote·T === 300; +250 → Result 220; −200 → Local exactly 220; T = 600 (minimum 200) changes nothing; {300,100,600} stays total; the remote boundary mirrors the local one; dx 0 gives the measured shares.
    - exact paneColumns strings for strip and gap; every fr factor ≥ 1 at the edges of the valid range.
  useColumnDrag.test.ts (fake MouseEvent/PointerEvent/Element globals, events dispatched through a real EventTarget):
    - an accepted press cancels, captures, adds the class, sets drag and calls press; the matching mousedown is cancelled.
    - moves get dx from the press.
    - pointerup, pointercancel and lostpointercapture each end the drag and clear the class; scope dispose clears it too.
    - a second pointer's press, moves and release are ignored; moves without a press do nothing.
    - a rejected target, and buttons 1 and 2, do nothing and cancel nothing.
    - a press that returns null neither captures nor adds the class.
    - dblclick resets on an accepted target and does nothing on a rejected one.
    - hover: accepted → hover, rejected → rest, leave → rest; during a drag, hover and leave keep drag.
  usePaneDividers.test.ts:
    - the handle and the strip's svg root are accepted; an icon target, an svg nested in an icon group, and a wave join are rejected; a null handle accepts nothing.
    - a press measures once, and each move sets dragged() for its own boundary.
    - a press that cannot measure gives no drag; reset calls resetPaneSplit only.
  fileListWidth.test.ts:
    - a missing key gives null and writes nothing; 160 and 612.5 are read back.
    - invalid values ("", a word, {}, 159.5, 0, −300, Infinity) give null without a warning.
    - set → written → read again by a second instance.
    - the clamp: 100 → 160, 900 → 800, 700 kept; in a 300 px window the width is 160.
    - reset gives null and removes the key.
    - a throwing storage keeps the width in memory and warns.

smoke_evidence
  1. pnpm -C frontend fmt:check → "All matched files use the correct format." fmt exit 0
     pnpm -C frontend lint → "$ oxlint --type-aware && eslint --max-warnings 0 "src/**/*.vue"" lint exit 0
     pnpm -C frontend typecheck → "$ vue-tsc -b" typecheck exit 0
     pnpm -C frontend test → "Test Files  113 passed (113)  Tests  1516 passed (1516)" test exit 0
     pnpm -C frontend unused → "Unused exports (1) usePaneDividers function src/ui/usePaneDividers.ts:38:17 / Unused exported types (1) DotsState type src/ui/useColumnDrag.ts:4:13" exit 1.
       These are only the new exports row 6 will import. Per the brief they stay exported.
  2. `just mutants` belongs to the orchestrator; the lines I expect to survive are under open_risks.
  3. Throwaway inline script, not committed: `pnpm exec tsx -e '…'` in frontend/. `ipc/index.ts` was stubbed in require.cache because import.meta.glob is not available under tsx. Output:
     minmax(min(220px, calc((100% - 2 * 2.5rem) / 3)), 33.33333333333333fr) 2.5rem minmax(min(220px, calc((100% - 2 * 2.5rem) / 3)), 33.33333333333334fr) 2.5rem minmax(min(220px, calc((100% - 2 * 2.5rem) / 3)), 33.33333333333333fr)
     minmax(min(220px, calc((100% - 2 * 1px) / 3)), 20fr) 1px minmax(min(220px, calc((100% - 2 * 1px) / 3)), 50fr) 1px minmax(min(220px, calc((100% - 2 * 1px) / 3)), 30fr)
     { local: 0.4, remote: 0.3 }

deviations_from_brief
  - The accept rule is stricter than the design's `target instanceof SVGSVGElement`: the svg must also be a direct child of the handle (`target.parentNode === currentTarget`). Reason: stripIcons.ts puts a Lucide <svg> inside every `.chunk-action` group, so any SVGSVGElement would also accept a nested icon svg. In MergeView.vue:235-236 the strip svg is a direct child of the wrapper. A null currentTarget is rejected.
  - Added export `dividerHandle(boundary, measure, split)` to usePaneDividers.ts. It is the testable rule. Its `accepts` takes `Pick<Event, "target" | "currentTarget">` and its `press()` takes no arguments; it is still assignable to useColumnDrag's handle type. usePaneDividers wraps two of them.
  - Added exported types ColumnHandle (the contract's handle parameter, named) and ColumnDragHandle. The `listeners` type is `Readonly<Record<ListenedEvent, (event: Event) => void>>`. Handlers narrow with `instanceof PointerEvent` / `MouseEvent` / `Element` before reading any field, so the node tests can use real Events and stubbed globals with no casts.
  - Order on pointerdown: preventDefault → press(); only a non-null drag captures, adds the class and sets dots to drag. The design says a null press does not capture.
  - When a drag ends (up, cancel, lost capture), dots become "hover", not "rest": while captured the pointer counts as over the handle (Pointer Events), and VS Code keeps hover after the drag. Scope dispose leaves "rest".
  - resetPaneSplit writes the thirds as JSON. resetWidth removes "yamt.files.width" (null → useStorage removeItem), as behaviour 6 asked me to say.
  - No explicit Number.isFinite check on the stored split: JSON gives no NaN, and 1e400 (Infinity) already fails the ≥/≤ checks, so the check would be an equivalent mutant. fileListWidth does check isFinite, because Number("Infinity") is accepted otherwise; a test covers it.
  - Needed outside my files, for PM6 `just map-check`, which I did not run: `.omp/skills/project-map/SKILL.md` must name ui/paneSplit.ts, ui/useColumnDrag.ts, ui/usePaneDividers.ts and ui/fileListWidth.ts, plus a state row for the split. Row 6 or the docs step owns this.
  - `frontend/node_modules` was missing in the worktree; I ran `pnpm -C frontend install --frozen-lockfile --offline` (lockfile unchanged).

open_risks
  - Mutants I expect to survive (equivalent):
    - useColumnDrag.ts: the `instanceof PointerEvent` / `MouseEvent` / `Element` guards in pressed, moved, ended, hovered, mousePressed and doubleClicked replaced by `true`. Every test event and target already passes them.
    - paneSplit.ts readSplit: `typeof local === "number"` / `typeof remote === "number"` replaced by `true`. A non-number that coerces past `>= 0.01` makes `local + remote` a string or NaN, which fails `<= 0.99`.
  - paneSplit.ts dragged: when a measured pane pair is smaller than 2 % of T, a share can fall under MIN_SHARE, and its fr factor under 1. This needs a layout that CSS minmax does not produce (T over about 22,000 px or a broken measure). The stored value then reads back as thirds. I followed the brief's formula unchanged.
  - useColumnDrag.ts ended → "hover": this relies on WebKit sending pointerleave after capture is released over somewhere else. It is unverified, and row 6's WebKit steps should check it.
  - fr factors print as long floats (`33.33333333333334fr`). That is valid CSS; whether WebKitGTK accepts `min()` with a percentage inside a grid track minimum is still unverified (design risk, row 6).
```