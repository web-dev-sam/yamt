# PlanScoutMrPeopleFacts

Agent output (`agent://PlanScoutMrPeopleFacts`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-03T21-08-17-015Z_01a1a33d-c5f7-7658-b66f-85ea275269a1/PlanScoutMrPeopleFacts.md), collected 2026-11-03T21:14:29.058Z.

All eight questions are answered below with a `path:line` or a URL. The two main design constraints:
- **New pictures aren't offered:** the re-request reply's people never go through the shell's picture offer. A person added from a search would get a broken picture until the next list load (RK53).
- **Free tier drops extras:** on Free, GitLab quietly cuts both the reviewer list and the assignee list to one person. Its `errors` list stays empty, so "add a second person" looks like it worked.

Facts I worked out from GitLab's source rather than its docs are marked `[INFERENCE]`.

## 1. Re-request path, end to end
**Rust (`crates/merge-requests/src/rerequest.rs`, 276 lines)**
- **Reply type:** `RerequestReply` at `:17-47` has 7 kinds: `Requested{reviewers}`, `NotReviewer`, `NotOpen`, `GlabMissing`, `NotLoggedIn{detail}`, `Refused{message}`, `Failed{message}`. The serde tag is `kind`, camelCase.
- **Entry:** `pub fn rerequest_review(repository, glab, iid, username) -> RerequestReply` at `:95-108` logs `outcome` (the kind only) at `:205-216`. The work is in `asked_again` at `:110-138`:
  1. glab missing → `GlabMissing`.
  2. `logged_in_project` (`project.rs:35`).
  3. `fresh_reviewers` (`:141-157`) reads `REVIEWERS_QUERY` through `glab.get`. A state other than `OPENED` → `NotOpen`.
  4. The username isn't among the reviewers → `NotReviewer`, with no write.
  5. The reviewer is still awaiting review (`is_awaiting_review`, `people.rs:182`) → `Requested` with the fresh reviewers, no write.
  6. Otherwise it builds `rerequest_body(full_path, iid, &asked.id)` and calls `glab.post(root, &GRAPHQL_BODY_ARGS, body)`.
- **GitLab calls (`query.rs`):**
  - `REVIEWERS_QUERY` at `:20-23`: `project(fullPath){ mergeRequest(iid){ state reviewers{ nodes{ id username name avatarUrl mergeRequestInteraction{approved reviewState} }}}}`. This is the only place a user's global id is fetched.
  - `REREQUEST_MUTATION` at `:27-30`: `mergeRequestReviewerRereview(input:{projectPath, iid, userId: UserID!}){ errors mergeRequest{ reviewers{…} } }`.
  - `GRAPHQL_BODY_ARGS = ["api","graphql","--input","-"]` at `:33`.
  - The body is JSON `{query, variables:{projectPath, iid (string), userId}}`; the id travels as a variable (`:147-153`).
  - `reviewers_args`/`merge_request_args` at `:97-99` send `-f query= -f fullPath= -f iid=`.
- **How a refusal becomes one sentence:** `rereviewed` at `:161-180`.
  - A glab `Err` → `Failed{message}`.
  - `graphql_data` (`page.rs:178`) returns GitLab's first top-level `errors[].message` as `Err` → `Failed`.
  - A missing payload or a missing `mergeRequest` → `Failed{"GitLab's answer names no merge request"}` (`:14`).
  - The payload's first `errors[]` string → `Refused{message}`.
  - Otherwise `requested()` at `:182-189` turns the nodes into `Reviewer`s and warns once per unknown review state.
- **Picture gap:** `requested()` creates a `People` and then throws away `people.pictures` (`:183-188`). The re-request path offers no new pictures.
- **No `glab_answer.rs` here.** That file is `crates/review/src/glab_answer.rs`, which handles REST statuses (`posted` at `:25`). Plan #153 rejects it for this path.
- **glab calls:** `Glab::get` and `Glab::post(cwd, args, body)` at `crates/gitio/src/glab.rs:102,107`.

**Tauri shell (`src-tauri/src/merge_requests.rs`, 413 lines)**
- The command is `rerequest_review<R>(window, iid: MergeRequestIid, username: String) -> Result<RerequestReply, IpcError>` (async, `blocking_reply`), at about `:302-317`.
- The helper `rerequested` at `:172-184` answers `Failed{NO_PROJECT}` when the window has no GitLab repo.
- It is registered at `src-tauri/src/commands.rs:83`.
- There is no `offer(...)` call on this path. The list path offers pictures through `offer()` at `:98-106` and `forward_page()` at `:121-125`.

