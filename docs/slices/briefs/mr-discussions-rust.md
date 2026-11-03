# Slice mr-discussions-rust — open discussions with their last person's note, 20 rows per call; the setting

Feature: whose turn it is, per open discussion. Sources:
- Request `docs/slices/request-mr-discussions.md`: rules 2, 4, 6, 7, 8 and the Rust acceptance.
- Design `docs/slices/briefs/mr-discussions-design.md` option A, §1.1, §1.2, §1.5, §1.6, §1.8, §1.10.
- Proposed plan §2 #162, #163; proposed RK60, RK61; existing RK41 and RK53.

Runs beside `mr-discussions-core`. After it lands the orchestrator runs `just bindings`.

## Target

**Owned:**
- `crates/merge-requests/**`
- `crates/settings/**`
- `src-tauri/src/merge_requests.rs`, `src-tauri/src/merge_requests/**`
- `src-tauri/src/settings.rs`
- `src-tauri/src/commands.rs` (the command list only)
- `scripts/fake-glab/glab`
- `tests/glab/mr-discussions/**` (new)
- `tests/glab/README.md`

**Read-only:** everything else.
- `frontend/**`: the generated `frontend/src/ipc/bindings.ts` comes from the orchestrator's `just bindings` (PM4).
- `crates/gitio/**`: use `Glab::get` as it is (`glab.rs:101-104`).
- Every `Cargo.toml`: no new dependency; `serde_json` is already the crate's (`query.rs:1`).
- The other scenarios under `tests/glab/`.
- `docs/**`, and the `AGENTS.md` files outside your Owned globs: put their lines in `deviations_from_brief`.

**Non-goals:**
- Replying, resolving or reacting (request non-goals).
- Resolved discussions or whole threads.
- Turns, order or words: the core's.
- Retrying a failed row.
- Caching details across calls.
- Skipping bots' notes (design open question 1: a bot's note counts).
- Any frontend code.
- `scripts/gitlab-playground.sh`: the owner's check needs a second GitLab user who answers by hand (orchestrator,
  measured: !1 already holds four open discussions by `samubr`).

## Contract

Fixed; you may add, never change. In `yamt-merge-requests`, a new module `discussions.rs`, re-exported from `lib.rs`.
The IPC types derive `Clone, Debug, PartialEq, Eq, Serialize, Type`, are documented as their neighbours are, and carry
`#[serde(rename_all = "camelCase")]` (enums also `tag = "kind"`):

```rust
/// Merge requests read in one glab call: 20 took 4.47 s on gitlab-org/gitlab, 100 took 22.22 s, past glab's 20 s
/// deadline (orchestrator, measured 2026-11-03).
pub const DISCUSSION_BATCH: usize = 20;
const DISCUSSIONS_PER_PAGE: u32 = 100;   // the schema's page cap (facts §2)
const NOTES_READ: u32 = 20;              // costs the same complexity as 1 (facts §2)
const MAX_DISCUSSION_PAGES: u32 = 10;

/// One merge request's open discussions, or why they were not read.
pub struct RowDiscussions { pub iid: MergeRequestIid, pub answer: DiscussionsAnswer }

pub enum DiscussionsAnswer {
    /// Its resolvable, unresolved discussions, in GitLab's order.
    Open { discussions: Vec<OpenDiscussion> },
    GlabMissing,
    NotLoggedIn { detail: String },
    Failed { message: String },
}

/// An open discussion: where it is and its last note written by a person (system notes skipped).
pub struct OpenDiscussion { pub place: DiscussionPlace, pub last: DiscussionNote }

pub enum DiscussionPlace {
    /// On the merge request itself: the last person's note has no `position`.
    Overview,
    /// On the diff: `filePath`, and `newLine`, else `oldLine` (both may be null).
    File { path: String, line: Option<u32> },
}

pub struct DiscussionNote {
    pub author: Option<Person>,     // People::person
    pub created_at: String,         // GitLab's ISO 8601 time, as sent
    pub text: String,               // the raw body
    pub page: Option<WebPage>,      // WebPage::note of GitLab's `url`
}

/// What the shell gets: the rows answered, and the uploaded pictures of their authors (one per username).
pub struct ReadDiscussions { pub rows: Vec<RowDiscussions>, pub pictures: Vec<OfferedPicture> }   // not IPC

/// Answers the first `DISCUSSION_BATCH` distinct iids of `iids`, in their order, each once; nothing only for an empty
/// `iids` (then no glab run).
/// - no glab → each of them `GlabMissing`;
/// - `logged_in_project` → `NotLoggedIn`/`Failed` each (`From<NoProject> for DiscussionsAnswer`, project.rs);
/// - one `Glab::get` of `discussions_args`; `Err(line)` or GraphQL `errors` → each `Failed` with that message;
/// - per merge request: `discussions.pageInfo.hasNextPage` → the same query for that iid alone with
///   `discussionsAfter=<endCursor>`, at most `MAX_DISCUSSION_PAGES` pages in all (more → that row `Failed`
///   "more than 1,000 discussions"; a failing later page → that row `Failed`);
/// - open = `resolvable && !resolved`; its last note = the last with `system: false` among `notes(last: 20)`; none
///   and `hasPreviousPage` → that row `Failed` ("a discussion's last 20 notes are all GitLab's own; yamt reads no
///   further"); none without earlier notes (not resolvable per GitLab, facts §1) → the discussion is left out;
/// - an asked iid GitLab's answer does not name → `Failed` ("GitLab sent no merge request !<iid>").
/// One `tracing::info!` per call: asked, answered, failed rows, glab calls, the first batch's
/// `queryComplexity { score, limit }`; never a name, a body or an address.
pub fn read_discussions(repository: &GitLabRepository, glab: Option<&Glab>, iids: &[MergeRequestIid]) -> ReadDiscussions;

/// The same batch cut, each `Failed { message }`: for a window without a GitLab project, and for a failed call.
pub fn unread_discussions(iids: &[MergeRequestIid], message: &str) -> Vec<RowDiscussions>;
```

