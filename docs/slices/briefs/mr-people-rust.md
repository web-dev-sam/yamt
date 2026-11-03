# Slice mr-people-rust — search the project's people; add or remove one person; pictures offered; fake glab

Feature: people on a merge request. Sources:

- Request `docs/slices/request-mr-people.md`: rules 2, 5, 6, 7, 8 and the Rust acceptance.
- Design `docs/slices/briefs/mr-people-design.md` option A, §1.1–1.5.
- Proposed plan §2 #153 (amended), #169; RK53 (owner and test added), RK54 (rewritten), RK64.

Runs beside `mr-people-core`. After it lands the orchestrator runs `just bindings`.

## Target

**Owned:**

- `crates/merge-requests/**` (its `AGENTS.md` included)
- `src-tauri/src/merge_requests.rs`, `src-tauri/src/merge_requests/**`
- `src-tauri/src/commands.rs` (the command list only)
- `scripts/fake-glab/glab`
- `tests/glab/mr-people/**` (new)
- `tests/glab/README.md`

**Read-only:** everything else.

- `frontend/**`: the generated `frontend/src/ipc/bindings.ts` comes from the orchestrator's `just bindings` (PM4).
- `crates/gitio/**`: use `Glab::get` and `Glab::post` as they are (`crates/gitio/src/glab.rs:102,107`).
- Every `Cargo.toml`: no new dependency. `serde_json` is already the crate's (`query.rs:1`).
- `tests/glab/mr-row-details/**` and the other scenarios: copy from them, never edit them.
- `docs/**`, and the `AGENTS.md` files outside your Owned globs: put their lines in `deviations_from_brief`.

**Non-goals:**

- Changing several merge requests at once; the author; approving or revoking; labels or milestones on GitLab (request
  non-goals).
- Reading the list before a write, or any `REPLACE` (rule 8, design option C rejected).
- `projectMembers` (design §1.1; open question 1 keeps `autocompleteUsers` alone).
- Renaming `may_rerequest`. Only its doc comment changes (design §3).
- Any frontend code.
- Writing to any real GitLab. The owner's check does that.

## Contract

Fixed; you may add, never change. Two new modules in `yamt-merge-requests`, `people_search.rs` and
`people_change.rs`, re-exported from `lib.rs`.

- The IPC types derive `Clone, Debug, PartialEq, Eq, Serialize, Type`, plus `Deserialize` for those the window sends.
- They are documented as their neighbours are and carry `#[serde(rename_all = "camelCase")]`; enums with payloads also
  carry `tag = "kind"`.

```rust
// people_search.rs
/// How searching the project's people ended.
pub enum PeopleSearchReply {          // tag = "kind"
    /// Who matched, in GitLab's order: at most 20 (GitLab's `Autocomplete::UsersFinder::LIMIT`).
    Found { people: Vec<Person> },
    GlabMissing,
    NotLoggedIn { detail: String },
    /// glab's, GitLab's or yamt's words (an older GitLab's "Field 'autocompleteUsers' doesn't exist…" included).
    Failed { message: String },
}

/// What the shell gets: the reply and its people's uploaded pictures, to offer before replying. Not IPC.
pub struct FoundPeople { pub reply: PeopleSearchReply, pub pictures: Vec<OfferedPicture> }

/// The project's people whose name, username or public email matches `text`, as GitLab's own dropdown asks:
/// glab missing → GlabMissing; `logged_in_project` (From<NoProject>); one `Glab::get` of `people_search_args`;
/// `Err(line)` or a GraphQL error → Failed; `project: null` → Failed(page.rs NO_PROJECT); `autocompleteUsers: null`
/// → Found with nobody. One `tracing::info!` with the outcome kind and the count, never the text or a name.
pub fn search_people(repository: &GitLabRepository, glab: Option<&Glab>, text: &str) -> FoundPeople;

// people_change.rs
pub enum PeopleGroup { Assignees, Reviewers }   // + Deserialize, Copy
pub enum PeopleAction { Add, Remove }           // + Deserialize, Copy
/// One person added to or removed from one list of a merge request.
pub struct PeopleChange { pub group: PeopleGroup, pub action: PeopleAction, pub username: String }  // + Deserialize
/// A merge request's assignees and reviewers as GitLab answered.
pub struct MergeRequestPeople { pub assignees: Vec<Person>, pub reviewers: Vec<Reviewer> }

/// How asking GitLab for one change ended.
pub enum PeopleChangeReply {          // tag = "kind"
    /// GitLab's answered list shows the change: both lists as answered.
    Changed { people: MergeRequestPeople },
    /// GitLab answered without an error but its list does not show the change (GitLab Free keeps one assignee and one
    /// reviewer; no permission; an unknown user): both lists as answered.
    Unchanged { people: MergeRequestPeople },
    GlabMissing,
    NotLoggedIn { detail: String },
    /// GitLab refused, in its words: the payload's first `errors` entry.
    Refused { message: String },
    /// glab failed, GitLab's top-level error, or an answer naming no merge request.
    Failed { message: String },
}

/// Not IPC: the reply and the uploaded pictures of everyone in its lists.
pub struct ChangedPeople { pub reply: PeopleChangeReply, pub pictures: Vec<OfferedPicture> }

/// Asks GitLab for `change` on merge request `iid`, against GitLab's list at that moment (rule 8):
/// glab missing → GlabMissing; `logged_in_project`; then exactly one
/// `Glab::post(root, &GRAPHQL_BODY_ARGS, people_change_body(..))`, nothing read before it. The answer:
/// glab Err → Failed; `graphql_data` Err → Failed; no `changed` payload or no `mergeRequest` → Failed
/// (rerequest.rs NO_MERGE_REQUEST words); the first `errors` entry → Refused; else design §1.3's table (usernames
/// compared with `eq_ignore_ascii_case`). Unknown review states warn once, as `requested()` does
/// (rerequest.rs:183-190). One `tracing::info!` with iid, group, action and outcome kind; never a username.
pub fn change_people(
    repository: &GitLabRepository,
    glab: Option<&Glab>,
    iid: MergeRequestIid,
    change: &PeopleChange,
) -> ChangedPeople;
```

