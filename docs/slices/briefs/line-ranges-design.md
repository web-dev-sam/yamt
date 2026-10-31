# Line-range threads — design

Designer `LineRangesDesign`, 2026-10-31. Request: `docs/slices/request-line-ranges.md` (rules 1–10, owner answer #2052:
a range may cover both sides). Facts marked `(scout §n)` are from `.omp/run/notes/PlanScoutRangeThreads.md` at `c8c5c54a`,
given; facts with a path:line were read for this design at `265d168`. GitLab sources are gitlab-org/gitlab at tag
`v19.3.2-ee` (raw files under `https://gitlab.com/gitlab-org/gitlab/-/raw/v19.3.2-ee/`). Unobserved claims are marked
`[INFERENCE]`.

## 0. Facts the options stand on

**Today's anchor.**

- Rust `ThreadLine` = `Removed { left } | Added { right } | UnchangedOnLeft { left, right } | UnchangedOnRight { left, right }`,
  `#[serde(tag = "kind", rename_all = "camelCase")]` (`crates/review/src/thread_types.rs:14-42`); `Thread.line`
  (`:108-121`), `StoredThread.line` (`thread_file.rs:26-34`), `QueuedMessage.line` (`thread_store/waiting.rs:7-12`),
  `add_thread(range, file, line, text)` (`thread_store.rs:63-88`, no check of the line against the file), command
  `add_thread(file, line, text)` (`src-tauri/src/review.rs:44-54`).
- TS domain `ThreadLine`, `ShownThread { key, line, shown }`, `shownLine`, `changedThreadLine`, `unchangedThreadLine`,
  `toThreadLine`, `fromThreadLine` (`frontend/src/ipc/threadLine.ts:6-76`), exported at `ipc/index.ts:139-146`.
- `anchorAt` turns a pressed column line into a `ThreadLine` from the reply's differences; `linePlace` finds the
  difference or the partner line (`editor/internal/threadAnchor.ts:13-45`).

**The file.** `threads.json`, `FORMAT = 1` (`thread_file.rs:10-11`); `parsed` reads the format first, `format > FORMAT`
→ `NewerFormat`, other mismatch → `Broken "format N is not 1"` (`:193-211`); no `deny_unknown_fields`, so an older
yamt drops an unknown field when it rewrites the file (scout §3). Every format constant in the repo is 1; none has
ever stepped (scout §3). `ThreadStore::open` never writes (`thread_store.rs:24-29`); every change writes the whole
file through temp + rename (`thread_file.rs:220-237`). Older yamt builds refuse format 2 with `NewerFormat` naming
the file, untouched (`thread_file.rs:196-201`; plan §2 #120; tests `a_newer_format_is_refused_and_left_unchanged`,
`crates/review/tests/threads.rs:115-127`).

**GitLab today.** `line_place(entry, line)` → `LinePlace { old_path, new_path, old_line?, new_line? }`, 1-based, the
old path a renamed entry's old path, else the entry's path (`position.rs:19-41`, `gitlab.rs:38-45`); `PostBody::json`
(`position.rs:47-77`); `same_draft` compares note, `head_sha`, `LinePlace` (`position.rs:80-88`); `placed_draft_from`
reads `position.old_line/new_line` only (`gitlab.rs:177-188`); the send path (`send.rs:141-165`) has only the
`RangeEntry`, not the file's differences. `Range::load(file)` gives `RangeFile::Texts { left, right, differences, mode }`
(`crates/range/src/open.rs:96`, `crates/range/src/lib.rs:117-123`).

**GitLab's `line_code`, from GitLab's code.**

- `Gitlab::Git.diff_line_code(file_path, new_line_position, old_line_position)` =
  `"#{Digest::SHA1.hexdigest(file_path)}_#{old_line_position}_#{new_line_position}"` (`lib/gitlab/git.rb:113-115`).
- A diff line's code is `line.legacy_id(file_path)` → `diff_line_code(file_path, new_pos, old_pos)`
  (`lib/gitlab/diff/file.rb:83-85`, `lib/gitlab/diff/line.rb:170-174`), with `file_path` = `new_path.presence ||
  old_path` (`file.rb:253-255`): **the new path, also for a renamed file**.
