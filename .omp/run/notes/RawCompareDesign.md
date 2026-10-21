# `yamt --raw` design: options, recommendation and build plan

I recommend option A. The diff runs in `merge-core` behind one Rust call that both saves a column and diffs it. A new crate, `yamt-compare`, stores the tabs. The editor gets a second public class, `CompareController`. The window gets its own root (`CompareApp` and `compareStore`).

The plan has eight builds and one docs owner. No build owns more than about 25 files or 1,500 changed lines, and the code globs of any two builds never overlap.

I designed for your three answers only: Format covers JSON and XML with no added dependency, JSON keys keep their order, and the strip shows bands only (no copy arrows). This was a read-only design: I edited nothing and ran no build or test.

## 1. The two `[INFERENCE]` items in the request, checked

**`compute_chunks(left, left, right)` as a 2-way diff: true for lines, not for word marks.**
- **Lines are correct.** With `local == base`, the base↔local diff has no hunks, so `sweep` only sees right-side hunks (`crates/merge-core/src/compute.rs:137-160`). Every region is then `RemoteOnly` (`classify`, `compute.rs:162-169`). `map_base_to_side` with no hunks maps each line to itself (`compute.rs:62-81`), so `chunk.base == chunk.local` are the left line ranges and `chunk.remote` is the right range.
- **The gap must be 0, not `DEFAULT_GAP` 1** (`compute.rs:88`). Otherwise two hunks one unchanged line apart merge into one block, unlike WebStorm's one fragment per hunk. The repo already uses exactly this call as its 2-way line diff: `crates/cli/tests/merge_file.rs:185` `compute_chunks(base, side, side, &Options { gap: 0 })`.
- **Word marks only cover the right column.** `word_changes` compares each side with base (`word.rs:47-64`). Here that gives the right column's marks and removal bars, but local == base gives nothing for the left. The left column needs the other direction (right as base) — `side_word_changes` with the right text as base (`word.rs:66-97`).
- **So:** a small 2-way entry point `merge_core::compare` that calls `compute_chunks(left, left, right, gap 0)` once and `side_word_changes` in both directions. One diff rule.

