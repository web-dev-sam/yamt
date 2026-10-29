# Search design: one search across all files in the merge and range windows

**Recommendation: option A.** The search code lives in a new framework-free TypeScript module, `frontend/src/search/`. It does the matching, groups matches into rows (the place rule), orders them, applies the pane filters and dismissals, and stops at 20,000 rows. Rust only supplies texts:

- **Merge window:** no Rust change. Files that aren't open come from the existing `load_file`. An open file's Result comes live from its controller.
- **Range window:** one new async, batched command, `search_range_texts`. It returns each file's texts and the line ranges where the sides differ, without word diffs.

I made no tool runs other than reading. Facts below cite `path:line` at HEAD. `[INFERENCE]` marks guesses.

---

## 1. Facts re-checked at HEAD

| Fact | Where |
|---|---|
| `MergeSession::load` builds the Result "as it would open" from the texts kept in memory. It reads no disk and changes nothing. | `crates/session/src/session.rs:178-212` |
| `load_file` is a synchronous command | `src-tauri/src/commands.rs:101-103` |
| The store already holds `FileMergeData` (with texts) for opened files | `ui/store.ts:115` |
| A view's live Result is reachable only through `snapshot()` | `editor/index.ts:251-253`, `ui/useMergeController.ts:138` |
| The only registry keyed by path is the close guard's `track`/`untrack` | `ui/closeGuard.ts:11-12,45-52`, called at `MergeView.vue:83,117` |
| The merge controller is built in a post-flush watch, after its host elements exist | `ui/useMergeController.ts:188-190` |
| The range controller is built only after the file loads, the hosts exist and the thread list was read once | `ui/useRangeController.ts:89-107,121` |
| Range: every load opens a new `cat-file --batch` process and runs `compare` with word diffs | `crates/range/src/load.rs:8-31`, `merge-core/src/compare.rs:34-60` |
| The range window's async commands run on a worker | `blocking_reply`, `src-tauri/src/ipc_error.rs:75-78`, used at `src-tauri/src/range.rs:86-91` |
| Rust splits lines at `\n` only | `merge-core/src/line.rs:109-111` |
| Merge panes: the Result follows the selection in the same transaction; a side pane reveals hidden lines through `revealOnOwner`, then scrolls to the centre again | `folds.ts:109`, `folds.ts:222-246` |
| Range columns: the left owns the fold state, the right reveals through `revealOnOwner` | `columnFolds.ts:49,180` |
| Find selects a match with `EditorView.scrollIntoView(..., {y: "center"})`, userEvent `select.search`. That is a CodeMirror scroll request, which is #82's safe path. | `selectMatch`, `editor/internal/findMatch.ts:61-68` |
| `revealSpan` writes `scrollTop` directly; the go-to will not use it | `viewport.ts:68-77` |
| `FileList.vue`'s `<aside>` carries the width and the handle | `FileList.vue:23,53-56,105` |
| Each root's window keydown handler | `App.vue:48-50`, `RangeApp.vue:48-50` |
| The window-key guard (`fileListKey`) | `ui/fileListKey.ts:16-26` |
| Key table: actions and defaults; Shift counts only for letters | `ipc/keys.ts:3-20,191-207,241` |
| Lucide icons `case-sensitive`, `panel-left`, `panel-left-right-dashed`, `panel-right` exist | `@iconify-json/lucide` icons.json:994,3816,3828,3831 |
| `useVirtualList` exists | `@vueuse/core` 15.0.0 (`package.json`), `dist/index.d.ts:5375` |
| The theme token `--color-search-match` is defined in every theme | `style.css:59`, `themes/*.css` |
| Fence regex: a file named `src/ui/range*` belongs to the range window only (PM9) | `frontend/scripts/fences.ts` `WINDOW_FILE` |

---

## 2. Options

### Option A (recommended): search core in the window; Rust supplies texts

**Data structures.** `Query`, `SearchedFile<P>`, `Place<P>`, `SearchResults<P>`, all generic over the pane key `P`, written out in full in §3.1. The merge window uses panes `"left" | "center" | "right"` with the Result as the lead pane. The range window uses `Column` (`"left" | "right"`) with the new side as the lead.

**Where each step runs.**
- Matching, the place rule, order, filters, dismissals and the cap: `search/`, all pure TypeScript.
- Merge texts:
  - An opened file's Result comes from `MergeHandle.lineUp()`.
  - Its sides come from the `FileMergeData` in `opened`.
  - A file that isn't open comes from `loadFile`, kept once per stop.
- Range texts: `search_range_texts(from)` pages about 4 MiB per call, read with one blob reader per page, line ranges only. The window keeps them for its whole run, since the texts of a commit pair never change.

**Visions served.** 1 (the matcher and place rule are TypeScript the owner reads), 2 (one matcher), 5 (no Rust in the merge window, one command in the range window).