**Generated binding:** `commands.rerequestReview(iid, username)` → `__TAURI_INVOKE("rerequest_review", {iid, username})` at `frontend/src/ipc/bindings.ts:85`. The type is at `bindings.ts:1034`, and `mayRerequest` at `bindings.ts:693`.

**ipc layer**
- `MergeRequestSource.rerequestReview(iid, username): Promise<SourceResult<RerequestReply>>` at `ipc/MergeRequestSource.ts:32`.
- The real source is `tauriMergeRequests.ts:87-91`. It converts the reply with `toRerequestReply(reply, uploadedPicture)` (`mergeRequestDomain.ts:161-167`), which turns `uploaded` pictures into scheme URLs.
- The domain type is at `mergeRequestDomain.ts:63-65`.

**UI (`frontend/src/ui/mergeRequestRerequests.ts`, 82 lines)**
- `createRerequests({source, report, replaced})` at `:73`.
- It keeps `asks: ShallowRef<Map<iid, Map<username, RerequestAsk>>>`, where `RerequestAsk` is `running` or `refused{reply}` (`:7-14`).
- `rerequestReview` at `:43-66`:
  - It returns at once if that person's ask is already `running`.
  - A thrown call clears the ask and reports `step: "rerequestReview"`. The step is in `problem.ts:49`; its text is "Could not re-request the review" (`problemText.ts:83`).
  - `requested` → `deps.replaced(iid, reply.reviewers)` and clears the ask.
  - Anything else becomes `refused`.
- `dismissRerequestRefusals` keeps only the running asks (`:68-71`).
- The refusal text comes from `rerequestReplyText` (`mergeRequestsText.ts:131-152`). `refused` and `failed` show `reply.message` verbatim.

**How the row updates:** it is patched locally only; the list is not reloaded. `rerequestsOf.replaced` (`ui/mergeRequests.ts:137-148`) maps over the rows, replaces `reviewers` on the matching iid in `state.rows`, and also in `state.running.buffer` when a buffered refresh is in flight.

**Wiring**
- `MergeRequestsView.vue:62,264,270-271` passes `:asks="rerequests.get(row.iid) ?? NO_ASKS"`, `@rerequest-review`, and `@people-box-closed="requests.dismissRerequestRefusals"`.
- `MergeRequestRow.vue:47,55,153-155` forwards those events.

## 2. `MergeRequestPeople.vue` (208 lines)
- **Interface:** props `{ row: MergeRequestRow; asks: ReadonlyMap<string, RerequestAsk> }`; emits `rerequestReview: [username]` and `closed` (`:42-43`).
- **Stack:** `peopleStack(row.assignees, row.reviewers)` (`:62`). It shows 3 overlapping pictures plus "+N" inside an opener `<button>` (`:127-145`). With nobody on the row, a placeholder picture carries `NO_PEOPLE_TEXT` (`:103-110`).
- **Hover box:** `useHoverBox({area, opener, box})` (`:55-59`, `ui/useHoverBox.ts`). It opens on pointer enter or focus, closes on leave, scroll outside or Escape, and exposes `open`, `placement` and `on.*`. The box is a `fixed` div with `max-h-[60vh] max-w-[30rem]`, `tabindex=-1` (`:146-152`). Closing emits `closed` (`:65-69`).
- **Assignees group** (`:153-165`): an `ASSIGNEES` header, then a `<ul>` of rows with picture and `displayName`. Assignees have no controls.
- **Reviewers group** (`:166-205`), one `<li>` per reviewer:
  - picture and name;
  - a right-aligned span holding the optional re-request button, then the state icon (Lucide icon per `REVIEW_STATE_LOOKS`, `:45-50`);
  - an optional refusal `<p role=status>` under the reviewer.