- `old_pos`/`new_pos` are the parser's counters when the line is read (`lib/gitlab/diff/parser.rb:13-14` start at 1,
  `:32-33` reset at each hunk header, `:48` the line gets `line_old, line_new`, then `:52-64`: `+` adds 1 to new only,
  `-` to old only, a context line to both). Git's unified diff lists a change's `-` lines before its `+` lines, so:
  - **unchanged** line (left `l`, right `r`, 0-based): `<sha1>_<l+1>_<r+1>`;
  - **removed** line `l` of a difference `d`: `<sha1>_<l+1>_<d.right.start+1>` (the new number of the change's first
    added line, or of the line after a pure removal);
  - **added** line `r` of a difference `d`: `<sha1>_<d.left.start+d.left.len+1>_<r+1>` (the old number of the line
    after the change's removed lines).
- `type` is `"new"` for `+`, `"old"` for `-`, nil for a context line (`parser.rb:82-87`; `line.rb:92-94` `unchanged?` =
  `type.nil?`); `old_line` is nil for an added line, `new_line` nil for a removed one (`line.rb:80-86`); these four
  are what a diff line sends to the browser (`app/serializers/diff_line_entity.rb:4-7`).
- GitLab's own form builds `line_range` from two such lines: `commentLineStart = { line_code, type: line.type,
  old_line, new_line }` (`app/assets/javascripts/diffs/components/diff_line_note_form.vue:64-69`), `lineRange:
  formatLineRange(commentLineStart, this.line)` (`:89`; `notes/components/multiline_comment_utils.js:82-93`).
- The header "Comment on lines X to Y" signs each end by its `type`: `new` → `+new_line`, `old` → `-old_line`, nil → the
  bare number, `new_line` when the other end is `new` (`multiline_comment_utils.js:3-7, 9-24`). GitLab tints the
  commented rows by finding `line_range.start/end.line_code` among its own diff lines (`:95-117`).
- The REST route takes every `line_range` field as optional: `line_code`, `type` (String), `old_line`, `new_line`
  (Integer) (`lib/api/draft_notes.rb:95-108`).

Worked on the review fixture's `src/board/board.ts` (`frontend/fixtures/range/review.json`, `files[7]`, which `just
fixtures` makes from `scripts/range-repo.sh` `main...feature` through the same Rust, `justfile:47-48`): differences
(0-based) `d0` left 19+1 / right 19+2, `d1` 179+0 / 180+3, `d2` 199+1 / 203+1, `d3` 254+1 / 258+3, `d4` 308+18 / 314+0,
`d5` 415+0 / 403+33, `d6` 461+0 / 482+2. In display numbers: removed L200 → `<sha1>_200_204`; added R204 →
`<sha1>_201_204`; unchanged L197/R201 → `<sha1>_197_201`; removed L309 (pure removal `d4`) → `<sha1>_309_315`; added
R404 (pure addition `d5`) → `<sha1>_416_404`.

**Editor facts.** A gutter `mousedown` on a number starts a thread at once (`threadNumbers.ts:103-128`); returning
`true` from a CodeMirror gutter handler prevents the default `[INFERENCE: @codemirror/view gutter calls
preventDefault when a domEventHandler returns true; the editor build checks node_modules]`, so no text selection
starts from the gutter. The columns are selectable (`pane.ts:209-210`, scout §8). There are no spacer lines between the
columns (no spacer in `editor/internal`); at any height each column shows one of its own lines, except over a thread
row, a collapsed run's wave and below its last line. `ThreadHosts` creates one host element per thread key
(`threadHosts.ts:153-159`) and already listens on the document for focus (`:48-49`); widgets ignore events (plan §2
#116), host DOM listeners still fire. Hidden lines per column: `hiddenIn(state, column)` and `displayed(fold, column)`
(`columnFolds.ts:113-116`, `foldRuns.ts:103-105`). `columnRuns` assumes changes that do not overlap: two overlapping
changes give a run starting inside the first (`foldRuns.ts:25-30, 86-101`), so overlapping range runs must be merged.
The selection colour is `var(--color-selection)` (`pane.ts:98`; `themes/vscode-dark.css:29`,
`vscode-light.css:29`). Drag precedent: `IconDrag` with pointer capture (`drag.ts:51-116`).

**Window facts.** Draft identity "same line" = same shown column and line (`rangeDrafts.ts:120-135`); drafts as
`ShownThread`s (`rangeThreads.ts:96-103`); stored threads as `ShownThread`s (`rangeOpen.ts:45-50`); place text
`threadPlaceText` (`rangeThreadText.ts:164-173`) for the box header and `aria-label` (`RangeThreadBox.vue:42-45, 157,
161`) and the AI value (`rangeStore.ts:110-128`); default template `firstMessage.ts:11-19`; seeded fixture threads
`fixtureThreads.ts:20-68` (ids 0–3 on board.ts, used by index in many ui tests).

## 1. Options

All three keep rules 1–10; they differ in the shape of a thread's place and in where GitLab's numbers come from.

### Option A — one place shape with two ends; GitLab numbers from the file's differences at send (recommended)

**Data.**

```rust
/// A line of the diff as GitLab's one-column view lists it: an unchanged line once, a change's removed lines, then its added lines.
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum DiffLine { Removed { left: LeftLine }, Added { right: RightLine }, Unchanged { left: LeftLine, right: RightLine } }

