# V0DiskTruthDesign — design output (row 13)

Two rounds. Round 1: options A/B/C; the orchestrator chose A. Round 2: A + start-up detection (owner chose 'start from the disk whenever it differs from what git wrote', #516). Decisions recorded in docs/plan.md §2 #52/#53. Options B and C are rejected and omitted here.

## A: each open git block becomes one conflict; yamt keeps the file's bytes; disk changes come back in every reply

### Summary

(1) What yamt remembers and how it compares. Each `FileState` gains `seen: OnDisk`, the worktree entry as yamt last saw it. It holds the bytes of a regular file, a symlink's target bytes, the commit a submodule has checked out, `Missing`, or `Other` (a directory or special file sitting at the path). yamt reads it in `open()` and again after each of its own writes. It reads the file back from disk rather than assuming what it wrote, because filters and `checkout -m` rewrite it. `MergeSession::refresh()` replaces `refresh_statuses` behind `list_files`, which the window already calls on focus (#49). It reads every file, compares it with `seen` and passes each difference to `disk::settle`, the one place that decides between staging and reopening. Only then does it re-read `git ls-files -u`, so the marks include the staging just done. `finish`, `take` and `reset` first run the same look on their one file. If it changed, the write is skipped and they return `WriteReply::ChangedOnDisk`, which is not an error. Cost: per focus, one `symlink_metadata` + `read` + byte compare per conflicted file, and no git process unless something changed. Memory is the total size of the conflicted files: a few MB for hundreds of source files [INFERENCE, not measured]. Binaries are held whole. Comparing bytes needs no hash and no dependency (vision 5).
(2) Reading markers. `session/markers.rs` parses the bytes line by line. CRLF: `\r\n` is stripped before matching. Labels are ignored, and a last line without a newline is accepted. The marker size N comes from one `git check-attr -z --stdin conflict-marker-size` call at `open()` for all paths; unspecified, unset or non-numeric gives 7, git's default. This is the size git used at merge time. A `.gitattributes` edited during the merge is not followed. A marker line is exactly N copies of `<`, `|`, `=` or `>`, followed by a space, CR, LF or end of file (git rerere.c `is_cmarker`). Inner markers of a virtual base (N+2 long) are therefore text. The parser's states are Outside → Ours → (Base) → Theirs → Outside. `|||||||` and `=======` count only inside an open block, so the settled `=======` on line 2 of the samples is text. Anything out of order becomes a `Raw` region: a missing separator, `>>>>>>>` before `=======`, a nested `<<<<<<<`, end of file inside a block, or a stray `<<<<<<<`/`>>>>>>>` line. A `Raw` region runs to the next `>>>>>>>` (inclusive), or to the line before the next `<<<<<<<`. 'Markers left' means at least one `Block` or `Raw` region. A half-edited block is shown as it is, never repaired. That covers a deleted `=======` (parsed as `Raw`) and an edit inside a section (parsed as a `Block` that is not located exactly, see 3). The whole disk region, markers included, becomes one Conflict whose middle is that raw text. This is safe for five reasons: nothing on disk is hidden or rewritten; the summary counts it, so Mark resolved asks first; × on both sides keeps the text as it is; apply swaps it for the stage text visibly and can be undone; and a file with marker lines is never staged automatically.
(3) Mapping. One `Conflict` chunk per open block. Settled text gets no chunks. The middle's starting text is the settled lines as they are, each exactly located block replaced by its base lines (stage 1), and each `Raw` region or inexact block left verbatim. Locating: build `ours_view` = the settled lines plus each block's ours section (`Raw` regions left out), then `merge_core::line_map(ours_view, local)`. The section's local range is `LineMap::exact` of its lines: every line matched, or for an empty section the insertion point after the last matched line before it. Theirs is located the same way against remote. Base lines are the union of the local and remote ranges projected through `line_map(local, base)` and `line_map(remote, base)` with `covering`, which grows them outward to whole changed hunks. The base section that diff3/zdiff3 write is parsed and skipped: base comes from the stages (plan §1). The markers only say which blocks are open and where they sit in the disk text. When text repeats, the diff's context picks the copy. Because 'exact' means the lines are textually equal, apply ours writes the same text whichever copy was picked. Only word marks and scroll anchors could point at a twin. A block that is not exact gets `covering` ranges on both sides. Each chunk = merge-core `Chunk { kind: Conflict, base, local, remote }` + its middle range + `word_changes(base, local, remote, &chunks)`. The side panes stay stages 2 and 3, with only these ranges tinted. Worked example (0-based `{start,len}`; the user resolved block 2 by hand on disk to `eight-theirs`; block 1 is still open). zdiff3 disk: 0 title, 1 =======, 2 <<<<<<< HEAD, 3 one, 4 TWO, 5 shared-a, 6 three-ours, 7 ||||||| 8409db1, 8–10 one/two/three, 11 =======, 12 ONE, 13 two, 14 shared-a, 15 three-theirs, 16 >>>>>>> theirs, 17 shared-b, 18 four … 21 seven, 22 eight-theirs, 23 nine, 24 ten. Parse: settled [0,2) and [17,25); Block{whole [2,17), ours [3,7), theirs [12,16)}. `ours_view` = title, =======, one, TWO, shared-a, three-ours, shared-b, four … seven, eight-theirs, nine, ten. It differs from local only at line 11 (eight-theirs/eight-ours), so the section [2,6) is exact → local {2,4}. `theirs_view` equals remote → remote {2,4}. Base: local [2,6) projects to base [2,5) (line 2 is equal, and the hunk TWO…shared-b ↔ two,three ends at base 5). Remote [2,6) projects to base [2,5) as well, so base {2,3} = one, two, three. Middle: title, =======, one, two, three, shared-b, four, five, six, seven, eight-theirs, nine, ten. One chunk: Conflict, middle {2,3}, local {2,4}, remote {2,4}. Apply ours replaces middle lines 2–4 with local lines 2–5: title, =======, one, TWO, shared-a, three-ours, shared-b, four, five, six, seven, eight-theirs, nine, ten. Resolving by hand gives the same text: disk lines 2–16 replaced by the ours section [3,7). merge-style disk: 0 title, 1 =======, 2 <<<<<<< HEAD, 3–6 one/TWO/shared-a/three-ours, 7 =======, 8–11 ONE/two/shared-a/three-theirs, 12 >>>>>>> theirs, 13 shared-b, … 18 eight-theirs, 19 nine, 20 ten. Line 1 is text because no block is open there, and line 7 is the separator. Block{whole [2,13), ours [3,7), theirs [8,12)}. The ours and theirs views are identical to the zdiff3 case, so the chunk, the middle text and the result after apply ours are byte-identical. With no base section in the markers, base still comes from stage 1. The reverse case: block 1 resolved by hand to ours and block 2 open gives middle = local lines 0–10, then eight, nine, ten; one chunk with middle {11,1}, local {11,1}, remote {11,1}; apply ours → local exactly.
(4) Files without markers. Any change stages them in `disk::settle`. A file that is gone, or a directory at its path, is staged as a deletion with `update-index --force-remove` (the existing `Repo::remove_from_index`, i.e. `git rm --cached` of an already absent file). Anything present is staged with `git add -- <path>` (`Repo::add`). Binary: disk = bytes. Symlink: disk = the `read_link` target; a retarget, a replacement by a regular file or a removal counts, and `git add` stages a link (120000) or a file. Submodule: disk = HEAD of the checked-out submodule (new `Repo::submodule_head`, which runs `rev-parse --verify --quiet HEAD` only when `<path>/.git` exists, otherwise not checked out); a new commit is staged with `git add` as a gitlink, and an absent directory with force-remove. Deleted-side text files (#47): disk = the kept file or `Missing`; any change stages, with no marker check (git writes none for modify/delete). Non-UTF-8 and over-8-MiB text files are staged only when no marker lines remain; otherwise they are left unstaged and keep their choice view. The executable bit alone is not a change.
(5) IPC: full types under data_structures. `FileMergeData.base` and `.word_changes` become `middle: Middle` and `chunks: Vec<MergeChunk>`, so the Rust side says where each chunk sits in the middle. `list_files` returns `FileList`; `finish_file`, `take_side` and `reset_file` return `WriteReply`. No `IpcError` variant is added. #25 holds: merge-core's `Chunk` is wrapped, not mirrored.
(6) Window. `store.refreshFiles` and the three write actions hand `disk_changes` (or `change`) to one `applyDiskChanges`. It adds a notice per path and drops `taken[path]`. If the file is shown, it re-runs `fetchView` → `putOpened`/`putChoice`. The new object makes the kept `MergeView` rebuild its controller (fresh `EditorState`, no undo history). `useMergeController` sets `saved` to the new `resultText()`, so `unsaved()` is false and the close guard forgets the dropped edits with no new code. On `ChangedOnDisk` there is no `markSaved` and no `moveOn`. A changed file that is not open only gets the notice and its new mark; the next open loads the disk view. Notices: `notices` shallowRef in `store.ts`, `NoticeBar.vue` (role=status, closable per path) above `ProblemBar` and the all-resolved bar in `App.vue`, words in `noticeText.ts`. `StageFailed` also raises a `Problem`. The editor starts the centre from `middle.text` and places spans by `chunk.middle`. For `DiskNotText` it shows an empty read-only middle, and `MergeView` adds a sentence.
(7) State ownership. `seen`, `view`, the marker size and every decision live in `MergeSession`. Vue holds only the notices (Rust's reports, display only) and the `taken` display map, which now also records 'staged from disk'.

### Files touched

- Rust: crates/merge-core/src/line_map.rs (new: pure 2-way line alignment over the existing imara-diff histogram, `exact`/`covering`), crates/merge-core/src/lib.rs
- Rust: crates/session/src/disk.rs (new: OnDisk read/compare, settle = stage or reopen)
- Rust: crates/session/src/markers.rs (new: byte-level marker parser with unit tests on the .omp/run/markers samples copied under crates/session/tests/markers/)
- Rust: crates/session/src/seed.rs (new: locate sections, project base, build middle text + MergeChunk)
- Rust: crates/session/src/session.rs (FileState.seen/view/marker_size, refresh, before-write look in finish/take/reset, load by view, FileMergeData/Middle/MergeChunk/MiddleLine/FileList/WriteReply/DiskChange)
- Rust: crates/session/src/lib.rs (exports)
- Rust: crates/session/tests/disk_is_truth.rs (new), crates/session/tests/{finish_and_reset,describe_and_take,deleted_side,git_view,open_and_load,all_or_nothing}.rs (new return types)
- Rust: crates/gitio/src/repo.rs (`conflict_marker_sizes(paths)` via check-attr -z --stdin, `submodule_head(path)`), crates/gitio/tests
- Rust: src-tauri/src/commands.rs (list_files → FileList, finish/take/reset → WriteReply; command tests)
- Rust: crates/cli/src/fixture.rs (merge_data now yields Middle::Stages + MergeChunk)
- Window: frontend/src/ipc/bindings.ts (GENERATED by `just bindings`), ipc/domain.ts (MiddleLine brand, Chunk.middle replaces .base, Middle, FileList, WriteReply), ipc/ChunkSource.ts, ipc/tauri.ts, ipc/fixture.ts (valibot schema; fixture list/writes return empty disk changes), ipc/index.ts
- Window: frontend/fixtures/golden/*.json and showcase/*.json (regenerated by `just fixtures`)
- Window: frontend/src/editor/index.ts (centre doc = middle text, readOnly for DiskNotText), editor/internal/chunkField.ts (spans from chunk.middle), editor/internal/tone.ts (inserted = middle.len 0), editor tests that build from data.base
- Window: frontend/src/ui/store.ts (applyDiskChanges, notices, dismissNotice, WriteReply handling, taken → Taken), ui/App.vue, ui/NoticeBar.vue (new), ui/noticeText.ts (new), ui/deletedSide.ts (middle 'disk'), ui/MergeView.vue, ui/useMergeController.ts, ui/ChoiceView.vue + ui/choiceText.ts (Result 'staged from disk')
- Docs (orchestrator/curator): docs/architecture.md §3.3/§4/§5.1, .omp/skills/project-map (new files for PM6), ipc-contract command list, risk-register new row, CHANGELOG.md

### Data structures

Rust, session (private):
```rust
struct FileState { path: PathBuf, stages: CapturedStages, status: FileStatus, content: Content,
                   marker_size: usize /* check-attr at open, 7 by default */, seen: OnDisk, view: View }
#[derive(PartialEq, Eq)]
enum OnDisk { Missing, File(Vec<u8>), Link(Vec<u8>) /* target */, Submodule(Option<Oid>) /* None: not checked out */, Other /* dir etc. */ }
enum View { Stages /* yamt's merge: at start, after Reset or Take */, Disk /* load() builds the middle from `seen` */ }
// markers.rs — disk line indexes
pub(crate) enum Piece { Settled(Range<u32>), Block(Block), Raw(Range<u32>) }
pub(crate) struct Block { whole: Range<u32>, ours: Range<u32>, theirs: Range<u32> } // base section parsed, not kept
```
Rust, merge-core (pure, new public):
```rust
pub struct LineMap { hunks: Vec<imara_diff::Hunk> }
pub fn line_map(from: &str, to: &str) -> LineMap;
impl LineMap {
    /// `to` lines equal to these `from` lines (empty range: point after the last matched line); None if any line changed.
    pub fn exact(&self, from: Range<u32>) -> Option<Range<u32>>;
    /// `to` lines covering these `from` lines, grown to whole changed hunks.
    pub fn covering(&self, from: Range<u32>) -> Range<u32>;
}
```
IPC, session (`Serialize + specta::Type`):
```rust
pub struct MiddleLine(pub u32); // 0-based line of the middle pane's starting text
pub struct MergeChunk { pub chunk: Chunk, pub middle: LineRange<MiddleLine>, pub words: WordChanges }
pub enum NotText { Deleted, Binary, NonUtf8, TooLarge, Link, Directory }
#[serde(tag = "kind")]
pub enum Middle { Stages { text: String }, Disk { text: String }, DiskNotText { found: NotText } }
pub struct FileMergeData { pub path: String, pub middle: Middle, pub local: String, pub remote: String,
                           pub deleted: Option<Side>, pub eol: Eol /* from the disk text for Disk */, pub chunks: Vec<MergeChunk> }
#[serde(tag = "kind")]
pub enum DiskResult { Staged, MarkersLeft, StageFailed { message: String } }
pub struct DiskChange { pub path: String, pub result: DiskResult }
pub struct FileList { pub files: Vec<FileEntry>, pub disk_changes: Vec<DiskChange> }
#[serde(tag = "kind")]
pub enum WriteReply { Written { files: Vec<FileEntry> }, ChangedOnDisk { files: Vec<FileEntry>, change: DiskChange } }
// MergeSession: refresh() -> Result<FileList>; finish/take/reset(..) -> Result<WriteReply>; load unchanged signature
```
Commands: `list_files() -> Result<FileList, IpcError>`, `load_file(path) -> Result<FileMergeData, IpcError>`, `finish_file(path, text)`, `take_side(path, side)` and `reset_file(path)`, each `-> Result<WriteReply, IpcError>`. `describe_file`, `remote_name`, `log` and `IpcError` are unchanged.
Generated TS:
```ts
export type MiddleLine = number;
export type MergeChunk = { chunk: Chunk; middle: LineRange<MiddleLine>; words: WordChanges };
export type NotText = "Deleted" | "Binary" | "NonUtf8" | "TooLarge" | "Link" | "Directory";
export type Middle = { kind: "Stages"; text: string } | { kind: "Disk"; text: string } | { kind: "DiskNotText"; found: NotText };
export type FileMergeData = { path: string; middle: Middle; local: string; remote: string; deleted: Side | null; eol: Eol; chunks: MergeChunk[] };
export type DiskResult = { kind: "Staged" } | { kind: "MarkersLeft" } | { kind: "StageFailed"; message: string };
export type DiskChange = { path: string; result: DiskResult };
export type FileList = { files: FileEntry[]; disk_changes: DiskChange[] };
export type WriteReply = { kind: "Written"; files: FileEntry[] } | { kind: "ChangedOnDisk"; files: FileEntry[]; change: DiskChange };
```
Domain (`ipc/domain.ts`, brands by type guard):
```ts
type MiddleLine = number & { readonly __brand: "MiddleLine" };
export type Chunk = { id: ChunkId; kind: ChunkKind; middle: LineRange<MiddleLine>; local: LineRange<LocalLine>; remote: LineRange<RemoteLine>; words: ChunkWords }; // stage-1 range dropped: no pane shows base
export type Middle = Generated.Middle;
export type FileMergeData = { path; middle: Middle; local; remote; deleted: Side | null; eol; chunks: readonly Chunk[] };
export type FileList = { files: readonly FileEntry[]; diskChanges: readonly DiskChange[] };
export type WriteReply = Generated.WriteReply; export type DiskChange = Generated.DiskChange;
// ChunkSource: listFiles(): SourceResult<FileList>; finishFile/resetFile/takeSide(): SourceResult<WriteReply>
```
UI (`store.ts`): `notices: ShallowRef<readonly DiskChange[]>` (one per path, closable); `taken: ShallowRef<ReadonlyMap<string, Taken>>` with `Taken = { by: "side"; side: Side } | { by: "disk" }`.

### Risks

- Two `line_map` runs per side per load, plus two for base. That is proportional to file size and happens only for files reopened from disk. No measurement yet.
- Memory holds every conflicted file whole, including large binaries. A merge with hundreds of MB of binary conflicts keeps them in RAM for the app's lifetime.
- A block coarser than yamt's own chunks shows as one conflict, with no one-sided sub-changes and no bulk apply inside it.
- Base lines are a projection, so with repeated text the middle of an open block can show a different base span than git's base section. Applied results stay exact; only the unresolved middle, '× both sides' and the word marks can differ.
- Time-of-check gap: a process that writes between the look and yamt's write is still overwritten. yamt never overwrites a change it has seen.
- × on both sides of a raw region writes marker lines back on Mark resolved (as today, yamt does not check the result text).
- Read-back after writes must use the disk, not the written bytes (autocrlf, smudge filters, `checkout -m` style). A test pins it.
- `.gitattributes` changes during the merge are not followed (marker size read once).
- FileMergeData shape change regenerates bindings and every fixture, and touches the editor tests that build from `data.base`.
- A Take on a file reopened from disk (deleted-side view) must set the view back to `Stages` and refetch it, or the deleted-side middle applies kept changes onto disk text.
- Proposed decision rows for the orchestrator (DR5): (a) an open block on disk becomes one conflict, with base taken from stage 1 by projection and broken or edited blocks shown raw (visions 1, 2, 4). (b) `FileMergeData.middle`/`MergeChunk` replace `base`/`word_changes` (2, 4). (c) Worktree content is remembered as bytes (5).

### Tests

- Rust, session/tests/disk_is_truth.rs (conflict_repo; per test `git config merge.conflictStyle zdiff3|merge` + `git checkout -m` to write markers in the owner's style):
- Regenerated file without markers → `refresh` reports `Staged`. `ls-files -u` lacks it, the stage-0 blob equals the disk bytes, `remaining()` drops, and a second `refresh` reports nothing.
- One of two blocks removed on disk (zdiff3 and merge) → `MarkersLeft` and the file stays Unresolved. `load` gives `Middle::Disk` with exactly the worked-example text and a single chunk (middle {2,3}, local {2,4}, remote {2,4}). Splicing local lines into the middle by the chunk's ranges equals the by-hand file. The mirror case (block 2 open) gives middle {11,1}.
- File deleted on disk → `Staged`, `ls-files -s <path>` empty, Resolved, `load` = `DiskNotText{Deleted}`.
- Mark resolved after an unseen change → `ChangedOnDisk`, the worktree still holds the user's bytes, and they are what got staged. The same for `take` (no checkout-index) and `reset` (no `checkout -m`: the file keeps no markers).
- After `finish`, `take` and `reset`, `seen` equals the bytes read back. `refresh` reports nothing; with `core.autocrlf=true` this catches comparing against the written text.
- A file already resolved and changed again → staged again with the new bytes.
- Binary file changed → `git add`. Symlink retargeted → stage 0 mode 120000 with the new target. Submodule HEAD moved → gitlink at the new commit. An uninitialised submodule directory is never compared with the superproject's HEAD.
- Held `index.lock` during refresh → `StageFailed`, disk untouched, the other files are still reported.
- Unchanged disk → no change and no git write (index mtime unchanged).
- markers.rs unit tests: style-merge, style-diff3 and style-zdiff3 parse into the same two blocks; marker-size-12 with N=12 (and the same file with N=7 is all text); CRLF sample; settled `=======` on line 2 is text; deleted separator → Raw covering `<<<`..`>>>`; nested `<<<<<<<`; stray `>>>>>>> x`; end of file inside a block; last line without newline; labels absent or present; N+2 inner markers stay text.
- seed.rs unit tests: an edit inside the ours section → that block is middle-raw with `covering` ranges; an empty ours section → insertion point; a repeated section line still gives exact text; a CRLF disk text keeps `\r\n` in the middle and in `eol`.
- gitio tests: `conflict_marker_sizes` with a `.gitattributes` size of 12, an unset value and a missing value; `submodule_head` checked out, not checked out, and absent.
- src-tauri commands tests: `list_files` JSON is `{files, disk_changes}`; `finish_file` after an outside write returns `{kind:'ChangedOnDisk', …}`.
- Window, `store.test.ts`: a disk change for an opened file replaces its record with a new object, adds one notice and drops `taken`. An unopened file gets the notice only. `ChangedOnDisk` on finish does not `markSaved` or move on and reloads the view. `dismissNotice` removes one. `StageFailed` also sets a problem.
- Window, `useMergeController.test.ts`: after a data swap, `unsaved()` is false even when the old controller had edits, and the controller was rebuilt.
- Window, `chunkField.test.ts`/`apply.test.ts`: spans come from `chunk.middle` where it differs from base. The worked example as an editor test: apply ours on the disk-seeded chunk → `resultText()` equals the by-hand text, and undo brings back the base lines. CRLF keeps `\r\n`.
- Window, `tone.test.ts` (inserted = middle.len 0), `deletedSide.test.ts` (middle 'disk'), `noticeText.test.ts`, `domain`/`fixture` tests for the new shape and the MiddleLine guard.
- Desktop smoke (verifier): with yamt unfocused, resolve one block in an editor, regenerate a second file and delete a third. On focus there are three notices, the marks are right and the middle shows the disk text with one conflict.

Visions: [1, 2, 4, 5]


---

## A + start: at open, compare each file with what git wrote; a file that differs counts as changed on disk

### Summary

Additions to Option A only. Everything settled in your message stands.

(1) What git wrote, for a two-sided text file (two-sided non-UTF-8 and over-8-MiB text too):
- **Regeneration.** Re-run git's merge from the stage bytes that `open()` already reads: `git merge-file -p -q --marker-size=N -L ours -L base -L theirs <local> <base> <remote>`. Add `--diff-algorithm=histogram` only when `git version` reports 2.44 or later; merge-ort merges with histogram (merge-ort.c `opt->xdl_opts = DIFF_WITH_ALG(opt, HISTOGRAM_DIFF)`), merge-file defaults to myers, and per the manual's change history `--object-id` came in 2.43 and `--diff-algorithm` in 2.44 [INFERENCE from that history].
- **Plain form cost.** It needs three temp files per conflict: the base, local and remote bytes, already in memory, written into one directory under `std::env::temp_dir()` that `open()` creates and removes. That is three small writes plus one process per file. The process is the real cost; the files are negligible. One code path for every git version, so `--object-id` is not used.
- **Exit codes.** merge-file returns the number of conflicts (0..127) on success, so gitio's `merge_file` must not treat a non-zero exit as failure; 128 and above is an error.
- **Marker size.** N comes from the `check-attr` call Option A already makes, the same attribute git's ll_merge reads.
- **Style.** Not needed. `merge.conflictStyle` is never read.

How "differs" is decided: one improvement on parsing both texts and comparing pieces. `markers.rs` gets `views(bytes, N)`, which returns two texts:
- the ours view: settled lines, plus each block's ours section, plus raw regions as they are;
- the theirs view: the same with each theirs section.
Both drop marker lines, labels and base sections, and strip `\r` before `\n`. A file is untouched when its views equal the regenerated file's views; otherwise it differs. Why views beat a piece-by-piece compare:
- They are the same for all three styles. diff3 is clamped to EAGER and keeps shared-b inside the block; merge and zdiff3 run ZEALOUS and move it out. merge-file also runs ZEALOUS_ALNUM where ll_merge runs ZEALOUS. Joining nearby conflicts, or moving lines both sides share in or out of a block, changes neither view. So a different style, or a file re-written with `checkout --conflict=diff3`, does not count.
- Every resolution changes at least one view, because ours and theirs sections differ. Taking ours changes the theirs view.
- An edit to settled text changes both views.
- A broken marker changes the views.
- Legit marker-looking lines (the settled `=======`, or a doc about git) appear identically in both texts and so compare equal.
- Only an edit confined to a base section or a label goes unnoticed. Such text is dropped by every resolution anyway.
- Line endings: covers `core.autocrlf`, `eol=crlf` and `text=auto`.

False positives. The user then sees the file from disk: git's blocks as conflicts, git's auto-merged parts counted as done, and a notice "<path> changed on disk; N conflicts left". Reset gives yamt's own view back.
- `-X` options (`ignore-space-change`, `patience`, `diff-algorithm=`) and git older than 2.44 (myers against ort's histogram): blocks may align differently.
- `merge.renormalize` / `-Xrenormalize`: ort normalizes the three inputs before merging; anything beyond end-of-line conversion can then differ.
- Smudge filters other than end-of-line conversion (`ident`, custom filters).
- rename/rename(2to1) and rename/add: nested content merges with `extra_marker_size`.
- `merge.default` set to a custom driver.
- A file rewritten outside with `git checkout -m` [INFERENCE: different alignment].
- Plain renames are not false positives: the stages hold exactly the blobs ort merged, and only the `HEAD:old` labels differ, which views ignore.
- The only false positives that would stage at start: a smudge-filtered file whose git output had no markers (a mode-only conflict) differing through the filter.

Two attributes change the rule (read in the same `check-attr` call):
- `merge`: unset or `binary` means git kept ours (see 2). Any other value than `text`, `union` or unspecified is a custom driver (mergiraf). yamt cannot know what the driver wrote, so it does not regenerate and the disk counts as changed: remaining driver conflicts open from disk; a driver output without markers is staged at the first `list_files`. `union` regenerates with `--union`.
- `working-tree-encoding`: yamt cannot parse markers in UTF-16. Such a file is never a start change and is never auto-staged, now or later. Without this rule its markers would look absent and the file would be staged.
- If the check fails for a file (merge-file error), yamt logs a warning and treats the file as untouched, today's behaviour. It never stages on doubt.

(2) What git wrote, for files without markers. The worktree is always one stage, compared in git's clean form:
- Two-sided binary, and two-sided text with `-merge`/`merge=binary`: stage 2. merge-ll.c `ll_binary_merge`: "For the final merge, it is 'ours' by default"; `ll_xdl_merge` falls back to it when any side `buffer_is_binary`, the same 8000-byte NUL test yamt uses.
- Two-sided symlink: stage 2's target (merge-ort.c `handle_content_merge`, `S_ISLNK`: `MERGE_VARIANT_NORMAL` copies `a->oid`, ours).
- Deleted-side file or link (#47): the kept stage. merge-ort.c: "CONFLICT (modify/delete) … Version %s of %s left in tree", with `merged.result` = the modified side's stage. If both sides are gone, the file is expected to be missing.
- Submodule: none. ort decides only the gitlink, and a merge without submodule recursion leaves the submodule's checkout alone [INFERENCE]. So a submodule is never a start change; only later changes count, as in A.

How it compares:
- Regular files: one `git hash-object --stdin-paths` for all of them. Without `--no-filters` each path gets its own clean filter, so CRLF, `eol` and LFS clean back to the stored blob. Its oid is compared with the expected stage's oid. This is the case you named: an untouched modify/delete under autocrlf hashes to the kept stage and is not staged.
- Symlinks: no process. `read_link` bytes are compared with the stage blob, read through the `cat-file --batch` that `open()` already runs. hash-object would follow the link.
- A missing file whose stage exists, or a file where git expected none, differs.
- Paths containing a newline cannot go through `--stdin-paths`; they are compared raw.

(3) Cost at start, for T two-sided text conflicts:
- One `git version`.
- One `check-attr -z --stdin conflict-marker-size merge working-tree-encoding`.
- At most one `hash-object --stdin-paths`.
- T runs of `merge-file`, each with three temp-file writes.
- On top of today's `rev-parse`, `ls-files -u` and `cat-file --batch`: about 4 + T processes, all in `open()`, run one after another. For T = 300, roughly 1 s on Linux, more on macOS [INFERENCE, not measured: process start plus merge time].
- The staging this causes happens in the first `refresh()`. Batch it into one `git add -- <paths>` and one `update-index --force-remove -- <paths>`, so hundreds of files fixed before start cost 2 processes, not hundreds. Batching applies to runtime changes too.

(4) Where it sits. `open()` does not stage or reseed anything. For a file that differs, it records `seen = OnDisk::GitOutput`, a value no disk read ever equals. The first `refresh()`, i.e. the window's first `list_files`, therefore finds it changed and runs Option A's own `disk::settle` and reporting:
- fully fixed: staged and marked resolved, with a notice;
- partly fixed: `MarkersLeft`, Disk view with only the remaining blocks.
There is one code path for start and runtime, and nothing is written before a window exists. One consequence: if every file was fixed before start, the window still opens; the first list stages them and shows the notices and the all-resolved bar. An untouched file keeps `seen` = its bytes and opens as yamt's merge from base (#9).

IPC change from A: `MarkersLeft` gains `conflicts: u32`, the number of blocks plus raw regions still open, so the window can say what happened for a file it has not loaded. Nothing else crosses the boundary.

Window wording (window's job): "<path> changed on disk; your edits in yamt were dropped" only when the file had unsaved edits, read from the close guard before its view is rebuilt. Otherwise "<path> changed on disk". Either sentence is followed by what happened: "staged as resolved", "N conflicts left", or "staging failed: …". Start-time changes never claim dropped edits, because no view exists yet.

### Files touched

- Rust: crates/session/src/start.rs (new): `expected(file, attrs) -> GitWrote`; per kind the regeneration or stage compare; `untouched(...) -> bool`; used only by `open()`
- Rust: crates/session/src/markers.rs: `views(bytes, marker_size) -> Views` (CR-insensitive, raw lines kept), with unit tests
- Rust: crates/session/src/session.rs: `open()` builds attributes and version once, sets `seen` to bytes or `OnDisk::GitOutput`; `refresh()` batches staging
- Rust: crates/session/src/disk.rs: `OnDisk::GitOutput`; `DiskResult::MarkersLeft { conflicts }`; `working-tree-encoding` files never auto-staged
- Rust: crates/gitio/src/repo.rs: `version()`; `attributes(paths)` for three attributes in one check-attr; `hash_objects(paths) -> Vec<Oid>` (hash-object --stdin-paths); `merge_file(inputs, marker_size, histogram) -> Vec<u8>` (temp dir, exit 0..127 = success); `add_paths`/`remove_paths` batch forms. gitio/src/run.rs: an exit-status-tolerant variant for merge-file. crates/gitio/tests
- Rust: crates/conflict-repo/src/lib.rs (dev-only): a way to set repo config (`merge.conflictStyle`, `core.autocrlf`) and `.gitattributes` before the merge runs, so tests get git's own output in each style
- Rust: crates/session/tests/start_from_disk.rs (new)
- Window: frontend/src/ipc/bindings.ts (generated: `MarkersLeft { conflicts }`), ipc/fixture.ts schema
- Window: frontend/src/ui/store.ts (notice records `{ path, result, editsDropped }`), ui/closeGuard.ts (`hasUnsaved(path)`, read before the rebuild), ui/noticeText.ts (wording rules) + tests
- Docs (orchestrator/curator): architecture §3.3 (start detection), risk register rows (wrong 'differs' at start; UTF-16 files), proposed plan §2 row

### Data structures

Rust, session (additions to Option A):
```rust
enum OnDisk { Missing, File(Vec<u8>), Link(Vec<u8>), Submodule(Option<Oid>), Other,
              /// git's own output, which the disk no longer matches (changed before start); no read ever equals it
              GitOutput }
struct Attributes { marker_size: usize, driver: MergeDriver, encoded: bool /* working-tree-encoding set */ }
enum MergeDriver { Text, Union, Binary /* `-merge` or `merge=binary` */, Custom /* any other value */ }
// start.rs — computed in open(), not stored
enum GitWrote {
    Merged { union: bool },     // two-sided text: compare views with `git merge-file` output
    Stage(StageEntry),          // binary, `-merge` text, symlink (stage 2); deleted-side (kept stage)
    Nothing,                    // both sides deleted: file expected missing
    Unknown,                    // custom merge driver: the disk wins
    NotWritten,                 // submodule, working-tree-encoding: never a start change
}
// markers.rs
pub(crate) struct Views { pub(crate) ours: Vec<u8>, pub(crate) theirs: Vec<u8> } // settled + raw + one side's sections; `\r\n` → `\n`
pub(crate) fn views(text: &[u8], marker_size: usize) -> Views;
```
Rust, gitio (bytes in, bytes out):
```rust
pub struct GitVersion { pub major: u32, pub minor: u32 }
pub fn version(&self) -> Result<GitVersion>;
pub fn attributes(&self, paths: &[PathBuf]) -> Result<Vec<AttributeValues>>; // conflict-marker-size, merge, working-tree-encoding (raw values)
pub fn hash_objects(&self, paths: &[PathBuf]) -> Result<Vec<Oid>>;          // hash-object --stdin-paths, filters per path
pub fn merge_file(&self, inputs: MergeInputs<'_>, marker_size: usize, histogram: bool) -> Result<Vec<u8>>;
pub struct MergeInputs<'a> { pub base: &'a [u8], pub local: &'a [u8], pub remote: &'a [u8] }
pub fn add_paths(&self, paths: &[PathBuf]) -> Result<()>;      // one `git add --`
pub fn remove_paths(&self, paths: &[PathBuf]) -> Result<()>;   // one `update-index --force-remove --`
```
IPC: Option A's types unchanged except
```rust
#[serde(tag = "kind")]
pub enum DiskResult { Staged, MarkersLeft { conflicts: u32 }, StageFailed { message: String } }
```
```ts
export type DiskResult = { kind: "Staged" } | { kind: "MarkersLeft"; conflicts: number } | { kind: "StageFailed"; message: string };
```
Window store: `notices: ShallowRef<readonly Notice[]>`, `Notice = { readonly path: string; readonly result: DiskResult; readonly editsDropped: boolean }`; `closeGuard.hasUnsaved(path): boolean`.

### Risks

- Start time grows by one merge-file process per two-sided text conflict. Not measured; measure on the owner's largest merge before release.
- False 'differs' from `-X` options, git older than 2.44, `merge.renormalize`, smudge filters, nested rename merges or `merge.default`: the file opens from disk with git's blocks and a notice, though the user did nothing. Reset recovers yamt's view.
- A custom merge driver whose output has no markers but reported a conflict is staged at the first list.
- Edits confined to a base section or a marker label before start are not seen; Mark resolved overwrites them. They carry no content.
- Paths containing a newline cannot use `hash-object --stdin-paths`; they are compared raw, so a CRLF worktree there reads as changed.
- Temp files under the system temp directory. A crash between write and removal leaves three small files.
- `working-tree-encoding` files are excluded from auto-staging everywhere: without this, their UTF-16 markers would be invisible to the byte parser and the file staged with markers. This is a change to Option A too.
- Proposed plan §2 row (DR5): "a file that differs from git's own merge output at start counts as changed on disk". Untouched means: two-sided text has equal ours/theirs views with `git merge-file` of the stages; other kinds hash (clean) to the stage git leaves (2, or the kept side). Submodules, custom drivers and working-tree-encoding as described. Visions 2, 5.

### Tests

- start_from_disk.rs (conflict_repo with config and attributes set before the merge):
- Untouched file merged under each of zdiff3, merge and diff3: first `refresh` reports nothing; `load` is `Middle::Stages` with base text.
- The zdiff3 file rewritten with `git checkout --conflict=diff3`: still untouched (views are the same in every style).
- `core.autocrlf=true` worktree (CRLF markers over LF blobs): untouched, `Stages`.
- pnpm-style regenerated file (no markers) written before open: first refresh reports `Staged`; `ls-files -u` lacks it; the stage-0 blob is the clean form of the disk bytes.
- One block resolved by hand before open: first refresh reports `MarkersLeft { conflicts: 1 }`; `load` gives Option A's worked-example middle.
- Settled text edited before open, blocks untouched: `MarkersLeft { conflicts: 2 }`, Disk view.
- Only the base section edited before open: untouched.
- Marker size 12 via `.gitattributes`, untouched: untouched (catches regenerating with 7).
- modify/delete untouched under autocrlf: not staged, `ls-files -u` unchanged. The same file removed before open: staged as deleted.
- Binary untouched (worktree = stage 2): not staged. Binary replaced by theirs before open: staged.
- `-merge` text file untouched (ours, no markers): not staged. Catches the 'no markers means fixed' shortcut.
- Two-sided symlink untouched (target = ours): not staged. Retargeted before open: staged with the new target.
- Rename conflict (labels `HEAD:old`): untouched.
- `merge=custom` attribute with markers: Disk view at the first list.
- `working-tree-encoding=UTF-16` conflict: never staged, even after an outside change.
- A merge-file failure for one file (unreadable temp dir): warning logged, file untouched, no staging.
- Unit tests: `views()` gives identical results on the style-merge, style-diff3 and style-zdiff3 samples, and on the CRLF sample with its line endings removed. Raw lines are kept. Labels and base sections are ignored. The version parse handles `git version 2.39.5 (Apple Git-154)` (no histogram flag) and `2.56.0` (flag).
- gitio tests: `merge_file` returns the output with exit 1 and 2 (conflicts) and fails on exit 255; `hash_objects` applies autocrlf clean; `attributes` reads all three in one call.
- Window `store.test.ts`: changes reported by the first `loadFiles` give notices with `editsDropped: false`. A change to an opened file with edits gives `editsDropped: true` (read before the rebuild).
- Window `noticeText.test.ts`: every combination of edits dropped or not with Staged, MarkersLeft (singular and plural) and StageFailed.

Visions: [2, 4, 5]