**Query** (`query.rs`, one line like `list_query`, design §1.1 verbatim):
`MergeRequestDiscussions($fullPath: ID!, $iids: [String!], $first: Int!, $discussionsAfter: String)` with
`queryComplexity { score limit }` and `project { mergeRequests(iids: $iids, first: $first) { nodes { iid
discussions(first: 100, after: $discussionsAfter) { pageInfo { hasNextPage endCursor } nodes { resolvable resolved
notes(last: 20) { pageInfo { hasPreviousPage } nodes { system author { username name avatarUrl } body createdAt url
position { filePath newLine oldLine } } } } } } } }`. Spell the numbers through the constants.

```rust
/// `api graphql -f query=… -f fullPath=<path> -F iids=<["1","2"] by serde_json> -F first=<count> [-f discussionsAfter=<cursor>]`
pub(crate) fn discussions_args(full_path: &str, iids: &[MergeRequestIid], after: Option<&str>) -> Vec<String>;
```

**Note page** (`web_page.rs`, the maker beside `merge_request`):

```rust
/// GitLab's address of a note on merge request `iid`: `url` exactly `WebPage::merge_request(origin, web_path, iid)`
/// followed by `#note_<digits>` (`lib/gitlab/url_builder.rb`, facts §1); any other address → `None`.
pub(crate) fn note(origin: &str, web_path: &str, iid: MergeRequestIid, url: &str) -> Option<WebPage>;
```

**src-tauri** (`merge_requests.rs` and the new `merge_requests/discussions.rs`, the shape of `job_logs.rs`):

```rust
/// No GitLab project → `unread_discussions(iids, NO_PROJECT)`; else `read_discussions`, then every answered note's
/// page added to `pages` and the pictures offered (`state.pictures.offer`), both before the rows are returned; never
/// holds `pages` while glab runs.
pub(super) fn discussions_reply(state: &MergeRequestState, glab: Option<&Glab>, iids: &[MergeRequestIid]) -> Vec<RowDiscussions>;

#[tauri::command] #[specta::specta]
pub(crate) async fn read_discussions<R: Runtime>(window: WebviewWindow<R>, iids: Vec<MergeRequestIid>)
    -> Result<Vec<RowDiscussions>, IpcError>;   // blocking_reply, as read_job_log (merge_requests.rs:303-317)
```

**Settings** (`crates/settings`):
- `#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Serialize, Deserialize, specta::Type)]
  #[serde(rename_all = "lowercase")] pub enum DiscussionDetails { #[default] Full, Lazy, Off }`, with `name()` as
  `Antialiasing::name` (`lib.rs:59-68`).
