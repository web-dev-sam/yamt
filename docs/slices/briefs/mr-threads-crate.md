# Slice mr-threads-crate — turn data, the thread read, the viewer's drafts, four writes and the preview (Rust)

Feature: whose turn it really is, the whole thread beside the box, answering it, and sized images. Sources:

- Request `docs/slices/request-mr-threads.md`: B (the data the rule needs), C3–C5, C7–C10 (the Rust side), D (one row
  reloads alone), the Rust acceptance.
- Design `docs/slices/briefs/mr-threads-design.md` option A, §1.2–§1.4, §3.1 rows #179–#182, §3.2, §4 items 3, 4, 6.
- Proposed plan §2 #179–#182; RK54, RK60, RK61 (amended); RK71.

Runs in wave 3, after `mr-threads-fixtures`, `mr-threads-http` and `mr-threads-images` are committed. `mr-threads-app`
builds the commands on this slice.

## Target

**Owned:**

- `crates/merge-requests/src/**` **except** `src/description.rs` and `src/description/**`: in particular `lib.rs`,
  `query.rs`, `query/tests.rs`, `project.rs`, `page.rs` (if a helper is needed), `discussions.rs`,
  `discussions/answer.rs`, `discussions/tests.rs`, `discussions/mentions.rs` (new), `discussion_thread.rs` (new),
  `discussion_thread/read.rs`, `discussion_thread/drafts.rs`, `discussion_thread/write.rs`,
  `discussion_thread/tests.rs` (new), `markdown_preview.rs` (new)
- `crates/merge-requests/tests/discussions.rs`, `crates/merge-requests/tests/threads.rs` (new)
- `crates/merge-requests/AGENTS.md`
- `crates/merge-requests/src/description.rs`, its re-export line only (amended after `mr-threads-images`, `03bee845`:
  it re-exports only `ImageSize`, because `ImageLength` unused there fails `-D unused-imports`; change it to
  `pub use size::{ImageLength, ImageSize};` when `lib.rs` re-exports both). Images' note also lists a line for this
  crate's `AGENTS.md` (`.omp/run/notes/MrThreadsImages.md`, deviations): apply it with yours.

**Read-only:** everything else.

- `src/description.rs`, `src/description/**`: `mr-threads-images`'. Use `described_on` (`description.rs:326`), the
  `Described` fields and `ImageSize`/`ImageLength` as they are; re-export the two size types from `lib.rs` here.
- `crates/gitio/**`: use `Glab::get`, `Glab::post`, `Glab::send`, `HttpCall`, `HttpAnswer` (`mr-threads-http`) as
  contracted.