**Cost per run on a large range.** Example: N = 5,000 text files, T = 100 MB on both sides together.
- First run: about T / 4 MiB ≈ 25 async calls. Each runs one `cat-file --batch` and line diffs only, on a worker. About T of JSON reaches the window, which then keeps about 2T as JS strings `[INFERENCE: UTF-16]`.
- Later runs: matching only, about T scanned in slices of 8 ms or less `[INFERENCE: ≈0.3–1 s to finish, never blocking]`.

### Option B: everything in Rust

**Data structures.** A `merge-core::search` module (matcher with UTF-16 columns, place rule, order, cap). `session::search(query, live: Vec<LiveResult { path, text, changes }>)`. `range::search(query, from)`, with texts cached in `RangeState`.

**Commands.**
- `search_stop(query, live)`
- `search_stop_file(query, path, live)`
- async `search_range(query, progress: Channel<SearchPage>)`

The window keeps filters, dismissals and the panel.

**Costs.**
- The owner (a Rust beginner) would have to read the matcher and place rule in Rust.
- Rust's standard library has no simple case folding (`char::to_lowercase` is the full mapping), so columns need a hand-written folding map with UTF-16 offsets — or a `regex` dependency, which is a DR3 decision.
- An opened file's live Result and its current change lines cross the IPC on every 300 ms pause.
- The place-rule key that dismissals rely on would live in Rust while the dismissals live in TypeScript.
- Its strength: window memory stays at about 20,000 rows, and per run Rust scans T and diffs only the files that match.

**Visions served.** 2 and 3. It costs vision 1 and vision 5.

### Option C: option A without any new Rust

The range window reads through the existing `loadRangeFile`, four calls in flight at a time, and keeps texts and differences.

**Costs.** The first run on a large range makes N IPC calls, starts N `cat-file` processes and computes N word diffs (`load.rs:12`, `compare.rs:34-60`) `[INFERENCE: ≈5–15 s for N = 5,000]`. The window never freezes, but the summary says "Searching…" for a long time.

**Visions served.** 5 (smallest surface). It costs on rule 12's large range.

---

## 3. Recommendation (option A) in full

**What it costs.**
- A very large range keeps its texts in the webview for the whole run.
- The first search on a large range waits on Rust paging.
- One merge-core function, one range method and one command are added.

### 3.1 Data structures (`frontend/src/search/index.ts`, the module's only surface)

```ts
export type Query = { readonly text: string; readonly matchCase: boolean };
export type LineRange = { readonly start: number; readonly len: number }; // 0-based lines of one pane's text
export type Layout<P extends string> = { readonly panes: readonly [P, ...P[]]; readonly lead: P };

/** One file's searched texts and line-up data, from any source. */
export type SearchedFile<P extends string> = {
  readonly path: string;
  readonly texts: Readonly<Record<P, string | null>>;           // null: the pane has no text (DiskNotText)
  readonly changes: readonly Readonly<Record<P, LineRange>>[];  // sorted and disjoint in every pane
};

export type PaneHit = { readonly line: number; readonly from: number; readonly to: number }; // UTF-16 columns in that line
export type PaneEntry<P extends string> = { readonly pane: P; readonly hit: PaneHit };
export type PlaceKey = string & { readonly __brand: "PlaceKey" };      // built only in internal/places.ts
export type Preview = { readonly before: string; readonly match: string; readonly after: string };
export type Place<P extends string> = {
  readonly key: PlaceKey;
  readonly hits: readonly [PaneEntry<P>, ...PaneEntry<P>[]];  // layout order, at most one per pane
  readonly preview: Preview;                                   // from the lead hit, else the first hit
};
export type FileGroup<P extends string> = {
  readonly path: string;
  readonly rank: number;                         // index in the window's file order
  readonly places: readonly Place<P>[];          // rule-7 order
  readonly dismissed: ReadonlySet<PlaceKey>;     // only keys still among `places`
};
export type SearchResults<P extends string> = {
  readonly query: Query;
  readonly groups: readonly FileGroup<P>[];      // by rank; only files with places
  readonly dismissedFiles: ReadonlySet<string>;  // group dismissals: kept across one-file re-runs, cleared by a full run
  readonly found: number;                        // places kept, ≤ MAX_ROWS
  readonly cut: boolean;
};
export type ListRow<P extends string> =
  | { readonly kind: "group"; readonly path: string; readonly count: number; readonly open: boolean }
  | { readonly kind: "place"; readonly path: string; readonly place: Place<P>; readonly shown: readonly [PaneEntry<P>, ...PaneEntry<P>[]] };
export type Summary =
  | { readonly kind: "searching" }
  | { readonly kind: "noResults" }
  | { readonly kind: "filteredOut" }
  | { readonly kind: "results"; readonly rows: number; readonly files: number; readonly cut: boolean };

export const MAX_ROWS = 20_000;
export type Matcher; // opaque: one RegExp built once per query
export function matcherOf(query: Query): Matcher | null;                         // null for empty text
export function filePlaces<P extends string>(file: SearchedFile<P>, matcher: Matcher, layout: Layout<P>, limit: number): { readonly places: readonly Place<P>[]; readonly cut: boolean };
export function emptyResults<P extends string>(query: Query): SearchResults<P>;
export function withFile<P extends string>(results: SearchResults<P>, file: { path: string; rank: number; places: readonly Place<P>[]; cut: boolean }): SearchResults<P>;
export function dismissPlace<P extends string>(results: SearchResults<P>, path: string, key: PlaceKey): SearchResults<P>;
export function dismissFile<P extends string>(results: SearchResults<P>, path: string): SearchResults<P>;
export function listRows<P extends string>(results: SearchResults<P>, on: ReadonlySet<P>, closed: ReadonlySet<string>): readonly ListRow<P>[];
export function summaryOf<P extends string>(results: SearchResults<P> | null, on: ReadonlySet<P>, running: boolean): Summary | null; // null: empty box
export function goToPane<P extends string>(place: Place<P>, on: ReadonlySet<P>, layout: Layout<P>): PaneEntry<P> | null;
```