`project.rs` gains `From<NoProject>` for both replies, as for `RerequestReply` (`project.rs:96-103`).

**Queries** (`query.rs`, each one line, braces balanced):

```rust
const PEOPLE_SEARCH_QUERY: &str = "query PeopleSearch($fullPath: ID!, $search: String!) { \
     project(fullPath: $fullPath) { autocompleteUsers(search: $search) { username name avatarUrl } } }";
/// `api graphql -f query=<PEOPLE_SEARCH_QUERY> -f fullPath=<path> -f search=<text>` (-f: a raw string, never @file).
pub(crate) fn people_search_args(full_path: &str, text: &str) -> Vec<String>;

// The answered lists are the list query's fields (query.rs:53-54).
const SET_ASSIGNEES_MUTATION: &str = "mutation SetAssignees($projectPath: ID!, $iid: String!, $usernames: [String!]!, \
     $mode: MutationOperationMode!) { changed: mergeRequestSetAssignees(input: { projectPath: $projectPath, iid: $iid, \
     assigneeUsernames: $usernames, operationMode: $mode }) { errors mergeRequest { \
     assignees { nodes { username name avatarUrl } } \
     reviewers { nodes { username name avatarUrl mergeRequestInteraction { approved reviewState } } } } } }";
const SET_REVIEWERS_MUTATION: &str = /* the same with SetReviewers, mergeRequestSetReviewers, reviewerUsernames */;
/// {"query": <the group's mutation>, "variables": {"projectPath", "iid": "<n>", "usernames": [<username>],
/// "mode": "APPEND" | "REMOVE"}} by serde_json; the username is only ever a variable.
pub(crate) fn people_change_body(full_path: &str, iid: MergeRequestIid, change: &PeopleChange) -> Vec<u8>;
```

**`may_rerequest`'s doc** (`lib.rs:243`) becomes: "GitLab's `updateMergeRequest` permission for you: whether you may
re-request a review and add or remove assignees and reviewers." The name stays (design §3).

**src-tauri** (`merge_requests.rs` and a new `merge_requests/people.rs`, the shape of `merge_requests/discussions.rs`):

```rust
/// No GitLab project → Failed(NO_PROJECT); else `search_people`, its pictures offered (`state.pictures.offer`)
/// before the reply is returned.
pub(super) fn search_reply(state: &MergeRequestState, glab: Option<&Glab>, text: &str) -> PeopleSearchReply;
/// The same for `change_people`.
pub(super) fn change_reply(state: &MergeRequestState, glab: Option<&Glab>, iid: MergeRequestIid, change: &PeopleChange)
    -> PeopleChangeReply;

#[tauri::command] #[specta::specta]
pub(crate) async fn search_people<R: Runtime>(window: WebviewWindow<R>, text: String)
    -> Result<PeopleSearchReply, IpcError>;                // blocking_reply, as rerequest_review (merge_requests.rs:303-317)
#[tauri::command] #[specta::specta]
pub(crate) async fn change_people<R: Runtime>(window: WebviewWindow<R>, iid: MergeRequestIid, change: PeopleChange)
    -> Result<PeopleChangeReply, IpcError>;
```

Both are registered in `commands.rs` after `read_discussions` (`commands.rs:85`). The generated TS is:

