# 3.Z design: Ctrl/Cmd+S saves the Result, the unsaved dot, Reset to this run's start

## Summary

I recommend **Option 1**:
- **Rust** works out, when it loads a file, what each change looks like on disk while it waits. It sends that to the window as one new field per chunk.
- **The window** builds the file to write from that field, its own statuses and the Result text.
- **The new `save_file` command** is `finish_file` without the `git add`.
- **Reset** writes back the bytes this run found on disk at open.
- **The saved point** is a snapshot of the editor's own state (text and statuses), kept by `MergeController`.

I edited nothing. Every file and line reference below was read in this session. Statements I did not check against the code are marked [INFERENCE].

## Facts that shape the design

These are checked in the code.

- **A save is not a settle, so the disk version stays the same.** `DiskVersion` goes up only in `settled_as` (`session.rs`), and `finish` does not bump it. A save only replaces `seen` with the bytes it wrote. The window keeps its `disk_version`, its undo history and its statuses, and nothing is rebuilt. This answers brief item 2 without any new type.
- **yamt does not read `merge.conflictStyle`.** Plan #53 rejected it, and `merge_config.rs` reads only `merge.default` and `merge.*.driver`. The only marker attribute read is `conflict-marker-size` (`start.rs` `Attributes`). `merge_file` writes the labels `-L ours -L base -L theirs`.
  - What git actually wrote is on disk at open. For an untouched file, `open.rs` reads it as `Seen::ViewFromStages(disk)`. So labels and style can be copied from git's own first conflict block, with no new git read.
- **The disk view has only `Conflict` chunks** (`seed.rs` `push_conflict`). An exactly located block shows its base lines. An inexact block or raw region shows the disk lines as they are. `Block { whole, ours, theirs }` holds the original marker lines, so they can be copied exactly.
- **`reset` today** runs `restore_stages`, then `checkout_merge` when `can_rebuild_markers`, then `read_back` (`writes.rs:88-101`). It has no rollback.
- **`Text.eq`** checks length and line count first, then skips identical parts of the text tree (`@codemirror/state` `index.js:53-58`). After a keystroke it usually answers false at once.
- **The editor already throws away typing inside a waiting change when a side is applied.** Apply replaces the span's current range ("replace" mode), unless the other side was already applied ("append" mode) (`apply.ts` `applyChange`, `status.ts` `applyMode`). Save relies on the same rule.

## Rules for what Save writes (brief item 1)

The rules are the same in all three options. Only where they run differs.

| state of a change (`chunkField`) | what Save writes |
|---|---|
| every side decided (applied or ignored) | the Result's lines, as shown |
| one-sided (`LocalOnly`, `RemoteOnly`, `BothSame`) and still waiting | the changed side's lines, i.e. applied, as git wrote it. Text typed there is not written |
| conflict, both sides waiting | git's markers: open line, local lines, the "between" lines (base section if the file had one, then the separator), remote lines, close line. Text typed there is not written |
| conflict, one side decided, the other waiting | git's markers. The decided side's section holds the Result's lines; the waiting side's section holds its own lines. No side and no decided work is lost |
| a region yamt could not place (raw region or inexact block) | the Result's lines as shown. They start as the disk's own lines, markers included |
| the file is already resolved in git's view | the Result as shown, the same as "Mark resolved" wrote it; not staged |

**Line endings.** The window joins every line, marker lines included, with the Result's own line separator (`state.lineBreak`, CM5). A CRLF file stays CRLF everywhere.
- [INFERENCE] A `Mixed` file has no separator set (`paneDocs.ts:6-7`), so CodeMirror joins with `\n`. Save writes it all-LF, exactly as `finish` does today. `architecture.md` §3.3 says "Mixed is passed through untouched", which looks out of date.

**Encodings.** Text crosses as UTF-8 (IPC6), and Save writes UTF-8 as `finish` does. See risks for `working-tree-encoding` files.

**Marker size, labels and style.**
- **Disk-view conflicts:** the block's own lines, exactly as they are.
- **Stages-view conflicts:** `MarkerStyle` copies the open, base-marker, separator and close lines from the first block git wrote into this file at open (marker size, labels, diff3/zdiff3 base section). For files git wrote without markers (union driver), and for CLI fixtures, the fallback is `ours`/`theirs`, merge style, the file's marker size.
  - In diff3 style the base section holds the chunk's base lines. A zdiff3 file gets full diff3 base sections. That is harmless: `markers::views` ignores base sections.