**The matcher (one place).**
- `new RegExp(escaped, matchCase ? "gu" : "giu")`, where `escaped` escapes only the syntax characters `^$\.*+?()[]{}|/`.
- The `i` and `u` flags together give Unicode simple case folding. Positions are offsets in the original string, so UTF-16 columns map straight onto CodeMirror positions.
- `text.matchAll` runs over the whole text. It is stateless, and matches never overlap.
- The line number is the count of `\n` before the match. A trailing `\r` is left out of the line's text.
- A query typed into a one-line box can't contain `\n` or `\r`, so a match never crosses a line.
- Each pane stops scanning after `limit` hits.

**The place rule (one place, `internal/places.ts`).** For each hit of pane `p` on line `x`:
- **Inside change `k`** when `changes[k][p].start ≤ x < start + len`. Group key: `("in", k, lineText, from, ordinal)`. The ordinal counts the earlier hits of pane `p` in change `k` with the same `(lineText, from)`, so identical lines pair first-with-first (rule b).
- **Otherwise**, find the last change `c` that ends at or before `x` in pane `p`. The aligned lead line is `x − end_p(c) + end_lead(c)`, or `x` when there is no such change. Group key: `("out", alignedLead, from)` (rule a).
- One group becomes one `Place` with its hits in layout order.

**Order.** Sort places by the tuple `(anchor, phase, paneRank, line, from)`:
- A place with a lead hit: `(leadLine, 1, 0, leadLine, from)`.
- An outside place without a lead hit: `(alignedLead, 1, 0, alignedLead, from)`.
- A side-only place inside change `k`: `(changes[k][lead].start, 0, firstPaneRank, line, from)`. It sorts at its change's place in the lead pane, before that line's lead rows.

**Key.** `JSON.stringify([panes, from, lineText(preview source), ordinal])`. The ordinal counts earlier places in the file with the same first three parts.

**Preview.** Up to 26 characters before the match, leading whitespace trimmed, `…` when cut `[INFERENCE: VS Code's lcut(before, 26)]`; then the match; then the rest of the line, which CSS truncates.

**Dismissals across a one-file re-run (rule 10).** `withFile` keeps only the dismissed keys that are still among the new places. A place whose line changed has a new key and comes back. A full run starts from `emptyResults`, so everything returns: Enter, a changed query, Match Case.

**The cap.**
- `withFile` re-applies `MAX_ROWS` over the groups by rank and sets `cut`.
- A full run stops reading files once `cut` is set.
- When a file is cut, its rows are the first ones found in each pane.

### 3.2 IPC: one command, range window only (contract change follows `skill://ipc-contract`)

**Rust.**

```rust
// crates/merge-core/src/compare.rs  (compare() now builds on line_changes: one chunk→range rule)
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Type)]
pub struct LineChange { pub left: LineRange<LeftLine>, pub right: LineRange<RightLine> }
#[must_use] pub fn line_changes(left: &str, right: &str) -> Vec<LineChange>; // compute_chunks(l, l, r, gap 0), no words

// crates/range/src/lib.rs
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Type)]
pub struct SearchText { pub file: RangeFileId, pub left: String, pub right: String, pub changes: Vec<LineChange> }
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Type)]
pub struct SearchTexts { pub files: Vec<SearchText>, pub next: Option<RangeFileId> }

// crates/range/src/search.rs (+ `impl Range { pub fn search_texts(&self, from: RangeFileId) -> Result<SearchTexts> }` in open.rs)
const SEARCH_PAGE_BYTES: usize = 4 * 1024 * 1024; // text bytes read per page; a page reads at least one file
```