- **The button** shows only when `row.mayRerequest && reviewDone(state)` (`:79-82`). It uses `aria-disabled` and `aria-busy` while running, `data-rerequest=username`, a `RotateCcw` icon or a `LoaderCircle` spinner, and `v-tooltip=REREQUEST_REVIEW`.
- **Focus:** `keepFocusInBox` (`:87-99`) moves focus to the box when the focused button disappears.
- **Menus:** `useHoverMenu.ts` exists; per plan #155 it drives the filter bar, not this box.
- **`Person` fields:** only `username`, `name` and `picture: PersonPicture` (`uploaded` | `gravatar{address}` | `none`) (`crates/merge-requests/src/people.rs:9-19`).
  - There is no id, global or numeric. The list query asks `username name avatarUrl` only (`query.rs:53-55`).
  - Only `REVIEWERS_QUERY` fetches `id`, kept privately in `FreshReviewer` (`rerequest.rs:64-70`).
  - `mergeRequestSetAssignees` and `mergeRequestSetReviewers` take usernames (Q6), so no id is needed for them.
- **`Reviewer`** is `{person, state}` (`people.rs:50-57`).
- **`MergeRequestRow`:** `author: Option<Person>`, `assignees: Vec<Person>`, `reviewers: Vec<Reviewer>`, `approved_by`, `may_rerequest` (= `userPermissions.updateMergeRequest`) (`lib.rs:232-244`, `page.rs:213-224`).

## 3. Where the people come from, and "Me"
- **List query (`query.rs:41-70`):** includes `currentUser { username }` (`:46`), `author {username name avatarUrl}`, `assignees { nodes { username name avatarUrl } }` (`:53`), `reviewers { nodes { username name avatarUrl mergeRequestInteraction {approved reviewState} } }` (`:54`), `approvedBy` and `userPermissions { updateMergeRequest }`. It cost 170 of GitLab's limit of 250, measured 2026-11-02 (`:36-40`).
- **Parsing (`page.rs:102-105, 213-224`):** `People::person` and `People::reviewers` (`people.rs:111-146`). `People` collects `OfferedPicture`s for uploaded avatars, and `review_state` folds `approved` first (`people.rs:151-166`).
- **Viewer:** yes, the page knows it. `MergeRequestPage.me: Option<String>` ("The logged-in user's username", `lib.rs:261-262`) comes from `currentUser.username` (`page.rs:167`).
  - In the UI it is `state.me` (`ui/mergeRequests.ts:51,84,99-107,119,236,266`).
  - The view destructures `viewer` (`MergeRequestsView.vue:64`).
  - `MergeRequestPeople` does not receive `me`.
- **Fixture viewer:** `FIXTURE_ME = "sam"` (`ipc/fixtureMergeRequestData.ts:4`), sent as `me` (`fixtureMergeRequests.ts:268`).

## 4. Fake glab, scenarios, fixtures
- **`scripts/fake-glab/glab`** (POSIX sh) — the `api()` dispatch:
  - `"POST graphql"` → `post` when `--input -`, else `graphql`.
  - `post()` reads the counter in `$YAMT_FAKE_GLAB_STATE`, increments it, and replies with `post-<n>.{json,status,err,exit,sleep}` (default status `201 Created`).
  - `graphql()` routes a field `iids` → `graphql-discussions-…`, a field `iid` → `graphql-merge-request-<iid>`, otherwise `graphql-page-<n>`.
  - stdin is logged as `stdin: <body>`, argv as `argv: …`.
  - Posts are counted by order, not by mutation name: any `--input -` GraphQL post is "post n".
- **README:** `tests/glab/README.md:19-36` (file table; `post-<n>` covers "the re-request mutation") and `:133-151` (the `mr-row-details` scenario).
- **`tests/glab/mr-row-details/`:**
  - User `sam`.
  - !52: assignee sam; reviewers ben (`REVIEWED`), chiara (approved), dmitri (`UNREVIEWED`).
  - !50: `updateMergeRequest` false.
  - `graphql-merge-request-52.json` is the fresh reviewers answer (ben `gid://gitlab/User/4`, chiara `/5`, dmitri `/6`). `-50.json` reports merged.
  - `post-1.json` is a successful re-request of ben answering `UNREVIEWED`. `post-2.json` is `{"errors":["Reviewer not found"]}`.
  - The `crowd/` subfolder is for pictures.
