# Design 3.RV: `yamt --diff=<range>`, the read-only range window (delivery A)

I recommend **option A**. A new crate, `yamt-range`, reads git through `yamt-gitio` and diffs through `yamt-merge-core`. The window gets a third mode end to end: `Invocation::Range`, `data-window="range"`, and its own root `RangeApp.vue` + `rangeStore.ts`, fenced as PM9. The editor gets a third public class, `RangeController`, built on the compare internals. `FileList`/`FileTree`/`fileTree.ts` become generic with slots, so the merge root and the range root share one list.

**Cost:**
- One new crate: a plan §2 row, a §7 entry, an arch-check rule.
- One new fence and a third editor seam.
- The merge root's `App.vue` changes, because it now passes its marks into the list through slots.
- Empty lock folders pile up under the app's data folder, one per reviewed pair.
- About 86 files and about 5,300 lines over 8 builds, docs and generated files included. The critical path is 5 builds.

---

## 1. Facts checked for this design (with sources)

- **One git run lists everything.** In `git diff-tree --raw --numstat -z`, raw records for all pairs come first, then the numstat records. A separator is printed only before a patch (git `diff.c` `diff_flush`, master ~7168–7230).
  - numstat prints `-\t-\t` for a binary pair.
  - With `-z`, a rename is `added\tremoved\t\0old\0new\0` (`show_numstat`, `diff.c` ~3248–3280).
  - The parser matches numstat records to raw records **by destination path, not by position**. A raw record with no numstat record gets `NotCounted`.
- **The plumbing command keeps the user's diff config out.** `builtin/diff-tree.c:127` reads only `git_diff_basic_config` ("no diff UI options").
  - `diff.renames`, `diff.noprefix`, `diff.relative`, `diff.external`, `diff.orderfile`, `diff.ignoresubmodules` and `diff.algorithm` are read only in `git_diff_ui_config` (`diff.c:360–470`).
  - `diff-tree` also does no textconv and runs no external diff by default.
  - Repository attributes still decide "binary". That is intended: the user's own `git diff` behaves the same.
- **Resolving a name already exists.** `Repo::commit_named` runs `rev-parse --verify --quiet <name>^{commit}` (`crates/gitio/src/repo.rs`). `Repo::commit_summary` gives short id, subject and message (`names.rs:54`).
- **The merge window's text rule:** a NUL in the first 8,000 bytes means binary (`session/src/decode.rs:4–5`); then more than 8 MiB means too large (`:6`, `:30`); then `String::from_utf8` failing means not UTF-8 (`:42–44`).
- **`CompareController` is edit-only.** Its surface is settle, `columnLimit`, Format, language picker and undo (`editor/compare.ts`). A read-only pane kind already exists: `"readOnlyCenter"` in `editor/internal/pane.ts` `kindExtensions`.
- **What the list files import today:**
  - `FileList.vue` imports `FileEntry`, `FileMark` and `OperationLabel`, all merge-only.
  - `FileTree.vue` imports `FileMark`.
  - `fileTree.ts` reads only `file.path`.
  - `fileListMode.ts`, `usePanelWidth.ts`, `PanelWidthHandle.vue`, `fileListKey.ts` and `SettingsButton.vue` are neutral to the root.
- **Size limits that shape the file lists:**
  - `window.rs` has 362 lines and the limit is 400 (RS6), so the range window's shell code goes into a new `src-tauri/src/range.rs`.
  - `editor/index.ts` has about 290 lines; +2 lines is fine.
  - `compareStore.ts` is at 300 lines, the TS11 cap.
- **Seams that already exist:**
  - `SettingsView.vue` has a default `<slot />` between Keymap and Settings file; C's AI section goes there.
  - `scripts/map-check.sh:31` loops `for source in ChunkSource CompareSource`; adding a third source is one word.
- **[INFERENCE]** `git diff-tree`'s order after rename detection is not pinned here, so Rust sorts the entries by display path itself.

---

## 2. Options at a glance

