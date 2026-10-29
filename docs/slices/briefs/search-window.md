# Slice SearchWindow — the search panel above the file list in both windows, its state, both text sources, the key

Board "Search" row 5 (session 35). Request `docs/slices/request-search.md` (read it whole: rules 1–6, 8 (the click
side), 9, 11, 12, 13 are yours); decision `docs/plan.md` §2 **#127** (read it whole), #61 (the file-list key), #84 (the
column's width). Design: `.omp/run/notes/SearchDesign.md` option A §3.4 (store, panel, key, both roots), §3.6
"Window tests (B4)" (given facts). You build the designer's "B4". Built and committed before you (read-only, read
their code first): `SearchCoreB` — `frontend/src/search/index.ts` (brief `search-core.md`); `SearchGoToB` — the
handles' `goTo`/`lineUp`/`resultVersion` and the types `MergePane`, `PaneMatch`, `MergeGoTo`, `ResultLineUp`,
`RangeGoTo` from `ui/useMergeController.ts`/`ui/useRangeController.ts` (brief `search-goto.md`); `SearchRangeTexts` —
`RangeSource.searchTexts(from)` and the `SearchTexts` domain types (brief `search-range-texts.md`). A later slice
(`SearchConnect`) wires the views, stops and disk changes to the contract below: do not edit `MergeView.vue`,
`RangeView.vue`, `stops.ts`, `diskChanges.ts`. A fix round on the go-to (`SearchGoToR1`) runs beside you: it moves
`MergeController` into `editor/merge.ts` and changes `useMergeController.ts`'s internals, never an exported name or
type you use. New `ui/search*.ts` / `ui/Search*.vue` files are yours if you split by concern.

## Target

Owned: `frontend/src/ipc/keys.ts`, `frontend/src/ipc/keys.test.ts`, and under `frontend/src/ui/`: `keyText.ts`,
`keyText.test.ts`, `fileListKey.ts`, `fileListKey.test.ts` (new), `searching.ts` (new), `searching.test.ts` (new),
`mergeSearch.ts` (new), `mergeSearch.test.ts` (new), `rangeSearch.ts` (new), `rangeSearch.test.ts` (new),
`searchText.ts` (new), `searchText.test.ts` (new), `SearchPanel.vue` (new), `SearchResults.vue` (new),
`SideColumn.vue` (new), `FileList.vue`, `App.vue`, `RangeApp.vue`, `store.ts`, `store.test.ts`, `rangeStore.ts`,
`rangeStore.test.ts`, `problem.ts`, `problemText.ts`, `problemText.test.ts`, `sideHeaders.ts`, `AGENTS.md`.

Read-only: everything else (`search/**`, `editor/**`, the handles, `CompareApp.vue`, `CompareTabList.vue` — the compare
window keeps its file-list key and layout unchanged). Docs are the orchestrator's. If a root or store file is over
the size caps after your change, split by concern into a new `ui/` file and report it.

Non-goals: the views' go-to and Result-change wiring, stops, disk changes (row 6); whole word, regex, replace,
include/exclude, history, F4, Refresh/Clear/Collapse All; keeping the query across restarts; the compare window.

## Contract (fixed; you may add, never change)

```ts
// ui/searching.ts — one per window store; remembered while hidden, never stored
export type PaneIcon = "panel-left" | "panel-left-right-dashed" | "panel-right";
export type SearchPaneInfo<P extends string> = {
  readonly pane: P;
  readonly icon: PaneIcon;
  readonly title: string;
};
export type SearchSource<P extends string> = {
  readonly layout: Layout<P>;
  files(): AsyncIterable<SearchedFile<P>>; // window file order; files without text left out; ends after one report at a read failure
  file(path: string): Promise<SearchedFile<P> | null>; // one file now; null: no text, or a reported failure
  forget(path: string): void;
  forgetAll(): void;
};
export type GoToRequest<P extends string> = {
  readonly id: number;
  readonly path: string;
  readonly pane: P;
  readonly match: PaneHit | null;
};
export type Searching<P extends string> = {
  readonly shown: Readonly<ShallowRef<boolean>>;
  readonly query: Readonly<ShallowRef<string>>;
  readonly matchCase: Readonly<ShallowRef<boolean>>;
  readonly panesOn: Readonly<ShallowRef<ReadonlySet<P>>>; // all on at first
  readonly closed: Readonly<ShallowRef<ReadonlySet<string>>>; // emptied by each full run
  readonly results: Readonly<ShallowRef<SearchResults<P> | null>>;
  readonly running: Readonly<ShallowRef<boolean>>;
  readonly goTo: Readonly<ShallowRef<GoToRequest<P> | null>>; // consumed by the shown view (row 6) through took(id)
  readonly panes: ComputedRef<readonly SearchPaneInfo<P>[]>;
  readonly rows: ComputedRef<readonly ListRow<P>[]>;
  readonly summary: ComputedRef<Summary | null>;
  type(text: string): void; // full run after SEARCH_PAUSE_MS = 300 of quiet
  enter(): void; // full run at once
  toggleMatchCase(): void; // full run at once
  togglePane(pane: P): void; // no run; nothing dismissed comes back
  toggleGroup(path: string): void;
  dismissPlace(path: string, key: PlaceKey): void;
  dismissGroup(path: string): void;
  go(path: string, place: Place<P>, pane: P | null): void; // null: goToPane; sets goTo, then opens the file as a list click does
  took(id: number): void;
  focusShownFile(): void; // goTo = { shown path, lead pane, match: null }
  toggleKey(event: KeyPress, platform: string): void; // windowKey(..., "toggle-search", ...)
  changed(path: string): void; // forget + one-file re-run after the same pause; stale replies dropped per path
  clear(): void; // a stop ended: cancel, forgetAll, results null; query, case, filters, shown kept
  rerun(): void; // full run if the box has text
};
export function createSearching<P extends string>(deps: {
  readonly source: SearchSource<P>;
  readonly panes: () => readonly SearchPaneInfo<P>[];
  readonly open: (path: string) => void;
  readonly shownPath: () => string | null;
  readonly keys: WindowKeyTarget; // asking + settings: the file-list key's conditions
}): Searching<P>;

// ui/fileListKey.ts — the one window-key guard, used by fileListKey and toggleKey
export type WindowKeyTarget = {
  readonly asking: Asking;
  readonly settings: Readonly<ShallowRef<SettingsInUse>>;
};
export function windowKey(
  target: WindowKeyTarget,
  action: "toggle-file-list" | "toggle-search",
  event: KeyPress,
  platform: string,
): boolean; // true: handled (preventDefault done)

// ui/mergeSearch.ts — MERGE_LAYOUT = { panes: ["left", "center", "right"], lead: "center" }
export type LiveResults = {
  track(path: string, live: { lineUp(): ResultLineUp | null }): void; // row 6: MergeView, like the close guard's track
  untrack(path: string, live: { lineUp(): ResultLineUp | null }): void;
};
// store.ts: `search: Searching<MergePane>`, `liveResults: LiveResults`; rangeStore.ts: `search: Searching<Column>`
// ui/rangeSearch.ts — RANGE_LAYOUT = { panes: ["left", "right"], lead: "right" }
// problem.ts: { action: "search"; cause: ProblemCause }; problemText.ts: "Search stopped: …"
// ipc/keys.ts: "toggle-search", default Mod-Shift-s; keyText.ts: "Toggle search", place "anywhere in the merge and range windows", group "Window": ["toggle-file-list", "toggle-search"]
// sideHeaders.ts: RESULT_HEADER = "Result"
```

