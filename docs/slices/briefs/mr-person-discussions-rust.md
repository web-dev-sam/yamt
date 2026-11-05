# Slice mr-person-discussions-rust — the first comment's formatted text and time in the discussions read

Feature: one person's discussions across every merge request. Sources:

- Request `docs/slices/request-mr-person-discussions.md` D1, D2, and the acceptance's "Rust against the fake glab" sentence.
- Design `docs/slices/briefs/mr-person-discussions-design.md` option A §2.1; proposed plan row #193, RK41/RK53 amended.

Runs in round 1, in parallel with `mr-person-discussions-core` and `mr-person-discussions-threads`. It wires no window.
After it the orchestrator runs `just bindings` and hands `frontend/src/ipc/bindings.ts` to `mr-person-discussions-ipc`
(the frontend type check is red until that slice lands: commit them together).

Facts (given):

- The discussions query reads every note's `body` and `bodyHtml` (`crates/merge-requests/src/query.rs:148-159`); the
  parsed `NoteNode` keeps `body` and `body_html` (`discussions/answer.rs:75-86`); `open_discussion` keeps for the last note
  only its raw `body` (`discussions/turn.rs:44-82`). No query change is needed.
- `open_discussion` is the one builder of `OpenDiscussion`: the box, a row's reload and the thread (`DiscussionThread.
  discussion`, `discussion_thread/read.rs` `thread_from`) (`docs/architecture.md:1026`).
- A thread comment's body is `described_on(project, iid, note.body_html…)` (`description.rs:329-335`, returns
  `Described { description, pages, uploads, … }`, `description/html.rs:30`); `comments_of` (`discussion_thread/read.rs`)
  collects every page (the note's own, then its links') and every upload once each, in order.
- The shell: `discussions_reply` offers each answered `last.page` and `read.pictures` before returning the rows
  (`src-tauri/src/merge_requests/discussions.rs:9-26`); `offer` (`merge_requests.rs:99-106`) and `offer_described`
  (`:110-113`, pages then `pictures.offer_uploads`) are the offer paths (RK41, RK53).
- Fake glab: `tests/glab/mr-discussions/` holds the batch 82-81-79-78, !81 alone, a later page `79-after-d-2`, a failing
  77 and anna's picture; uploads are served as `tests/glab/README.md:265-268` and `:319-321` describe (the uploads API
  path `uploads/7/uploads/<hex>/<file>`).
- Measured (architecture.md:1017-1022): the query with `bodyHtml` 23.5 s / 2.7 MB for 10 busy rows, 19.7 s without; so
  carrying the described starter costs GitLab nothing more.

## Target

**Owned:**

- `crates/merge-requests/src/discussions.rs`, `crates/merge-requests/src/discussions/turn.rs`,
  `crates/merge-requests/src/discussions/offers.rs` (new), `crates/merge-requests/src/discussions/sample.rs`,
  `crates/merge-requests/src/discussions/tests.rs`
- `crates/merge-requests/src/discussion_thread/read.rs`, `crates/merge-requests/src/discussion_thread/tests.rs`
- `crates/merge-requests/src/lib.rs` (the re-export only)
- `crates/merge-requests/tests/discussions.rs`, `crates/merge-requests/tests/discussion_thread*.rs` (expected values only)
- `tests/glab/mr-discussions/**`, `tests/glab/README.md` (the `mr-discussions/` paragraph)
- `src-tauri/src/merge_requests/discussions.rs`, `src-tauri/src/merge_requests/tests/discussions.rs`,
  `src-tauri/src/merge_requests/tests/discussion_thread.rs` (expected values only)

**Read-only:** everything else. `frontend/**` (the bindings come from the orchestrator's `just bindings`; run it locally
only to read the generated names, never commit `bindings.ts`); `docs/**`, `.omp/skills/**` (lines in
`deviations_from_brief`; the docs keeper writes architecture §3.9 and §4).

**Non-goals:** any frontend change; a new command; a new query field; times of the later comments (the pictures row
needs only their order, already in `earlier` + `last`).

## Contract

Fixed. You may add, never change.

```rust
// discussions.rs — beside OpenDiscussion
/// The note that started a discussion, as the person view shows it.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct FirstComment {
    /// When it was written: GitLab's ISO 8601 time, as sent.
    pub created_at: String,
    /// Its `bodyHtml` reduced by `described_on` on the merge request's page (RK60, RK66: no other path).
    pub body: Description,
}

pub struct OpenDiscussion {
    pub id: DiscussionId,
    pub place: DiscussionPlace,
    /// The first person note (`earlier[0]`, else `last`): its time and its rendering.
    pub first: FirstComment,
    pub earlier: Vec<TurnComment>,
    pub last: DiscussionNote,
}

pub struct ReadDiscussions {
    pub rows: Vec<RowDiscussions>,
    pub pictures: Vec<OfferedPicture>,
    /// Every answered last note's page, then every page its first comment links, once each, in order.
    pub pages: Vec<WebPage>,
    /// Every upload the first comments name, once each.
    pub uploads: Vec<OfferedUpload>,
}

// discussions/offers.rs — the one "each once, in order" collector (the discussions read and the thread read)
pub(crate) struct Offers { pub(crate) pages: Vec<WebPage>, pub(crate) uploads: Vec<OfferedUpload> }
impl Offers {
    pub(crate) fn new() -> Self;
    /// Adds `page` unless it is already there.
    pub(crate) fn page(&mut self, page: WebPage);
    /// Adds `described`'s pages and uploads (an upload once per key) and gives back its description.
    pub(crate) fn described(&mut self, described: Described) -> Description;
}

// turn.rs
pub(crate) fn open_discussion(
    id: DiscussionId,
    notes: Vec<NoteNode>,
    iid: MergeRequestIid,
    project: &Project,
    people: &mut People,
    offers: &mut Offers,
) -> Option<OpenDiscussion>;
```

`lib.rs` re-exports `FirstComment` beside `OpenDiscussion`. The TS side (by `mr-person-discussions-ipc`) will read
`first: { createdAt: number; body: Description }`.

## Change

1. `offers.rs`: `Offers` per the Contract.
2. `open_discussion`: build `first` from the starter (`earlier[0]`, else `last`) before the notes are consumed:
   `created_at` as sent, `body` = `offers.described(described_on(project, iid, starter.body_html…unwrap_or_default()))`.
   Push `last.page` (when `Some`) through `offers.page` too, so `pages` holds the last pages first in answer order, as the
   shell offered them before.
3. `read_discussions` (`answered`): one `Offers` per call; `ReadDiscussions { rows, pictures, pages, uploads }`; `unanswered`
   gives empty `pages`/`uploads`. The `info` line adds `pages` and `uploads` counts (never an address).
4. `discussion_thread/read.rs`: `comments_of` collects through the same `Offers` (its two dedupe loops removed, clean
   cutover); `thread_from` passes that `Offers` to `open_discussion` (the starter described twice dedupes to one offer).
   `Read.pages`/`uploads` come from it. The thread's `discussion.first` is therefore present.
5. Shell `discussions_reply`: offer `read.pages` with `read.pictures` (`offer`), then `read.uploads`
   (`state.pictures.offer_uploads`), before returning the rows; the `open_discussions` helper goes.
6. Fake glab `tests/glab/mr-discussions/`: in the batch file, give one discussion with two or more notes a first note whose
   `bodyHtml` holds a link to an issue page of the project and an upload image (the uploads-API form of
   `README.md:265-268`, its file under `uploads/7/uploads/<hex>/`); document it in `README.md`.
7. Update every expected `OpenDiscussion` JSON (crate and shell tests) with `first`.
8. Measure: the fake batch's reply bytes (`serde_json::to_vec(&rows).len()` for `[82, 81, 79, 78]`) before your change
   and after; paste both in `smoke_evidence`.

## Acceptance

**Tests** (`cargo nextest run -p yamt-merge-requests -p yamt-app` with the hermetic prefix), each named for the bug it
catches:

- `each_discussion_carries_its_first_comment_in_one_read` (shell, `run_with_fakes` over `mr-discussions`): for the batch,
  every discussion's `first.createdAt` is its first person note's and `first.body` is that note's reduction; exactly one
  `argv: api graphql` line for the batch.
- `a_first_comments_link_and_upload_are_offered_before_the_reply` (shell, RK41, RK53): before the read the link does not
  open (`notOffered`) and the upload's `yamt-picture://…/upload~<key>` answers 404; after it the link opens and the upload
  answers 200 with the file's bytes.
- `a_single_note_discussion_starts_with_its_last_note` (crate): `earlier` empty → `first` is `last`'s time and rendering.
- `the_first_comment_goes_through_the_description_reducer` (crate, RK60/RK66): a planted `<script>`/`onerror` in a first
  note's `bodyHtml` appears nowhere in `first.body`.
- `offers_keep_each_page_and_upload_once_in_order` (crate, `Offers`).
- `the_thread_read_carries_first_and_offers_each_page_once` (crate thread tests): `thread.discussion.first` equals the
  first comment's body; `pages`/`uploads` unchanged from before (same order, no duplicates).
- The log test: the `info` line gains `pages` and `uploads`, still no name, body or address.

**Commands:** `cargo fmt --all --check`; `cargo clippy --workspace --all-targets -- -D warnings`; the nextest run above;
`just bindings` locally (report the new generated names: `FirstComment`, `OpenDiscussion.first`); `just mutants HEAD`.

**Smoke:** the `run_with_fakes` tests are the shell's end-to-end proof (the window does not read `first` yet). Paste the
reply-size measurement (step 8).

## Skills

`skill://rust-conventions`, `skill://ipc-contract` (a new IPC type; bindings regenerate after this slice),
`skill://risk-register` (RK41, RK53, RK60, RK61, RK66), `skill://verification`.