- `crates/merge-requests/Cargo.toml`: no dependency is added (`dom_query`, `serde_json`, `url` are already the crate's).
- `tests/glab/**`, `scripts/fake-glab/glab`, `crates/merge-requests/tests/fake_glab/**`: `mr-threads-fixtures`' and
  shared; ask the orchestrator for a fixture change.
- `src-tauri/**`: `mr-threads-app`'s. `read_discussions` keeps its signature; the app compiles unchanged except where
  its tests build `OpenDiscussion`/`DiscussionNote` (they are `mr-threads-app`'s).
- `docs/**`: lines in `deviations_from_brief`.

**Non-goals:** starting a discussion, editing or deleting a comment, reactions, approvals or `reviewer_state` (request
non-goals); any write other than the four; rendering drafts (design §4 item 3); timing or caching in Rust (the window
asks afresh).

## Contract

Fixed; you may add, never change. IPC types derive `Clone, Debug, PartialEq, Eq, Serialize, Type` (plus `Deserialize`
where the window sends them), carry `#[serde(rename_all = "camelCase")]`, enums with payloads `tag = "kind"`, unit-only
enums serialize as camelCase strings; each is documented as its neighbours; every one is re-exported from `lib.rs`.

### Turn data (`discussions.rs`, `discussions/mentions.rs`; row #179)

```rust
/// A discussion's id: GitLab's 40 lowercase hex digits, the REST routes' `:discussion_id` (from GraphQL
/// `gid://gitlab/Discussion/<hex>`). The window sends it back; nothing else deserializes.
#[derive(Clone, Debug, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize, Type)]
#[serde(try_from = "String", into = "String")]            // specta: a string
pub struct DiscussionId(String);
impl DiscussionId {
    pub(crate) fn from_gid(gid: &str) -> Option<DiscussionId>;   // the prefix and 40 [0-9a-f] only
    #[must_use] pub fn as_str(&self) -> &str;
}
impl TryFrom<String> for DiscussionId { type Error = String; } // "not a discussion id"

pub struct OpenDiscussion {
    pub id: DiscussionId,
    /// Where it is: the first person note's `position` (GitLab's place of the discussion).
    pub place: DiscussionPlace,
    /// Every person note before `last`, oldest first: `earlier[0]` (or `last` when empty) started the discussion.
    pub earlier: Vec<TurnComment>,
    /// Its last person note.
    pub last: DiscussionNote,
}
pub struct TurnComment { pub author: Option<Person>, pub mentions: Vec<Mention> }
pub struct DiscussionNote {
    pub author: Option<Person>, pub created_at: String, pub text: String, pub page: Option<WebPage>,
    /// The users the note mentions (new).
    pub mentions: Vec<Mention>,
}
/// A user GitLab linked as a mention in a note: `a[data-reference-type="user"][data-user]` of its `bodyHtml`.
pub struct Mention {
    /// The `href`'s last path segment, when it is `[A-Za-z0-9_.-]+` (else the link is not a mention).
    pub username: String,
    /// The link's `title` (GitLab's name of the user), else the username.
    pub name: String,
}
/// Pure: the mentions of one note's HTML, in document order, each username once; never a link with `data-group`
/// or `data-project` (a group, `@all`), never text (code spans render as `<code>`, no link, design §1.2).
pub(crate) fn mentions_in(html: &str) -> Vec<Mention>;

/// The most notes read per discussion: `Discussion.notes`' `max_page_size` (facts §5).
pub(crate) const NOTES_READ: u32 = 200;
```

- `DISCUSSION_BATCH` stays 20 unless step 1 measures more than 10 s for 20 busy rows logged in; then 10 (its doc
  comment carries the measurement).
- An open discussion (resolvable and unresolved) with `notes.pageInfo.hasNextPage` fails its row: `Failed { message:
  "a discussion has more than 200 notes; yamt reads no further" }`. One with no person note is left out. Today's
  "last 20 all GitLab's own" error and `hasPreviousPage` go.
- The place is now the **first** person note's position (today: the last's, `discussions.rs:308`); `last.page` stays
  the last person note's page.
- Mentions for `earlier` and `last` come from each person note's `bodyHtml` (`mentions_in`); system notes are never
  read for anything (RK61).

### The query (`query.rs`)

`discussions_query` becomes, as one line (design §1.2; 88 of 200 for 20 rows logged out, measured):

```
query MergeRequestDiscussions($fullPath: ID!, $iids: [String!], $first: Int!, $discussionsAfter: String) {
 queryComplexity { score limit } project(fullPath: $fullPath) { mergeRequests(iids: $iids, first: $first) { nodes {
 iid discussionLocked userPermissions { createNote } discussions(first: 100, after: $discussionsAfter) {
 pageInfo { hasNextPage endCursor } nodes { id resolvable resolved userPermissions { resolveNote }
 notes(first: 200) { pageInfo { hasNextPage } nodes { system author { username name avatarUrl } body bodyHtml
 createdAt lastEditedAt lastEditedBy { username name avatarUrl } url position { filePath newLine oldLine } } } } } } } } }
```

Its doc comment carries the measured scores (88 for 20 rows logged out; step 1's logged-in score and time). New
argument builders, each returning `Vec<String>`, `<p>` the project's full path with every `/` as `%2F`, `<d>` the
discussion id's hex:

| fn                                            | args                                                                                               | stdin body (`serde_json`)                                                                      |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `draft_notes_args(full_path, iid)`            | `api --paginate projects/<p>/merge_requests/<iid>/draft_notes`                                     | —                                                                                              |
| `reply_args(full_path, iid, &DiscussionId)`   | `api --include --method POST projects/<p>/merge_requests/<iid>/discussions/<d>/notes --input -`    | `reply_body(text)` = `{"body": text}`                                                          |
| `draft_reply_args(full_path, iid)`            | `api --include --method POST projects/<p>/merge_requests/<iid>/draft_notes --input -`              | `draft_reply_body(text, &DiscussionId)` = `{"note": text, "in_reply_to_discussion_id": "<d>"}` |
| `resolve_args(full_path, iid, &DiscussionId)` | `api --include --method PUT projects/<p>/merge_requests/<iid>/discussions/<d> --input -`           | `resolve_body(resolve)` = `{"resolved": resolve}`                                              |
| `submit_review_args(full_path, iid)`          | `api --include --method POST projects/<p>/merge_requests/<iid>/draft_notes/bulk_publish --input -` | `{}` (never `reviewer_state`, request non-goal)                                                |
| `markdown_args()`                             | `api --method POST markdown --input -`                                                             | `markdown_body(text, full_path)` = `{"text": text, "gfm": true, "project": full_path}`         |

Routes from `docs.gitlab.com/api/discussions` ("POST …/discussions/:discussion_id/notes", "PUT
…/discussions/:discussion_id" with `resolved`), `/api/draft_notes` (create with `in_reply_to_discussion_id`,
`bulk_publish`), `/api/markdown` (`text`, `gfm`, `project`; answers `{ "html" }`).

### The thread (`discussion_thread.rs`, `discussion_thread/read.rs`, `discussion_thread/drafts.rs`; row #180)

```rust
pub enum DiscussionThreadReply {                       // tag = "kind"
    Read { thread: DiscussionThread },
    /// The merge request answered, without this discussion (deleted, or never there).
    NotFound,
    GlabMissing,
    NotLoggedIn { detail: String },
    /// glab's or GitLab's words, `page.rs` NO_PROJECT, or the 200-note rule's sentence.
    Failed { message: String },
}
pub struct DiscussionThread {
    /// The same turn data the box gets, built by the same function (resolved or not).
    pub discussion: OpenDiscussion,
    pub resolved: bool,
    /// Every person note, oldest first; never empty (the discussion has one). System notes left out (RK61).
    pub comments: Vec<DiscussionComment>,
    /// The viewer's pending drafts in this discussion, in GitLab's order.
    pub drafts: Vec<PendingDraft>,
    /// All the viewer's pending drafts on this merge request (C9).
    pub pending: u32,
    pub commenting: Commenting,
    /// `Discussion.userPermissions.resolveNote`, and the discussion resolvable.
    pub may_resolve: bool,
}
pub struct DiscussionComment {
    pub author: Option<Person>,
    pub created_at: String,
    /// Edited as GitLab's `Note#edited?` means it: `lastEditedBy` a person and `lastEditedAt` after `createdAt`
    /// (`app/models/note.rb:533-545`; resolving moves `lastEditedAt` alone, measured, design §1.3).
    pub edited: Option<NoteEdit>,
    /// GitLab's `bodyHtml` reduced by `described_on` on the merge request's page (RK60, RK66: no other path).
    pub body: Description,
    pub page: Option<WebPage>,
}
pub struct NoteEdit { pub at: String, pub by: Person }
/// A draft's raw text as written (GitLab's draft list sends no rendering; design §4 item 3).
pub struct PendingDraft { pub text: String }
pub enum Commenting { Allowed, Locked, NotAllowed }    // "allowed" | "locked" | "notAllowed"
// createNote true → Allowed; false with discussionLocked → Locked; false → NotAllowed.

/// Not IPC: what the shell offers before it replies (RK41, RK53).
pub struct ReadThread {
    pub reply: DiscussionThreadReply,
    /// Every comment's page and every link's page of every comment, once each, in order.
    pub pages: Vec<WebPage>,
    /// Every upload the comments name, once each.
    pub uploads: Vec<OfferedUpload>,
    /// The uploaded pictures of the comments' and editors' authors, one per username.
    pub pictures: Vec<OfferedPicture>,
}

/// glab missing → GlabMissing; `logged_in_project`; the discussions query for `[iid]` with its later pages (the
/// same code as `read_discussions`, the `Fetch` seam `discussions.rs:111`); the discussion with `id`; then one
/// `Glab::get` of `draft_notes_args` (`--paginate`: one JSON array or one per page, as `yamt-review`'s
/// `draft_notes_from`). A draft counts for `drafts` when its `discussion_id` is `id`'s hex; every draft counts for
/// `pending`. The batch failing, the merge request missing, the 200-note rule or the draft list failing → Failed.
/// `pages`/`uploads`/`pictures` empty unless Read. One `tracing::info!`: iid, outcome, comments, drafts, pending,
/// pages, uploads, queries; never a name, text or address.
pub fn read_discussion_thread(repository: &GitLabRepository, glab: Option<&Glab>, iid: MergeRequestIid,
    discussion: &DiscussionId) -> ReadThread;
```

### The writes (`discussion_thread/write.rs`; row #181)

```rust
pub enum ReplyKind { Comment, Draft }                  // "comment" | "draft"; Deserialize too
pub enum DiscussionWriteReply {                        // tag = "kind"
    Sent,
    /// GitLab answered 4xx: `HttpAnswer::reason()` (its `message`/`error`, glab's line, `HTTP <code>`); also a
    /// blank text, before any glab run: "There is nothing to send."
    Refused { reason: String },
    GlabMissing,
    NotLoggedIn { detail: String },
    /// No HTTP answer (glab failed, timed out), a 5xx or another status (its reason), or NO_PROJECT.
    Failed { message: String },
}
pub fn reply_to_discussion(repository: &GitLabRepository, glab: Option<&Glab>, iid: MergeRequestIid,
    discussion: &DiscussionId, kind: ReplyKind, text: &str) -> DiscussionWriteReply;
pub fn resolve_discussion(repository: &GitLabRepository, glab: Option<&Glab>, iid: MergeRequestIid,
    discussion: &DiscussionId, resolve: bool) -> DiscussionWriteReply;
pub fn submit_review(repository: &GitLabRepository, glab: Option<&Glab>, iid: MergeRequestIid) -> DiscussionWriteReply;
```

- Each is: (blank check for replies: `text.trim().is_empty()` → Refused, no glab) → glab missing → `logged_in_project`
  → **exactly one** `Glab::send(root, args, Some(body))` (RK54). The text is sent as written (not trimmed).
- Mapping: `Answered` 2xx → Sent (the body is not read); 4xx → Refused; other → Failed(reason); `NotAnswered(m)` →
  Failed(m).
- One `tracing::info!` per write: iid, kind (`comment`/`draft`/`resolve`/`unresolve`/`submit`), outcome, the HTTP
  status when answered; never the text, a name or the discussion id.

### The preview (`markdown_preview.rs`; row #182)

```rust
pub enum MarkdownPreviewReply {                        // tag = "kind"
    Read { preview: Description },
    GlabMissing,
    NotLoggedIn { detail: String },
    Failed { message: String },
}
/// Not IPC.
pub struct ReadPreview { pub reply: MarkdownPreviewReply, pub pages: Vec<WebPage>, pub uploads: Vec<OfferedUpload> }
/// A blank text → Read with no blocks and no glab run. Else glab missing → GlabMissing; `logged_in_project`; one
/// `Glab::post(root, markdown_args, markdown_body)`; `Err` → Failed; the answer's `html` (a string) through
/// `described_on(project, iid, html)`, else Failed "GitLab's preview is not JSON with html". Never a write: no
/// `--include`, nothing counted (RK54). One `tracing::info!`: iid, outcome, blocks, pages, uploads.
pub fn preview_markdown(repository: &GitLabRepository, glab: Option<&Glab>, iid: MergeRequestIid, text: &str)
    -> ReadPreview;
```

`project.rs` gains `From<NoProject>` for `DiscussionThreadReply`, `DiscussionWriteReply`, `MarkdownPreviewReply` as
for the other replies.

## Change

1. **Measure first**, read-only, with the logged-in glab in `../glab-yamt-playground` (as `briefs/mr-people-rust.md`
   step 1). Paste each result; write nothing to GitLab.
   - `time glab api graphql -f query='<the new query>' -f fullPath=gitlab-org/gitlab -F 'iids=[<20 busy open iids,
     e.g. those of design §1.2>]' -F first=20 | wc -c` and its `queryComplexity`: the score logged in, the bytes, the
     wall time. Over 10 s → `DISCUSSION_BATCH = 10`.
   - The same for one merge request of the playground with a discussion: the edited fields and `userPermissions` as
     the logged-in user.
   - `glab api --paginate projects/<playground path %2F>/merge_requests/<iid>/draft_notes`: the shape (`id`,
     `discussion_id`, `note`).
   - `printf '{"text":"**x** @<you>","gfm":true,"project":"<playground path>"}' | time glab api --include --method
     POST markdown --input -`: the status (201), `{ "html" }`, the time.
2. `discussions/mentions.rs`; `discussions.rs` (id, first-note place, `earlier`, mentions, the 200 rule) and
   `answer.rs` (the new fields, the merge request's permissions beside its connection); `query.rs` and its tests;
   existing unit and integration tests updated to the new shape.
3. `discussion_thread.rs` with `read.rs`, `drafts.rs`, `write.rs`, `tests.rs`; `markdown_preview.rs`;
   `project.rs`; `lib.rs` re-exports (also `ImageSize`, `ImageLength`, `DiscussionId`, `Mention`, `TurnComment`).
4. `tests/discussions.rs` (updated) and `tests/threads.rs` over the fake.
5. `AGENTS.md`: the turn data, the 200 rule, the thread read, drafts, the four writes and their routes, the preview.

## Acceptance

**Tests** (`cargo nextest run -p yamt-merge-requests`, hermetic prefix), each named for the bug it catches, at least:

- unit (`discussions/tests.rs`, `discussion_thread/tests.rs`, `query/tests.rs`, inline JSON and the `Fetch` seam):
  - `only_a_user_link_with_data_user_is_a_mention` (RK71: group `data-group`, `@all` `data-project`, a `<code>@sam`,
    plain text `@sam`, an `href` with a bad segment → none; order and once-each kept; the `title` as name)
  - `earlier_holds_every_person_note_before_the_last_oldest_first`, `system_notes_count_in_no_turn` (RK61)
  - `the_place_is_the_first_person_notes`
  - `a_discussion_over_200_notes_fails_its_row` (RK71), `a_discussion_id_is_40_hex_or_nothing`
  - `a_comment_is_edited_only_when_gitlab_names_an_editor_after_creation` (`lastEditedAt == createdAt` → none;
    later with `lastEditedBy: null` (a resolve) → none; later with a person → `NoteEdit`)
  - `a_comments_html_reaches_the_window_only_as_blocks` (RK60), `a_planted_handler_in_a_comment_is_left_out` (RK66)
  - `a_notes_image_keeps_its_size` (A via `described_on`)
  - `a_thread_answered_without_its_discussion_is_not_found`, `a_resolved_discussions_thread_reads_resolved`
  - `commenting_is_allowed_locked_or_not_allowed_as_gitlab_says`
  - `drafts_of_this_discussion_show_and_every_draft_counts`, `paginated_drafts_are_read_page_by_page`
  - `each_write_sends_one_call_with_its_body` (RK54: argv and stdin JSON of all five, `%2F` path, `reviewer_state`
    absent), `an_empty_reply_runs_no_glab`, `a_4xx_is_refused_with_gitlabs_reason`, `no_http_answer_or_a_5xx_fails`
  - `a_blank_preview_runs_no_glab`, `a_previews_html_is_described_on_the_merge_requests_page`
- `tests/discussions.rs` over `Fake::new("mr-discussions")` (updated) and `Fake::new("mr-threads")`:
  - `a_listed_rows_turn_data_arrives_with_starter_comments_and_mentions` (!90: d01's `earlier` anna, sam, dmitri and
    `last` anna; d04's `earlier[0].mentions` `[sam]`; d12's mentions empty) — **the acceptance's turn data**
  - `one_row_reloads_alone` (`read_discussions(&[90])` → exactly one `graphql-discussions-90` call in the log, one row)
  - the existing tests, adjusted to the new shape
- `tests/threads.rs` over `Fake::new("mr-threads")` / `("mr-threads-refused")`:
  - `a_thread_comes_back_whole_with_edits_and_the_viewers_drafts` (d01: four comments, the system note left out,
    anna edited by herself, sam's edited by dmitri, drafts `[501's text]`, pending 2, may resolve, allowed)
  - `reading_a_thread_writes_nothing` (the state file stays absent or 0), `a_preview_writes_nothing`
  - `each_write_is_one_post` (posts 1–5 in order, the calls log names each endpoint once)
  - `a_refused_write_carries_gitlabs_reason` (403 "403 Forbidden", 400 "note is missing"),
    `a_write_without_an_answer_fails` (post-3), `a_5xx_fails` (post-4)
  - `a_locked_merge_request_may_not_be_commented` (!91 → `Locked`; d14 `may_resolve` false)

**Commands:** `cargo fmt --all --check`; `cargo clippy --workspace --all-targets -- -D warnings`; `cargo nextest run -p
yamt-merge-requests -p yamt-app` with the hermetic prefix as `just test` (the app's tests that build the changed
structs may need `mr-threads-app`; if they fail to compile, say which in `deviations_from_brief` and stop there);
`just mutants HEAD`.

**Smoke:** the step-1 measurements, pasted; no window change here.

## Skills

`skill://rust-conventions`, `skill://risk-register` (RK54, RK60, RK61, RK66, RK71), `skill://verification`,
`skill://ipc-contract` (new IPC types, a `Deserialize` id at the boundary; bindings regenerate after the app slice).