| | **A (recommended)** | **B: range inside the compare mode** | **C: session's second job** |
|---|---|---|---|
| Crate that reads the range | new `yamt-range` (gitio + merge-core) | `yamt-compare` gains gitio | `yamt-session` gains `range*.rs` |
| Shell mode | `Invocation::Range`, `WindowKind::Range` → `data-window="range"` | `Invocation::Compare(CompareInput::{Pasted, Range})`, `data-window="compare"`, `open_compare` answers a sum | as A |
| Page root | third root `RangeApp.vue` + `rangeStore.ts`, fence PM9 | branches in `CompareApp.vue` + `compareStore.ts` (`CompareMode` sum) | as A |
| Editor | `RangeController` beside `CompareController` (shared internals) | `CompareController` takes `{kind:"editable"…} \| {kind:"readOnly"…}` | as A |
| File list | `FileList`/`FileTree`/`fileTree` generic with slots | same | same |
| Visions served | 3, 2, 4, 1 | 5 (fewer files) | 5 (no crate) |
| Visions hurt | — | 4 (format/undo/settle compile on read-only columns), 2 (two jobs in one store and crate), 3 ("`--diff` never runs git" no longer holds by construction) | 1, 2 (`session` becomes two crates in one; B's thread storage drags `serde_json` into it) |
| Size | ~86 files / ~5,300 lines | ~60 / ~4,600 | ~82 / ~5,200 |

---

## 3. Option A in full

### Data structures first

**Rust (`yamt-range`): what is held**

```rust
// spec.rs: parsed once by the argument parser
pub struct RangeSpec { text: String, left: Option<String>, dots: Dots, right: Option<String> }
enum Dots { Two, Three }

// open.rs: built before any window
pub struct Resolved { repo: Repo, spec: RangeSpec, left: SideAt, right: SideAt }
struct SideAt { oid: Oid, side: RangeSide }                      // RangeSide is the IPC type below
pub struct Range { resolved: Resolved, files: Vec<FileAt> }      // immutable for the window's life
struct FileAt { entry: RangeEntry, old: Option<BlobAt>, new: Option<BlobAt>, binary: bool }
struct BlobAt { oid: Oid, mode: u32, size: Option<u64> }        // size None for a gitlink

// lock.rs
pub struct PairLock { file: File, folder: PathBuf }              // held for the process's life
```

**Shell (`src-tauri/src/range.rs`)**

```rust
pub(crate) struct RangeState { range: Range, _lock: PairLock }
```

`app.manage(state)`, with **no Mutex**: nothing changes after start. RS5 is not amended because there is no fourth Mutex.

**Window**
- `rangeStore` mirrors the `open_range` reply (sides and list, never text).
- `shown: RangeFileId | null`.
- `visited`: the mounted views, in first-visit order, at most `MOUNTED_FILES = 16`.
- Texts live only in each column's `EditorState`.

### 1. Arguments (`src-tauri/src/args.rs`)

```rust
pub(crate) enum Invocation {
    Merge { repo: PathBuf },
    Compare,
    Range { spec: RangeSpec, repo: PathBuf },   // repo default "."
    Help,
    Version,
}
```

**What the parser accepts**
- An argument starting with `--diff=` goes to `yamt_range::RangeSpec::parse(rest)`. Its `SpecError` is the usage line.
- `--diff` alone with no `--repo` stays `Compare` (#93–#101 unchanged).
- `--diff` with `--repo` is still `DIFF_WITH_REPO`.
- `--diff=<range>` with `--repo <p>`, in either order, is a range.

**Usage errors found by the parser** (message + `USAGE`, exit 2, from `lib.rs:51`'s existing `Err` arm):

| input | line |
|---|---|
| `--diff=` | `--diff= needs a range, such as main...dev` |
| `--diff=main` | `--diff=main: a range needs two dots (a..b) or three (a...b); yamt does not compare the working tree` |
| `--diff=a....b`, `--diff=a..b..c` | `--diff=a....b: a range holds one ".." or "..."` |
| `--diff=-x..b` | `--diff=-x..b: a side may not start with "-"` (keeps option text away from git's argv) |
| `--diff --diff=a..b`, `--diff=a..b` twice | `give --diff or one --diff=<range>, not both` |

**How the spec is read:** split at the first `..`. If the rest starts with `.`, it is three dots; drop that dot. The rest must not start with `.`. Neither side may contain `..` (git ref names cannot, check-ref-format rule 3). An empty side reads as `HEAD`.

**Valid examples:** `v1.2..v1.3`, `HEAD~3...main`, `@{u}..`, `..` (an empty range).

**Errors found only after git answers.** `Ending::failure(e.to_string()).report()` prints `yamt: <line>` on stderr and exits 2. The shell returns before `open_and_wait`, so no window is ever built, the same path `outcome::startup` uses.
- Not a repository: `yamt: /x is not inside a git repository: fatal: not a git repository …` (git's first stderr line).
- Unknown name: `yamt: git names no commit "foo"`.
- No merge base: `yamt: main and other have no merge base`.
- Pair already open: see point 8.

**Help text**

```
usage: yamt [--repo <path>]
       yamt --diff
       yamt --diff=<a>..<b> [--repo <path>]
       yamt --diff=<a>...<b> [--repo <path>]

Resolves the conflicted files of the merge in progress in <path> (default: the current directory).
With --diff, compares any two pasted texts in two columns: no repository needed, its tabs kept between runs.
With --diff=<range>, shows read-only what changed between two commits of the repository: a..b compares the
two commits, a...b compares where b branched off a with b (a merge request's changes). Either side is any
name git knows (branch, tag, commit id, HEAD~3); an empty side is HEAD.

  --repo <path>     any directory inside the work tree
  --diff            compare pasted texts instead of merging
  --diff=<range>    review a commit range
  --help            print this help
  --version         print the version
```

`lib.rs` adds one arm:

```rust
Ok(Invocation::Range { spec, repo }) => {
    #[cfg(target_os = "linux")]
    let repo = appimage::repo_from_start_dir(repo);
    range::run_range(&repo, &spec).report()
}
```

### 2. Git reads and their crate

**`yamt-gitio` additions.** Bytes and paths only; no UTF-8 decoding (RS14).

```rust
// diff.rs (new)
pub struct TreeSide { pub path: PathBuf, pub mode: u32, pub oid: Oid }
pub enum Changed {
    Added { new: TreeSide },
    Deleted { old: TreeSide },
    Modified { old: TreeSide, new: TreeSide },   // raw M and T (a kind change: the modes say which)
    Renamed { old: TreeSide, new: TreeSide },    // raw R<score>
}
pub enum Numstat { Lines { added: u32, removed: u32 }, Binary, Missing }
pub struct ChangedFile { pub change: Changed, pub numstat: Numstat }

impl Repo {
    /// `git diff-tree -r -z --raw --numstat --no-abbrev -M --diff-algorithm=histogram --ignore-submodules=none <old> <new>`
    pub fn changed_files(&self, old: &Oid, new: &Oid) -> Result<Vec<ChangedFile>>;
    /// `git merge-base <a> <b>`: the first base when there are several (as `git diff a...b`); exit 1 → None
    pub fn merge_base(&self, a: &Oid, b: &Oid) -> Result<Option<Oid>>;
    /// `git rev-parse --path-format=absolute --git-common-dir`: one identity for every worktree
    pub fn common_dir(&self) -> Result<PathBuf>;
}
// blob.rs
impl Repo {
    /// one `git cat-file --batch-check` run; None = missing
    pub fn blob_sizes(&self, oids: &[Oid]) -> Result<Vec<Option<u64>>>;
}
```

Raw `C`, `U` and `X` give `UnexpectedOutput`.

**Notes on the git command:**
- `--diff-algorithm=histogram` keeps the `+n −m` counts in line with merge-core's histogram diff (RK13's reference).
- `--no-abbrev` and `--ignore-submodules=none` are explicit because `submodule.*` is basic config.
- `diff.renameLimit` (basic config) still applies. Above it, git skips inexact renames and warns on stderr; the run still succeeds.

**Which crate owns the range: `yamt-range`, new.** It depends on `yamt-gitio`, `yamt-merge-core`, `serde`, `specta` and `thiserror`. No `serde_json` in A; B adds it for threads.
- `scripts/arch-check.sh` gets a rule: `yamt-range` depends on `yamt-gitio` and `yamt-merge-core` only among the yamt crates, never on tauri.
- yamt-app's allowed list gains `yamt-range`.
- PM1's text in the project map changes with it.

**Reads at start (each once):**
1. `rev-parse --show-toplevel` (`discover`).
2. Two `commit_named` calls.
3. `merge_base` for `...`.
4. Two `commit_summary` calls.
5. One `diff-tree` run.
6. One `cat-file --batch-check` over every changed blob id.

Sizes are known at listing, so a too-large blob is never read.

**Order:** `Resolved::resolve` → build the tauri `App` → `PairLock::take` (fails fast before a long listing) → `Resolved::list`.

**Per file, on demand:** `load_range_file` runs on `spawn_blocking`. It runs one `cat-file --batch` (`BlobReader`) for at most two blobs, then `merge_core::compare(left, right)`. A reply is never recomputed: nothing is edited.

**What a 10,000-file range costs:**
- One `diff-tree` run. Git reads both blobs of every pair for numstat; that is git's own time, **[INFERENCE]** seconds, inside `GIT_TIMEOUT` 30 s.
- One `--batch-check` of at most 20,000 lines.
- An `open_range` reply of about 1.5 MB JSON (about 150 bytes per entry).
- About 2 MB held in Rust.
- `FileList` renders every `li`, because it has no virtual scrolling. **[INFERENCE]** about 0.5–1 s in WebKitGTK in list mode; fewer rows in tree mode with closed folders. Recorded as RK31.

**One 8 MiB:** `merge_core::MAX_TEXT_BYTES: usize = 8 * 1024 * 1024` becomes the one constant (vision 2).
- `session/src/decode.rs` uses it.
- `yamt-compare`'s `MAX_COLUMN_BYTES: u32` stays, because it is the IPC type. A unit test in `compare/src/lib.rs` pins `usize::try_from(MAX_COLUMN_BYTES) == Ok(MAX_TEXT_BYTES)`, so the duplicate has a detector.

### 3. The mode in the shell and the page

- **`window.rs`:** `WindowKind::Range` → `"range"` in `start_script`. `context()` and `open_and_wait()` become `pub(crate)`. That is about +6 lines, which keeps the file under 400.
- **`range.rs`**, new:
  - `run_range(repo, spec) -> Ending`.
  - Builds with `commands::with_range(builder)`.
  - Takes the lock under `app.path().data_dir()/yamt/range/`.
  - Manages `RangeState`.
  - Opens with title `"<range as typed> — <repository folder> — yamt"`.
  - Returns `Ending { exit: Success, message: None }`.
- **What never starts:** no `MergeSession`, no `HostState` (no `servers::manage`, so no language servers), no `TabStore` and no compare lock.
- **Close:** `RangeApp` registers no `onWindowClose`, so the native close is not held. It exits 0 with no question.
- **`main.ts`:** the page's root is chosen by one exhaustive `switch` over `windowKind()`:
  - in the app, `dataset["window"]` is `"merge" | "compare" | "range"`, anything else meaning merge;
  - in fixture mode, `?range[=<case>]` gives `range`, then `?diff` gives `compare`, else `merge`.
  - `startRange(theme)` creates the source (`createTauriRangeSource` or `createFixtureRangeSource(log, SEARCH)`), creates `createRangeStore`, calls `startUp` and mounts `RangeApp`. No `LanguageServers`, no merge store.
- **Fixture mode:** cases are `frontend/fixtures/range/<case>.json` = `{ start: RangeStart, files: RangeFile[] }`, where the index is the id.
  - They are written by `just fixtures` (`fixtures-into`) through `yamt-cli range <repo> <range>` against `scripts/range-repo.sh`. The script builds into `target/range-repo` (on disk, RK27) with fixed dates and authors, so commit ids are deterministic.
  - Two cases: `review` = `main...feature` and `empty` = `feature..feature`.
  - A bare `?range` loads `review`. An unknown case logs `range.fixture_miss` and lists nothing.

### 4. The window's root: a third root

| file | job |
|---|---|
| `ui/RangeApp.vue` | composition only (VU16): `FileList` (slot: `RangeFileRow`), the visited `RangeView`s, `ProblemBar`, `SettingsView` (empty default slot in A), `QuestionDialog` (the key dialog's clash questions); `useThemeAttribute()`; window `keydown` → `fileListKey`; window focus → `loadSettings` |
| `ui/rangeStore.ts` | `createRangeStore(source, startTheme)` / `useRangeStore()`; registers the settings seam (`registerSettingsStore`) |
| `ui/RangeView.vue` | one per visited file, hidden when not shown (`PaneFrame`). Header: file icon, path ("old → new" when renamed), the mode note, ↑/↓ change arrows (`ACTION_NAMES`), gear. Section: column headers + the two hosts + strip (`compareColumns()` from `paneSplit.ts`), or one sentence across the columns |
| `ui/RangeFileRow.vue` | one row's content (list and tree): coloured letter A/M/D/R with the word as `title`, the label, the old path muted after a renamed file's label, `+n −m` right-aligned (`text-success-signal` / `text-problem-error`, existing tokens; the palette check passes) |
| `ui/useRangeController.ts` | the range root's only `../editor` importer: load, then build `RangeController`, then follow preferences |
| `ui/rangeText.ts` | every range word: side labels, the sentences, counts, the change words, the empty range |

**Ownership:**
- Rust's `Range` owns every fact about the range.
- `rangeStore.start` is a mirror of one reply.
- `shown` is written only by `showFile` and `startUp`.
- `visited` is written only by `showFile`. It stays in first-visit order and is never reordered, because a moved DOM node loses its scroll position. When a 17th file is shown, the least recently shown one is dropped.
- Each column's text lives only in `EditorState`. `useRangeController` holds a reply in a non-reactive `let` until its hosts exist, then drops it (VU10).

**Settings gear and view:** through `ui/settingsStore.ts`, exactly as the compare root does.

**Find:** per column, as every pane already has (`createPane`).

**Change arrows:** header buttons → `moveToChange`; the keymap's previous/next-change keys as in the compare window.

**Problems:** a failed load reports `{ action: "open", path, cause }`, the existing words "Could not open <path>". The file leaves `visited`, so selecting it again retries.

### 5. The changed-files list (rule 3): one list for both roots

| file | change |
|---|---|
| `ui/fileTree.ts` | `export type ListedFile = { readonly path: string }`; `TreeRow<F extends ListedFile>`; `treeRows<F extends ListedFile>(files: readonly F[], closed)`. Two concrete users: `FileEntry` and `RangeEntry` (RS2/TS6) |
| `ui/FileTree.vue` | `generic="F extends ListedFile"`; props `{ rows: readonly TreeRow<F>[]; active: string \| null; label: string }`; scoped slot `#file="{ file, label }"` replaces `FileMark`; `aria-label` from `label` |
| `ui/FileList.vue` | `generic="F extends ListedFile"`; props `{ files: readonly F[]; active: string \| null; label: string }`; emits `select: [path: string]`; slots `#file="{ file, label }"` (list and tree rows) and `#footer`; keeps the view button, width (`usePanelWidth`), closed folders and reveal. No longer imports `FileEntry`, `FileMark` or `OperationLabel` |
| `ui/App.vue` | passes `<FileMark :status="file.status" :label="label" />` into `#file` and `<OperationLabel v-if="operation !== null" … />` into `#footer`; `label="Conflicted files"` |

The list/tree choice (`yamt.files.view`), the width (`yamt.files.width`) and Ctrl/Cmd+B (`fileListKey`) are the same code and the same stored values for every window.

**The first file at start** is `files[0]` in Rust's order (paths sorted by bytes, the list view's order).

**A range with no changes:** the window opens. The panel shows an empty list, and the main area says one sentence: *"main (1b2cfed) and dev (2b3b4b5) have the same files."* `rangeText.ts` `emptyRangeText`.

### 6. The two read-only columns over the compare internals

**Public surface (`editor/range.ts`, re-exported by `editor/index.ts`, +2 lines):**

```ts
import type { Difference } from "../ipc";
import type { CompareHosts } from "./compare";
import type { Direction } from "./internal/navigation";
import type { Preferences } from "./internal/pane";

export type RangeTexts = {
  readonly path: string; // the file's path in the range, the old path when deleted: picks the language
  readonly left: string;
  readonly right: string;
  readonly differences: readonly Difference[];
};

export type RangeOptions = { readonly preferences: Preferences };

export class RangeController {
  constructor(texts: RangeTexts, hosts: CompareHosts, options: RangeOptions);
  setPreferences(preferences: Preferences): void;
  moveToChange(direction: Direction): void;
  destroy(): void;
}
```

`index.ts` adds `export { RangeController } from "./range";` and `export type { RangeOptions, RangeTexts } from "./range";`.

**Internals:**
- `compareViews.ts` splits its `createColumn` into a pure `columnState(column, { text, kind, settings, extensions })` and the view, then exports two factories:
  - `createColumnViews(texts, hosts, wiring)`: editable, unchanged behaviour (`"center"`, `columnLimit`).
  - `createReadOnlyColumnViews(texts, hosts, { settings, updated, extensions })`: `"readOnlyCenter"`, `differenceField`, `removalTooltip()`, `everyPane()`, no byte limit.
- `RangeController` composes the rest:
  - `CompareStrip` and `CompareFrame`: bands in one strip, locked scroll through `ScrollSync<Column>`, find space.
  - `columnMarks(...)` dispatched once through `showDifferences`: word marks and removal bars in both columns, `changeTone`.
  - `revealDifference`/`keyboardColumn` for the arrows.
  - `languageOf(texts.path)` + `loadLanguage(description, path, [left, right], () => destroyed)`, the merge window's rule.
  - `preferenceEffects("center", …)`.
- None of `format`, `settleNow`, `historyKey`, `setLanguage` or `holdsText` exists on this class. They cannot be called on a read-only column (vision 4).

**Where B's thread boxes attach (A leaves the seam, B builds it):**
- A per-column `threadField`, a `StateField<DecorationSet>`, passed in `extensions` by `RangeController`. Block decorations must come from a field, not a plugin.
- `Decoration.widget({ block: true, side: 1 })` after the commented line holds the thread box. In the other column, a gap widget sits at the aligned line: outside a difference, the line offset by the earlier differences; inside one, after the difference's end.
- The gap's height follows the box. It is measured in `CompareFrame`'s frame through `requestMeasure`, and an effect sets it in the other column.
- `compareFrame.ts` `measure` adds each box/gap pair's top and bottom to `anchors`, so scroll sync stays exact. `rowsChanged(update, [differenceField, threadField])`.
- Bands need no change: `columnSpan` uses `lineBlockAt`, which already counts the block widgets above a line.

### 7. Special files, decided once in Rust

`load.rs` `decide(file: &FileAt)` checks in this order:

| # | condition (from listing data, before any blob read) | reply |
|---|---|---|
| 1 | either mode is `160000` | `Submodule { old, new }` (full commit ids; None for an added or removed submodule) |
| 2 | kinds differ (file ↔ link) | `KindChanged { old, new }` |
| 3 | same blob id, modes differ | `ModeOnly { old, new }` |
| 4 | git's numstat said binary (`-`): attributes + NUL in the first 8,000 bytes, xdiff `buffer_is_binary` | `Binary` |
| 5 | either size > `MAX_TEXT_BYTES` | `TooLarge { limit }` |
| 6 | read the blobs; `String::from_utf8` fails on a side (session `decode.rs:42–44`) | `NotUtf8 { sides }` |
| 7 | otherwise | `Texts { left, right, differences, mode }`: added → `left ""`; deleted → `right ""`; renamed → the old blob on the left; `mode` = `Changed` when the content and the mode both changed (shown in the header) |

**Symbolic links** whose target changed are shown as text (their target path), as `git diff` and GitLab do.

**Words**, in `ui/rangeText.ts` only:
- "Binary file: not shown."
- "Larger than 8 MiB: not shown."
- "Only the file mode changed: file → executable file."
- "Changed from a file to a symbolic link."
- "Submodule: 1a2b… → 3c4d…"
- "The left side is not UTF-8 text." / "The right side …" / "Neither side …"
- Header "old/path → new/path".

### 8. One window per repository and commit pair

- **Folder:** `<data_dir>/yamt/range/<repo key>/<left oid>-<right oid>/lock`.
  - `repo key` = the work tree folder's name + `-` + 16 hex digits of FNV-1a 64 over the bytes of the absolute **common git dir** (`Repo::common_dir`).
  - So every worktree of one repository shares a pair folder: B's threads and C's checkout are per repository.
  - FNV-1a is a named 8-line function with a pinned test vector. It is stable across Rust releases, unlike `DefaultHasher`.
- **Lock:** `File::try_lock` for the process's life, exactly as `compare/src/files.rs:28–43`. The OS releases it on any exit, including `kill -9`.
- **Refusal:** `yamt: another yamt window shows 1b2cfed..2b3b4b5 of /home/me/proj`, exit 2, no window. It names short commit ids; nothing about the first window is written into the lock file.
- **Running side by side:** windows on different pairs, and a `yamt --diff` window (its own lock in `compare/`), all run at once.
- **B** stores `threads.json` in `PairLock::folder()`.

### 9. IPC

**Rust (`crates/range/src/lib.rs`):**

```rust
use serde::{Deserialize, Serialize};
use specta::Type;
use yamt_merge_core::Difference;

/// A changed file's place in the range's list: 0.. in list order, fixed for the window's life.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize, Type)]
pub struct RangeFileId(pub u32);

/// How a column header names its side.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Type)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum RangeSideLabel {
    /// A side as typed; an empty side is `HEAD`.
    Named { name: String },
    /// The left of `a...b`: where `right` branched off `left`.
    MergeBase { left: String, right: String },
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Type)]
pub struct RangeSide { pub label: RangeSideLabel, pub short_id: String, pub subject: String }

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Type)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum RangeChange { Added, Modified, Deleted, Renamed { old_path: String } }

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Type)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum RangeLineCounts { Counted { added: u32, removed: u32 }, NotCounted }

/// One row of the list; `path` is the new path, the old one for a deleted file (UTF-8, lossy for display).
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Type)]
pub struct RangeEntry { pub id: RangeFileId, pub path: String, pub change: RangeChange, pub lines: RangeLineCounts }

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Type)]
pub struct RangeStart { pub range: String, pub left: RangeSide, pub right: RangeSide, pub files: Vec<RangeEntry> }

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum RangeEntryKind { File, Executable, Link, Submodule }

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Type)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum RangeModeChange { Same, Changed { old: RangeEntryKind, new: RangeEntryKind } }

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum RangeSides { Left, Right, Both }

/// What one file shows: decided once, here.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Type)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum RangeFile {
    Texts { left: String, right: String, differences: Vec<Difference>, mode: RangeModeChange },
    Binary,
    TooLarge { limit: u32 },
    NotUtf8 { sides: RangeSides },
    ModeOnly { old: RangeEntryKind, new: RangeEntryKind },
    KindChanged { old: RangeEntryKind, new: RangeEntryKind },
    Submodule { old: Option<String>, new: Option<String> },
}

#[derive(Debug, thiserror::Error)]
pub enum Error {
    #[error("{} is not inside a git repository: {message}", path.display())]
    NotARepository { path: PathBuf, message: String },
    #[error("git names no commit \"{name}\"")]
    UnknownName { name: String },
    #[error("{left} and {right} have no merge base")]
    NoMergeBase { left: String, right: String },
    #[error("another yamt window shows {left}..{right} of {}", root.display())]
    Locked { root: PathBuf, left: String, right: String },
    #[error("cannot write {}: {message}", path.display())]
    LockFailed { path: PathBuf, message: String },
    #[error("no file {} in this range", file.0)]
    UnknownFile { file: RangeFileId },
    #[error(transparent)]
    Git(#[from] yamt_gitio::Error),
}

#[derive(Debug, PartialEq, Eq, thiserror::Error)]
pub enum SpecError { Empty, NoDots { text: String }, ExtraDots { text: String }, Dash { text: String } }
// messages as in point 1's table
```

**Public functions:**
- `RangeSpec::parse(&str) -> Result<RangeSpec, SpecError>` and `RangeSpec::text(&self) -> &str`.
- `Resolved::resolve(cwd: &Path, spec: &RangeSpec) -> Result<Resolved>`, `Resolved::root(&self) -> &Path`, `Resolved::list(self) -> Result<Range>`.
- `PairLock::take(range_dir: &Path, resolved: &Resolved) -> Result<PairLock>` and `PairLock::folder(&self) -> &Path`.
- `Range::start(&self) -> RangeStart` and `Range::load(&self, file: RangeFileId) -> Result<RangeFile>`.

**Commands (`src-tauri/src/range.rs`, each ≤ 15 lines):**

```rust
#[tauri::command] #[specta::specta]
pub(crate) fn open_range(state: State<'_, RangeState>) -> RangeStart { state.range.start() }

#[tauri::command] #[specta::specta]
pub(crate) async fn load_range_file<R: Runtime>(window: WebviewWindow<R>, file: RangeFileId)
    -> Result<RangeFile, IpcError>   // spawn_blocking: window.state::<RangeState>().range.load(file); a panic → WorkerStopped
```

**`ipc_error.rs`:**
- Adds `UnknownRangeFile { file: RangeFileId }`.
- `From<yamt_range::Error>`, exhaustive: `UnknownFile` → `UnknownRangeFile`; `Git(e)` → `Git { message }`; the start-only variants → `Git { message: e.to_string() }`.
- `commands.rs` registers both commands, plus `with_range(builder)`.

**Generated TS (`bindings.ts`, `just bindings`):**

```ts
export type RangeFileId = number;
export type RangeSideLabel = { kind: "named"; name: string } | { kind: "mergeBase"; left: string; right: string };
export type RangeSide = { label: RangeSideLabel; short_id: string; subject: string };
export type RangeChange = { kind: "added" } | { kind: "modified" } | { kind: "deleted" } | { kind: "renamed"; old_path: string };
export type RangeLineCounts = { kind: "counted"; added: number; removed: number } | { kind: "notCounted" };
export type RangeEntry = { id: RangeFileId; path: string; change: RangeChange; lines: RangeLineCounts };
export type RangeStart = { range: string; left: RangeSide; right: RangeSide; files: RangeEntry[] };
export type RangeEntryKind = "file" | "executable" | "link" | "submodule";
export type RangeModeChange = { kind: "same" } | { kind: "changed"; old: RangeEntryKind; new: RangeEntryKind };
export type RangeSides = "left" | "right" | "both";
export type RangeFile =
  | { kind: "texts"; left: string; right: string; differences: Difference[]; mode: RangeModeChange }
  | { kind: "binary" } | { kind: "tooLarge"; limit: number } | { kind: "notUtf8"; sides: RangeSides }
  | { kind: "modeOnly"; old: RangeEntryKind; new: RangeEntryKind }
  | { kind: "kindChanged"; old: RangeEntryKind; new: RangeEntryKind }
  | { kind: "submodule"; old: string | null; new: string | null };
// IpcError gains | { kind: "UnknownRangeFile"; file: RangeFileId }
// commands.openRange(): Promise<RangeStart>; commands.loadRangeFile(file: RangeFileId): Promise<Result<RangeFile, IpcError>>
```

**Window side:**
- **Brand:** `RangeFileId` in `ipc/domain.ts` (`isRangeFileId` type guard, IPC3). No commit-id brand in A: the window never sends one back; B adds it where Rust needs it.
- **`ipc/rangeDomain.ts`:** camelCase shapes (`shortId`, `oldPath`); `toRangeStart`, `toRangeFile` (reusing `toDifferences` from `compareDomain.ts`).
- **`ipc/RangeSource.ts`:**

```ts
export interface RangeSource extends SettingsSource {
  openRange(): Promise<SourceResult<RangeStart>>;           // the sides and every changed file
  loadRangeFile(file: RangeFileId): Promise<SourceResult<RangeFile>>; // one file's view, decided by Rust
}
```

- **Implementations:** `createTauriRangeSource` (`ipc/tauriRange.ts`) and `createFixtureRangeSource(log, search)` (`ipc/fixtureRange.ts`, valibot through `parsedFixture`).
- **Words:** `ui/problemText.ts` gives `UnknownRangeFile` the fixed reason "that file is not part of this range."
- **`map-check.sh`:** `for source in ChunkSource CompareSource RangeSource`.

### 10. Tests

**Editor node tests.** `editor/` is not mutated (VF7), so each test names its bug and the one-line hand mutation that must make it fail.

| test (`editor/internal/compareViews.test.ts`, new) | bug it catches | hand mutation |
|---|---|---|
| a read-only column's state refuses a user insert and keeps its text | review columns become editable | `"readOnlyCenter"` → `"center"` in the read-only `columnState` call |
| a read-only column holds `differenceField`, so `showDifferences` lands | bands and word marks never show in the range window | drop `differenceField` from the read-only extensions |
| an editable column still refuses an insert over its byte limit | the split dropped the compare window's 8 MiB guard | delete the `columnLimit(...)` line in the editable path |

**WebKit probe `editor/range.browser.test.ts`** (not in `just check`, like `compare.browser.test.ts`):
- both columns marked from one reply;
- a `.ts` path loads TypeScript;
- `moveToChange("down")` puts the selection on the next difference;
- typing changes nothing;
- `destroy()` empties the hosts.

**Rust behaviour tests.** Mutated by `just mutants`; real repositories built by `conflict-repo`'s `diverged_repo` + `git_ok`.

`crates/gitio/tests/diff.rs`:
- `added_modified_deleted_files_are_listed_with_git_s_counts`
- `a_renamed_file_lists_both_paths_and_counts_only_its_edits`
- `a_binary_file_is_listed_without_counts`
- `a_mode_only_change_lists_both_modes_and_one_blob_id`
- `a_submodule_commit_change_is_listed_as_a_gitlink` (`update-index --cacheinfo 160000,…`)
- `a_file_replaced_by_a_link_is_one_modified_entry_with_both_modes` (unix)
- `the_users_diff_config_does_not_change_the_list`: repository config `diff.relative`, `diff.orderFile`, `diff.renames=false`, `diff.algorithm=minimal`, `diff.external`, `diff.ignoreSubmodules=all`, plus `GIT_EXTERNAL_DIFF` and `GIT_DIFF_OPTS` in the environment (RK19).
- `paths_with_spaces_newlines_and_non_utf8_bytes_round_trip`
- `merge_base_is_the_fork_point_and_none_for_unrelated_histories`
- `blob_sizes_answer_in_order_and_missing_as_none`
- Unit tests in `diff.rs`: the rename record; numstat matched by path when records are reordered.

`crates/range` unit tests:
- `spec.rs`: every malformed form, plus `v1.2..v1.3`, `..`, `HEAD~3...main`, `@{u}..`.
- `lock.rs`: FNV-1a vector `"a"` → `af63dc4c8601ec8c`.
- `entries.rs`: rows sorted by path; the deleted row's path is the old path.

`crates/range/tests/range.rs`:
- `three_dots_compares_the_merge_base_and_two_dots_the_tips` (main moved on after the fork)
- `a_criss_cross_range_lists_what_git_diff_three_dots_lists` (compared with `git diff --name-only a...b`)
- `an_empty_side_is_head`
- `unknown_name_not_a_repository_and_no_merge_base_are_their_errors`
- `added_has_an_empty_left_and_deleted_an_empty_right`
- `renamed_shows_the_old_text_left`
- `binary_is_answered_before_size_and_without_reading` (a NUL blob > 8 MiB → `Binary`)
- `exactly_8_mib_loads_and_one_byte_more_is_too_large`
- `non_utf8_names_the_sides`
- `mode_only_kind_changed_and_submodule_are_sentences`
- `a_link_is_shown_as_its_target_text`
- `texts_carry_merge_core_compare_s_differences`
- `an_unknown_id_is_unknown_file`
- `the_same_pair_twice_is_locked_naming_both_short_ids`
- `another_worktree_of_the_same_repository_shares_the_lock`
- `a_different_pair_is_not_locked`

`src-tauri`:
- `args.rs`: each usage line above; `--diff=a..b --repo p` in both orders; `--diff` alone stays `Compare`; help names `--diff=<range>`.
- `range.rs`: `open_range` equals `Range::start`; an unknown id → `UnknownRangeFile`; title format.
- `window.rs`: the start script carries `data-window="range"`.

**`ui/` and `ipc/` tests** (Stryker-mutated):
- `rangeStore.test.ts`:
  - the first file is shown at start;
  - an empty range shows none;
  - `showFile` switches the screen to files;
  - the 17th file drops the least recently shown and keeps the others' order;
  - a failed load reports `open` with its path, leaves `visited`, and a later success clears the problem;
  - Ctrl+B toggles, but not while a question waits.
- `rangeText.test.ts`: every `RangeFile` sentence, merge-base and HEAD labels, counts, the renamed header.
- `useRangeController.test.ts`: a reply arriving after unmount is dropped; sentence kinds build no controller.
- `fileTree.test.ts`: the existing merge rows unchanged, plus range entries through the generic.
- `rangeDomain.test.ts`, `fixtureRange.test.ts`:
  - `?range=review` lists the case;
  - a bare `?range` loads `review`;
  - an unknown case logs `range.fixture_miss`.
- `fences.test.ts`: PM9 violations (see point 12).
- `app-session/args.test.ts`: `--range` needs `--repo`; `--range-case`.

**WebKit steps.** `just webdriver <port>` + `app-session start-fixture --range-case review`, one per acceptance line:
1. A/M/D/R marks, `+n −m`, the old path on renamed rows.
2. Tree/list switch.
3. Width drag and its dots.
4. Ctrl+B.
5. The first file is shown.
6. Header "old → new".
7. Added: left empty. Deleted: right empty.
8. The sentences for binary, too large, mode-only, kind change, submodule and not UTF-8.
9. Word marks, removal bars with tooltip, bands.
10. Locked scroll.
11. Find in each column.
12. ↑/↓.
13. Syntax colours from the file name.
14. Gear → settings → Back.
15. `--range-case empty` shows the sentence.

**Real-app steps.** `scripts/range-repo.sh /var/tmp/rr`, then `just app-session start-app --repo /var/tmp/rr --range main...feature`:
1. Title.
2. Headers with short ids, with the subject on hover.
3. Two dots vs three dots show different file sets (README).
4. Close exits 0 at once.
5. With no window shown, exit 2 and the line on stderr for `--diff=main`, `--diff=nope..main`, a folder outside any repository, and `main..unrelated`.
6. The same pair typed differently (`<main id>...feature`) is refused, exit 2.
7. A different pair opens.
8. `yamt --diff` opens at the same time.

**`scripts/range-repo.sh <dir>`** (sources `git-sandbox.sh`, fixed dates and authors):
- main: base files, reusing `scripts/demo/base` texts.
- `feature` branched off main:
  - `board.ts` edited (long, for scroll);
  - `reminders.ts` added;
  - `mockBoards.ts` deleted;
  - `shortcuts.md` renamed to `keys.md` with an edit;
  - `logo.png` changed (binary);
  - `build.sh` chmod +x only;
  - a gitlink by `--cacheinfo`;
  - `data/big.txt` at 8 MiB + 1;
  - a Latin-1 file;
  - a CRLF file;
  - a link retargeted;
  - `config` turned from a file into a link;
  - one file with both a mode and a content change.
- main moves on after the fork (README).
- Prints the command to run.

### 11. Size and order

Code globs never overlap. At most one Rust build and one web build run at once.

| step | build | owns | files / lines |
|---|---|---|---|
| 0 | **D0** docs | `docs/architecture.md` (§1, §2, §3.2, new §3.8 `range`, §3.5, §4, §5.1, §5.2, §5.4, §7, §8), `.omp/skills/{project-map,ipc-contract,risk-register}/SKILL.md`, `src-tauri/AGENTS.md`, `frontend/src/{ipc,editor,ui}/AGENTS.md`, `README.md`, `CHANGELOG.md`; names every planned file, command and `RangeSource` method up front | 11 / ~500 |
| 1 | **R1** (rust) ∥ **W1** (web) | R1: `crates/gitio/src/{diff,repo,blob,lib}.rs`, `crates/gitio/tests/diff.rs` | 5 / ~650 |
| | | W1: `editor/range.ts`, `editor/range.browser.test.ts`, `editor/index.ts`, `editor/internal/compareViews.ts`, `editor/internal/compareViews.test.ts`; `ui/{fileTree,fileTree.test}.ts`, `ui/{FileTree,FileList,App}.vue` | 10 / ~480 |
| 2 | **R2** | `crates/range/**` (`Cargo.toml`, `AGENTS.md`, `src/{lib,spec,open,entries,load,lock}.rs`, `tests/range.rs`), root `Cargo.toml`, `Cargo.lock`, `scripts/arch-check.sh`, `crates/merge-core/src/lib.rs`, `crates/session/src/decode.rs`, `crates/compare/src/lib.rs` | 15 / ~1,450 |
| 3 | **R3a** (contract) | `src-tauri/Cargo.toml`, `src-tauri/src/{args,lib,window,range,commands,ipc_error}.rs`, `Cargo.lock`, `frontend/src/ipc/bindings.ts` (generated), `frontend/src/ui/{problemText,problemText.test}.ts` | 11 incl. 1 generated / ~480 |
| 4 | **R3b** ∥ **W3** | R3b: `crates/cli/{Cargo.toml,src/args.rs,src/lib.rs,src/range.rs}`, `scripts/range-repo.sh`, `justfile` (`fixtures-into`, `fixtures-check`), `frontend/fixtures/range/{review,empty}.json` (generated) | 8 incl. 2 generated / ~320 |
| | | W3: `ipc/{domain,rangeDomain,rangeDomain.test,RangeSource,tauriRange,fixtureRange,fixtureRange.test,index}.ts`, `scripts/map-check.sh` | 9 / ~480 |
| 5 | **W4** | `frontend/src/main.ts`, `ui/{RangeApp,RangeView,RangeFileRow}.vue`, `ui/{rangeStore,rangeStore.test,rangeText,rangeText.test,useRangeController,useRangeController.test}.ts`, `frontend/scripts/{fences,fences.test}.ts`, `frontend/scripts/app-session/{args,args.test,start,fixture}.ts` | 16 / ~1,290 |
| 6 | D0's second pass + verification | `just check`, `just mutants <base>`, WebKit, real app | |

```
D0 ─┬─ R1 ── R2 ── R3a ─┬─ R3b ───────────────┐
    └─ W1 (∥ R1/R2) ────┴─ W3 ── W4 ──────────┴─ verify
```

**Contracts each build fixes for the next:**
- R1 → R2: the gitio functions and types in point 2.
- R2 → R3a/R3b: `yamt-range`'s public functions and IPC types (point 9).
- R3a → W3: the generated `bindings.ts`, `IpcError::UnknownRangeFile`, `data-window="range"`.
- W1 → W4:
  - the `RangeController` surface;
  - generic `FileList` (props `files`, `active`, `label`; slots `#file`, `#footer`; `select(path)`);
  - `TreeRow<F>`.
- W3 → W4: `RangeSource`, the domain types, `createTauriRangeSource`, `createFixtureRangeSource(log, search)`.
- R3b → verification: `yamt-cli range`, the smoke repository, the fixtures.

`fixtureRange.ts`'s `import.meta.glob` reads an empty record until R3b lands; W3's tests use inline JSON.

### 12. Plan §2 rows (DR4/DR5: proposed; the orchestrator records them)

- **#93, Rejected column, added:** "… `git difftool`, file pairs: reopened 2026-10-24 for commit ranges (owner, request-review-range A); `yamt --diff` without a value is unchanged; a range is #103."
- **#94, amended:** "the shell never … runs git" now reads "the compare window's shell never runs git"; the range window reads git only through `yamt-range` (#104). PM7 now also forbids the compare root from importing `ui/rangeStore.ts`/`ui/RangeApp.vue`.
- **#101, extended to `--diff[=<range>]`:**
  - `--diff` alone opens the compare window;
  - `--diff=<range>` opens the range window (#103);
  - `--repo` is allowed with a range only;
  - `--diff` together with `--diff=`, `--diff=` with no value, a name without dots, extra dots, a side starting with `-` and a second `--diff=` are usage errors (exit 2, one line + usage);
  - test tooling: `app-session start-app --range <r> --repo <dir>`, `start-fixture --range-case <case>`, the fixture page `?range[=<case>]`.
- **#103: The range window is a third mode end to end.**
  - `Invocation::Range { spec, repo }`; `WindowKind::Range` → `<html data-window="range">` before the first frame; `?range=<case>` in fixture mode.
  - `RangeApp.vue` + `rangeStore.ts` are a third root that never imports `ui/store.ts`, `ui/App.vue`, `ui/compareStore.ts`, `ui/CompareApp.vue` or `lsp/` (PM9, `frontend/scripts/fences.ts`).
  - No `MergeSession`, no language servers, no `TabStore`.
  - Title `"<range> — <folder> — yamt"`; close exits 0 with no question; an empty range opens with one sentence.
  - `FileList`/`FileTree`/`fileTree.ts` are generic with slots, shared by the merge and range roots.
  - The last `MOUNTED_FILES` 16 visited files stay mounted, in first-visit order.
  - Amends TS15 (a third store singleton), VU9, VU11 (a third editor seam, `useRangeController`), VU15.
  - Rejected: a range shape inside `CompareApp`/`compareStore` (option B: two jobs in a store at its 300-line cap; Format, undo and settle callable on read-only columns); a `get_mode` command (one frame of the wrong root); a copy of `FileList` (two list rules); every visited file mounted (memory grows with hundreds of files).
  - Visions 3, 2, 4, 1.
- **#104: Commit ranges are read by the new crate `yamt-range`** (`yamt-gitio` + `yamt-merge-core`).
  - `RangeSpec` is parsed by the argument parser.
  - Both sides are resolved once (`rev-parse --verify --quiet <name>^{commit}`; `merge-base`'s first base for `...`, as `git diff a...b`); names come from `log -1`.
  - The list comes from one plumbing run, `git diff-tree -r -z --raw --numstat --no-abbrev -M --diff-algorithm=histogram --ignore-submodules=none`, which reads no porcelain `diff.*` config, does no textconv and runs no external diff. Sizes come from one `cat-file --batch-check`.
  - One file's texts are read on demand by `cat-file --batch` and diffed by `merge_core::compare` on a worker.
  - The state is immutable and managed without a Mutex.
  - `merge_core::MAX_TEXT_BYTES` is the one 8 MiB.
  - Amends §7 (the crate list) and PM1 / `scripts/arch-check.sh`.
  - Rejected: `yamt-compare` gaining gitio (the compare window would reach git; two jobs); `yamt-session` gaining a second job (option C); porcelain `git diff` (reads `diff.relative`/`orderFile`/`algorithm`/`external`, textconv); separate raw and numstat runs; every text in one reply (10,000 files).
  - Visions 3, 2, 5, 1.
- **#105: What a changed file shows is decided once in Rust**, as the `RangeFile` sum type.
  - Order: submodule → kind change → mode only → binary (git's numstat: attributes + NUL in the first 8,000 bytes) → over 8 MiB → not UTF-8 (`session/decode.rs` rule) → texts.
  - Added and deleted files show an empty column; a renamed file shows "old → new"; links show as text; a mode change alongside a content change shows in the header.
  - Rejected: deciding in the window; reading blobs while listing.
  - Visions 4, 2.
- **#106: `RangeController` beside `CompareController`** (`editor/range.ts`).
  - Two `readOnlyCenter` columns showing one reply's differences, never recomputed.
  - Language from the path (`languageOf`).
  - Shares `compareViews` (a second factory), `CompareFrame`, `CompareStrip`, `columnMarks`, `compareFocus`.
  - B's threads attach as a per-column block-widget field plus anchors in `CompareFrame`.
  - Rejected: a read-only option on `CompareController` (Format, settle, language picker and undo would compile on read-only columns); a two-pane `MergeController` (#96).
  - Visions 4, 2, 5.
- **#107: One range window per repository and commit pair.**
  - `File::try_lock` on `<data>/yamt/range/<repo key>/<left>-<right>/lock`, where repo key = work tree folder name + FNV-1a 64 of the common git dir, so worktrees share it.
  - Refusal names both short ids and the repository; exit 2.
  - B keeps its threads in the pair folder.
  - Rejected: no lock (B would have two writers); a lock in the repository's git dir (writes into the user's repository); a hashing crate (a dependency for 10 lines); path-escaped folder names (collisions, the 255-byte limit).
  - Visions 2, 3, 5.

**Risks to register:**
- **RK28:** the user's diff config changes the list. Proven by `the_users_diff_config_does_not_change_the_list`.
- **RK29:** three dots with several merge bases differ from git. Proven by `a_criss_cross_range_lists_what_git_diff_three_dots_lists`.
- **RK30:** a second window on the same pair. Proven by `the_same_pair_twice_is_locked…` and `another_worktree…`.
- **RK31:** a 10,000-row list renders slowly (no virtual scrolling). No proving test yet: a real-app timing step.

### Seams for B and C (option A)

- **Thread boxes:** `editor/range.ts`'s `extensions` to `createReadOnlyColumnViews` (a `threadField` per column), plus `compareFrame.ts` `measure` anchors and `rowsChanged`. Only the range columns ever get them.
- **Per-pair storage:** `crates/range/src/threads.rs` (B) in `PairLock::folder()`; `RangeState` gains B's `Mutex<Threads>`.
- **`--ai` (C):** `Invocation::Range { …, ai: bool }` → `RangeState.ai` → `RangeStart.ai` → `rangeStore.ai`. The AI section goes in `SettingsView`'s default slot in `RangeApp.vue`. The list's per-file thread count goes in `RangeFileRow`.

---

## 4. Option B: the range inside the compare mode

**Structure:**
- Rust:
  - `Invocation::Compare(CompareInput)` with `CompareInput = Pasted | Range { spec, repo }`; one `WindowKind::Compare`.
  - `open_compare` answers `CompareStart = Tabs { list, column_limit } | Range(RangeStart)`.
  - `yamt-compare` gains `yamt-gitio` and the range modules.
  - The shell's `compare.rs` manages either `Mutex<TabStore>` or the range state.
- Window:
  - `compareStore.ts` holds `CompareMode = { kind: "tabs" … } | { kind: "range" … }`.
  - `CompareApp.vue` branches `CompareTabList` vs `FileList`; `CompareView.vue` branches Format and the picker vs the path header.
  - `CompareController(columns: { kind: "editable"; texts; columnLimit; events } | { kind: "readOnly"; texts: RangeTexts }, hosts, options)`.

**Files:**
- Rust: gitio as R1.
- `crates/compare/{Cargo.toml, src/{lib,range_spec,range_open,range_entries,range_load,range_lock}.rs, tests/range.rs}`.
- `scripts/arch-check.sh` (the compare rule allows gitio).
- `src-tauri/src/{args,lib,window,compare,commands,ipc_error}.rs`.
- `ipc/{CompareSource,compareDomain,tauriCompare,fixtureCompare,domain,index}.ts`.
- `editor/{compare,index}.ts`, `editor/internal/compareViews.ts`.
- `ui/{compareStore,compareRange (split, over 300 lines),CompareApp,CompareView,useCompareController,rangeText}.*`.
- The list generalization as in A.
- CLI, smoke script and fixtures as in A.

**Cost:**
- #94's own rejected alternative ("branches inside the root's store") comes back for this root.
- `format()`, `settleNow()`, `historyKey()`, `setLanguage()` and `holdsText()` must answer something for read-only columns, so vision 4 breaks.
- "`yamt --diff` never runs git" is no longer true by construction.
- B's threads and their storage pile into `yamt-compare` beside the tabs.

**Gain:** about 26 fewer files and one window kind.

**Seams:** thread boxes go in the shared controller's read-only kind (another branch); storage in `yamt-compare`; `--ai` through `CompareInput::Range { ai }`.

## 5. Option C: the range as `yamt-session`'s second job

**Structure:** as A on the window side. Rust:
- `crates/session/src/{range,range_spec,range_entries,range_load,pair_lock}.rs` + `tests/range.rs`.
- `RangeReview` is re-exported beside `MergeSession`.
- `decode.rs`'s `is_binary`, `MAX_TEXT_BYTES` and the UTF-8 check are reused without moving.
- No new crate, no workspace or arch-check change; `src-tauri` imports from `yamt_session`.

**Cost:**
- `session`, described as "the MergeSession state machine; the only crate that knows both", gets a second public job unrelated to merging (vision 1 reader load, vision 2).
- B's thread storage needs `serde_json` in `session`, a new dependency row.
- Every mutation run over session grows.

**Gain:** no §7 entry, no arch-check rule, no constant move.

**Seams:** as A, but storage lands in `session`.

---

## 6. Recommendation

**Option A.** The range window is a different job: read-only, git-backed, many files, one pair. Every place it touches gets its own named home:
- a crate with one job (vision 2);
- a root its fence checks (vision 3);
- an editor class whose methods all mean something (vision 4);
- one list shared by two roots, not copied (vision 2).

B's thread blocks, B's pair storage and C's `--ai` each attach in one named file without touching the merge or compare windows.

**What it costs:**
- One crate (row #104, a §7 entry, an arch-check rule).
- A third root, store and fence (PM9).
- A third editor seam.
- The merge root's `App.vue` passes its marks through slots.
- `MAX_TEXT_BYTES` moves into `merge-core`, touching `session` and `compare` (3 small edits).
- Empty pair folders build up under the data folder.
- About 86 files and about 5,300 lines in 8 builds; the critical path is D0 → R1 → R2 → R3a → W3 → W4.

---

## 7. Open questions for the product owner

1. **A range with no changes.** Right now the window opens and says "main (1b2cfed) and dev (2b3b4b5) have the same files". The other way: no window; one line in the terminal, exit 0. That line is invisible when yamt is started from a launcher button.
2. **Coming back to a file you looked at.** Right now the last 16 files keep their scroll position and selection; an older one opens again at the top. The other ways:
   - keep every visited file as you left it, but memory grows with every file, and a 300-file review may make the window heavy;
   - keep none, so every switch starts at the top.
3. **Very large ranges.** Right now the window appears once git has listed every file: a few seconds on thousands of files, but any error stays in the terminal. The other way: the window appears at once with "Listing…". Then a listing failure shows inside an opened window.
4. **Symbolic links.** Right now a link whose target changed shows its old and new target as text in the two columns, as `git diff` and GitLab do. The other way: one sentence, "symbolic link: old → new".

## 8. Where this departs from the brief

- **"Nothing is written anywhere for A"** does not hold fully. The pair lock (rule 6) creates an empty `lock` file and its folders under the app's data folder; no content is ever written.
- **`+n −m` are git's counts** (`diff-tree --numstat --diff-algorithm=histogram`), like GitLab's. They are not recounted by merge-core, so in rare cases they may differ by a line from the coloured lines.
- **"Binary" is git's decision** (repository attributes + the NUL rule), held once in Rust. Size and UTF-8 follow the merge window's rule.
- **Additions beyond rule 5:** a file whose kind changed (file ↔ link or submodule) gets its own sentence, and a mode change that comes with a content change shows in the header.
- **`merge_core::MAX_TEXT_BYTES` becomes the one 8 MiB.** A third user appeared, and vision 2 asks for one constant. Compare's `u32` copy is pinned by a test.