- `StoredSettings` gains `#[serde(rename = "discussionDetails")] pub discussion_details: DiscussionDetails`.
- `pub fn set_discussion_details(places: &Places, current: &StoredSettings, details: DiscussionDetails) ->
  Result<SettingsRead, Error>` (through `change`, as `set_antialiasing` at `lib.rs:183-189`).
- `file.rs`:
  - The key `DISCUSSION_DETAILS = "discussionDetails"`, read with `entry()`, so a missing key is `Full`.
  - It is written only when not `Full`.
  - Another value → `Broken` ("`discussionDetails`: …") as the other entries.
- src-tauri `settings::set_discussion_details(window, current, details)` as `set_antialiasing`
  (`src-tauri/src/settings.rs:50-64`).

Both commands are registered in `commands.rs`: `merge_requests::read_discussions::<tauri::Wry>` after
`read_job_log`, and `settings::set_discussion_details::<tauri::Wry>` after `set_agent`. Generated TS:
- `commands.readDiscussions(iids: MergeRequestIid[]): Result<RowDiscussions[], IpcError>`
- `commands.setDiscussionDetails(current, details)`
- `StoredSettings.discussionDetails: DiscussionDetails`, with `DiscussionDetails = "full" | "lazy" | "off"`

**Fake glab** (`scripts/fake-glab/glab` `graphql()`):
- Before the `iid` route: a field `iids` (`-F`, kept as `name=value`) answers
  `$scenario/graphql-discussions-<the iids, quotes, brackets and spaces dropped, commas as "-">[-after-<discussionsAfter>]`
  through `reply` (so `.json`, `.status`, `.err`, `.exit` and `.sleep` work).
- Every other route stays as it is.
- `tests/glab/README.md`: the row, the measured `-F` JSON array (glab 1.126.0), and the scenario.

**Scenario `tests/glab/mr-discussions/`:**
- Logged in; `merge-requests/`'s project (`taskboard/taskboard` on `https://gitlab.example`); user `sam`.
- One list page, the last, with every field today's list query reads (copy `mr-row-details/graphql-page-1.json`'s
  shape, its `queryComplexity`); no `diffHeadSha`.

| row | open (resolvable − resolved) | its discussions |
| --- | --- | --- |
| !82 | 3 | below |
| !81 | 1 | an Overview discussion whose last note is ben's; `body` `Please **check** <b>THIS</b> & that` on several lines |
| !80 | 0 | — |
| !79 | 1 | discussions page 1 has `hasNextPage: true, endCursor: "d-2"` and only closed ones; page 2 holds the open one |
| !78 | 1 | absent from the batch's answer |

!82's discussions:
- (a) A diff discussion: anna's comment, a system note "changed this line in version 2 of the diff", then sam's
  reply. Its last person is sam.
- (b) A diff discussion: ben's comment, then a system note as the last note. Its last person is ben.
- (c) An Overview discussion by anna whose `url` is `https://evil.example/x#note_1`, so it gets no page.
- (d) A resolved discussion.
- (e) A system-only discussion ("added 2 commits", `resolvable: false`).
- (f) A non-resolvable comment.

Every other `url` is `https://gitlab.example/taskboard/taskboard/-/merge_requests/<iid>#note_<n>`. Avatars are anna's
uploaded `/uploads/-/system/user/avatar/2/avatar.png` and ben's Gravatar, as in `mr-row-details/`.

Answer files:
- `graphql-discussions-82-81-79-78.json` (the batch; `queryComplexity` with the score step 1 measured)
- `graphql-discussions-79-after-d-2.json`
- `graphql-discussions-81.json` (one row, lazy)
- `graphql-discussions-77.json` with `.err` and `.exit` 1 (glab fails)

## Change