**When Save writes.**
- Save writes nothing when the dot is off.
- Rust also skips the write when the bytes equal what it last saw on disk, so the file's modification time does not change for nothing.

### Round trip: save, then open the file in a new session

**Untouched case.** Nothing was decided, so nothing is written. The next run finds the file equal to git's output and opens it from the stages, exactly as before.

**Otherwise** the next run starts with `GitOutput`, and the first look sets the disk view.
- **Conflicts that waited on both sides** come back as waiting conflicts. Their marker sections are the stage lines exactly, so they are located exactly. [INFERENCE: `locate.rs` "exact when every line of both sections was found unchanged"; test S1 below proves it.]
- **These cases cannot round-trip, and this is what the user sees:**
  1. **One-sided changes still waiting** come back settled (applied, as git wrote them), not waiting. The disk view has no one-sided chunks (plan #53).
  2. **Half-decided conflicts:**
     - If the decided section equals that side's lines (applied, not edited), the conflict comes back fully waiting. The decision is gone, but nothing is lost.
     - If the user ignored a side or typed in it, the block is inexact. It comes back as one conflict showing the raw marker block in the Result.
  3. **Text typed inside a change whose sides all wait** is not in the file (open question 1).
  4. **A saved file with no markers left** (every conflict decided) is staged as resolved at the next start, under #52's rule, with any waiting one-sided changes applied (open question 2).
  5. **Every saved file** shows the start notice "… differs on disk from git's merge — N conflicts left" in each later run (open question 2).

## Option 1 (recommended): Rust serves "what waiting looks like" per change, the window builds the file

Visions 1, 2 and 5.

### Data structures first

```rust
// crates/session/src/waiting.rs (new), exported through lib.rs
/// What Save writes for this change while a side of it still waits (plan §2 #65).
#[serde(tag = "kind")]
pub enum Waiting {
    /// One side changed these lines, or both the same way: written applied, as git wrote it.
    SideLines,
    /// A conflict: `open`, the local section, `between` (base section if any, then the separator),
    /// the remote section, `close`. Lines without line breaks.
    Markers { open: String, between: Vec<String>, close: String },
    /// A region yamt could not place: written as the Result shows it.
    AsShown,
}
pub struct MarkerStyle { open: String, base: Option<String>, separator: String, close: String }
//   MarkerStyle::found_in(disk: &[u8], marker_size) — first Block of the file as found at open, else fallback
//   MarkerStyle::fallback(marker_size)              — ours/theirs, merge style (the labels start.rs's merge_file uses)

// merge_data.rs
pub struct MergeChunk { pub chunk: Chunk, pub middle: LineRange<MiddleLine>, pub words: WordChanges, pub waiting: Waiting }

// disk.rs
/// The file as this run of yamt found it at open: what Reset puts back (plan §2 #66).
pub(crate) enum AtOpen { Untouched(OnDisk), Changed(OnDisk), Unread }
// session.rs: FileState gains `at_open: AtOpen` (set once in open.rs, never written again)
```

```ts
// editor/internal/fileText.ts (new, pure): the file Save writes
fileText(state: EditorState, field, sides: SideDocs): string
//   one ChangeSpec per span that still waits (wholeLines over sideLines / the span's own lines / the marker lines),
//   ChangeSet.of(specs, doc.length, state.lineBreak).apply(doc).sliceString(0, undefined, state.lineBreak)
//   No state transaction, so no chunkField mapping and no CM8.

// editor/internal/savedPoint.ts (new, pure): the saved point
type SavedPoint = { readonly doc: Text; readonly statuses: readonly ChunkStatus[] };
savedPoint(state, field): SavedPoint
isUnsaved(point, state, field): boolean  // !doc.eq(point.doc) || some status differs; statuses compared only when the texts are equal

// editor/index.ts (MergeController)
snapshot(): ResultSnapshot   // { asShown(): string; fileText(): string; unsaved: boolean; markSaved(): void }
onUnsavedChange(listener: (unsaved: boolean) => void): void   // called when the value flips; checked only on docChanged or a field change
```

Notes on the TS side:
- `snapshot()` captures the immutable `EditorState`. `markSaved()` sets `#saved = savedPoint(capturedState)`. If the user typed during the write, the dot stays.
- `Waiting` comes from `span.chunk.waiting`: `ipc/domain.ts` `toChunk` copies it. No extra map is needed.

### Rust behaviour

**`save(path, text, disk_version) -> Result<WriteReply>`**:
1. `require_text`.
2. `changed_on_disk`, as `finish` does. A disk change stops the save.
3. `file_bytes_before_write` refuses a link or a folder (`NotAFile`).
4. Skip the write if the bytes equal what yamt last saw.
5. Otherwise `fs::write`; if the write fails, put the bytes from before back (best effort, logged, the same pattern as `finish`).
6. `seen = seen.after_own_write(written)`: `ViewFromDisk` stays `ViewFromDisk`; `ViewFromStages` or `GitOutput` becomes `ViewFromStages`. `finish` shares this step.
7. `settled` and the disk version stay unchanged. Reply `Written { files }`. No `DiskChange` is ever produced for this write.

**`finish`** becomes the shared write plus `git add` plus its rollback. Its behaviour does not change.

**`reset` (brief item 3)**, in this order:
1. Look at the disk first.
2. Record the index as it was (`IndexBefore`, the pattern `take` uses).
3. Run `restore_stages`.
4. Put the file back according to `at_open`:

| `at_open` holds | Reset does |
|---|---|
| a regular file's bytes | writes them, after removing a link that now sits at the path; a folder there means `NotAFile`, checked before step 3 |
| `Missing` | removes the file |
| a link, submodule, other entry, or `Unread` | today's `checkout -m` when `can_rebuild_markers`, then `read_back` |

5. If writing the file fails, restore the index as it was and write back the bytes from before. The error is returned, so the index and the file change together or not at all.
6. `seen` becomes `ViewFromStages(bytes)` for `Untouched`, `ViewFromDisk(bytes)` for `Changed`.
7. Status becomes `Unresolved`.

Within one run with no earlier saves, the at-open bytes are git's output, so Reset matches today's result. One difference: a file changed by hand before start now resets to that hand-edited content, as #66 says.

### Window behaviour

**The dot (item 4).** One owner: `MergeController.#saved`.
- "Unsaved" means the Result's text or any change's status differs from the last save or the opening.
- Statuses count because ignoring a one-sided change changes the file Save writes without changing the text.
- Undoing back clears the dot, because undo restores text and spans together (CM2).
- Cost per keystroke is O(1) when the length changed, and O(changes) only when the texts are equal.
- Vue learns of it through `onUnsavedChange`. `useMergeController` holds `unsaved: ShallowRef<boolean>`; no text and no point is kept in Vue state.
- The dot clears after a save because the saved point is the snapshot that was sent.

**Save flow, in `store.save({ path, diskVersion, snapshot })`:**
1. Do nothing if another write to `path` is in flight. `state.writing: Set<string>` is not reactive; `finish` and `reset` register in it too, so Save cannot slip between Reset's reply and its reload. A second Ctrl+S while a save runs is ignored, and the dot stays lit if more work came in.
2. **[3.Y seam]** `await format()` goes here; the orchestrator fixes its signature. This slice adds no call and no stub.
3. `snap = snapshot()`; return if null or `!snap.unsaved`.
4. `text = files[path].status === "Resolved" ? snap.asShown() : snap.fileText()`.
5. Call `source.saveFile`.
   - `Written`: set `files`, call `snap.markSaved()`, `clearProblemAbout`.
   - `ChangedOnDisk`: `changedOnDisk(...)`, exactly as `finish` handles it.
   - Error: `report({ action: "save", … })`.
6. Remove `path` from `writing` (in `finally`).

**`finish`** takes the snapshot too: it writes `asShown()` and calls `markSaved()` after `Written`. `closeGuard.markSaved` is removed, and `FileWork` becomes `{ unsaved(): boolean }`.

**The key.**
- `ipc/keys.ts` gets the action `"save"`, default `Mod-s`. `ui/keyText.ts` gets the name "Save", the place "anywhere in the shown file" and the group "Anywhere in the file".
- `MergeView.vue` adds a window `keydown` handler next to `historyKeyInShownFile`. It acts when `props.shown`, no question is open, `editable`, the event is not `defaultPrevented`, and `pressesKey(event, bindings.save, platform)`; it calls `preventDefault()` and saves. It also works in the find bar.
- Choice views have no handler. Deleted-side views are not editable.
- **A file that is not shown is never saved:** the key acts only on the shown file, and nothing else triggers a save.

**The dot itself** goes at the right end of the Result header: an `ml-auto` circle after the "Reset" button, with `title`/`aria-label` "Not saved".

**Close question (item 5)** in `question.ts`, keeping two buttons:
- Title "Unsaved Changes", message "These files have changes that are not saved to disk. Exit without saving them?", the files listed, buttons "Exit Without Saving" / "Cancel".
- I would not add a third "Save and exit" button: it would mean several writes, each with its own disk check and failure, during window close. Cancel plus Ctrl+S covers it.
- WebStorm's merge window has no Save, so DR6 has no source here; the words follow the usual editor "unsaved changes" convention.

**Fixture mode.** `saveFile` logs `fixture.save` and replies `Written` without marking the file finished.

### Cost

- The order of a marker block (open, local section, between, remote section, close) is written in TS, while Rust parses it. It is git's fixed grammar, and Rust supplies every marker line.
- `FileMergeData` grows by the marker lines of each conflict, plus base lines for diff3 files.
- The golden and showcase fixtures are regenerated.
- The round trip is tested in two halves (Rust: the waiting shapes and the reader; TS: the builder). A TS line-break bug is caught only by TS tests and an `app-session` smoke run.

## Option 2: Rust builds the file from the window's decisions

Visions 2 and 3.

- **Data:**
  - The window sends `save_file(path, pieces: Vec<ResultPiece>, disk_version)`, where `ResultPiece = Shown { text } | Change { id: ChunkId, text, local: SideStatus, remote: SideStatus }`.
  - New input DTOs with `Deserialize`: `ResultPiece` and `SideStatus { Pending, Applied, Ignored }`.
  - Rust remembers the waiting shapes it served: `FileState.served: Vec<Waiting>`, set by `load`.
  - The window only splits the Result at waiting spans.
- **Pro:** the builder sits next to the marker parser. The whole chain (build, write, open, place the blocks) is one `cargo test` over real repositories, which is the strongest proof of the round trip.
- **Cons:**
  - Rust holds a second copy of chunk facts, which only makes sense together with the window's ids. An unknown or stale id needs a new error.
  - The view source must stay separate from `seen`, because a save replaces `seen` in disk view.
  - The status rules the owner reads best move into Rust (vision 1).
  - It needs a new input DTO, so IPC9 asks for a decision row.

## Option 3: the window builds everything from one marker style per file

Visions 5 and 1.

- **Data:** `FileMergeData.markers: { size, ours_label, theirs_label }`, merge style always; nothing per chunk.
  - TS writes `<<<<<<<` and the other marker lines itself.
  - TS tells raw regions apart by checking whether the Result span still equals the original middle lines.
- **Pro:** the smallest IPC change.
- **Cons:**
  - The marker grammar lives in TS, with the marker-size rule copied from Rust (vision 2).
  - Disk-view blocks are rewritten with the file's labels, so per-block labels are lost.
  - diff3/zdiff3 base sections disappear on every save.
  - It cannot tell an inexact block from an exact one without the facts Rust already has.

**Rejected outright:**
- Re-running `git merge-file` on the Result with the waiting ranges put back: a subprocess and temp files per save, git may reshape blocks or merge cleanly what the user left waiting, and git ≥ 2.44 is needed for histogram.
- Atomic temp file + rename: it loses the executable bit and hard links, and handles links badly on Windows; `finish` does not do it either.
- Bumping `DiskVersion` per save: the window would rebuild the view and lose undo.

## Recommendation: Option 1

It keeps Rust free of any memory for Save (`save` is `finish` minus `git add`), keeps the status rules in TS where the owner reads them (vision 1), and gives each fact one owner (vision 2):
- statuses: `chunkField`
- marker lines: Rust
- the saved point: `MergeController`
- the at-open bytes: `FileState.at_open`

**What it costs:**
- One more field per chunk across IPC.
- Git's marker order known in two places.
- A round trip tested in two halves. A test-only splice in Rust of about 15 lines mirrors the TS builder, and that mirror can drift from `fileText.ts`.

## Ownership split (disjoint)

### Contract, fixed before both builds

- `Waiting` and `MergeChunk.waiting`, exactly as in the Rust block above (`serde(tag = "kind")`). TS gets `{kind:"SideLines"} | {kind:"Markers"; open; between; close} | {kind:"AsShown"}`.
- `save_file(path: &str, text: &str, disk_version: DiskVersion) -> Result<WriteReply, IpcError>`, which becomes `commands.saveFile(path, text, diskVersion)`.
  - It does not stage and does not change the disk version.
  - It replies `ChangedOnDisk` exactly as `finish_file` does, and `NotAFile` for a link or folder.
  - The write never comes back later as a `DiskChange`.
- `reset_file` keeps its signature. Its meaning becomes #66 (at-open bytes).

### Rust build (runs first)

- New: `crates/session/src/waiting.rs`, `crates/session/tests/save.rs`.
- Changed:
  - `crates/session/src/` `lib.rs`, `merge_data.rs` (field, plus a `style` parameter on `merge_data`), `seed.rs`, `disk.rs` (`AtOpen`, `Seen::after_own_write`), `open.rs`, `session.rs`, `writes.rs`
  - `crates/session/tests/` `finish_and_reset.rs`, `all_or_nothing.rs`
  - `crates/session/AGENTS.md`
  - `crates/cli/src/fixture.rs` (passes `MarkerStyle::fallback`)
  - `src-tauri/src/commands.rs`
- Generated: `frontend/src/ipc/bindings.ts` (`just bindings`), `frontend/fixtures/golden/*.json` and `frontend/fixtures/showcase/*.json` (`just fixtures`).
- Between the two builds `pnpm typecheck` fails, because `fixture.ts`'s `MERGE_CHUNK satisfies SchemaOf<…>` lacks `waiting`. That is expected.

### Window build (runs second)

- New: `frontend/src/editor/internal/fileText.ts` + `.test.ts`, `savedPoint.ts` + `.test.ts`.
- Changed:
  - `editor/internal/apply.ts` (export `sideLines`, `wholeLines`), `editor/index.ts`
  - `ipc/keys.ts` (+test), `ChunkSource.ts`, `tauri.ts`, `fixture.ts` (schema + `saveFile`), `domain.ts`, `index.ts`
  - `ui/useMergeController.ts` (+test), `closeGuard.ts`, `store.ts` (+test), `MergeView.vue`, `question.ts` (+test), `keyText.ts` (+test), `problem.ts`, `problemText.ts` (+test)
- Docs, owned here so no file has two owners:
  - `docs/architecture.md` (§3.3, §3.5, §4, §5.1, §5.2)
  - `.omp/skills/project-map/SKILL.md` (state table: the saved point is in `MergeController`; the at-open bytes are in `FileState.at_open`; the new modules)
  - `.omp/skills/ipc-contract/SKILL.md` (`save_file`)
  - `CHANGELOG.md`
- The Rust build reports its doc facts in its result.

### Files 3.Y is also likely to touch

`editor/index.ts`, `ui/useMergeController.ts`, `ui/MergeView.vue`, `ui/store.ts`, `ipc/ChunkSource.ts`, `ipc/tauri.ts`, `ipc/fixture.ts`, `ipc/index.ts`, `ipc/bindings.ts`, `src-tauri/src/commands.rs`, `docs/architecture.md`, the project-map and ipc-contract skills, and `CHANGELOG.md`. Also `editor/internal/pane.ts` and `ui/MergeToolbar.vue`, which only 3.Y touches.

Suggested order: 3.Z Rust, then 3.Z window, then 3.Y. 3.Y inserts its format step in `store.save` between the in-flight check and `snapshot()`. Formatting edits light the dot, and the snapshot taken afterwards writes them.

## Tests that would catch a real bug (brief item 7)

### Rust (`session`, real repositories from `conflict-repo`)

| # | what is checked |
|---|---|
| S1 | For every golden case: saving with everything waiting, using the test splice, then a new session's `open` + `refresh` + `load` either finds the file untouched, or every `Conflict` comes back with the same local and remote ranges |
| S2 | A half-decided conflict that was not edited comes back exactly placed; one that was edited or ignored comes back as one raw conflict with both sections in the file |
| S3 | Own write vs foreign write: after `save`, `refresh().disk_changes == []`, `ls-files -u` is unchanged and the status stays `Unresolved`. A foreign write before `save` gives `ChangedOnDisk` and keeps the foreign bytes. A stale version writes nothing. A link or folder gives `NotAFile` |
| S4 | Reset after a save: the bytes equal the at-open bytes, the stages are back, and a later refresh shows no change |
| S5 | Reset in a second run: run 1 saves S, run 2 saves S2 and resets; the file is S again |
| S6 | Reset of a file changed before start gives back the hand-edited bytes, not git's conflict |
| S7 | Reset all-or-nothing: an `index.lock` leaves the file untouched; a failed file write restores the index |
| S8 | Unit: `MarkerStyle` from `tests/markers/style-{merge,diff3,zdiff3}.txt`, `marker-size-12.txt`, `crlf.txt`; a seeded exact block's `Markers` plus its section lines rebuild `Block.whole` exactly |

### TS (node)

- `fileText` rule table:
  - CRLF ⇒ `\r\n` in marker lines
  - a span at the end of the file without a final line break
  - an insertion-point conflict
  - an empty side
  - `AsShown`
  - a resolved file ⇒ as shown
- `savedPoint`:
  - type ⇒ dot; undo ⇒ no dot
  - ignore of a one-sided change ⇒ dot
  - apply + undo ⇒ no dot
- `store.save`:
  - `Written` ⇒ `markSaved`
  - `ChangedOnDisk` ⇒ notice and reload
  - in flight ⇒ ignored
  - no dot ⇒ no IPC call
- `closeGuard` asks only when something is unsaved.
- The keys, key-text and question wording tests.

## Proposed decision row (DR5; the orchestrator records it)

**#68 How Save writes and Reset restores** (implements #65 and #66; design 3.Z option 1). Content: the rules table above; `MergeChunk.waiting`; `save_file`; the own write updates `seen` only; `AtOpen` for Reset; the saved point is the editor state.
- **Rejected:** Rust builds the file (memory of served chunks, ids); a per-file marker style built in the window (base sections and labels lost); a `git merge-file` re-merge; atomic rename; a version bump per save.
- **Visions:** 1, 2, 5.

Row #57 should also say 16 key actions, not 14.

## Open questions for the product owner

1. **Typing inside a change before either side is taken.** With the recommended default, Save writes git's conflict (or the side git applied) there, so that typing is not in the file: the dot clears and closing yamt loses it. This matches what Apply already does with such typing (it replaces it). Choices:
   - (a) keep this default;
   - (b) write the typing into the conflict's middle "base" section, so other tools show it as the common ancestor and yamt shows base there next time;
   - (c) keep the dot lit after Save while such typing exists, so the close question still asks.
2. **The next run after a save.** Each saved file shows "differs on disk from git's merge — N conflicts left" at start. A saved file with no conflict markers left (every conflict decided, one-sided changes still waiting) is staged as resolved at start, with those changes applied. Accept both, or should yamt remember its own saves between runs? That would mean a new per-repository record.
3. **The close question:** "Unsaved Changes" / "These files have changes that are not saved to disk. Exit without saving them?" / "Exit Without Saving" / "Cancel". Two buttons, no "Save and exit". Agree?
4. **Ctrl+S on a file already marked resolved** writes the Result as shown, without staging, so git shows it staged plus changed until "Mark resolved" again. Agree, or should Ctrl+S do nothing there?

## Open risks

- [INFERENCE] **`working-tree-encoding` files:** `finish` and `save` both write UTF-8 bytes into a file git keeps in another encoding. This already happens in today's `finish`; Save makes it more frequent. It is a candidate for its own row.
- **A save write that fails partway** is rolled back on a best-effort basis only. If that fails too (for example, disk full), the next look settles the truncated file as a foreign change, and could stage it if no markers are left in it.
- **Not yet tested:** that a waiting block whose sections are the exact stage lines is placed exactly even when decisions elsewhere changed the surrounding text. This is [INFERENCE] from the `locate.rs` doc comment; S1 and S2 prove it or refute it.

## Choices beyond the brief

These are not in the brief but are decided here, as the plain options:
- Save does nothing when the dot is off.
- Rust skips a write whose bytes equal what it last saw.
- A Save during any write to the same file is ignored (Reset and Mark resolved register their writes).
- On a resolved file, Save writes the Result as shown.

`architecture.md` §3.3's statement that `Mixed` line endings pass through untouched looks wrong ([INFERENCE] from `paneDocs.ts` and CM5).

**Checks for the main agent after both builds:** `just test`, `just bindings-check`, `just fixtures-check`, `just arch-check`, `just map-check`, `pnpm test`, `vue-tsc -b`.