- `commands.searchPeople(text: string): Result<PeopleSearchReply, IpcError>`
- `commands.changePeople(iid: MergeRequestIid, change: PeopleChange): Result<PeopleChangeReply, IpcError>`
- `PeopleChange = { group: PeopleGroup; action: PeopleAction; username: string }`
- `PeopleGroup = "assignees" | "reviewers"` and `PeopleAction = "add" | "remove"`

**Fake glab** (`scripts/fake-glab/glab` `graphql()`, `:127-150`):

- Before the `iid` route (`:137`), a field `search=<text>` answers `$scenario/graphql-people-<text>` through `reply`, so
  `.json`, `.status`, `.err`, `.exit` and `.sleep` work.
- Posts stay counted by order (`post()`, `:115-124`).
- `tests/fake_glab/mod.rs` gains `pub fn answered_posts(&self, count: u32)`. It writes `count` to the fake's state
  file, so the next post is `post-<count+1>` (design §1.5).

**Scenario `tests/glab/mr-people/`:**

- Logged in, as `mr-row-details/` is.
- `project.json` and `graphql-page-1.json` copied from `mr-row-details/`: !52 assignee sam, reviewers ben, chiara
  (approved) and dmitri; !51 nobody; !50 `updateMergeRequest` false; user `sam`.
- `pictures/uploads/-/system/user/avatar/{1,2,7}/avatar.png`: small PNGs. 1 and 2 are copies of `mr-row-details/`'s;
  7 is erik's.

Searches:

| file                         | answer                                                                                                           |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `graphql-people-er.json`     | erik "Erik Lund" (`/uploads/-/system/user/avatar/7/avatar.png`), then ben (his Gravatar as in `mr-row-details/`) |
| `graphql-people-an.json`     | anna (`/2/avatar.png`)                                                                                           |
| `graphql-people-gh.json`     | ghost "Ghost User" (no avatar)                                                                                   |
| `graphql-people-nobody.json` | `autocompleteUsers: []`                                                                                          |
| `graphql-people-broken`      | `.err` "glab: a deadline line" and `.exit` 1                                                                     |

Posts, in the real-app order; each `changed` payload has GitLab's answered lists:

| post | the change it answers               | answer                                                                                                                                                                            |
| ---- | ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | !52 add assignee erik               | assignees sam, erik; reviewers as !52                                                                                                                                             |
| 2    | !52 add reviewer erik               | reviewers ben, chiara (approved), dmitri, erik (`UNREVIEWED`)                                                                                                                     |
| 3    | !52 remove assignee sam             | assignees erik                                                                                                                                                                    |
| 4    | !52 remove reviewer chiara          | reviewers ben, dmitri, erik                                                                                                                                                       |
| 5    | !52 add assignee anna (GitLab Free) | `errors: []`, assignees erik only                                                                                                                                                 |
| 6    | !52 add reviewer ghost              | `errors: ["Reviewers not able to be set: ghost"]`                                                                                                                                 |
| 7    | any                                 | top-level `errors: [{"message": "The resource that you are attempting to access does not exist or you don't have permission to perform this action"}]`, `data: {"changed": null}` |
| 8    | !52 remove reviewer ben, not made   | reviewers still hold ben                                                                                                                                                          |

## Change

1. **Measure first**, read-only, with the logged-in glab in `../glab-yamt-playground`, as `briefs/mr-discussions-rust.md`
   step 1 did. Paste each result. Write nothing to GitLab.
   - `glab --version`.
   - `time glab api graphql -f query='query PeopleSearch($fullPath: ID!, $search: String!) { queryComplexity { score
     limit } project(fullPath: $fullPath) { autocompleteUsers(search: $search) { username name avatarUrl } } }' -f
     fullPath=gitlab-org/gitlab -f search=hamm`: the score and limit logged in (logged out it was 13 of 200, design
     §1.1), the wall time and the count.
   - The same with `-f search=@sam`: the field arrives as the text `@sam` (GitLab finds no one, or people matching
     "@sam"), not as a file read.
   - The same on the playground's project path with `search=sam`: `samubr` is found.
2. `query.rs`: the search query and args, the two mutations and `people_change_body`, with unit tests: one line,
   balanced braces, argv and body exactly as contracted, `mode` from the action, `usernames` a one-element array.
3. `people_search.rs`, `people_change.rs`: the parse types (reuse `UserNode`, `ReviewerNode`, `People`, `Nodes`,
   `listed`, `graphql_data`), the two functions, the outcome names for the log, and unit tests over inline JSON.
   `project.rs`: the two `From<NoProject>`. `lib.rs`: the re-exports and `may_rerequest`'s doc.