1. **Measure first**, read-only, with the logged-in glab in `../glab-yamt-playground` (as `briefs/mr-diff-stats.md`
   did): `glab --version`. Then `time glab api graphql -f query='<the query>' -f fullPath=gitlab-org/cli -F
   'iids=[<20 open iids from glab api "projects/gitlab-org%2Fcli/merge_requests?state=opened&per_page=20">]' -F
   first=20 | wc -c`. Paste the score and limit, the time and the bytes. Then the playground's !1 with `-F 'iids=["1"]'
   -F first=1`: four open discussions, their last notes `samubr`. Write nothing to GitLab.
2. `query.rs`: the query and `discussions_args`, with a unit test that the query is one line and the args are as
   contracted. `web_page.rs`: `note`, with tests.
3. `discussions.rs`: the parse types, `read_discussions`, `unread_discussions`, and unit tests over inline JSON.
   `project.rs`: `From<NoProject>`. `lib.rs` re-exports.
4. `tests/discussions.rs` with the fake glab (`tests/fake_glab/mod.rs`, as `tests/job_log.rs` uses it).
5. Settings: the enum, the field, `file.rs`, `set_discussion_details`, `tests/discussion_details.rs` (the
   `tests/antialiasing.rs` shape).
6. src-tauri: `merge_requests/discussions.rs`, the command, `settings.rs`, `commands.rs`, and
   `merge_requests/tests/discussions.rs`.
7. Fake glab route, the scenario, the README; the crate's `AGENTS.md`: discussions, the batch, note pages.

## Acceptance

**Tests** (`cargo nextest run -p yamt-merge-requests -p yamt-settings` with the hermetic prefix as `just test`, and
`-p yamt-app merge_requests settings`), each named for the bug it catches, at least:

- `discussions.rs` unit:
  - `a_system_note_after_the_last_reply_is_skipped` (RK61)
  - `a_system_note_between_replies_is_skipped`
  - `resolved_and_unresolvable_discussions_are_left_out`
  - `a_note_without_position_is_the_overview`
  - `a_diff_place_takes_the_new_line_else_the_old`
  - `twenty_system_notes_with_earlier_ones_fail_the_row`
  - `an_iid_gitlab_does_not_name_fails_alone`
  - `graphql_errors_fail_each_row_of_the_batch`
  - `the_batch_is_the_first_twenty_distinct_iids_in_order`
  - `an_empty_ask_answers_nothing_and_runs_no_glab`
  - `an_uploaded_avatar_is_offered_once_per_username`
- `web_page.rs`: `a_note_url_is_a_page_only_as_gitlab_builds_it` (RK60). Accepts GitLab's form. Refuses another
  host, `http`, another project, another iid, `#note_` with no digits or other characters, a path after the
  anchor, and an origin under a sub-path missing from the url.
- `tests/discussions.rs` (scenario `mr-discussions`):
  - `a_rows_open_discussions_arrive_with_their_last_persons_note_place_and_link` (!82: three, in GitLab's order;
    (a) sam at `src/…:<line>`, (b) ben, (c) no page)
  - `one_rows_details_alone_are_one_call` (`[81]`: one `argv:` line naming `iids=["81"]`)
  - `a_later_discussions_page_is_asked_for_that_row_alone` (!79: the `discussionsAfter=d-2` line)
  - `markup_in_a_body_stays_as_sent`
  - `a_failed_glab_call_fails_its_rows_and_keeps_its_words` (77)
  - `glab_missing_answers_each_row`, `logged_out_answers_each_row` (scenario `logged-out`)
- `crates/settings/tests/discussion_details.rs`:
  - `the_three_values_read_and_write_as_named`
  - `a_file_without_the_key_reads_as_full_and_full_is_not_written`
  - `an_unknown_value_is_broken_and_nothing_is_written`
  - `unknown_entries_are_kept`
  - plus the IPC-spelling round trip in `lib.rs` (as `the_agent_entry_crosses_the_ipc_…`)
- `src-tauri` `merge_requests/tests/discussions.rs`:
  - `a_note_page_is_offered_before_the_reply` (then `open_page` of it does not answer `NotOffered`; another address
    does; RK41, RK60)
  - `an_authors_uploaded_picture_is_offered`
  - `no_gitlab_project_fails_each_asked_row`
  - `read_discussions_replies_on_paths_glab` (as the job log's)

**Commands:**
- `cargo clippy --workspace --all-targets -- -D warnings`, `cargo fmt --all --check`, `just arch-check`: summary lines.
- `sh -n scripts/fake-glab/glab`: no output.
- Step 1 pasted.
- `cargo run -p yamt-app --features bindings --bin export-bindings -- target/bindings-discussions.ts` then
  `diff -u frontend/src/ipc/bindings.ts target/bindings-discussions.ts`: only the types and the two commands of the
  Contract.
- `just mutants HEAD` in your workspace (SP11).

## Skills

`skill://rust-conventions`, `skill://ipc-contract`, `skill://risk-register` (RK41, RK53; proposed RK60, RK61),
`skill://verification`.