**WebKitGTK's localStorage quota: confirmed at 5 MB per origin.**
- WebKit's NetworkProcess sets `constexpr unsigned localStorageQuotaInBytes = 5 * MB;` and passes it to `SQLiteStorageArea::create` ([LocalStorageManager.cpp](https://raw.githubusercontent.com/WebKit/WebKit/main/Source/WebKit/NetworkProcess/storage/LocalStorageManager.cpp)).
- Size is counted with `String::sizeInBytes` ([changeset 276774](https://trac.webkit.org/changeset/276774/webkit)).
- One 8 MiB ASCII column is already over the quota. localStorage is ruled out.

**Other facts I checked that decide the design:**
- **Colours.** WebStorm colours a 2-way fragment by which sides have lines: both → MODIFIED, left only → DELETED, right only → INSERTED (`DiffUtil.getDiffType`, [DiffUtil.java:1552-1584](https://raw.githubusercontent.com/JetBrains/intellij-community/master/platform/diff-impl/src/com/intellij/diff/util/DiffUtil.java)).
- **No DOM in node tests.** The `node` Vitest project has no `DOMParser` (`frontend/vite.config.ts`, `environment: "node"`). WebKit probes are not part of `just check`.
- **Test files count as importers** for knip (`frontend/package.json:61-66`), so a build that adds pure modules with tests still passes `pnpm unused`.
- **map-check only asks that names appear in the map**; it does not require the files to exist (`scripts/map-check.sh:6-18`). A docs build can therefore name every planned file first.
- **No lock crate needed.** The toolchain is 1.99 (`rust-toolchain.toml`), so `std::fs::File::try_lock` is available (stable since 1.89).
- **`pane.ts` is already at 300 lines** (`pane.ts:298-300`). The design does not touch it and reuses `createPane({ kind: "center" })` (`pane.ts:226-235, 259-292`).

## 2. Options

| | A (recommended) | B | C |
|---|---|---|---|
| Data structures | Rust `TabStore` (index file + one text file per column) holds what is stored; the window holds `EditorState`s per visited tab; the diff reply carries the column versions it was computed from | settings file + a `tabs` entry in `yamt-settings`; one view whose `EditorState`s are swapped per tab | `MergeController` with a `Layout = ThreePane \| TwoPane` sum type |
| Where the diff runs | `merge_core::compare` inside `set_column` (stores the column, then diffs it against the other one Rust already holds) | stateless `compare_texts(left, right)` in `session`, plus a separate `save_column` | the same as A or B |
| Who stores the tabs | new crate `yamt-compare` (depends on merge-core, like `session`) | `yamt-settings` gains a second job | — |
| Editor | `CompareController` reusing the pure building blocks | the same class, plus per-tab state swapping (preferences re-applied and scroll restored on every swap) | every internal becomes optional over two or three panes |
| Visions served | 2 (one diff rule, one owner of stored text), 4, 5, 1 | 5 (no new crate) | 5 on paper |
| Cost | one crate (~650 lines), a third `Mutex` in src-tauri | each pause sends both columns (up to 16 MiB) plus a save call; `yamt-settings` stops being "settings only"; ~150 more editor lines for swapping | a flag bag through `Frame`, `chunkField`, `STRIP_PANES`, folds, minimap; risks plan §2 #51's measured paint budget |

C is rejected: three-pane `Record`s are everywhere (`geometry.ts:11-25`, `frame.ts`, `scrollSync.ts`, `strips.ts`), and a compare window has no status, no apply, no folds and no minimap. B is a reasonable fallback; section 10 lists B's files.

## 3. Option A: the ten points

### 1. Mode

**Arguments.** `args.rs` gets `Invocation::Compare` next to `Merge`, `Help` and `Version` (`args.rs:15-20`). `parse` (`args.rs:22-39`) tracks a `raw` flag and an optional repo:
- `--raw` together with `--repo` → `Err("--raw compares pasted text and takes no --repo")`, printed with the usage like every usage error (`lib.rs:51`), exit 2.
- `--help`/`--version` still win.
- `USAGE` gets a `yamt --raw` line and a `--raw` entry.

**What the shell does instead of `outcome::startup`.** `lib.rs:33-54`: `Ok(Invocation::Compare) => window::run_compare().report()`. It never calls `MergeSession::open`, never touches git, never manages `MergeState` or `HostState`, and never runs `appimage::repo_from_start_dir`. So a merge in progress in the start folder is untouched by structure. `run_compare`:
1. builds the app;
2. opens `TabStore` in `<app data dir>/yamt/compare` (taking its lock);
3. on failure returns `Ending::failure(message)` before any window exists;
4. otherwise manages `Mutex<TabStore>`, opens the window titled "Compare — yamt", and after `run_return` returns `Ending { exit: Success, message: None }`.

`CloseWatch` (`window.rs:98-174`) is shared, so a page that is gone still closes.

**How the page knows it is the compare window, with no flash.** The start script already set before the first frame (`window.rs:89-94`, `start_script(theme)`) gains a page argument: `document.documentElement.dataset.window = "compare"`. `main.ts` (`main.ts:18-35`) reads it the way it reads `data-theme`. In fixture mode, `?raw` (optionally `?raw=<case>`) does the same.

**Two roots.** `main.ts` gets two function declarations:
- `startCompare()`: `createCompareStore(source, startTheme)` and `createApp(CompareApp)`. No `LanguageServers`, no `startUp` of the merge store.
- `startMerge()`: unchanged.

**What never starts in the compare window, by structure:** language servers (never built), the focus refresh of the file list, `listStop`, disk-change handling, the close guard's questions, the toolbar menu, collapsing and the pane split. All of these live only in `App.vue`/`store.ts`, which the compare root never imports. Detector: a new fence `[PM7]` in `frontend/scripts/fences.ts` — `ui/Compare*.vue`, `ui/compare*.ts`, `ui/TabList.vue` and `ui/LanguagePicker.vue` never import `./store`, `./App.vue` or `../lsp`.

**Closing.** The page registers `onWindowClose(async () => { await flushAll(); return true; })` (`ipc/window.ts:3-9`): unsent columns are written, there is no question, and the exit status is 0.

### 2. Where the differences are computed

- **Engine.** `merge_core::compare(left, right) -> Vec<Difference>` (section 4), with one named constant `COMPARE_GAP = 0` ("one fragment per hunk, as WebStorm's 2-way").
- **When it runs.** The controller counts each column's edits. After `SETTLE_PAUSE_MS = 300` with no edit (a constant in `editor/internal/compareSettle.ts`, its only user), it reports the columns changed since their last send. The store sends each one with `set_column(tab, column, text, version)`.
  - Rust stores the text, writes that one column file (temporary file + rename), takes a copy of both texts, releases the lock, diffs, and replies `Comparison { versions, differences }`.
  - Only the changed column crosses the IPC, and only that file is written.
  - It runs on a `spawn_blocking` worker like `on_worker` (`src-tauri/src/merge.rs:150-160`), so the main thread never waits on a diff.
- **Saving uses the same pause.** Rule 7 ("within about a second") holds: 300 ms + send + write. I deliberately left out a "send at least every second while typing" timer: it would cost a pause-free 8 MiB serialisation every second during continuous typing.
- **Dropping stale answers.**
  - Each column has a `ColumnVersion` (u32, branded). `load_tab` returns the stored versions, and the controller counts on from them.
  - Rust stores a column only when its version is higher than the stored one. This also orders two calls that reach the worker out of order.
  - The reply carries both stored versions. `showComparison` applies it only if both equal the controller's current versions; otherwise it is dropped and the next settle replies correctly.
  - Until then, the shown marks and bands follow edits through mapping (section 3).
- **Cost on two 8 MiB columns.** I did not measure it. imara-diff's histogram on ~200k-line inputs with few changes should be tens of milliseconds [INFERENCE]; word marks are computed per difference only, and `line_pairs` is capped by `MAX_GAP_COMBINATIONS`.
  - Required measurement in B1: `yamt-cli compare` (release build) on a generated 8 MiB pair, time reported.
  - In the final run: the time from the last key until the bands update, and frames late while typing, in a 7.5 MiB column vs a 1 KiB column (section 6).
- **Fixture mode (no Rust).**
  - `ipc/fixtureCompare.ts` keeps tabs in memory and answers `setColumn` from the generated `frontend/fixtures/compare/<case>.json` when the texts match a case exactly.
  - Any other text gets no differences and an `info` log line `compare.fixture_miss`.
  - `?raw=<case>` loads a case into tab 1, so WebKit sees bands, word marks and bars without typing.
  - Real-app only: "updated after each edit" for arbitrary text, restart/`kill -9`, two windows, `--raw --repo`, the merge left untouched, and typing speed. All need the real Rust diff and files.

### 3. The editor's two-column controller

**A second public class** in `editor/compare.ts`, re-exported by `editor/index.ts` (+8 lines → ~294 of 300). Its parts live in `editor/internal/compare*.ts`, named with a prefix like the `minimap*` files.

**Reused as they are:**
- `createPane({ kind: "center", eol: "Lf" })` gives each column its own `history()`, the middle keymap (undo/redo/indent), find, the theme compartment and `languageCompartment` (`pane.ts:226-235, 259-292`).
- `preferenceEffects("center", …)` for `setPreferences`.
- `removalTooltip`, `exactScroll`, `rangeSpan` (`geometry.ts:27-42`), `crossesStrip` (`gap.ts:31`), `connectors.bandPath`, `LINE_HEIGHT_PX`.

**Made general, each with its second user:**

| File | Change |
|---|---|
| `scrollSync.ts` | `ScrollSync<P extends string>(views, panes: readonly P[], requestFrame)`. `targets()` returns `(pane: P) => number` instead of building a record, so no `as` (TS4). `#syncedTops` becomes a `Map<P, number>`. The merge `Frame` passes `PANES`. The per-frame cost is the same loop over panes. |
| `find.ts:60-72` | `syncFindSpace(views: readonly EditorView[])` |
| `language.ts:8-34` | `loadLanguage(description, label, views: readonly EditorView[], destroyed)`, plus `languageNamed(name)` (`matchLanguageName`) and `languageNames()` |
| `decorations.ts:27-44` | `bandDecorations` exported |
| `words.ts:54-73` | `wordDecorations(doc, words: SideWords<number>, tone)` exported; `sideWordDecorations` loops chunks over it |
| `tone.ts:14-30` | `changeTone(baseLines, changedLines): "inserted" \| "deleted" \| "modified"`, called by `chunkTone` and by compare (one tint rule) |
| `paneViews.ts` | `everyPane` exported |

**Data structures, compare only:**
- `DiffSpan = { from: DocPos; to: DocPos; tone: Tone }`, one per difference, kept in each column's state in the `differenceSpans` field.
  - The `showDifferences` effect sets it; otherwise it is mapped (`from` with −1, `to` with −1).
  - So typing on the line after a difference stays outside it, typing inside grows it, and the next reply corrects any drift.
- `differenceMarks: StateField<{ bands: DecorationSet; words: DecorationSet }>`, built once per reply and mapped with `.map(tr.changes)` on each edit. It is not rebuilt per key: `centerDecorations` rebuilds on every doc change (`decorations.ts:99`), which would cost 200k line decorations per key in a fully changed 8 MiB column.
- `CompareRow = Readonly<Record<Column, Span>> & { tone }` and anchors `Readonly<Record<Column, number>>`, cached in `CompareFrame` until spans, geometry or the document change.
- A strip of keyed `<path class="chunk-<tone> chunk-band">` nodes (`compareStrip.ts`). The strip's `mousedown` calls `preventDefault`, as in `strips.ts`.
- `Settle` (versions, unsent columns, the timer) and `columnBytes` (a UTF-8 byte count updated from each change, plus a `transactionFilter` that refuses an edit over `columnLimit`). The count is exact and costs only the size of the change, never the whole document.

**Colours.** WebStorm's rule (`DiffUtil.java:1552-1584`):
- left lines only → `deleted`;
- right lines only → `inserted`;
- both → `modified`;
- never `conflict`.

The same tone shows in both columns and in the band. There is no status, so every difference is always tinted, and word marks and bars appear in both columns.

**Public surface** (`editor/compare.ts`):

```ts
export type Column = "left" | "right";                       // from ipc
export type CompareHosts = { readonly left: HTMLElement; readonly right: HTMLElement; readonly strip: SVGSVGElement };
export type CompareOptions = { readonly preferences: Preferences; readonly language: TabLanguage; readonly columnLimit: number };
export type ColumnText = { readonly column: Column; readonly text: string; readonly version: ColumnVersion };
export type ColumnFormat =
  | { readonly kind: "formatted" | "unchanged" }
  | { readonly kind: "failed"; readonly message: string; readonly line: number };
export type FormatReport = Readonly<Record<Column, ColumnFormat>>;
export type CompareEvents = {
  readonly settled: (columns: readonly ColumnText[]) => void; // after SETTLE_PAUSE_MS, only the columns changed since their last send
  readonly detected: (language: string | null) => void;       // Auto's finding, at build and whenever it changes
  readonly refused: (column: Column) => void;                 // an edit that would pass columnLimit bytes
};
export class CompareController {
  constructor(texts: TabTexts, hosts: CompareHosts, options: CompareOptions, events: CompareEvents);
  showComparison(comparison: Comparison): boolean;  // false = versions differ, dropped
  setLanguage(language: TabLanguage): void;         // reconfigures languageCompartment in both views
  setPreferences(preferences: Preferences): void;
  formatLanguage(): "JSON" | "XML" | null;          // picked, else detected; null = Format disabled
  format(): FormatReport;                           // one "yamt.format" transaction per changed column
  moveToChange(direction: Direction): void;         // toolbar arrows: next/previous difference from the cursor, no wrap
  holdsText(): boolean;
  settleNow(): readonly ColumnText[];               // close, tab close
  destroy(): void;
}
export function languageNames(): readonly string[];             // language-data's 151 names, sorted
export const FORMAT_LANGUAGES: readonly ["JSON", "XML"];
```

**Undo.** Each column has its own history. A Format is one whole-document replace per column (`userEvent: "yamt.format"`, cursor to the start): one undo step, undone by Ctrl/Cmd+Z in that column. An unchanged result dispatches nothing.

### 4. Tabs and storage

**Who owns what (one writer each):**

| Fact | Owner |
|---|---|
| Tab list, order, names, languages, shown tab | Rust `TabStore`. The window's `tabs` shallowRef mirror is written only from replies. |
| Text while a tab is mounted | that column's `EditorState` (as today: the editor owns document text) |
| Stored copy of the text | Rust (memory + column files). Vue never holds text: it passes only as a function argument from `settled` to `setColumn`. |
| Auto's finding per tab | the controller; Vue keeps a `detected` map (language names only) |

**Hidden tabs.** One `CompareView` per *visited* tab stays mounted and hidden with `invisible [content-visibility:hidden]`, the merge window's pattern (plan §2 #51; the `MergeView.vue` root `div`). Switching is instant and keeps scroll and undo. The cost is memory per visited tab (two views, up to 2 × 8 MiB plus history) until the tab is closed. Unvisited tabs are loaded lazily by `load_tab` the first time they are shown. The single-view-with-swapped-states variant is option B.

**Files** in `<app data dir>/yamt/compare/`:
- `tabs.json`: `{ "format": 1, "shown": 3, "nextId": 4, "tabs": [{ "id": 3, "number": 1, "name": "Compare 1", "language": { "kind": "auto" } }] }`
- `<id>-left.txt` and `<id>-right.txt`: plain UTF-8, a missing file meaning an empty column.
- `lock`: held with `File::try_lock` for the life of the process, released by the OS on exit, including `kill -9`.
- Every write is temp file + rename. The index is rewritten only on add, close, rename, language and shown; a column file only when that column was sent.
- A kill loses nothing written. A power loss may (no fsync); the rules ask about crashes and kills only.

**Tab rules:**
- A new tab's number is 1 + the highest number among existing tabs, so it is never reused while a tab with it exists.
- Ids come from `nextId` and never repeat.
- Closing removes the tab from the index first, then deletes its files. Files not in the index are deleted at start.
- Closing the shown tab shows the next one, else the previous one. Closing the last tab creates "Compare 1".
- On first use (no `tabs.json`), "Compare 1" is created and written.

**Broken, newer or locked store.** `yamt --raw` refuses to start and prints, with exit 2:
- `the stored compare tabs <path> cannot be read: <message> at line L, column C; nothing was changed`
- `… were written by a newer yamt (format N)`
- `another yamt --raw window is open (<folder>)`

The store is never overwritten. A broken column file shows up at `load_tab` as `ReadFailed`: that tab shows the problem, gets no controller, and so is never written.

**Size limit.** `MAX_COLUMN_BYTES = 8 MiB` is the one constant, in `yamt-compare`, chosen to match `session`'s `MAX_TEXT_BYTES` (`crates/session/src/decode.rs:6`). It is sent once as `CompareStart.column_limit`. The window refuses the edit (`columnBytes` filter) and shows a notice; Rust refuses again with `ColumnTooLarge` as a guard.

### 5. Format and Auto as pure modules

**Format scans tokens itself instead of using the browser's parsers.**
- `JSON.parse`/`stringify` puts integer-like keys first (ECMA-262 OrdinaryOwnPropertyKeys) and rounds numbers past 2^53. Both break "keep the order" and change data. JavaScriptCore's parse messages also carry no line [INFERENCE].
- `DOMParser` resolves character references (`&#233;` → `é`) and needs a DOM the node tests do not have.
- So `formatJson.ts` and `formatXml.ts` keep every token exactly as written and change only the whitespace between tokens.

**JSON.** Two-space indent, `": "`, `{}`/`[]` kept compact. Strings, escapes and number grammar are checked. Text after the root value is an error. Errors come back as `{ kind: "failed", message, line }`.

**XML.**
- Declaration, PIs, comments, CDATA and DOCTYPE (with its internal subset) are kept verbatim.
- Tags must nest and match; there is one root.
- An element holding only text stays on one line.
- Mixed content and anything under `xml:space="preserve"` are kept verbatim.
- Attribute order and entities are kept.

**Line endings and the last newline.** CodeMirror turns any line break in pasted text into `\n` (no `lineSeparator` set), so Format never sees `\r`. The output keeps whether the input ended with a newline. An empty column is "unchanged".

**Whole-document replace, not paired line edits.** The house Myers diff (`lineDiff.ts:138-147`, as used in `format.ts:144-171`) is O((N+M)·D), and minified → pretty has D ≈ M (200k+ lines). There are no statuses to protect here, and the change is one undo step.

**Auto** (`detectLanguage.ts`, pure). It reads the first 4,096 characters after leading whitespace, the left column first, the right if the left finds nothing. Rules in order:
1. `#!` → the interpreter (version digits stripped) through `LanguageDescription.matchLanguageName` (`node` → JavaScript, `bash`/`sh` → Shell, `python3` → Python)
2. `<?php` → PHP
3. `<?xml` → XML
4. `<!DOCTYPE html` (any case) → HTML
5. `<` followed by a letter, or `<!--` → XML
6. `{` followed by `"` or `}`, or `[` → JSON
7. otherwise plain text

It runs at every settle. The drop-down button reads "Auto · JSON" or "Auto · Plain text". The list is "Auto" then `languageNames()`. A choice goes through `setTabLanguage` (Rust), its reply updates the mirror, and `CompareView` watches it and calls `controller.setLanguage` (`languageCompartment` in both views).

### 6. The window's chrome

| Component / file | Job |
|---|---|
| `ui/CompareApp.vue` | second root: `TabList`, the views' grid cell, `NoticeBar`, `ProblemBar`, `QuestionDialog`, `SettingsView`; Ctrl/Cmd+B through the existing `fileListKey(state, …)`, whose structural type fits (`fileListKey.ts:17-28`); settings re-read on window focus |
| `ui/TabList.vue` | the panel in the file list's place; width from `createFileListWidth` (the same `yamt.files.width` key), `useColumnDrag`, `ResizeDots`; header "Tabs" + "+"; rows: name, language ("Auto · JSON" / "TypeScript"), × on hover, double-click to rename (Enter keeps, Escape cancels, empty keeps the old name, blur keeps) |
| `ui/CompareView.vue` | toolbar (Format with its hover text, `LanguagePicker`, ↑/↓, `SettingsButton`); "Left"/"Right" headers; two hosts with a 2.5 rem strip between, from `compareColumns()` in `paneSplit.ts` (the one place the strip width lives) |
| `ui/LanguagePicker.vue` | the drop-down over `useDropdownMenu` and `menuKeys` |

Notes:
- **Closing a tab.** "Close Compare 2? Its text is lost." is a new `Question` variant `closeTab` in `ui/question.ts`, asked through `createAsking` (`asking.ts:17-42`). The question is asked only when the tab holds text: the mounted controller's `holdsText()` decides, otherwise the stored entry's `holds_text`.
- **Notices.** `NoticeBar` takes ready rows (`NoticeRow` exported from `noticeText.ts`); the merge `App` passes `notices.map(noticeRow)` and the compare store builds its own rows in `compareText.ts`. Examples: "Compare 2, left: not valid JSON (line 3): Expected ',' or '}'" and "Compare 2, right: not pasted — a column holds up to 8 MiB".
- **IPC failures** go to `ProblemBar` as new `Problem` actions (`tabs`, `loadTab`, `saveTab`).
- **Settings view (gear).**
  - `ui/settingsStore.ts` (`SettingsStore` = settings + settings actions + open/close settings; `registerSettingsStore`/`useSettingsStore`) is registered by both stores.
  - `SettingsView.vue`, `KeymapList.vue` and `SettingsButton.vue` switch to `useSettingsStore()` (`SettingsView.vue:23`, `KeymapList.vue:24`, `SettingsButton.vue:6`).
  - The "Language servers" section moves into a slot that only `App.vue` fills, so the compare window shows Theme, Antialiasing, Keymap and the settings file.
  - `store.ts` gains 2 lines (297 → 299).
- **New components and why:** `CompareApp` (second root), `TabList` (tab panel), `CompareView` (two-column view), `LanguagePicker` (drop-down). This needs the VU15 reasons recorded.

### 7. IPC

**Rust (`yamt-compare`)**, plus `merge_core::{LeftLine, RightLine, Difference, DifferenceWords}`:

```rust
pub struct LeftLine(pub u32);  pub struct RightLine(pub u32);               // merge-core line.rs
pub struct Difference { pub left: LineRange<LeftLine>, pub right: LineRange<RightLine>, pub words: DifferenceWords }
pub struct DifferenceWords { pub left: SideWordChanges<LeftLine>, pub right: SideWordChanges<RightLine> }
pub fn compare(left: &str, right: &str) -> Vec<Difference>;
// left.removals = right text the left lacks, where it would sit; right.removals = the reverse.

pub struct TabId(pub u32);
pub enum Column { Left, Right }                            // serde lowercase
pub struct ColumnVersion(pub u32);
pub struct ColumnVersions { pub left: ColumnVersion, pub right: ColumnVersion }
#[serde(tag = "kind", rename_all = "camelCase")] pub enum TabLanguage { Auto, Picked { name: String } }
pub struct TabEntry { pub id: TabId, pub name: String, pub language: TabLanguage, pub holds_text: bool }
pub struct TabList { pub tabs: Vec<TabEntry>, pub shown: TabId }
pub struct CompareStart { pub list: TabList, pub column_limit: u32 }
pub struct Comparison { pub versions: ColumnVersions, pub differences: Vec<Difference> }
pub struct TabTexts { pub left: String, pub right: String, pub comparison: Comparison }
pub const MAX_COLUMN_BYTES: u32 = 8 * 1024 * 1024;
pub enum Error { Locked{path}, Broken{path,message}, NewerFormat{path,format}, ReadFailed{path,message}, WriteFailed{path,message}, UnknownTab{tab}, TooLarge{bytes} }
impl TabStore { open(&Path)->Result<TabStore>; start(&self)->CompareStart; load_tab; set_column(tab,column,String,ColumnVersion)->Result<LoadedTab>;
                add_tab; close_tab; rename_tab(tab,&str); set_language(tab,TabLanguage); show_tab  /* each ->Result<TabList> */ }
pub fn comparison(loaded: &LoadedTab) -> Comparison;   // runs outside the lock
```

**Commands** (`src-tauri/src/compare.rs`, thin):

```
open_compare() -> CompareStart
load_tab(tab) -> TabTexts                                  async, worker
set_column(tab, column, text, version) -> Comparison       async, worker; stale version: nothing stored, reply from the stored texts
add_tab() -> TabList        close_tab(tab) -> TabList        rename_tab(tab, name) -> TabList
set_tab_language(tab, language) -> TabList                 show_tab(tab) -> TabList
```

**`IpcError`** gains `UnknownTab { tab }` and `ColumnTooLarge { limit }`. `Error::Broken`/`Locked`/`NewerFormat` map to `ReadFailed`; after start they cannot occur.

**Generated TS shapes:**
- `TabId`, `LeftLine`, `RightLine`, `ColumnVersion` = `number`
- `Column = "left" | "right"`
- `TabLanguage = { kind: "auto" } | { kind: "picked"; name: string }`
- `TabEntry = { id; name; language; holds_text: boolean }`
- `TabList = { tabs: TabEntry[]; shown: TabId }`
- `CompareStart = { list: TabList; column_limit: number }`
- `Difference = { left: LineRange<LeftLine>; right: LineRange<RightLine>; words: DifferenceWords }`
- `Comparison = { versions: ColumnVersions; differences: Difference[] }`
- `TabTexts = { left; right; comparison }`

**Domain types** (`ipc/compareDomain.ts`; the brand guards and `nextColumnVersion` stay in `domain.ts`, per IPC3): the same shapes camelCased (`holdsText`, `columnLimit`), lines and words through `toRange`/`toSideWords`. `ColumnWrite = { tab; column; text; version }`.

```ts
interface CompareSource extends SettingsSource {
  openCompare; loadTab(tab); setColumn(write: ColumnWrite); addTab(); closeTab(tab); renameTab(tab, name);
  setTabLanguage(tab, language); showTab(tab);   // each -> Promise<SourceResult<…>>
}
```

Implementations: `ipc/tauriCompare.ts` and `ipc/fixtureCompare.ts`.

**Crate decision.** `yamt-compare` (no tauri, no git) is a direct dependency of yamt-app. `arch-check.sh:41-46` allows it and adds a no-`tauri`/`yamt-session` check for it. `serde_json` is used at run time by cli, settings and compare (amends architecture §7).

### 8. Tests

**Editor node tests (`editor/` is not mutated, VF7).** Each test, then the one-line hand mutation that must make it fail:
- `formatJson.test.ts`
  - same data in two layouts → equal text ← `":"` emitted without the space
  - `{"b":1,"2":0}` keeps b first, and `12345678901234567890` is kept ← layout replaced by `JSON.stringify(JSON.parse(t), null, 2)`
  - missing comma on line 3 → `line: 3` ← line counter not incremented on `\n` in whitespace
  - the last newline kept / its absence kept ← always append `\n`
  - `{}` stays compact ← newline emitted inside empty containers
  - `"a\"b"` is one token ← string scan ignores backslashes
  - text after the root fails ← stop after the root
- `formatXml.test.ts`
  - re-indents nested elements ← indent not increased on a start tag
  - text-only element stays on one line ← child text treated as a block
  - mixed content verbatim ← whitespace collapsed inside mixed content
  - declaration and `&#233;` kept ← entities resolved
  - `</b>` closing `<a>` fails with its line ← end-tag name not compared
  - `xml:space="preserve"` kept ← attribute not checked
- `detectLanguage.test.ts`
  - `{"a":1}` JSON, `{ foo }` plain ← accepting any `{`
  - `<!DOCTYPE html>` HTML ← the XML rule placed before HTML
  - `#!/usr/bin/env python3` Python ← version not stripped
  - leading whitespace skipped ← no trim
  - left wins over right ← columns swapped
- `compareFields.test.ts`: typing inside a difference grows it, on the next line stays outside ← `to` mapped with +1; marks are mapped, not rebuilt ← field ignores `tr.changes`; the effect replaces both
- `compareSettle.test.ts` (fake timers): one `settled` after the pause with only the edited columns ← dirty set not cleared; a reply with an old right version is dropped ← only the sent column compared; `settleNow` cancels the timer ← timer left running
- `compareMarks.test.ts`: left empty → inserted, right empty → deleted ← `changeTone` arguments swapped; word marks and bars at the right offsets in both columns ← `line + 1` dropped
- `columnBytes.test.ts`: a three-byte character over the limit is refused ← UTF-16 length counted; exactly at the limit accepted ← `>=`
- `compareNavigation.test.ts`: next/previous from the cursor, no wrap ← modulo wrap
- `compareFormat.test.ts`: one undo restores the column ← one transaction per line; a failing column is left alone while the other is formatted ← early return; an unchanged result adds no undo step ← dispatch without a check
- `scrollSync.test.ts`: the RK4 drift case is unchanged, plus a two-pane case ← follower loop over the wrong list
- `tone.test.ts` / `words.test.ts`: `changeTone` and `wordDecorations` stay identical for merge chunks

**WebKit probe** `editor/compare.browser.test.ts`: bands in the strip, marks and bars in both columns, a bar's tooltip, a scroll on the left moves the right through the anchors, the find bar in each column gives both columns the same space.

**Mutated by `just mutants`:**
- merge-core `tests/compare.rs` (proptest): rebuilding right from left and the differences gives right byte for byte; ranges sorted and disjoint; `compare(t, t)` is empty; line ranges equal `compute_chunks(l, l, r, gap 0)`; word ranges stay on their lines; removal texts never empty.
- `crates/compare/tests/store.rs`:
  - first use creates "Compare 1"; numbers follow the rule;
  - closing the last tab leaves "Compare 1";
  - `set_column` rewrites only that column (the other file's modified time unchanged); a stale version is ignored;
  - a restart reads back names, order, languages, shown tab and texts;
  - broken JSON gives `Broken` with line and column, untouched on disk; format 2 gives `NewerFormat`;
  - a second `open` gives `Locked`; too large gives `TooLarge`; a missing column file reads as empty; orphan files are cleaned; `holds_text`.
- src-tauri: args (`--raw`, `--raw --repo` error, help names `--raw`); `start_script` with the page; commands through `mock_window`; `ipc_error` serialisation.
- ui: the `compareTabs`, `compareColumns` and `compareText` tests; the question and problemText tests.

**WebKit on the fixture page** (`just webdriver <port>`, dev server on its own port, `?raw=<case>`): bands, marks and bars; "+", switch, rename (Enter/Escape/empty), close with and without the question; Ctrl/Cmd+B; language drop-down (Auto shows "Auto · JSON", picking TypeScript highlights both columns); Format on fixture JSON, and its failure notice; the settings view; dark and light.

**Real app** (`just app-session`; W4b adds `--raw` to `start-app`; `--home` keeps the data folder between restarts, `start.ts:87-93`):
1. From a folder outside any repository → one empty "Compare 1".
2. `target/debug/yamt --raw --repo x` → usage error on stderr, exit 2.
3. In `scripts/conflict-repo.sh /tmp/r`: compare `git status --porcelain=v2` before and after a `--raw` session started there (diff empty).
4. `xdotool type` into each column → bands, marks and bars update; a wheel on the left moves the right; Ctrl+Z in each column; Ctrl+F in each.
5. Paste two JSON layouts → Format → no bands; invalid left → notice naming the left column and the line; the right is formatted.
6. Auto, TypeScript, and languages per tab.
7. Tabs: add, switch (texts, language, scroll), rename, close; Ctrl+B.
8. Quit and start again → identical. `kill -9 $(pgrep -n -f 'yamt --raw')` one second after typing → the text is back.
9. A second `yamt --raw` → exit 2 with the message.
10. Dark and light.
11. Typing speed: 50 keys at 20 ms intervals in a 7.5 MiB JSON column vs a 1 KiB one. Measure frames late per 200 (plan §2 #51's method) and the time from the last key until the bands update (a DEV-only `compare.saved` debug log with milliseconds).

### 9. Size and order

Code globs never overlap between builds. The shared docs belong to one docs owner, D.

| Step | Build | Owns | Files / lines |
|---|---|---|---|
| 0 | **D** (docs, from this design) | `docs/architecture.md`, `.omp/skills/{project-map,ipc-contract,risk-register}/SKILL.md`, `crates/merge-core/AGENTS.md`, `src-tauri/AGENTS.md`, `frontend/src/{ipc,editor,ui}/AGENTS.md`, `README.md`, `CHANGELOG.md`; names every planned file and command up front (so map-check passes at every step); a second pass at the end for any deviation | ~11 / ~400 |
| 1 | **B1** (rust) ∥ **W1** | B1: `crates/merge-core/src/{compare,line,word,lib}.rs`, `crates/merge-core/tests/compare.rs`, `crates/cli/src/{main,args,compare}.rs`, `tests/compare/{json-layout,words,typescript}/**`, `frontend/fixtures/compare/**` (generated), `justfile` (`fixtures-into`, `fixtures-check`) | ~17 / ~520 |
| | | W1: `frontend/src/editor/internal/{formatJson,formatXml,detectLanguage}{,.test}.ts` | 6 / ~910 |
| 2 | **B2** (rust + contract) | `crates/compare/**`, `Cargo.toml`, `Cargo.lock`, `scripts/arch-check.sh`, `src-tauri/Cargo.toml`, `src-tauri/src/{args,lib,window,compare,commands,ipc_error,mock_window}.rs`, `frontend/src/ipc/bindings.ts` (generated), `frontend/src/ui/{problem,problemText,problemText.test}.ts` (the new `IpcError` kinds would otherwise break the exhaustive switch) | 25 incl. 2 generated / ~1,480 |
| 3 | **W2** | `frontend/src/ipc/{domain,compareDomain,compareDomain.test,CompareSource,tauriCompare,fixtureCompare,fixtureCompare.test,index}.ts`, `scripts/map-check.sh` (checks `CompareSource` methods too) | 9 / ~740 |
| 4 | **W3a** ∥ **W4a** | W3a: `editor/internal/{compareFields,columnBytes,compareMarks,compareSettle,compareNavigation}{,.test}.ts`, `editor/internal/{decorations,words,tone}.ts`, `{words,tone}.test.ts` | ~15 / ~810 |
| | | W4a: `ui/{compareStore,compareTabs,compareColumns,compareText,settingsStore}.ts` + tests, `ui/{store,question,question.test,noticeText}.ts` | ~13 / ~990 |
| 5 | **W3b** | `editor/{compare,compare.browser.test,index}.ts`, `editor/internal/{compareViews,compareFrame,compareStrip,compareFormat,compareFormat.test,compareLanguage,scrollSync,scrollSync.test,frame,find,language,language.test,paneViews}.ts` | ~16 / ~1,050 |
| 6 | **W4b** | `frontend/src/main.ts`, `ui/{CompareApp,TabList,CompareView,LanguagePicker,App,SettingsView,KeymapList,SettingsButton,NoticeBar}.vue`, `ui/useCompareController{,.test}.ts`, `ui/paneSplit{,.test}.ts`, `frontend/scripts/{fences,fences.test}.ts`, `frontend/scripts/app-session/{args,args.test,start,fixture}.ts` | ~20 / ~960 |
| 7 | D's second pass + verification: `just check`, `just mutants 8db7609`, WebKit, real app | | |

**What each build fixes for the next:**
- B1 → B2: `merge_core::compare` and its types.
- B2 → W2: the generated commands and types.
- W2 → W3a/W4a: the domain types, `CompareSource`, `nextColumnVersion`.
- W3a → W3b: the fields, `Settle` and marks.
- W3b → W4b: the `CompareController` surface above.
- W4a → W4b: `useCompareStore` and the actions (`addTab`, `showTab`, `closeTab`, `renameTab`, `setLanguage`, `saveColumn`, `track`, `reportFormat`, `refused`, `setDetected`, `flushAll`).

### 10. Draft plan §2 rows (DR4/DR5: the orchestrator records them)

- **#5, Rejected column, added:** "… reopened 2026-10-21 by the owner (#1461: compare any two pasted texts) — a changed requirement; replaced by #93."
- **#93 3-way for merges; one 2-way view for pasted text behind `yamt --raw`.** No git, any folder, both columns editable, WebStorm's 2-way colours. Rejected: `git difftool` and file pairs (still out of scope); `yamt --raw a b` (non-goal). Visions 5, 1.
- **#94 The compare window is its own mode end to end.**
  - `Invocation::Compare`; no `MergeSession`.
  - The start script sets `data-window`; `?raw` in fixture mode.
  - `CompareApp` + `compareStore` as a second root; `[PM7]` fence.
  - `settingsStore` shared by both roots.
  - Exit 0 at close after unsent columns are flushed.
  - Amends TS15 (the window's one store: `store.ts` or `compareStore.ts`, plus the `settingsStore` slot), VU9, VU11 (two editor seams), VU15.
  - Rejected: branches inside `App.vue`/`store.ts` (297/300 lines, merge parts reachable); a `get_mode` command (one frame of the merge window).
  - Visions 3, 2, 1.
- **#95 The differences come from `merge_core::compare`** (`compute_chunks(left, left, right, gap 0)` + `side_word_changes` both ways), behind `set_column`, which stores and diffs in one call; the reply carries both versions and is dropped if they differ.
  - Rejected: a TS diff (a second diff rule); `compute_chunks` + `word_changes` as they are (no left-column word marks; gap 1 merges fragments); a stateless `compare_texts` (both columns per pause).
  - Visions 2, 5, 1.
- **#96 `CompareController` beside `MergeController`.**
  - Reused: `createPane`, mapped difference fields, WebStorm's `getDiffType` tones, one strip of bands.
  - Made general: `ScrollSync<P>`, `syncFindSpace`, `loadLanguage`, `wordDecorations`, `bandDecorations`, `changeTone`.
  - Rejected: a two-pane `MergeController` (flag bag, risk to plan §2 #51); rebuilding decorations per key.
  - Visions 4, 2, 5.
- **#97 Tabs are stored by the new crate `yamt-compare`** in the data folder: `tabs.json` plus one UTF-8 file per column, temp file + rename, a `File::try_lock` lock; a second window, a broken store or a newer store refuses to start; one view per visited tab stays mounted.
  - Rejected: localStorage (WebKit 5 MB, `LocalStorageManager.cpp`); one file per tab (both columns rewritten); `yamt-settings` (a second job, and the diff needs merge-core); one swapped view (option B).
  - Amends RS5 (a third `Mutex`, never held with another).
  - Visions 2, 3, 5.
- **#98 Format and Auto are yamt's own pure scanners.** JSON and XML keep every token as written; one whole-document undo step per column; Auto reads the openings of the left text, then the right.
  - Rejected: `JSON.parse`/`stringify` (key order, number precision, no line in JavaScriptCore); `DOMParser` (resolves entities, no node tests); paired line edits (Myers cost on minified text); a bundled formatter or machine-learning detector (owner answers).
  - Visions 2, 4, 5, 1.

## Option B's files, briefly

- `crates/session/src/compare.rs` (`compare_texts`, re-export).
- `crates/settings/src/tabs.rs` + `src/lib.rs` (`read_tabs`, `save_column`, `set_tabs`, `data_dir` places).
- `src-tauri/src/compare.rs` (stateless diff + save commands).
- `editor/internal/compareTabs.ts` (`Map<TabId, { left: EditorState; right: EditorState; scrollTop }>`, swapped with `view.setState` and preferences re-applied).
- One `CompareView`.

About the same file count and ~250 more lines, mostly the swapping.

## Risks to add to the register

- **RK28**, two windows: proved by `store.rs` `a_second_open_is_locked`.
- **RK29**, a stale diff drawn over a changed text: proved by `compareSettle.test.ts` and `store.rs` `stale_version_is_ignored`.
- **RK30**, Format changing data: proved by `formatJson.test.ts` (key order and big numbers) and `formatXml.test.ts` (entities).

## Open questions for you

1. **A broken or newer stored-tabs file.** Right now `yamt --raw` refuses to start and says where the file is; nothing is lost, but you have to move it away by hand. The other way: open with the problem shown and the stored tabs read-only, so you can copy text out but nothing typed is kept.
2. **A second `yamt --raw` while one is open.** Right now it refuses with a message. Bringing the open window to the front instead needs Tauri's single-instance plugin, a new dependency.
3. **Memory.** Right now every tab you have visited stays loaded until you close it: switching is instant and keeps scroll and undo, but many big tabs add up (up to ~2 × 8 MiB each, plus undo). The other way: unload tabs not shown, so switching reloads them and their undo is lost.
4. **Line endings.** Pasted CRLF text becomes LF in the columns, so CRLF vs LF never shows as a difference, and the stored texts are LF.

## Departures from the brief

- **Format does not use the browser's parsers** (section 5): they would reorder keys and change numbers or entities, and the XML parser cannot be tested in `just check`.
- **`yamt-compare` is a new crate** (row #97).
- **B2 also edits three `ui/` files** (`problem`, `problemText`, `problemText.test`) so the exhaustive `IpcError` switch still compiles at B2's commit.
- **The shared docs have their own owner, D,** so the code builds' globs stay disjoint.