- **Other scenario dirs** under `tests/glab/`: merge-requests, mr-discussions, mr-review-mode, ci-job-log, mr-conflicts, local-conflicts, logged-out, refusal, slow-post, etc.
- **Tests on this scenario:**
  - `crates/merge-requests/tests/rerequest.rs` (exact body; `NotReviewer`, `NotOpen` and still-awaiting cases make no write; `the_only_write_is_the_rereview_mutation` at `:113-142` asserts no argv contains `mutation`, `-X`, `reviewer_ids` or `SetReviewers`; refusal as one sentence; logged-out).
  - `src-tauri/src/merge_requests/tests/rerequest.rs` (command through `run_with_fakes(…, "mr-row-details")`).
- **Frontend fixture (`ipc/fixtureMergeRequests.ts`):**
  - `rerequestScript` (`:219-229`) logs `mergeRequests.fixture_rerequest`, waits `RE_REQUEST_PAUSE_MS = 1000` (`:70`), then answers `rerequestReply` (`:174-189`).
  - `REFUSING_REVIEWER = "dmitri"` → `refused{"You are not allowed to re-request a review on this merge request."}` (`:72`; `fixtureMergeRequestData.ts:62`).
  - A non-reviewer → `notReviewer`. Otherwise the listed row's reviewers come back with that person set to `requested`.
  - There is no state between calls: each answer is computed from `fixtureRows`.
- **Fixture people:** `PEOPLE` = sam, anna, ben, chiara, dmitri (`fixtureMergeRequestData.ts:54-60`). `mayRerequest` is false on every 9th row (`:223`).

