# Slice mr-row-details-rust — people, labels, empty size, pictures and the re-request in Rust

Feature: merge-request row details (request `docs/slices/request-mr-row-details.md` rules 1–5, 10 and the Rust
acceptance; design `docs/slices/briefs/mr-row-details-design.md` option A, §1.1–1.4, §2.1; proposed plan §2 #151–#153;
owner answers #2104 (re-request only) and #2105 (Gravatar too)). Starts after the local conflict check (board section of
that name) has closed: cite symbols, not lines, in `check.rs`, `open.rs`, `readiness.rs`. Runs beside
`mr-row-details-core`. After it lands the orchestrator runs `just bindings`.

## Target

Owned: `crates/merge-requests/**`; `src-tauri/src/merge_requests.rs`, `src-tauri/src/merge_requests/**`;
`src-tauri/src/commands.rs` (the command list and the scheme registration in `with_commands` only);
`src-tauri/tauri.conf.json` (`csp` and `devCsp` only); `scripts/fake-glab/glab`; `tests/glab/mr-row-details/**`
(new); `tests/glab/README.md`; `scripts/gitlab-playground.sh`.

Read-only: everything else — `frontend/**` (the generated `frontend/src/ipc/bindings.ts` is the orchestrator's `just
bindings`, PM4; the frontend typecheck is red until `mr-row-details-page` lands, expected), `crates/gitio/**`
(`Glab::run`/`get` as they are), `crates/review/**`, other scenarios under `tests/glab/` (they keep their files; serde
defaults cover the new fields), `Cargo.toml`s (no new dependency: `serde_json` is already the crate's, plan §2 #131;
`tauri::http` comes with tauri), `docs/**` (the docs keeper's: put the lines in `deviations_from_brief`).

Non-goals: adding, assigning or removing anyone (owner #2104: `mergeRequestSetReviewers` and REST `reviewer_ids` are
never called), approving, labels or due dates on GitLab (request non-goals); any picture host but the project's GitLab
and Gravatar's two; Gravatar through glab; a custom Gravatar URL; a picture size parameter; caching across runs; the
window's code.

## Contract

Fixed (add-only beyond this), in `yamt-merge-requests` (`lib.rs` unless named), all IPC types `Serialize, Type` with
`#[serde(rename_all = "camelCase")]`, documented as their neighbours are:

```rust
/// A GitLab user and the picture the window may show for them.
pub struct Person { pub username: String, pub name: String, pub picture: PersonPicture }

/// Which picture the window shows for a person.
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum PersonPicture {
    /// Uploaded to the project's GitLab: the window asks `yamt-picture://localhost/<username>`.
    Uploaded,
    /// A Gravatar picture: the window loads this address itself.
    Gravatar { address: GravatarAddress },
    /// Nothing yamt may load: initials.
    None,
}

/// A Gravatar picture's address: `https://secure.gravatar.com` or `https://www.gravatar.com`, the path
/// `/avatar/<32 or 64 hex digits>`, an optional query of `[A-Za-z0-9=&%._-]`; only `avatar_source` makes one.
#[serde(transparent)] pub struct GravatarAddress(String);   // Clone, Debug, PartialEq, Eq, Serialize, Type

/// An uploaded avatar's address on the project's GitLab (never sent to the window); only `avatar_source` makes one.
pub struct PictureAddress(String);   // Clone, Debug, PartialEq, Eq, PartialOrd, Ord; not Serialize
impl PictureAddress { pub fn as_str(&self) -> &str }

/// Where a person's `avatarUrl` points (picture.rs, crate-internal).
pub(crate) enum AvatarSource { Uploaded(PictureAddress), Gravatar(GravatarAddress), None }
/// `origin` the project's `web_origin` (`None` off https). Uploaded: a path starting with `/`, or an `https` address of
/// that origin, whose path is `(/segment)*/uploads/-/system/user/avatar/<digits>/<file>` (segments and file of
/// `[A-Za-z0-9._~-]`, no `..`, an optional query of `[A-Za-z0-9=&._-]`). Gravatar: as `GravatarAddress` says.
/// Anything else (`http`, another host, a custom Gravatar URL, null) → None.
pub(crate) fn avatar_source(origin: Option<&str>, avatar_url: Option<&str>) -> AvatarSource;

/// How far a reviewer's review is: GitLab's state in the four the window names.
pub enum ReviewState { Requested, Reviewed, Approved, ChangesRequested }
// fold (GitLab's own order, uncollapsed_reviewer_list.vue `reviewStateIcon`): `approved: true` → Approved; else
// UNREVIEWED, REVIEW_STARTED, missing or null → Requested; REVIEWED, UNAPPROVED → Reviewed; APPROVED → Approved;
// REQUESTED_CHANGES → ChangesRequested; any other text → Requested, one `tracing::warn!` naming it per load.

/// A reviewer of a merge request and how far their review is.
pub struct Reviewer { pub person: Person, pub state: ReviewState }

/// A label's colours as GitLab sends them, each `#rgb` or `#rrggbb` (checked: `#` then 3 or 6 hex digits).
pub struct LabelColors { pub background: String, pub text: String }
/// A label of a merge request; `colors` is `None` when either colour is missing or not `#rgb`/`#rrggbb`.
pub struct Label { pub title: String, pub colors: Option<LabelColors> }

pub struct MergeRequestRow {
    // today's fields, with these changes:
    pub author: Option<Person>,      // new, before `assignees`; None when GitLab sends null
    pub reviewers: Vec<Reviewer>,    // was Vec<Person>
    pub labels: Vec<Label>,          // was Vec<String>, GitLab's order
    pub approved_by: Vec<Person>,    // replaces `approvals: u32` (removed: the count is the length)
    pub may_rerequest: bool,         // new: GitLab's `userPermissions.updateMergeRequest` for you
    pub size: Option<ChangeSize>,    // see "Size" below
}

/// How asking GitLab to re-request a reviewer's review ended.
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum RerequestReply {
    /// Done, or already awaiting their review; the merge request's reviewers as GitLab answered.
    Requested { reviewers: Vec<Reviewer> },
    /// They are no longer a reviewer of the merge request: nothing was written (owner #2100, #2104).
    NotReviewer,
    /// The merge request is no longer open.
    NotOpen,
    /// glab is not found on PATH.
    GlabMissing,
    /// `glab auth status` failed.
    NotLoggedIn { detail: String },
    /// GitLab refused, in its words (the mutation's first `errors` entry).
    Refused { message: String },
    /// glab failed, timed out or answered something unexpected, in glab's, GitLab's or yamt's words.
    Failed { message: String },
}

/// One person's uploaded picture a list offered: the window asks for it by username.
pub struct OfferedPicture { pub username: String, pub address: PictureAddress }
/// One page of the list as the shell gets it: what the window sees, and the uploaded pictures it offers.
pub struct ListedPage { pub page: MergeRequestPage, pub pictures: Vec<OfferedPicture> }

pub enum ImageKind { Png, Jpeg, Gif, Webp }      // by the first bytes: 89 50 4E 47 0D 0A 1A 0A; FF D8 FF; "GIF8";
impl ImageKind { pub fn mime(self) -> &'static str }   // "RIFF" ???? "WEBP"
pub struct Picture { pub kind: ImageKind, pub bytes: Vec<u8> }
pub const MAX_PICTURE_BYTES: usize = 1 << 20;

// list.rs — the one changed signature
pub fn list_merge_requests(repository: &GitLabRepository, glab: Option<&Glab>, on_page: &dyn Fn(ListedPage)) -> Listed;
// rerequest.rs (new)
pub fn rerequest_review(repository: &GitLabRepository, glab: Option<&Glab>, iid: MergeRequestIid, username: &str) -> RerequestReply;
// picture.rs (new): `glab api <address>` in `root`, stdin closed (`Glab::get`); Err in glab's words, or
// "GitLab's picture is not a PNG, JPEG, GIF or WebP image", or "GitLab's picture is larger than 1 MiB".
pub fn fetch_picture(glab: &Glab, root: &Path, address: &PictureAddress) -> Result<Picture, String>;
```

`src-tauri` (`merge_requests.rs`, `merge_requests/pictures.rs`):

```rust
#[tauri::command] #[specta::specta]
pub(crate) async fn rerequest_review<R: Runtime>(window: WebviewWindow<R>, iid: MergeRequestIid, username: String)
    -> Result<RerequestReply, IpcError>;   // through blocking_reply, as open_merge_request
pub(crate) const PICTURE_SCHEME: &str = "yamt-picture";
const PICTURE_FETCHES: usize = 4;      // glab runs for pictures at once
// MergeRequestState gains `pictures: Mutex<PictureShelf>` (offered: username → PictureAddress, the latest list's
// wins; fetched: PictureAddress → Option<Picture>, failures kept as None) and the fetch gate; never locked together
// with `pages` or `merged`, and never held across a glab run.
```

The scheme answers `GET <scheme>://localhost/<username>` (and the Windows form `http://yamt-picture.localhost/<username>`,
built by the window's `convertFileSrc(username, "yamt-picture")`): a username of `[A-Za-z0-9._-]+` that a list of this
run offered → `200`, `Content-Type` the kind's mime, `X-Content-Type-Options: nosniff`, the bytes; anything else (not
offered, other characters, `%`, a failed or refused fetch) → `404` with an empty body. The handler never blocks the
webview thread (`register_asynchronous_uri_scheme_protocol`; the fetch on its own thread). CSP, both `csp` and
`devCsp`: `img-src 'self' data: yamt-picture: http://yamt-picture.localhost https://secure.gravatar.com
https://www.gravatar.com`.

**Size** (`page.rs` `change_size` and its caller): any `diffStats` entries → their sums (as today); no entries and
`diffRefs` non-null → `Some(ChangeSize { additions: 0, deletions: 0, files: 0 })`; no entries and `diffRefs` null or
missing → `None`. GitLab sends `[]` for both an empty diff and a diff it has not computed (design §1.4).

**Queries** (`query.rs`, one line each, balanced braces, as today's tests pin):

- list nodes add `author { username name avatarUrl }`, `avatarUrl` in `assignees`, `reviewers` and `approvedBy` nodes,
  `name` in `approvedBy` nodes, `mergeRequestInteraction { approved reviewState }` in `reviewers` nodes,
  `userPermissions { updateMergeRequest }`, `color textColor` in `labels` nodes, `diffRefs { baseSha }`; still no
  `diffStatsSummary`.
- `REVIEWERS_QUERY`: `query MergeRequestReviewers($fullPath: ID!, $iid: String!) { project(fullPath: $fullPath) {
  mergeRequest(iid: $iid) { state reviewers { nodes { id username name avatarUrl mergeRequestInteraction { approved
  reviewState } } } } } }` with `merge_request_args` (as `BRANCHES_QUERY`).
- `REREQUEST_MUTATION`: `mutation RerequestReview($projectPath: ID!, $iid: String!, $userId: UserID!) {
  mergeRequestReviewerRereview(input: { projectPath: $projectPath, iid: $iid, userId: $userId }) { errors mergeRequest {
  reviewers { nodes { username name avatarUrl mergeRequestInteraction { approved reviewState } } } } } }`, sent as
  `glab api graphql --input -` with the JSON body `{"query": "<text>", "variables": {"projectPath": "<full path>",
  "iid": "<n>", "userId": "<the reviewer's id>"}}` on stdin through `Glab::run` (`serde_json` builds it). It is the only
  write.

**`rerequest_review` steps:** no glab → `GlabMissing`; `logged_in_project` → `NotLoggedIn`/`Failed`; `REVIEWERS_QUERY`
(`glab.get`; Err → `Failed`; `mergeRequest` null or `state` not `opened` → `NotOpen`); `username` not among the
reviewers → `NotReviewer` (no write); its fresh state `Requested` → `Requested { the fresh reviewers }` (no write: no
second notification); else the mutation with that reviewer's `id`: spawn failure, a time-out or exit 1 → `Failed` with
glab's last stderr line (`glab.rs` `get`'s rule); exit 0 and a GraphQL `errors` → `Failed { first message }`; the
payload's `errors` non-empty → `Refused { first }`; else `Requested { reviewers }` (folded as the list's, pictures by
`avatar_source`). One `tracing::info!` per request naming iid and outcome kind (never the username's picture address).

**Fake glab** (`scripts/fake-glab/glab`): `POST graphql` with `--input -` is the mutation: answered by `post` (the n-th
post's `post-<n>.*`, the body logged as `stdin: …` as today); `GET` with an endpoint holding `://` is a picture: the file
`$scenario/pictures/<the endpoint's path after its host>` printed with `cat` (bytes as they are), exit 0; no such file →
`answer '404 Not Found' '{"message":"404 Not Found"}'`. Every other route unchanged. `tests/glab/README.md` documents
both and the new scenario.

**Scenario `tests/glab/mr-row-details/`** (project `taskboard/taskboard` on `https://gitlab.example`, user `sam`,
logged in, one page, the last; `queryComplexity` as the real run measured):

- !52 (`updateMergeRequest` true): author anna (avatar `/uploads/-/system/user/avatar/2/avatar.png`); assignee sam
  (the absolute `https://gitlab.example/uploads/-/system/user/avatar/1/avatar.png`); reviewers ben (`REVIEWED`, Gravatar
  `https://secure.gravatar.com/avatar/<64 hex>?s=80&d=identicon`), chiara (`approved: true` with `reviewState:
  REVIEWED`, as a GitLab older than 16.11 answers; avatar null), dmitri (`UNREVIEWED`, avatar
  `https://seccdn.libravatar.org/avatar/<hex>`, a custom Gravatar host → none); approved by chiara; labels `frontend`
  (`#428BCA`/`#FFFFFF`), `bug` (`#D9534F`/`#FFFFFF`), `odd` (`red`/`#FFFFFF` → no colours); `diffStats: []` with
  `diffRefs` set → zero size; a pipeline.
- !51 (`updateMergeRequest` true): author null; nobody assigned, no reviewer, no label; `diffStats: []`, `diffRefs:
  null` → no size.
- !50 (`updateMergeRequest` false): author ben; assignee dmitri; reviewers anna (`REQUESTED_CHANGES`), sam
  (`REVIEW_STARTED`), ben (`REVIEWED`), and one with `"MERGE_TRAIN_REVIEW"` (unknown → requested); approved by anna and
  sam; stats present.
- `graphql-merge-request-52.json`, `-50.json`: `REVIEWERS_QUERY`'s answers (reviewers with `id`
  `gid://gitlab/User/<n>`; !52's dmitri still `UNREVIEWED`); `post-1.json` (`200 OK`): the Rereview of ben on !52,
  answering ben `UNREVIEWED`; `post-2.json` (`200 OK`): a payload `errors: ["<GitLab's sentence>"]`.
- `pictures/uploads/-/system/user/avatar/1/avatar.png` and `/2/avatar.png`: small real PNGs (a few hundred bytes);
  `pictures/uploads/-/system/user/avatar/3/avatar.png`: a text file (→ refused), named by a fourth person's avatar in
  `REVIEWERS_QUERY`'s answer or a unit test.

`scripts/gitlab-playground.sh`: a branch `feature/empty` at `main`'s tip and `open_merge_request feature/empty "Empty
change"` (the owner runs the script; this slice never writes to GitLab).

## Change

1. Reproduce first (rule 10): with the logged-in glab in `../glab-yamt-playground` (as `briefs/mr-diff-stats.md`
   Acceptance did), run the **new** list query text with `glab api graphql` (read-only) and paste per node `iid
   detailedMergeStatus conflicts diffRefs diffStats headPipeline { status } userPermissions`, the `avatarUrl` forms
   (uploaded path, Gravatar host and query: which of `secure.gravatar.com`/`www.gravatar.com` gitlab.com answers), the
   `reviewState`/`approved` values and `queryComplexity`; compare each `detailedMergeStatus` with the same query
   without the new fields. If the playground has an empty merge request, its node is the owner's case; if not, say so
   (the owner's check runs the extended playground script). Fetch one listed uploaded avatar with `glab api <address>`
   and paste its first 8 bytes. Write nothing to GitLab.
2. `lib.rs`: the types above; `MergeRequestRow`'s fields; docs.
3. `query.rs`: the list fields, `REVIEWERS_QUERY`, `REREQUEST_MUTATION` and its body builder; tests.
4. `page.rs`: node structs for the new fields (a user node with `avatar_url`, kept beside the `Person` it becomes; a
   reviewer node with the interaction; a label node with colours; `diff_refs`; `user_permissions`); the fold of the
   review state; label colour check; the size rule; `ParsedPage` carries each row's uploaded pictures; `page/tests.rs`
   for each.
5. `picture.rs`: `AvatarSource`, `avatar_source`, `PictureAddress`, `GravatarAddress`, `ImageKind`, `Picture`,
   `fetch_picture`, `MAX_PICTURE_BYTES`; unit tests.
6. `list.rs`: `ListedPage` to `on_page` (pictures deduplicated by username within the page, the last wins).
7. `rerequest.rs`: `rerequest_review` as above; `project.rs` gains `From<NoProject> for RerequestReply`.
8. `src-tauri/src/merge_requests.rs`: `forward_page` takes `ListedPage`, records offered pictures in
   `pictures.offered`, sends `page`; the `rerequest_review` command; `merge_requests/pictures.rs`: the shelf, the gate
   (at most `PICTURE_FETCHES` glab runs, a `Mutex<usize>` + `Condvar`, or any std means as readable), a pure
   `picture_answer(state, glab, path) -> tauri::http::Response<Vec<u8>>` and the asynchronous handler around it;
   `commands.rs`: the command in the list, `register_asynchronous_uri_scheme_protocol(PICTURE_SCHEME, …)` in
   `with_commands`; `tauri.conf.json`: the CSP.
9. Fake glab routes, the scenario, `README.md`; `scripts/gitlab-playground.sh`; the crate's `AGENTS.md`.
10. Update the existing tests that read `approvals`, `labels`, `reviewers` or people (crate and `src-tauri`) to the new
    shapes.

## Acceptance

- Tests (`cargo nextest run -p yamt-merge-requests` with the hermetic prefix as `just test`, and `-p yamt-app
  merge_requests`), each named for the bug it catches, at least:
  - `page/tests.rs`: `an_empty_diff_with_diff_refs_is_a_zero_size`, `no_files_and_no_diff_refs_is_no_size`,
    `files_count_whatever_diff_refs_says`, `review_states_fold_into_four_and_an_unknown_one_is_requested`,
    `approved_true_reads_approved_whatever_the_review_state`,
    `approvers_reach_the_row_by_name_and_the_count_is_their_number`, `a_label_colour_that_is_not_hex_is_no_colour`,
    `a_null_author_is_none`, `the_update_permission_is_may_rerequest`.
  - `picture.rs`: `only_an_uploaded_avatar_on_the_projects_origin_is_an_uploaded_address` (path, same-origin https,
    `http`, another host, `..`, another path, a port), `only_gravatars_avatar_path_on_its_two_hosts_is_a_gravatar_address`
    (both hosts, MD5 and SHA-256 lengths, `http://`, a look-alike host, another path, a custom host, a query with other
    characters), `a_picture_that_is_not_png_jpeg_gif_or_webp_is_refused`, `a_picture_over_one_mib_is_refused`.
  - `tests/list.rs` (fake glab, `mr-row-details`): `the_details_scenario_brings_author_pictures_approvers_states_and_label_colours`
    (whole rows compared: anna and sam `Uploaded`, ben `Gravatar { address }`, chiara and dmitri `None`); offered
    pictures anna and sam only; `a_gravatar_person_is_never_fetched_through_glab` (no fake-glab log line names a
    Gravatar host, after the list and after the scheme is asked for ben).
  - `tests/rerequest.rs`: `a_done_reviewer_is_asked_again_by_global_id_with_the_exact_body` (the logged `stdin:` line
    equal to the expected JSON), `someone_no_longer_a_reviewer_is_refused_before_any_write` (no `stdin:` line),
    `a_reviewer_still_awaiting_review_is_not_asked_again` (dmitri on !52: `Requested`, no `stdin:` line),
    `the_only_write_is_the_rereview_mutation` (the body names `mergeRequestReviewerRereview`, no other mutation in any
    run), `a_mutation_error_comes_back_as_one_sentence` (`Refused { message }` equal to the recorded one),
    `a_merge_request_no_longer_open_is_not_open`.
  - `tests/picture.rs`: `a_listed_picture_is_fetched_through_glab_byte_for_byte`.
  - `src-tauri`: `only_an_offered_username_gets_a_picture`, `a_picture_is_fetched_once_per_run` (the fake log counts one
    call for two asks), `at_most_four_pictures_are_fetched_at_once` (pictures with `.sleep`, the log's overlap),
    `rerequest_review_replies_on_paths_glab` (`through_glab`), `the_csp_admits_the_scheme_and_gravatars_two_hosts_only`
    (reads `tauri.conf.json`: `img-src` is exactly the contracted list in both `csp` and `devCsp`).
- `cargo clippy --workspace --all-targets -- -D warnings`, `cargo fmt --all --check`, `just arch-check`: summary lines.
- The step 1 real run pasted (score, statuses with and without the fields, the avatar address forms, the picture's
  first bytes, the empty merge request's node or its absence).
- `just mutants HEAD` in your workspace (SP11).

## Skills

`skill://rust-conventions`, `skill://ipc-contract`, `skill://risk-register` (RK40, RK41, RK53, RK54),
`skill://verification`.
