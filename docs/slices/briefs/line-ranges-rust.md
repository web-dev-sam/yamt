# Slice line-ranges-rust — a thread's place with two ends, `threads.json` format 2, GitLab's multi-line body

Design: `docs/slices/briefs/line-ranges-design.md` option A (read §0 and §1 "File", "GitLab"). Request:
`docs/slices/request-line-ranges.md` rules 9, 10. Facts with a source below are given; re-check only `[INFERENCE]`.

## Target

**Owned:** `crates/review/src/**`, `crates/review/tests/**`, `crates/review/Cargo.toml`, `crates/review/AGENTS.md`,
`src-tauri/src/review.rs`, `src-tauri/src/review/tests.rs`, `src-tauri/src/ipc_error.rs`,
`src-tauri/src/ipc_error/tests.rs`, `tests/glab/line-range/**` (new), `tests/glab/line-range-drafted/**` (new),
`tests/glab/README.md`.

**Read-only:** everything else; in particular `crates/range/**`, `crates/merge-core/**`, `scripts/range-repo.sh`,
`tests/glab/lined-up/**`, `frontend/fixtures/range/review.json`.

**Orchestrator, not you:** before this build, root `Cargo.toml` `[workspace.dependencies]` gains `sha1 = "0.10"` and the
plan row #147 (DR3) is recorded; `Cargo.lock` changes come from cargo and are committed with your patch; after it,
`just bindings` regenerates `frontend/src/ipc/bindings.ts` (never edit it). The frontend does not typecheck between your
commit and the domain build's; that is expected.

**Non-goals:** any frontend file; reading GitLab's threads back; GitLab suggestions; changing a thread's place after it
starts; mirroring `BackwardPlace` in the fixture.

**Decided (plan §2 #147):** an unchanged end is posted with no `type`, as GitLab's own form sends it.

## Contract

Fixed (you may add, never change):

```rust
// crates/review/src/thread_types.rs (exported from lib.rs)
/// A line of the diff as GitLab's one-column view lists it: an unchanged line once, a change's removed lines, then its
/// added lines.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum DiffLine {
    Removed { left: LeftLine },
    Added { right: RightLine },
    Unchanged { left: LeftLine, right: RightLine },
}

/// The lines a thread is on, from `start` to `end` in GitLab's order, both included; one line when `start` is `end`'s
/// line. `end` decides the column the box sits in.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize, Type)]
pub struct ThreadPlace {
    pub start: DiffLine,
    pub end: ThreadLine,
}

impl ThreadLine { pub fn diff_line(self) -> DiffLine }        // UnchangedOnLeft/OnRight → Unchanged
impl ThreadPlace {
    pub fn one_line(line: ThreadLine) -> ThreadPlace         // { start: line.diff_line(), end: line }
    pub fn is_one_line(self) -> bool                         // start == end.diff_line()
    /// Where both ends have a left line, start's is not after end's; the same for right lines.
    pub fn runs_forward(self) -> bool
}

pub struct Thread { pub id: ThreadId, pub file: RangeFileId, pub place: ThreadPlace, pub messages: Vec<Message>,
                    pub session: Option<String> }           // `line` → `place`, doc "A thread on lines of one file"

// crates/review/src/lib.rs, Error
/// The place's first line comes after its last.
#[error("a thread's first line comes after its last")]
BackwardPlace,

// ThreadStore
pub fn add_thread(&mut self, range: &Range, file: RangeFileId, place: ThreadPlace, text: &str) -> Result<ThreadAdded>
// order of refusals: EmptyMessage, UnknownFile, BackwardPlace (nothing written on any)

// src-tauri/src/review.rs
#[tauri::command] #[specta::specta]
pub(crate) fn add_thread(state: State<'_, RangeState>, file: RangeFileId, place: ThreadPlace, text: String)
    -> Result<ThreadAdded, IpcError>
// src-tauri/src/ipc_error.rs: yamt_review::Error::BackwardPlace joins the arm with ReadFailed | Broken | NewerFormat
// → IpcError::Git { message: error.to_string() } (IpcError itself does not change)
```

Generated TS the domain build relies on (from the above, after `just bindings`):
`DiffLine = { kind: "removed"; left: LeftLine } | { kind: "added"; right: RightLine } | { kind: "unchanged"; left:
LeftLine; right: RightLine }`, `ThreadPlace = { start: DiffLine; end: ThreadLine }`, `Thread.place: ThreadPlace`,
`commands.addThread(file: RangeFileId, place: ThreadPlace, text: string)` invoking `add_thread` with `{ file, place,
text }`.

**`threads.json` format 2** (`thread_file.rs`): `FORMAT = 2`; a thread is
`{ "id", "path", "place": { "start": DiffLine, "end": ThreadLine }, "session", "messages" }` (field order as written,
`to_string_pretty`). Format 1 (`"line": ThreadLine` in place of `"place"`) is read through a private `StoredThread`
shape of its own and each thread becomes `ThreadPlace::one_line(line)`; the in-memory file then has `format: FORMAT`,
so the next write is format 2; a read never writes (`ThreadStore::open` unchanged). `parsed`: `format > 2` →
`NewerFormat`; `format == 1` → the format-1 shape; `== 2` → the current one; anything else → `Broken "format {n} is
not 1 or 2"`. `problem()` adds: a place with `!runs_forward()` → `"the thread {id}'s first line comes after its last"`.

**The post body** (`position.rs`), 1-based numbers:

```rust
pub(crate) enum LineType { Old, New }                        // "old" / "new"
/// One end of GitLab's `position[line_range]`.
pub(crate) struct RangeEnd { pub(crate) line_code: String, pub(crate) line_type: Option<LineType>,
                             pub(crate) old_line: Option<u32>, pub(crate) new_line: Option<u32> }
pub(crate) struct MultiLine { pub(crate) start: RangeEnd, pub(crate) end: RangeEnd }
pub(crate) struct PostBody { note, diff_refs, place: LinePlace, multi_line: Option<MultiLine> }
pub(crate) struct PlacedDraft { head_sha, place: LinePlace, multi_line: Option<MultiLine> }   // gitlab.rs
```

- `LinePlace` = today's `line_place(entry, place.end)` (the position's own `old_line`/`new_line` name the end line).
- `multi_line` is `None` when `place.is_one_line()`: the body is byte-for-byte today's (no `line_range` key).
- Otherwise each end, for a `DiffLine` and the file's `differences` (from `Range::load(file)` →
  `RangeFile::Texts { differences, .. }`, loaded in `send.rs` only for a message whose place is not one line):

  | end                               | `line_code`                                | `type`   | `old_line` | `new_line` |
  | --------------------------------- | ------------------------------------------ | -------- | ---------- | ---------- |
  | `Unchanged { l, r }`              | `<sha1>_{l+1}_{r+1}`                       | left out | `l+1`      | `r+1`      |
  | `Removed { l }` in difference `d` | `<sha1>_{l+1}_{d.right.start+1}`           | `"old"`  | `l+1`      | left out   |
  | `Added { r }` in difference `d`   | `<sha1>_{d.left.start+d.left.len+1}_{r+1}` | `"new"`  | left out   | `r+1`      |

  `<sha1>` = lowercase hex SHA-1 of `entry.path` (the new path, also for a renamed file). Sources (gitlab-org/gitlab
  `v19.3.2-ee`): `lib/gitlab/git.rb:113-115`, `lib/gitlab/diff/file.rb:83-85, 253-255`, `lib/gitlab/diff/line.rb:80-86,
  170-174`, `lib/gitlab/diff/parser.rb:13-14, 48, 52-64, 82-87`, `lib/api/draft_notes.rb:95-108`; one doc comment on the
  numbering function names the parser lines. A removed/added end not inside any difference → `Outcome::Refused("the
  thread's lines are not in this diff any more")`; a load error → `Refused(error.to_string())`; a load that is not
  `Texts` → `Refused("the file has no lines")`.