**Page rules.**
- Reads the files from `from` on, with one `BlobReader` per page.
- Leaves out every file whose `load` would not answer `Texts`: submodule, kind change, mode only, binary, too large, not UTF-8.
- `load.rs` is split so `decide` and the read-and-UTF-8 step are shared by `load_file` and `search_texts`; the rule stays in one place.
- `next = None` after the last file.
- `from` past the end → `Error::UnknownFile`.

**src-tauri** (`range.rs`, registered in `commands.rs` next to `range::load_range_file`):

```rust
#[tauri::command] #[specta::specta]
pub(crate) async fn search_range_texts<R: Runtime>(window: WebviewWindow<R>, from: RangeFileId) -> Result<SearchTexts, IpcError> {
    blocking_reply(move || Ok(window.state::<RangeState>().range.search_texts(from)?)).await
}
```

**Errors.** Existing ones only: `UnknownRangeFile { file }` and `Git { message }` (`ipc_error.rs:160-174`).

**Bindings.** `just bindings` regenerates `ipc/bindings.ts`.

**Frontend domain.**

```ts
// ipc/rangeDomain.ts
export type LineChange = { readonly left: LineRange<LeftLine>; readonly right: LineRange<RightLine> };
export type SearchText = { readonly file: RangeFileId; readonly left: string; readonly right: string; readonly changes: readonly LineChange[] };
export type SearchTexts = { readonly files: readonly SearchText[]; readonly next: RangeFileId | null };
export function toSearchTexts(raw: Generated.SearchTexts): SearchTexts;
// ipc/RangeSource.ts
searchTexts(from: RangeFileId): Promise<SourceResult<SearchTexts>>;
```

- `tauriRange.ts` maps the command through `converted`.
- `fixtureRange.ts` answers in one page from its cases' `texts` files: `changes` = each difference's `{left, right}`; `next: null`.

### 3.3 Editor go-to contract (both controllers)

```ts
// editor/index.ts (exports)
export type { Pane as MergePane } from "./internal/geometry";            // "left" | "center" | "right"
export type PaneMatch = { readonly line: number; readonly from: number; readonly to: number };
export type MergeGoTo = { readonly pane: MergePane; readonly match: PaneMatch | null };   // null: only the keyboard
export type ResultLineUp = {
  readonly result: string;                                                     // snapshot().asShown()
  readonly changes: readonly Readonly<Record<MergePane, { readonly start: number; readonly len: number }>>[]; // center live, sides fixed
};
MergeController.goTo(target: MergeGoTo): void;
MergeController.lineUp(): ResultLineUp;
MergeController.onResultChange(listener: (() => void) | null): void;  // after each Result transaction with docChanged
// editor/range.ts
export type RangeGoTo = { readonly pane: Column; readonly match: PaneMatch | null };
RangeController.goTo(target: RangeGoTo): void;
```