## 5. User search and known people
- **No user search exists anywhere in the tree.** A grep for `projectMembers|autocompleteUsers|users(search|mergeRequestSetAssignees|mergeRequestSetReviewers|SetReviewers|SetAssignees` finds only:
  - plan and brief text forbidding `mergeRequestSetReviewers`;
  - the test guard;
  - `.omp/run/findings.jsonl:2104` (owner #2104: "no SetReviewers path").
- **People the page already knows:** `personChoices(rows, "assignees" | "reviewers", me, held)` (`frontend/src/mergeRequests/internal/choices.ts:70-108`; called at `ui/mergeRequestFilters.ts:106-108`).
  - `peopleOf` (`:41-57`) counts each person over all loaded rows, separately for each field: assignees from `row.assignees`, reviewers from `row.reviewers`.
  - Authors and approvers are not used for the filters.
  - These are `{username, name}` pairs with counts. Pictures are on the rows' `Person`s.

## 6. GitLab facts
- **`mergeRequestSetAssignees(input:{projectPath: ID!, iid: String!, assigneeUsernames: [String!]!, operationMode: MutationOperationMode = REPLACE})`** returns `errors: [String!]!` and `mergeRequest`.
  - Current reference: https://docs.gitlab.com/api/graphql/reference/mutations/ (l. 9650-9668).
  - Present with `operationMode` in v15.2.0-ee (`index.md:3674`) and v15.3.0-ee (`:3654-3674`). First version: older than 15.2, exact one unknown.
- **`mergeRequestSetReviewers(input:{projectPath, iid, reviewerUsernames: [String!]!, operationMode = REPLACE})`** has the same return fields (mutations ref l. 9766-9784).
  - Absent from v15.2.0-ee; present with `operationMode` from the start in v15.3.0-ee (`index.md:3761-3781`, https://gitlab.com/gitlab-org/gitlab/-/raw/v15.3.0-ee/doc/api/graphql/reference/index.md). Introduced by https://gitlab.com/gitlab-org/gitlab/-/merge_requests/94294, merged 2022-08.
  - yamt's existing floor is 15.6 (`detailedMergeStatus`, `mr-row-details-design.md:39-41`), so both mutations exist with `operationMode` there.
  - `operationMode` values are `REPLACE`, `APPEND` and `REMOVE`, computed against the current list in source: `set_reviewers.rb` `reviewer_ids` (https://gitlab.com/gitlab-org/gitlab/-/raw/master/app/graphql/mutations/merge_requests/set_reviewers.rb) and `concerns/mutations/assignable.rb` `transform_list` (https://gitlab.com/gitlab-org/gitlab/-/raw/master/app/graphql/mutations/concerns/mutations/assignable.rb).
- **Unknown usernames:**
  - On current master, `mergeRequestSetReviewers` reports them in `errors` ("Reviewers not able to be set: …"). That is recent: https://gitlab.com/gitlab-org/gitlab/-/merge_requests/249348 and issue https://gitlab.com/gitlab-org/gitlab/-/work_items/611232. Older GitLab drops them silently.
  - The assignee mutation drops them silently: `UsersFinder` and no error (`assignable.rb`).
  - A user without `read_merge_request` → error "Cannot assign @x to !n" (`update_service.rb` `new_user_ids`, l. 380-399, https://gitlab.com/gitlab-org/gitlab/-/raw/master/app/services/merge_requests/update_service.rb).
- **Permission:** both services return unchanged without `set_merge_request_metadata`, and they add no error (`update_reviewers_service.rb` l. 6, `update_assignees_service.rb` l. 10). [INFERENCE: the mutation's `authorized_find!` needs `update_merge_request`, which is the same permission as `may_rerequest`.]
- **Free tier:**
  - Docs: "On GitLab Free, you can assign one user per merge request. On GitLab Premium and GitLab Ultimate, you can assign multiple users" (https://docs.gitlab.com/user/project/merge_requests/ l. 206-207). "GitLab Premium and Ultimate enable you to select more than one reviewer" (https://docs.gitlab.com/user/project/merge_requests/reviews/).
  - Source: core `reviewer_ids` and `assignee_ids` use `.first(1)` (https://gitlab.com/gitlab-org/gitlab/-/raw/master/app/services/merge_requests/update_reviewers_service.rb, …/update_assignees_service.rb). EE lifts the limit only when the licensed features `multiple_merge_request_reviewers` or `multiple_merge_request_assignees` are on (ee/…/update_reviewers_service.rb, ee/…/update_assignees_service.rb).
  - [INFERENCE from that code] On Free, `APPEND` with one person already there builds `[old, new]`, truncates it to `[old]`, sees no change, and returns silently with `errors: []`. The answered `mergeRequest` still lists only the old person.
  - [INFERENCE] `REMOVE` and `REPLACE` with one name work on Free.
- **User search for an MR:**
  - `Project.autocompleteUsers(search: String): [AutocompletedUser!]` (objects ref l. 16480). It is absent in v16.2.0-ee and present in v16.3.0-ee (`index.md:21132`), so it is newer than yamt's 15.6 floor.
  - The resolver passes only `search` to `Autocomplete::UsersFinder` (https://gitlab.com/gitlab-org/gitlab/-/raw/master/app/graphql/resolvers/autocomplete_users_resolver.rb).
  - `AutocompletedUser` has `id: UserID!`, `username`, `name`, `avatarUrl`, and `mergeRequestInteraction(id: MergeRequestID!)` (objects ref l. 2988-3060).
  - `Project.projectMembers(search:, relations:, sort:, accessLevels…)` is a `MemberInterfaceConnection` (objects ref l. 16663). It has `search` and `relations` already in v15.6.0-ee (`index.md:17690-17692`).
- **Approvals when a reviewer is removed:**
  - Not stated in the docs; I found no doc saying either way.
  - In source, `UpdateReviewersService#execute` changes only `reviewer_ids` and does no approval write. `handle_reviewers_change` sends notes, notifications and todos (`base_service.rb`, https://gitlab.com/gitlab-org/gitlab/-/raw/master/app/services/merge_requests/base_service.rb).
  - [INFERENCE] The approval stays, and the person stays in `approvedBy`.
  - Re-adding someone who already approved marks their reviewer state `approved` (`set_reviewers_approved`, same file).
  - A reviewer change creates a system note, a notification and a todo (`handle_reviewers_change`).

## 7. Plan rows and risk register
- **#151** (`docs/plan.md:183`): the row's people fields come from the list query. Rejected: asking for people on hover (an extra call per hover).
- **#153** (`docs/plan.md:185`): "Re-request review is GitLab's own control … no button for assignees; nothing adds a reviewer". Rejected: "`mergeRequestSetReviewers` or REST `reviewer_ids` (adds reviewers: owner #2104) … `glab_answer::posted` … a button for every person (owner #2104)". **The new request reopens #153's "nothing adds a reviewer" and must amend it** (decision-record).
- **Other places stating the same:**
  - `docs/slices/briefs/mr-row-details-rust.md:22` (non-goal: "adding, assigning or removing anyone (owner #2104: `mergeRequestSetReviewers` and REST `reviewer_ids` are never called)").
  - `mr-row-details-design.md:62-65`.
  - `request-mr-row-details.md:91-92`.
- **#154** (`:186`): hover texts use `v-tooltip`; rich content goes in `useHoverBox`.
- **#155** (`:187`): filters, `useHoverMenu`, "Me"/"None" choices by count.
- **#156** (`:188`): due dates are local.
- **#157** (`:189`): defaults from the row-details design, including "refusal stays until the box closes" and `REVIEW_STARTED` → no re-request button.
- **#163** (`:195`): the viewer is the list's `me`.
- **RK53** (risk-register SKILL): the window loads only avatars that GitLab listed and the shell offered. The owners are `avatar_source` and the shell's `picture_answer` (offered usernames only). A person added from a search must be offered before the picture scheme serves them, and today's re-request path offers nothing.
- **RK54:** a review must not be re-requested from a non-reviewer or twice, and nothing may add a reviewer. The owner is `rerequest_review` (fresh query, `mergeRequestReviewerRereview` only). Its proving test `the_only_write_is_the_rereview_mutation` (`crates/merge-requests/tests/rerequest.rs:113-142`) greps argv for `mutation` and `SetReviewers`, so it must change once this ships.
- **RK55:** stored filters (`not:` prefix).
- **RK56:** due-date day counting.
- **None of RK53–56 covers assignee writes, Free-tier truncation, or removing an approver.**

## 8. Line counts
| file | lines |
|---|---|
| `frontend/src/ui/MergeRequestPeople.vue` | 208 |
| `crates/merge-requests/src/rerequest.rs` | 276 |
| `src-tauri/src/merge_requests.rs` | 413 |
| `frontend/src/ui/mergeRequestRerequests.ts` | 82 |

Also mentioned above: `ui/mergeRequests.ts` is 299 lines and `ipc/fixtureMergeRequests.ts` is 284.

## Files
- `crates/merge-requests/src/rerequest.rs:17-216` — reply enum, fresh check, mutation, refusal mapping.
- `crates/merge-requests/src/query.rs:20-33,41-70,97-99,147-153` — queries, mutation, body.
- `crates/merge-requests/src/people.rs:9-57,111-185` — `Person`, `Reviewer`, `People`, review states.
- `crates/merge-requests/src/page.rs:167,178,213-224,247` — `me`, `graphql_data`, row people, `listed`.
- `crates/merge-requests/src/lib.rs:45,232-265` — exports, `MergeRequestRow`, `MergeRequestPage.me`.
- `src-tauri/src/merge_requests.rs:98-125,172-184,~302-317` — offer, `rerequested`, command.
- `src-tauri/src/commands.rs:83` — registration.
- `frontend/src/ipc/{bindings.ts:85,1034; MergeRequestSource.ts:32; tauriMergeRequests.ts:87-91; mergeRequestDomain.ts:63-65,161-167; fixtureMergeRequests.ts:70-72,174-229; fixtureMergeRequestData.ts:4,54-62,223}`
- `frontend/src/ui/{mergeRequestRerequests.ts; mergeRequests.ts:137-148; MergeRequestPeople.vue; useHoverBox.ts; mergeRequestsText.ts:127-152; MergeRequestRow.vue:47-56,153-155; MergeRequestsView.vue:44,62-64,264-271}`
- `frontend/src/mergeRequests/internal/choices.ts:41-108` — known people per field.
- `scripts/fake-glab/glab`, `tests/glab/README.md:19-36,133-151`, `tests/glab/mr-row-details/`
- `crates/merge-requests/tests/rerequest.rs`, `src-tauri/src/merge_requests/tests/rerequest.rs`

## Architecture
1. Click in `MergeRequestPeople` emits `rerequestReview(username)`.
2. `MergeRequestRow` and then `MergeRequestsView` call `requests.rerequestReview(iid, username)`.
3. `createRerequests` marks the ask `running` and calls `source.rerequestReview`, which is either the Tauri command `rerequest_review` or the fixture script.
4. The shell calls `yamt_merge_requests::rerequest_review`, which runs glab auth, the project lookup, the fresh `REVIEWERS_QUERY`, then `glab api graphql --input -` with the mutation.
5. The `RerequestReply` comes back. `toRerequestReply` turns `uploaded` pictures into URLs.
6. On `requested`, `replaced()` patches that row's `reviewers` in `rows` and in the buffered refresh. Any other reply stays as a refusal under the reviewer until the box closes (`closed` → `dismissRerequestRefusals`).