4. `tests/people.rs` on scenario `mr-people` (with `answered_posts`). Rename `tests/rerequest.rs`'s
   `the_only_write_is_the_rereview_mutation` to `the_rerequest_path_writes_only_the_rereview_mutation`, unchanged
   otherwise (RK54).
5. src-tauri: `merge_requests/people.rs`, the two commands, `commands.rs`, and `merge_requests/tests/people.rs` (the
   `run_with_fakes` shape of `tests/rerequest.rs` and `tests/picture_scheme.rs`).
6. Fake glab route, the scenario, `tests/glab/README.md`:
   - the `graphql-people-<text>` row;
   - `post-<n>` no longer "the re-request mutation" alone;
   - the scenario paragraph with the post table above;
   - `answered_posts`.
     Then the crate's `AGENTS.md`: the search, the change, `Changed`/`Unchanged`, the pictures.

## Acceptance

**Tests** (`cargo nextest run -p yamt-merge-requests` with the hermetic prefix as `just test`, and `-p yamt-app
merge_requests`), each named for the bug it catches, at least:

- Unit (`query.rs`, `people_search.rs`, `people_change.rs`):
  - `the_search_query_is_one_line_and_its_argv_is_exact`
  - `the_change_body_names_the_groups_mutation_with_one_username_and_the_actions_mode` (all four group × action)
  - `an_added_person_in_the_answer_is_changed_and_missing_is_unchanged`
  - `a_removed_person_missing_is_changed_and_still_listed_is_unchanged`
  - `usernames_compare_without_ascii_case`
  - `a_payload_error_is_refused_and_a_top_level_error_fails`
  - `no_payload_or_no_merge_request_fails`
  - `the_log_names_each_outcome_by_its_kind` (both replies)
- `tests/people.rs` (scenario `mr-people`):
  - `a_search_asks_autocomplete_users_with_the_text_as_a_raw_field`: argv exact; answers erik then ben in GitLab's
    order with erik `uploaded`, ben `gravatar`.
  - `a_search_writes_nothing`: no `stdin:` line, no `--input`.
  - `a_search_finding_nobody_is_found_with_nobody`
  - `a_failed_search_keeps_glabs_words` (`broken`)
  - `adding_an_assignee_sends_one_append_with_the_exact_body` (post 1: body exactly as contracted; the reply's
    `assignees` are sam and erik)
  - `adding_a_reviewer_answers_their_review_state_and_leaves_the_assignees` (post 2: erik `requested`; the body names
    only `mergeRequestSetReviewers`, rule 7)
  - `removing_sends_one_remove_of_one_username` (posts 3–4; chiara is gone and nothing else is asked)
  - `an_append_gitlab_dropped_is_unchanged_with_gitlabs_lists` (post 5, RK64)
  - `a_mutation_error_is_refused_in_gitlabs_words` (post 6)
  - `a_top_level_error_fails` (post 7)
  - `a_remove_gitlab_did_not_make_is_unchanged` (post 8, RK64)
  - `each_change_writes_one_append_or_remove_of_one_username` (RK54): after a run of changes,
    - every `stdin:` body's `query` is one of the two mutation texts;
    - `mode` ∈ {APPEND, REMOVE}; `usernames` has one element;
    - no body or argv names `REPLACE`, `-X`, `reviewer_ids` or `assignee_ids`;
    - the count of `--input` argv lines equals the count of changes.
  - `glab_missing_or_logged_out_answers_before_any_query` (scenario `logged-out`)
- `tests/rerequest.rs`: `the_rerequest_path_writes_only_the_rereview_mutation` passes, renamed.
- src-tauri `merge_requests/tests/people.rs`:
  - `a_searched_persons_uploaded_picture_is_offered_before_the_reply` (RK53): `picture_answer("/erik")` is 404 before
    the search, the PNG after it, in a window that listed nothing.
  - `every_person_in_a_change_answer_gets_their_picture_offered` (post 1, no search before it)
  - `no_gitlab_project_fails_search_and_change`
  - `search_and_change_reply_on_paths_glab` (through the commands)

**Commands:**

- `cargo clippy --workspace --all-targets -- -D warnings`, `cargo fmt --all --check`, `just arch-check`: their summary
  lines.
- `sh -n scripts/fake-glab/glab`: no output.
- Step 1 pasted.
- `cargo run -p yamt-app --features bindings --bin export-bindings -- target/bindings-people.ts`, then `diff -u
  frontend/src/ipc/bindings.ts target/bindings-people.ts`: only the Contract's types and the two commands, plus the
  `mayRerequest` doc line.
- `just mutants HEAD` in your workspace (SP11).

## Skills

`skill://rust-conventions`, `skill://ipc-contract`, `skill://risk-register` (RK53, RK54; proposed RK64),
`skill://verification`.