- JSON: `position.line_range = { "start": {…}, "end": {…} }`, each end's keys in the order `line_code`, `type`,
  `old_line`, `new_line`, left-out keys absent (never `null`).
- Drafts read back (`placed_draft_from`): `position.line_range` `null` or missing → `multi_line: None`; an object → its
  `start`/`end` with `line_code` (string), `type` (`"old"`, `"new"`, `null` or missing → `None`; another value → the
  draft has no place), `old_line`/`new_line` through `optional_line_at`.
- `same_draft`: today's checks and `multi_line` equal on both ends' `line_type`, `old_line`, `new_line` (`line_code`
  is not compared); `None` equals only `None`.

## Change

1. `thread_types.rs`, `lib.rs`: `DiffLine`, `ThreadPlace` and its methods, `Thread.place`, `Error::BackwardPlace`;
   unit tests for `runs_forward` (one-line places; start before end on the left, on the right; start after end on
   either side → false; an added start and a removed end → true, documented as unseen).
2. `thread_file.rs`: format 2 and format-1 reading as above; `StoredThread.place`; `problem()` order check; update the
   unit tests (`thread()` writes format 2; `format_0_is_broken_not_newer` with the new words; new
   `a_backward_place_is_broken`, `format_1_line_reads_as_a_one_line_place`).
3. `thread_store.rs`, `thread_store/waiting.rs`: `add_thread(.., place, ..)` refusing `BackwardPlace` after the existing
   checks; `QueuedMessage.place`; `list` copies `place`; waiting tests keep their format-1 `STORED` text (it reads).
4. `position.rs`, `gitlab.rs`, `send.rs`: the multi-line body, its read-back, `same_draft`, the per-message load in
   `outcome`; `crates/review/Cargo.toml` `sha1.workspace = true`.
5. `src-tauri`: `add_thread` takes `place`; the `BackwardPlace` arm; `review/tests.rs` sends `"place"`;
   `ipc_error/tests.rs` pins `BackwardPlace` → `Git { message: "a thread's first line comes after its last" }`.