## Change

Follow design §3.4: the runner (a full run takes a new generation; per file `filePlaces` → `withFile`; publishes
`results` and yields with `setTimeout(0)` once 8 ms passed in a slice; stops when the generation changes or the
result is cut); the merge source (text files only: `unsupported === null`; per file the Result is the live
`lineUp()` when tracked and built, else `opened`'s data, else one `loadFile` reply kept until `forget`; `DiskNotText`
has no Result text; failures through `reportFailure` with `action: "search"`; titles from `sideHeader` and
`RESULT_HEADER`); the range source (yields kept texts, then pages from the remembered `next`, paths from
`start.files` by id, titles `sideHeading`); `SideColumn.vue` takes the width and handle from `FileList.vue` (#84's
`usePanelWidth`, label "File list width", key and bounds unchanged) with a `search` slot on top, shown while
`fileListShown || search.shown`; `SearchPanel.vue` (generic over `P`): "Search" header row, a one-line box with Match
Case inside its right end (`case-sensitive`, `aria-pressed`, `@mousedown.prevent`), the pane toggles under it (square,
`aria-pressed:bg-row-selected`, titled with the pane), the summary, `SearchResults`; at most half the column, the
whole column while the file list is hidden; focus on show (box focused, text selected) and on hide (back where it was,
else `focusShownFile()`); `SearchResults.vue` with `useVirtualList` (rows: chevron, file icon, name, dimmed folder,
count, × "Dismiss" on hover; place rows: preview with the match in `bg-search-match`, one icon per on pane titled
"<title>, line N", × on hover; keys Up/Down, Left/Right, Enter → `go`; Down from the box enters the list);
`searchText.ts` (VS Code's words: "N results in M files" with singular forms, "No results found.", "Every pane is
filtered out.", "Searching…", the cut sentence); both roots' window keydown call `search.toggleKey` after
`fileListKey`; `ui/AGENTS.md` one line.

## Acceptance

- Node, design §3.6 "Window tests (B4)" (fake timers), each named for its bug, plus `windowKey` (ignored when
  `defaultPrevented`, while a question waits, for another key; Ctrl+Shift+S never matches Save). `ui/` tests kill the
  mutants on your `.ts` lines (Stryker, SP5).
- WebKit, both fixture pages (`just app-session start-fixture` and `--range-case review`), dark **and** light:
  Ctrl+Shift+S shows the panel above the file list with the box focused and its text selected; typing a word finds
  rows in every pane with the right icons (an unchanged line one row with all icons; a one-side line its own row);
  pane filters (one off, two off, all off → "Every pane is filtered out."); Match Case narrows; a group closes and
  opens; × on a row and a group, Enter brings them back; Ctrl+Shift+S hides and shows the same query and rows;
  Ctrl+B with the panel shown leaves the panel the whole column; the column's width handle sizes both; a row click
  opens its file (the go-to itself lands in row 6). Settings → Keymap lists "Toggle search" and rebinding it works.
  The compare window's file list and Ctrl+B unchanged. Screenshots.
- `pnpm -C frontend typecheck`, `lint`, `test`, `fmt:check`, `unused` pass.

## Skills

`skill://vue-conventions`, `skill://ts-conventions`, `skill://verification` (plus your autoloaded ones).