- **Internals.** A new `internal/goTo.ts`:
  - `matchRange(doc, match)` clamps the line to the document and the columns to that line. A stale search must not throw.
  - `goTo(view, match)` dispatches `selectMatch(matchRange(...))` from `findMatch.ts:61` (selection plus a centred `scrollIntoView`, #82's scroll-request path), then calls `view.focus()`.
  - `changeLines(doc, span)` turns a `ChunkSpan` into a `LineRange`. It handles an insertion point and a span ending mid-line at the end of the document (CM1).
- **No new reveal path.** The selection itself shows a collapsed stretch:
  - merge Result: `folds.ts:109`;
  - merge side panes: `revealOnOwner`, `folds.ts:222-246`;
  - range left column: `columnFolds.ts:49`;
  - range right column: `columnFolds.ts:180`.
- **`useMergeController`.** `MergeHandle` gains:
  - `resultVersion: Readonly<ShallowRef<number>>`, bumped at every build and on `onResultChange`;
  - `lineUp(): ResultLineUp | null`;
  - `goTo(target)`. While no controller exists the target is kept. It is applied once, right after the next build, in the watch at `:188` (that is how a file just opened by the click is reached), and a later rebuild does not apply it again.
  - Re-exports `MergePane`, `PaneMatch`, `MergeGoTo`, `ResultLineUp`.
- **`useRangeController`.** `RangeHandle.goTo(target: RangeGoTo)`, kept pending in `Live` and applied in `build()` after `parts.build` (`:105`). `ShownRange` picks `"goTo"`. Re-exports `RangeGoTo`.

### 3.4 Store, panel, key and both roots

```ts
// ui/searching.ts — the one owner per window (both stores hold one); remembered while hidden, never stored
export type PaneIcon = "panel-left" | "panel-left-right-dashed" | "panel-right";
export type SearchPaneInfo<P extends string> = { readonly pane: P; readonly icon: PaneIcon; readonly title: string };
export type SearchSource<P extends string> = {
  readonly layout: Layout<P>;
  files(): AsyncIterable<SearchedFile<P>>;              // file order; files without text left out; ends (after one report) at a read failure
  file(path: string): Promise<SearchedFile<P> | null>;  // one file now; null: no text, or a reported failure
  forget(path: string): void;
  forgetAll(): void;
};
export type GoToRequest<P extends string> = { readonly id: number; readonly path: string; readonly pane: P; readonly match: PaneHit | null };
export type Searching<P extends string> = {
  readonly shown: Readonly<ShallowRef<boolean>>;
  readonly query: Readonly<ShallowRef<string>>;
  readonly matchCase: Readonly<ShallowRef<boolean>>;
  readonly panesOn: Readonly<ShallowRef<ReadonlySet<P>>>;          // all on at first
  readonly closed: Readonly<ShallowRef<ReadonlySet<string>>>;      // emptied by each full run (groups open at first)
  readonly results: Readonly<ShallowRef<SearchResults<P> | null>>;
  readonly running: Readonly<ShallowRef<boolean>>;
  readonly goTo: Readonly<ShallowRef<GoToRequest<P> | null>>;
  readonly panes: ComputedRef<readonly SearchPaneInfo<P>[]>;
  readonly rows: ComputedRef<readonly ListRow<P>[]>;
  readonly summary: ComputedRef<Summary | null>;
  type(text: string): void;            // full run after SEARCH_PAUSE_MS = 300 of quiet
  enter(): void;                       // full run at once
  toggleMatchCase(): void;             // full run at once
  togglePane(pane: P): void;           // no run, nothing dismissed comes back
  toggleGroup(path: string): void;
  dismissPlace(path: string, key: PlaceKey): void;
  dismissGroup(path: string): void;
  go(path: string, place: Place<P>, pane: P | null): void;  // null: goToPane; then opens the file as a list click does
  took(id: number): void;
  focusShownFile(): void;              // request { shownPath, lead, match: null }
  toggleKey(event: KeyPress, platform: string): void;  // windowKey(..., "toggle-search", ...)
  changed(path: string): void;         // forget + one-file re-run after the same pause; stale replies dropped per path
  clear(): void;                       // stop ended: cancel, forgetAll, results null; query/case/filters/shown kept
  rerun(): void;                       // full run if the box has text
};
export function createSearching<P extends string>(deps: {
  readonly source: SearchSource<P>;
  readonly panes: () => readonly SearchPaneInfo<P>[];
  readonly open: (path: string) => void;
  readonly shownPath: () => string | null;
  readonly keys: WindowKeyTarget;      // asking + settings: the file-list key's conditions
}): Searching<P>;
```

- **Runner.**
  - A full run takes a new generation, then for each file: `filePlaces` → `withFile`.
  - After any file, once 8 ms or more have passed in the current slice, it publishes `results` and yields with `setTimeout(0)`.
  - It stops when the generation changes or the result is cut.
- **Merge source** (`ui/mergeSearch.ts`, `MERGE_LAYOUT = { panes: ["left","center","right"], lead: "center" }`):
  - Searches the text files: `files` entries with `unsupported === null`.
  - Per file: the Result is the live `lineUp()` if the file is tracked and its controller is built. Otherwise `opened`'s data. Otherwise the kept `loadFile` reply.
  - `LiveResults = { track(path, live: { lineUp(): ResultLineUp | null }), untrack(path, live) }`, the close guard's pattern.
  - Failure: `reportFailure(state, { action: "search", cause })`.
  - Pane titles: `sideHeader("local"|"remote", sideNames).text` and the new `RESULT_HEADER = "Result"` in `sideHeaders.ts`.
- **Range source** (`ui/rangeSearch.ts`, `RANGE_LAYOUT = { panes: ["left","right"], lead: "right" }`):
  - Yields the kept prefix of texts, then pages from the remembered `next`.
  - Paths come from `start.files` by id.
  - Titles: `sideHeading(start.left/right)`.
- **How the search reads live text without a second copy (constraint 3).** The source reads each opened file's live Result through the registry at the moment it searches that file. The store keeps only previews of at most about 26 characters plus the match and its line. Rule 10 is triggered by `resultVersion`: B5's MergeView watches it and calls `search.changed(path)`. Disk changes call `changed` for every changed path. A new stop calls `clear` and, once the new list arrives, `rerun`. `GoToRequest` holds a line and columns — the search's line space, like `ThreadLine` — never a `DocPos`.
- **Components.**
  - **`SideColumn.vue`** takes the width and handle from `FileList.vue`: `usePanelWidth(column)`, `PanelWidthHandle label="File list width"`, `mr-(--island-overlap)`. It has a `search` slot on top and the list below. The roots wrap it in `v-show="fileListShown || shown"`.
  - **`FileList.vue`** keeps its island as `flex-1 min-h-0`.
  - **`SearchPanel.vue`** (generic `P`), an island with `max-h-1/2`, or `flex-1` while the list is hidden. It contains:
    - a "Search" header row;
    - a one-line box (placeholder "Search", Enter, Down into the list) with a Match Case toggle inside its right end: `CaseSensitive`, `aria-pressed`, `@mousedown.prevent`;
    - one square toggle per pane: `aria-pressed:bg-row-selected`, the pane's title;
    - the summary;
    - `SearchResults`.
  - **Focus on show and hide.** On show it remembers `{ element: document.activeElement, path: shownPath }`, then focuses and selects the box after the DOM update. On hide, decided in a `flush: "pre"` watcher, and only when focus is in the panel or on body: if the shown path is unchanged and the element is still connected, it focuses that element; otherwise `focusShownFile()`.
  - **`SearchResults.vue`** uses `useVirtualList(rows, { itemHeight: 22 })`. Group rows: chevron, `fileIcon`, name, dimmed folder, count, × "Dismiss" on hover. Place rows: preview with the match in `bg-search-match`, one icon per on pane titled `"<title>, line N"`, × on hover. Keys: Up/Down, Left/Right to close/open a group, Enter → `go`. `scrollTo` keeps the active row in view.
- **Key.**
  - `KEY_ACTIONS` gains `"toggle-search"`, default `Mod-Shift-s`.
  - `ACTION_NAMES`: "Toggle search". `ACTION_PLACES`: "anywhere in the merge and range windows". `KEYMAP_GROUPS` "Window": `["toggle-file-list", "toggle-search"]`.
  - `fileListKey.ts` gains `windowKey(target, action, event, platform): boolean`, the one guard, which `fileListKey` and `toggleKey` both use.
  - Both roots' keydown handler calls `search.toggleKey` after `fileListKey`.
- **Stores.**
  - `store.ts`: `search: Searching<MergePane>`, `liveResults: LiveResults`, and `search` in `State`.
  - `rangeStore.ts`: `search: Searching<Column>`.
  - `problem.ts`: `{ action: "search"; cause }`. `problemText.ts`: "Search stopped: …".
- **Words** (`ui/searchText.ts`): "N results in M files" (singular forms), "No results found.", "Every pane is filtered out.", "Searching…", and the cut line "The result set only contains a subset of all matches. Be more specific in your search to narrow down the results." `[INFERENCE: VS Code's words]`.

### 3.5 Builds: ownership, size, order

Waves run at most two builds at a time: **W1: B1 ∥ B2 → W2: B3 ∥ B4 → W3: B5.** B4 compiles only once B3 lands; it imports the types `MergePane`, `ResultLineUp` and `MergeGoTo` from `./useMergeController`, as written in §3.3.

| Build | Owner | Files (all new or changed) | ≈ changed lines |
|---|---|---|---|
| **B1** Rust + range IPC | rust-impl | `crates/merge-core/src/compare.rs`, `crates/merge-core/src/lib.rs`, `crates/range/src/{lib,load,open,search}.rs`, `src-tauri/src/range.rs`, `src-tauri/src/commands.rs`, `frontend/src/ipc/{bindings (generated),rangeDomain,RangeSource,tauriRange,fixtureRange,index}.ts`, `frontend/src/ipc/fixtureRange.test.ts` (16 files) | 520 |
| **B2** search core | web-impl | `frontend/src/search/index.ts`, `search/internal/{match,places,preview,results,list}.ts` plus a `.test.ts` for each, `search/AGENTS.md`, `frontend/vite.config.ts` (node include), `frontend/.oxlintrc.json` (framework-free list), `frontend/scripts/fences.ts` + `fences.test.ts` (search is framework-free and imports no other `src/` module, like jsonrpc), `justfile` (mutants paths) (17 files) | 1,300 |
| **B3** editor go-to + handles | web-impl | `frontend/src/editor/index.ts`, `editor/range.ts`, `editor/internal/goTo.ts` + `goTo.test.ts`, `ui/useMergeController.ts` + test, `ui/useRangeController.ts` + test (8 files) | 450 |
| **B4** window | web-impl | `ipc/keys.ts`; `ui/{keyText.ts, keyText.test.ts, fileListKey.ts, searching.ts, searching.test.ts, mergeSearch.ts, mergeSearch.test.ts, rangeSearch.ts, rangeSearch.test.ts, searchText.ts, searchText.test.ts, SearchPanel.vue, SearchResults.vue, SideColumn.vue, FileList.vue, App.vue, RangeApp.vue, store.ts, rangeStore.ts, problem.ts, problemText.ts, sideHeaders.ts}` (23 files) | 1,450 |
| **B5** connect + docs | web-impl | `ui/MergeView.vue` (track/untrack live, `resultVersion` → `changed`, consume `goTo` when shown and on its path, `RESULT_HEADER`), `ui/RangeView.vue` (consume `goTo`), `ui/stops.ts` (`clear` in `clearStop`, `rerun` after `loadFiles`) + `stops.test.ts`, `ui/diskChanges.ts` (`changed` for every changed path) + the fakes in `saving.test.ts` and `listing.test.ts`, `docs/architecture.md` (§3.8, §4, §5.1 row, §5.2, §5.4), `.omp/skills/project-map/SKILL.md`, `.omp/skills/ipc-contract/SKILL.md`, `frontend/src/ui/AGENTS.md`, `frontend/src/editor/AGENTS.md`, `CHANGELOG.md` (13 files) | 450 |

The view's go-to watch (B5):

```ts
watch([search.goTo, () => props.shown], ([r, shown]) => { if (r && shown && r.path === path) { handle.goTo({ pane: r.pane, match: r.match }); search.took(r.id); } }, { immediate: true, flush: "post" })
```

### 3.6 Tests

**Pure tests (B2), each with the bug it catches.**

| Test | Catches |
|---|---|
| `a.b` does not match `axb` | an unescaped RegExp |
| Case-insensitive by default; Match Case narrows `Foo`/`foo` | an inverted flag |
| `İx foo` puts `foo` at column 3 | lowercasing the line, which shifts offsets |
| `😀foo` puts `foo` at column 2 | code-point columns instead of UTF-16 |
| CRLF: line text has no `\r` and the line count is right | `\r\n` counted as two breaks |
| `aaa`/`aa` gives one hit; two separate hits on one line give two places | overlapping or merged hits |
| An empty query gives no matcher | showing everything |
| An unchanged line is one place with every pane (3 panes and 2 panes) | rows per pane |
| Same aligned line, different columns → two places | merging by line only |
| After changes of unequal length, alignment uses each pane's change end | equal raw line numbers taken as aligned |
| In one conflict, the same text and column in two panes is one place; different text is two | rule (b) ignoring the text |
| Two identical lines in one change pair first-with-first | cartesian merging |
| The same text in two changes is two places | merging across changes |
| A line only one side has is its own place with only that pane | lost side-only hits |
| A `null` text yields nothing; an insertion range holds no line | DiskNotText and empty ranges counted as inside |
| Lead order by line, then column | an unsorted list |
| A side-only place sorts at its change's lead start, before that line's lead rows, left before right; range: left-only at its difference's right start | rule 7's "sorts at its change's place" |
| A dismissal survives a one-file re-run with lines inserted above | line-number keys |
| A dismissal is dropped once the line text changes | stale keys |
| Two identical places dismiss independently | over-dismissal |
| A group dismissal survives a one-file re-run; a full run clears it | rule 9 vs rule 10 |
| Counts follow dismissals | stale summary |
| A row shows while one of its panes is on, with only the on panes' icons | filter leaks |
| Every pane off → `filteredOut` | an empty-list wording bug |
| A filter change restores nothing dismissed | filters touching dismissals |
| `goToPane` takes the lead pane when on, else the leftmost on pane | the rule-8 choice |
| Cut at 20,000 places across files; later files are not added | an off-by-one at the limit |
| A one-file re-run under a cut result re-applies the cap | uncapped growth |
| A pane stops scanning at the limit | an unbounded array |
| A closed group shows only its header; an all-dismissed group disappears | ghost groups |
| Preview: 26 characters with `…`, leading whitespace trimmed | wrong trimming |

**Window tests (B4, node, fake timers).**

| Test | Catches |
|---|---|
| A run starts 300 ms after typing; Enter runs at once | a run per keystroke |
| A newer run's results win | a stale publish |
| Enter with the same query restores dismissed rows | rule 9 |
| Match Case re-runs; a filter toggle calls no `files()` | rule 4 |
| `changed` re-runs only that file after the pause and keeps its dismissals | rule 10 |
| The run yields between slices | a long synchronous loop |
| A read failure reports once and stops | a failure storm |
| Query, filters, closed groups and results survive hide and show | rule 11 |
| `toggleKey` is ignored when `defaultPrevented` or while a question waits | the #61 conditions |
| Merge source: live `lineUp` if built, else `opened`, else `loadFile` once until `forget`; skips unsupported files; DiskNotText has no Result text | wrong text sources |
| Range source: pages until `next === null`; a second run makes no IPC calls | re-fetching every query |
| `KEYMAP_GROUPS` covers `KEY_ACTIONS` (`keyText.test.ts:31,39`) | a missing key row |

**Editor tests (B3).**

| Test | Catches |
|---|---|
| `matchRange` clamps a line past the end and columns past the line end | a throw on stale results |
| `changeLines` for an insertion point, an end-of-document mid-line span and CRLF | wrong live line-up |
| A go-to on a collapsed Result reveals the run (foldField with a selection transaction) | the reveal not covering the go-to |
| `goTo` before build is applied once after build and not after a rebuild; `resultVersion` bumps on an edit and on rebuild (`useMergeController.test.ts`) | a missed or repeated go-to |
| The range `goTo` waits for load, hosts and the thread list | a go-to before the columns exist |

**Rust tests (B1).**

| Test | Catches |
|---|---|
| `line_changes` equals `compare`'s ranges; empty for equal texts | two range rules |
| `search_texts` skips binary, too large, submodule, mode-only, kind-change and not-UTF-8 files | searching sentences |
| A page reads at least one file and stops after about 4 MiB | unbounded replies |
| `next` is `None` at the end; `from` past the end → `UnknownFile` | paging loops |
| Texts equal what `load` gives | a drift between the two readers |

**WebKit fixture (MiniBrowser through `just webdriver` / `just app-session start-fixture`) and real app, per acceptance line.**
- Fixture pages: the merge fixture page, and `?range=review`.
- Real app, merge: `scripts/demo-repo.sh <dir>`, then `start-app --repo <dir>`.
- Real app, range: `scripts/range-repo.sh <dir>`, then `start-app` with the range.

| Acceptance line | Steps |
|---|---|
| 1. Show, hide, show again | `press Ctrl+Shift+S` → `read` the panel above the list and the focused element is the box with its text selected → `press` again → panel hidden, focus in the shown file → `press` again → same query and same rows |
| 2. Every pane, one row per place | `type` a word on an unchanged line → one row with 3 (merge) or 2 (range) icons; a word only one side has → a row with that icon only |
| 3. Filters | click the Result or new-side filter off → only rows holding other panes show; turn two off → rows of one pane; all off → "Every pane is filtered out." |
| 4. Match Case | the same word with different case → fewer rows |
| 5. Go-to | with collapse on, click a row whose match lies in hidden lines → the file opens, the selection text equals the query in the Result or new side, the wave around it is shown, that pane has focus; click a left icon → selection in the left pane; `shot` in dark and light |
| 6. Groups | click a group → its rows hide; again → they show; Left/Right on the keyboard |
| 7. Dismiss | hover a row, click × → the row is gone and counts drop; × on a group; Enter in the box → all back |
| 8. Edit follows (merge) | type in the Result on a matching line → after about 300 ms that file's rows update; Reset → rows back |
| 9. Rebind | Settings → Keymap → Toggle search → record another key → it toggles and Ctrl+Shift+S no longer does |
| 10. Gate | `just check` (node tests, fences, map-check, bindings-check, clippy, Rust tests) |

---

## 4. Refinements within the request (nothing reopened) and the proposed plan row

These are for the orchestrator to record (DR5).

**Details the design decides:**
1. A dismissed group stays dismissed through one-file re-runs until the next full run.
2. A dismissed place keeps its key while its panes, column and line text stay the same.
3. The summary says "Searching…" while a run has found nothing yet.
4. Side-only rows sort before the lead rows of their change's first line.
5. A cut file keeps the first rows found in each pane.
6. "Lines that line up" after edits outside changes follows the editor's own alignment, anchored on the changes.
7. The panel has a "Search" header row like "Files".
8. #84's width handle sizes the whole left column. The label "File list width", the key `yamt.files.width` and the bounds are unchanged.
9. The keymap place for the new action reads "anywhere in the merge and range windows".

**Proposed row #127:** *A window-wide search in the merge and range windows: matching, the place rule, order, filters, dismissals and the 20,000 cap in the framework-free `search/` (TypeScript: one `giu`/`gu` RegExp, UTF-16 columns); texts come from `load_file` and the live `MergeHandle.lineUp()` (merge) and `search_range_texts` pages kept for the run (range); the go-to is a selection with `scrollIntoView` whose fold reveal is #126's.* Rejected: Rust search (option B: the owner would read the matcher and place rule in Rust, live Results cross the IPC every pause, simple case folding has to be hand-written or `regex` added); `load_range_file` per file (option C: N git processes and word diffs on the first run); fetching texts on every run without keeping them (the whole range per query). Visions: 1, 2, 5, 3.

## 5. Open risks

- **Range memory.** A very large range keeps its texts in the webview for the whole run, about 2× the text size.
- **Longest single step.** One 8 MiB file's scan can't be interrupted `[INFERENCE: tens of ms]`.
- **Lone CR line endings.** Search lines count `\n` only (`line.rs:109-111`), while CodeMirror also splits at a lone CR. Chunk ranges already share this limit.
- **Merge reads on the main thread.** `load_file` is synchronous, so the first search reads each unopened file there, one at a time.
- **To verify in MiniBrowser:**
  - `useVirtualList` inside a `max-h-1/2` flex island.
  - A go-to into a view that just turned visible (#51 `content-visibility`).
- **Compile and check order.** B4 compiles only after B3 lands. `just map-check` passes only after B5 (all docs are in B5).

## 6. open_questions

None. The request answers every product question.