6. Fake GitLab cases (copy `merge-request.json` and `merge-requests.json` from `tests/glab/lined-up/`):
   - `tests/glab/line-range/`: `draft-notes.json` `[]`; `post-1.json` and `post-2.json` as `lined-up/post-1.json` with
     ids 201 and 202.
   - `tests/glab/line-range-drafted/`: `post-1.json` id 501; `draft-notes.json` with draft 401 (note = the in-column
     text below, the position of the in-column range with its `line_range`, `"type": null` on the unchanged start,
     head `9c1ba3fc606a3776061d23006b83e2af2a357112`, base/start as in `drafted/`) and draft 402 (note = the both-sides
     text, the same paths and `"new_line": 204`, `"old_line": null`, `"line_range": null`).
   - `tests/glab/README.md`: both scenarios in the list.
7. Tests in `crates/review/tests/` (`stored_threads/mod.rs` builders take places):
   - `EVERY_KIND` becomes format 2 (today's four one-line threads as places, plus thread 5 on c.txt with a both-sides
     place `start: removed { left: 1 }`, `end: added { right: 2 }`); `FORMAT_1_EVERY_KIND` keeps today's text.
   - `threads.rs`: `a_format_1_file_reads_as_one_line_places_and_is_written_as_format_2_by_the_first_change` (open +
     list leave the format-1 bytes; `add_note` writes the format-2 JSON, compared whole); `a_range_survives_a_reload`;
     `add_thread_refuses_a_backward_place_and_writes_nothing` (`start: unchanged { left: 5, right: 5 }`, `end: added {
     right: 2 }`); `a_newer_format_is_refused_and_left_unchanged` with `{"format":3,…}`; the old format-1 round-trip test
     becomes the format-2 one over the new `EVERY_KIND`.
   - `review.rs`, a `Review::ranges()` on `main...feature` with two threads on `src/board/board.ts`, each first message
     queued: in-column `start: unchanged { left: 196, right: 200 }`, `end: added { right: 203 }`, text "Why a second
     reminder here?"; both-sides `start: removed { left: 199 }`, `end: added { right: 203 }`, text "Why replace the
     limit check?" (board.ts's differences: `frontend/fixtures/range/review.json` `files[7]`, `d2` = left 199+1 / right
     203+1, the same Rust made it: `justfile:47-48`).
     - `a_range_posts_both_ends_with_gitlabs_line_codes` (`line-range`): bodies equal, in order: position
       `old_path`/`new_path` `src/board/board.ts`, `new_line: 204`, and `line_range`
       `{ start: { line_code: "<H>_197_201", old_line: 197, new_line: 201 }, end: { line_code: "<H>_201_204", type: "new",
       new_line: 204 } }`; then `{ start: { line_code: "<H>_200_204", type: "old", old_line: 200 }, end: { line_code:
       "<H>_201_204", type: "new", new_line: 204 } }`. `<H>` is a literal pinned from `printf '%s' src/board/board.ts |
       sha1sum`, never computed by the test.
     - `a_draft_stands_in_for_a_range_only_when_its_range_matches` (`line-range-drafted`): the in-column message is
       `Pending` with draft 401 and not posted; the both-sides one is posted once (draft 402 has no range) and `Pending`
       with 501.
   - `position.rs` unit: `line_codes_number_a_line_as_gitlabs_parser_does` (board.ts numbers above; removed L309 of the
     pure removal `d4` = left 308+18 / right 314+0 → `_309_315`; added R404 of the pure addition `d5` = left 415+0 /
     right 403+33 → `_416_404`; a renamed entry hashes its new path); `a_one_line_body_has_no_line_range`;
     `a_draft_is_the_same_only_with_the_same_range_or_both_without`. `gitlab.rs` unit:
     `drafts_read_back_their_line_range_or_none`.
   - `src-tauri/src/review/tests.rs`: `a_range_thread_added_through_add_thread_comes_back_from_list_threads`.
8. `crates/review/AGENTS.md`: the place, format 2, the multi-line body in its words.

## Acceptance

- `cargo clippy --workspace --all-targets -- -D warnings` clean; `cargo fmt --all --check` clean.
- With the justfile's `hermetic_git` prefix (RK19): `cargo nextest run -p yamt-review -p yamt-app` → every test above
  passes by name, and today's `the_post_body_names_the_three_commits_and_the_position` passes unchanged (one-line
  bodies keep their shape).
- `just bindings` in your workspace (do not commit its output) shows `DiffLine`, `ThreadPlace`, `Thread.place` and
  `addThread(file, place, text)`; paste the lines.
- `just mutants HEAD`; survivors on changed lines killed or kept with a reason (SP11).

## Skills

`skill://rust-conventions`, `skill://ipc-contract`, `skill://risk-register` (RK33, RK36; new rows RK48, RK49 in the
design §5), `skill://comment-policy`.