/// The lines a thread is on, from `start` to `end` in GitLab's order, both included; one line when `start` is `end`'s line.
/// `end` keeps today's `ThreadLine`: its variant decides the column the box and the count badge sit in.
pub struct ThreadPlace { pub start: DiffLine, pub end: ThreadLine }
```

Serde/TS: `{ "start": { "kind": "unchanged", "left": 196, "right": 200 }, "end": { "kind": "added", "right": 203 } }`;
a one-line thread is `{ "start": X', "end": X }` with `X'` = `X`'s line (one shape, one code path: tint, folds, rows,
text and GitLab all read the same two ends; only GitLab and the place text ask "is it one line?"). `start` has no
column because nothing uses one (an unchanged start is tinted in both columns; the box goes under `end`), so equal
ranges have one value. `Thread.place`, `StoredThread.place`, `QueuedMessage.place`, `add_thread(file, place, text)`.
`ThreadPlace::runs_forward()`: where both ends have a left line, start's ≤ end's; where both have a right line,
start's ≤ end's (GitLab's order is monotonic in each side's numbers). It cannot see every backward place (an added
start and a later removed end share no side) — the full order needs the differences, which only the editor has; the
editor builds places only through one ordering function. `add_thread` refuses a backward place
(`Error::BackwardPlace`), and a loaded file with one is `Broken`, so the check never lets a write make the file
unreadable.

**File (rule 9).** `FORMAT` 2. A format-1 file is read with its own private shape (`line: ThreadLine`) and each thread
becomes `ThreadPlace::one_line(line)`; it is not rewritten by reading (`open` never writes); the first change the user
makes (add, note, queue, send result, edit, delete, session) writes the whole file as format 2. A new field in format 1
is unsafe (scout §3: an older yamt would drop it on rewrite and turn a range into its end line); format 2 makes an
older yamt refuse the file by name, untouched. `{"format":0}` stays `Broken` ("format 0 is not 1 or 2"), `{"format":3}`
is `NewerFormat`. Pinned on disk: the format-1 `EVERY_KIND` text read and left byte-identical by refused operations,
then the format-2 text a change writes; a format-2 file with a both-sides range round-trips byte-identical.

**GitLab (rule 10).** `PostBody { note, diff_refs, place: LinePlace, multi_line: Option<MultiLine> }`;
`LinePlace` is today's, computed from `place.end` (the position's `old_line`/`new_line` name the end line);
`multi_line` is `None` for a one-line place (body unchanged, no `line_range`). For a range, `send` loads the file
(`Range::load`, once per range message) and `multi_line(path, differences, place)` builds both ends with the line-code
numbers above, hashing `entry.path` (= `new_path`, `file.rs:253-255`) with SHA-1. `position.line_range` =
`{ start: { line_code, type?, old_line?, new_line? }, end: {…} }`: `type` `"old"` for a removed end, `"new"` for an added
end, **left out for an unchanged end** (GitLab's own form sends nil there, `line.rb:92-94`,
`diff_line_note_form.vue:64-69`; decided by the orchestrator, plan §2 #147); `old_line` left out for an added end, `new_line` for a removed end
(`line.rb:80-86`; the route takes all four as optional, `draft_notes.rb:95-108`). Drafts read back parse
`position.line_range` into the same `MultiLine` (`null` or missing → `None`); `same_draft` also requires equal
`multi_line` ends compared on `type`, `old_line`, `new_line` (not `line_code`, which is derived from them and the path
already compared). A draft read back without a range is a one-line draft: it can stand in only for a one-line
message, never for a range ending on its line, and a range draft never for a one-line message. A changed end whose line
is not inside a difference of the loaded file (the diff engine moved on) is `Refused` with "the thread's lines are not
in this diff any more"; a load failure is `Refused` with its words. SHA-1 needs the crate `sha1` 0.10 (RustCrypto;
`digest` 0.10.7 is already in `Cargo.lock` through `sha2` 0.10.9): the stack has no SHA-1 (no `sha1` in `Cargo.lock`),
git's `hash-object` hashes a blob header with the text, and the window's WebCrypto would put GitLab's encoding in the
stored thread. Plan row below (DR3).

**GitLab's order over two columns (rule 2), editor.** One new pure module `editor/internal/diffOrder.ts` over the
reply's differences (as `linePlace` reads them):

- `orderIndex(differences, line: DiffLine)`: the line's index in GitLab's list. Unchanged `(l, r)`: `l` + the added lines
  of the differences before it; removed `l` in `d`: `l` + the added lines of the differences before `d`; added `r` in
  `d`: `d.left.start + d.left.len` + the added lines of the differences before `d` + `(r − d.right.start)`.
  `lineAtIndex(differences, index)` is its inverse.
- A pointer position becomes a `ThreadLine` with today's `anchorAt(differences, column, line)`; `diffLineOf` drops the
  column for ordering. Which column: the one whose box (gutter and text) the pointer's x is in; in the strip, the half
  it is in. Which line: `lineBlockAtHeight(y − documentTop)` in that column when it is a text line of the file
  (`pressedLine`'s rule: not the empty line after a last newline); over a thread row, below the last line, or in an
  empty column, the other column's line at that height by the same rule — the line the eye sees there `[INFERENCE:
  these are the "empty space" the request names; the columns have no spacer lines]`; when neither has one, the end
  stays where it was. y is clamped into the column's visible height.
- `placeBetween(differences, press, pointer): ThreadPlace`: the earlier of the two in GitLab's order is `start` (its
  `DiffLine`), the later is `end` (its `ThreadLine`, so an unchanged end keeps the column it was picked in); the same
  index is the press's one-line place. Upwards and downwards give the same place.
- `shownEnd(differences, hiddenLeft, press, pointer): ThreadLine`: the pointer clamped to the unbroken run of shown
  indices around the press (rule 3): a collapsed run hides unchanged lines in both columns, so it is one stretch of
  indices; the end stops at the shown line before the wave, in either direction. A line under the wave counts as
  hidden, so the pointer over the wave clamps too.
- `placeSpans(differences, place)`: per column, the lines to tint (unchanged in both, removed left, added right) as
  `{ start, len }` spans; `unchangedRuns(differences, place)`: the place's unchanged lines as `ColumnChange`s, one per
  stretch between differences (rule 8).

**Drag (rules 1, 3).** `editor/internal/threadDrag.ts` `ThreadDrag`: the gutter `mousedown` (left button, on a number,
not on a wave, not on the badge) returns `true` (no native selection, CodeMirror's own selection starts only in the
content) and starts the drag with the pressed `ThreadLine`; document listeners in the capture phase while it runs:
`pointermove` (recompute the end from the pointer), `scroll` on both columns' scrollers (the wheel scrolls natively;
recompute from the last pointer position, so the range follows the line under the pointer; no automatic scroll),
`keydown` Escape (cancel: preventDefault + stopPropagation, so no other Escape action runs), `pointercancel` and window
`blur` (cancel), `pointerup` (release: `placeBetween(press, shownEnd(...))` → `RangeEvents.startThread(place)`). A
press and release on one line gives that line's one-line place — today's thread, now started on release. The badge
press keeps today's toggle and starts no drag (`numberPress` → `{ kind: "toggle" }`).

**Box, badge, tint, collapse (rules 4, 5, 8).** `threadRows` places a row by `place.end` (today's `placeOf`/`gapAfter`
unchanged), so a range's box is under its last line in GitLab's order and threads ending on one line share a row; the
badge counts by `shownLine(place.end)` (`lineCounts`). Tint: `editor/internal/threadTint.ts`, a per-column `StateField`
of spans set by one effect, giving `Decoration.line({ class: "cm-thread-tint" })` and a gutter line class; the
controller sets it to the union of the live drag's place, every shown draft's place and the hovered thread's place.
Hover: `ThreadHosts` gets `hovered(key | null)` and adds `pointerenter`/`pointerleave` on each host it creates — the
box is Vue, its host is the editor's, so nothing crosses into the window. CSS: `.cm-line.cm-thread-tint` and the
gutter cell get `background-image: linear-gradient(var(--color-selection), var(--color-selection))`, layered over a
difference's own background, readable in both themes. Collapse: `columnChanges` takes `unchangedRuns` of every shown
thread (any shown kind, drafts included, #126), merges overlapping or touching runs, then the differences; computed at
open and on each toggle as today.

**Window (rules 6, 7).** Drafts hold `place`; "the same range" = same `start` and today's same-end rule (shown column
and line of `end`): the same range focuses the draft, any other is a new draft (sharing the end's row).
`threadPlaceText(entry, place)` (each end named by today's rule: a removed line by the old path and old number, any
other by the new path and new number):

| case                                                  | text                                                  | example                                                   |
| ----------------------------------------------------- | ----------------------------------------------------- | --------------------------------------------------------- |
| one line                                              | `path:N` (today)                                      | `src/board/board.ts:204`                                  |
| both ends on the same side (both removed, or neither) | `path:a-b`                                            | `src/board/board.ts:201-204`, `src/api/mockBoards.ts:2-5` |
| one removed end, one not, one path                    | `path:<s>a to <s>b`, `-` an old number, `+` a new one | `src/board/board.ts:-200 to +204`                         |
| the same in a renamed file                            | `<path of start>:<s>a to <path of end>:<s>b`          | `docs/shortcuts.md:-3 to docs/keys.md:+4`                 |

The default first message's sentence becomes: "A line removed by the changes is named by its place in
{{ OLD_COMMIT }}; in a range such as `-5 to +8`, `-` marks a line of {{ OLD_COMMIT }} and `+` one of
{{ NEW_COMMIT }}." (placeholder names unchanged, plan §2 #113).

**Fixtures.** `?threads=seeded` keeps threads 0–3 as they are (one-line places) and appends, on board.ts, both
`notQueued` so queued counts stay: thread 4 "inside a column" `start: unchanged { left: 400, right: 388 }`,
`end: added { right: 405 }` (R389–R406, left L401–L415; under collapse it keeps L397–L415 shown, which the run
`d4`→`d5` would hide from L331); thread 5 "across both" `start: removed { left: 254 }`, `end: added { right: 259 }`
(L255, R259–R260). The `?range` acceptance uses the `review` case (`fixtureRange.ts:28`).

**Files.** Rust: `crates/review/src/{thread_types,thread_file,thread_store,thread_store/waiting,position,gitlab,send,
lib}.rs`, its tests, `Cargo.toml`, `AGENTS.md`; `src-tauri/src/{review.rs,review/tests.rs,ipc_error.rs,
ipc_error/tests.rs}`; `tests/glab/{line-range,line-range-drafted}/`, `tests/glab/README.md`. Web: `ipc/{threadLine,
ReviewSource,reviewDomain,tauriReview,fixtureReview,fixtureThreads,index}.ts` and tests; `editor/internal/{diffOrder,
threadDrag,threadTint}.ts` (new), `{threadAnchor,threadRows,threadNumbers,columnFolds,threadHosts}.ts`, `range.ts`,
`theme.css`, tests; `ui/{rangeDrafts,rangeThreads,rangeOpen,rangeThreadText,rangeStore,useRangeController}.ts`,
`RangeThreadBox.vue`, tests; `agent/internal/firstMessage.ts`.

**Risks.** GitLab's diff is git's; yamt's differences come from `merge_core::compare` (plan §2 #95). Where the two cut
a change differently, a changed end's partner number differs and GitLab cannot find that `line_code` among its rows:
its tint (`multiline_comment_utils.js:95-117`) is off, while the note itself still sits on the end line by
`old_line`/`new_line` (risk row below; owner check on the playground). A range that starts on a line GitLab has not
expanded (yamt shows more lines than GitLab's 3-line hunks when collapse is off) has the same effect. The drag's three
document listeners must all go at release, cancel and `destroy`. Every single-line test that names `line` changes
mechanically to `place`.

**Tests.** §3. **Visions.** 4 (one shape, no column on `start`, a refused backward place, format step), 2 (GitLab's
order lives in one editor module; GitLab's numbers in one Rust function), 1 (two ends a reader can see in the JSON).

**Cost.** Rust ~900 changed lines, web ~2,100 (≈ half mechanical `line` → `place` in tests), one new crate (`sha1`),
one format step; five builds (rust, domain, editor, window, verify).

### Option B — every end carries GitLab's two numbers

**Data.** `GitLabLine { kind: Removed | Added | Unchanged, old: u32, new: u32 }` (GitLab's `old_pos`/`new_pos`,
1-based) for both ends, plus the end's column for an unchanged end; `ThreadPlace { start: GitLabLine, end: GitLabLine,
column: Column }`. Order is constructive-checkable in Rust (componentwise ≤ on `(old, new)` is exactly GitLab's
order), line codes need no differences at send, `same_draft` compares numbers directly.

**Cost and risks.** A format-1 removed or added line has no partner number; making one needs the file's differences
at `ThreadStore::open` (a diff per file with threads, at every start) or two stored shapes (old one-line threads
without partners, new ones with) — two code paths for one concept. The partner numbers are GitLab's encoding stored
as yamt's fact, and the editor must produce them for every press (it can, from `linePlace`). Files as A, plus the
store open path. Visions 4 (stronger order check), against 2 and 5 (a migration that reads git, or two shapes).

### Option C — a range beside the line

**Data.** `Thread { line: ThreadLine, from: Option<DiffLine> }` (`None` = one line); format 2 still needed (an older
yamt drops `from`). Smallest churn: every one-line code path and test keeps `line`; range code reads `from`.

**Cost and risks.** Two shapes for one concept: tint, folds, place text, drafts and GitLab each branch on the
`Option`; `Some(from)` equal to `line`'s own line is a second value for a one-line thread (illegal state
representable), so draft identity and `same_draft` need a normalising step. ~30% fewer changed lines than A.
Visions 5 (less churn), against 4 and 2.

## 2. Recommendation and cost

**Option A.** One place shape keeps every consumer on one path and makes equal ranges equal values (vision 4); GitLab's
numbering lives in one Rust function fed by the differences the range already computes, and GitLab's order in one
editor module (vision 2); format 2 is the only safe way to add data to `threads.json` (rule 9). B buys a stronger Rust
order check at the price of a migration that reads git or two stored shapes; C buys less churn at the price of two
shapes and a normalising step. Cost: ~3,000 changed lines over five builds, the `sha1` crate, one format step; the
editor's drag and tint are WebKit-tested in the editor build, the window's wiring in the verify pass.

## 3. Tests per layer (each with the bug it catches)

**Rust (`yamt-review`, `yamt-app`).**

- `thread_types` unit: `runs_forward` true for one-line places and for start ≤ end on a shared side; false for a start
  after the end on the left or on the right (catches a swapped drag reaching the file).
- `thread_file` unit: `format_0_is_broken_not_newer` ("format 0 is not 1 or 2"); `a_backward_place_is_broken`
  (catches a hand-edited file loading a range that runs backwards); format 1 `line` read as a one-line place.
- `tests/threads.rs`: `a_format_1_file_reads_as_one_line_places_and_is_written_as_format_2_by_the_first_change`
  (pins both JSON texts: `FORMAT_1_EVERY_KIND` bytes unchanged after open and list; the format-2 text after `add_note`;
  catches a load that rewrites or a write that keeps format 1); `a_range_survives_a_reload` (both-sides place through
  add, reopen, list); `a_newer_format_is_refused_and_left_unchanged` now with format 3; `add_thread_refuses_a_backward_place_and_writes_nothing`;
  the format-2 `EVERY_KIND` (one thread per end kind plus one both-sides range) byte-identical after refused
  operations (`note_edits.rs`, `threads.rs` existing assertions).
- `position` unit: `line_codes_number_a_line_as_gitlabs_parser_does` (removed in a mixed and in a pure removal, added in
  a mixed and in a pure addition, unchanged; the hash of the new path for a renamed file; catches partner numbers taken
  from the wrong side or 0-based); `a_range_body_has_line_range_and_names_its_end_line`; `a_one_line_body_has_no_line_range`;
  `a_draft_is_the_same_only_with_the_same_range_or_both_without`.
- `gitlab` unit: `drafts_read_back_their_line_range_or_none` (`null`, missing, a range, a malformed one → no place).
- `tests/review.rs` over the fake glab: `a_range_posts_both_ends_with_gitlabs_line_codes` (`tests/glab/line-range`: an
  in-column range and a both-sides range, full bodies: start `old`/end `new` for the both-sides one);
  `a_draft_stands_in_for_a_range_only_when_its_range_matches` (`tests/glab/line-range-drafted`); the existing
  `the_post_body_names_the_three_commits_and_the_position` unchanged (one-line bodies keep their shape).
- `src-tauri`: `a_range_thread_added_through_add_thread_comes_back_from_list_threads`; the `BackwardPlace` mapping in
  `ipc_error/tests.rs`.

**ipc (domain).** `reviewDomain.test.ts`: a place comes through with both ends, each number checked and named
(`threads[0].place.start.left`); `tauriReview.test.ts`: `addThread` hands the place as is; `fixtureReview.test.ts`:
seeded threads 0–5 with their places, `addThread` stores a place; `fixtureRange.test.ts`: every seeded place's ends sit
on board.ts lines as their kinds say (inside a difference or paired outside).

**editor (node).** `diffOrder.test.ts`: order lists an unchanged line once and a change's removed lines before its
added ones, including pure additions/removals at the file's start and end (catches added-before-removed or a skipped
line); `lineAtIndex` inverts `orderIndex` over every index of a fixture; `placeBetween` gives the same place up and
down and the end keeps its picked column; a one-column drag from an unchanged line to an added line covers the change's
removed lines; `shownEnd` stops before a collapsed run in both directions and over the wave; `placeSpans` and
`unchangedRuns` split at differences. `columnFolds.test.ts`: every unchanged line of a range stays shown under
collapse, split across a difference; overlapping ranges merge (catches lines of a long range hidden by a short one).
`threadTint.test.ts`: tinted lines and gutter cells get the class; a new set replaces the old. `threadRows.test.ts`: a
range's row sits under its end; two ranges ending on one line share a row. `threadNumbers.test.ts`: counts by the end;
a press on a number is a drag, on the badge a toggle.

**editor (WebKit, `rangeThreads.browser.test.ts`).** Press-release on one number starts a one-line thread on release
and nothing on press (replaces the test at `:297`); a drag over four right-column numbers across unchanged and added
lines tints them and the change's removed lines on the left, and starts the range on release; left removed → right
added starts a both-sides range, upwards the same; Escape mid-drag starts nothing and clears the tint; a scroll
mid-drag moves the end to the line under the pointer; a real drag (`userEvent.dragAndDrop`) leaves both columns'
selection collapsed; a drag stops at a wave; the pointer over a box tints its thread's lines and leaving clears them;
the badge still toggles; an added file's empty left column still starts nothing (`:368`).

**window (node).** `rangeThreadText.test.ts`: the four place texts above; `rangeThreads.test.ts`: the same range
focuses its draft, a range ending on the same line is a new draft; seeded counts 6; `rangeStore.test.ts`:
`askContext` gives the range's text; `firstMessage.test.ts`: the default text; `useRangeController.test.ts`:
`startThread(place)` makes a draft with that place.

**Existing single-line tests that change, and why.** Every Rust test naming `ThreadLine` as a thread's `line`
(`position.rs` tests, `thread_file.rs` tests, `waiting.rs` tests, `tests/{review,threads,note_edits}.rs`,
`stored_threads/mod.rs`, `src-tauri/src/review/tests.rs`): the field is `place`. `threads.rs:61-103` (format 1 round
trip) becomes the format step test; `:115-127` uses format 3. Web: `reviewDomain`, `tauriReview`, `fixtureReview`,
`fixtureRange`, `threadAnchor`, `threadRows`, `threadNumbers`, `columnFolds`, `rangeThreads.browser`, `rangeThreads`,
`rangeThreadText`, `rangeStore`, `rangeAi`, `useRangeController`, `firstMessage` tests: `line` → `place` (a one-line
place built with `onePlace`), the press test now releases.

**WebKit and real-app acceptance (verify).** Display numbers on board.ts: see `line-ranges-verify.md` (drags on
`d2`: R201–R204 and L200 → R204; the wave after `d0` at R25; seeded threads 4 and 5).

## 4. Proposed `docs/plan.md` §2 rows (DR5; text for the orchestrator)

- **145 — A thread sits on a range of lines chosen by dragging over the line numbers** (owner 2026-10-31, #2051, #2052;
  request `docs/slices/request-line-ranges.md` rules 1–10; design `briefs/line-ranges-design.md` option A). The anchor is
  `ThreadPlace { start: DiffLine, end: ThreadLine }` (amends #116's `ThreadLine` anchor): `DiffLine` = `Removed { left }
  | Added { right } | Unchanged { left, right }`, `end` today's `ThreadLine` deciding the box's column; a one-line thread
  is a place whose start is its end's line. GitLab's one-column order over the two columns (an unchanged line once, a
  change's removed lines then its added ones) is one pure editor module, `diffOrder.ts`; a gutter press starts a drag
  (document listeners: move, column scroll, Escape cancels, release starts the thread; the badge keeps its toggle); the
  range stops at a collapsed run; the box and badge sit on `end`; the tint (selection colour, both columns) shows the
  drag, every draft and the thread whose box the pointer is over, the hover read from the editor's own hosts; a range's
  unchanged lines are run edges, merged when they overlap (amends #126's one-line run edges). Rejected: every end with
  GitLab's two numbers (option B: format-1 lines have no partner without reading git at open); a range beside the line
  (option C: two shapes, a second value for one line). Visions 4, 2, 1.
- **146 — `threads.json` format 2** (amends #117/#120's format 1). Format 1 reads as one-line places and is never
  rewritten by a read; the first change writes format 2; an older yamt refuses format 2 by name, untouched (#120); a
  place running backwards on a shared side is refused at add (`BackwardPlace`) and `Broken` at read. Rejected: a new
  field in format 1 (an older yamt drops it on rewrite); writing format 1 while no range exists (two writers of the
  file's shape). Visions 4, 2.
- **147 — A range posts as GitLab's multi-line comment** (amends #118's body). `position[line_range]` with `start` and
  `end` `{ line_code, type?, old_line?, new_line? }`, the position's `old_line`/`new_line` naming the end;
  `line_code` = `<sha1 of the new path>_<old>_<new>` with GitLab's parser numbers (an added line carries the old number
  of the line after its change, a removed one the new number of its change's first added line;
  `lib/gitlab/git.rb:113-115`, `lib/gitlab/diff/parser.rb:52-64`, `lib/gitlab/diff/file.rb:253-255` at `v19.3.2-ee`),
  computed from `Range::load`'s differences at send; `type` `old`/`new`, left out for an unchanged end (GitLab's own form;
  decided by the orchestrator); a draft stands in only when its range matches too, a draft without a range only for a one-line
  message. New crate `sha1` 0.10 in `yamt-review` (amends §7): the stack has no SHA-1. Rejected: computing line codes in
  the window (GitLab's encoding stored with the thread); sending no `line_code` (GitLab tints the range by it). Visions
  2, 5.
- **148 — Defaults decided with the line-range design** (orchestrator, OR13; the owner may veto): in the strip, the
  pointer belongs to the column of its half; over a thread row, below the last line or in an empty column, the other
  column's line at that height; Escape during a drag is taken by the drag alone; the tint is a layer over the
  difference colours; a drag past the column's edge waits for the wheel (no automatic scroll); the place-text wording of
  `line-ranges-design.md` §1.

## 5. Proposed risk-register rows

| id   | risk                                                                                                                                                                                                                | owner                                                                                                      | proving test                                                                                                                                                                                                |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| RK48 | a posted range's `line_code` names other rows than GitLab's (partner numbers from the wrong side, 0-based, the old path hashed for a rename, or GitLab's hunks cut a change differently than `merge_core::compare`) | `yamt-review` `position` `multi_line` (numbers from `Range::load`'s differences, GitLab's parser rule)     | `line_codes_number_a_line_as_gitlabs_parser_does`, `a_range_posts_both_ends_with_gitlabs_line_codes`; owner check on the playground (a different hunk cut is accepted: the note still sits on its end line) |
| RK49 | a range turns into its end line or a file becomes unreadable (an older yamt rewrites a range file; a backward place written)                                                                                        | `yamt-review` `thread_file` (format 2; format 1 read-only until a change) + `add_thread` (`BackwardPlace`) | `a_format_1_file_reads_as_one_line_places_and_is_written_as_format_2_by_the_first_change`, `a_newer_format_is_refused_and_left_unchanged`, `add_thread_refuses_a_backward_place_and_writes_nothing`         |
| RK50 | a drag selects text, reveals hidden lines, crosses a collapsed run, or leaves a listener behind                                                                                                                     | `editor/internal/threadDrag.ts` + `diffOrder.ts` `shownEnd`                                                | WebKit `a drag selects no text in either column`, `a drag stops at a collapsed run's wave`, `Escape mid-drag starts nothing`; `shownEnd` node tests                                                         |
| RK51 | a range's unchanged lines hide under collapse (a run edge kept as one line, or two overlapping ranges)                                                                                                              | `editor/internal/columnFolds.ts` (`unchangedRuns`, merged)                                                 | `columnFolds.test.ts` "every unchanged line of a range stays shown…", "overlapping ranges merge…"                                                                                                           |

## 6. Doc updates for the docs keeper (after the builds)

`docs/architecture.md` §3.8 `review` paragraph (`:621-625`: `ThreadPlace`, format 2, the multi-line body); project map
`tree.md` rows for `crates/review` (`:58-63`), `ipc/threadLine.ts` (`:139`) and the three new editor files (`diffOrder.ts`,
`threadDrag.ts`, `threadTint.ts`: PM6, `just map-check` fails without them); `skill://ipc-contract` line 85
(`add_thread(file, place: ThreadPlace, text)`); the risk rows above; plan rows above.
