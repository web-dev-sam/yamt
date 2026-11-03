# People on a merge request: add and remove assignees and reviewers — design

Request: `docs/slices/request-mr-people.md` (rules 1–8 settled; this design closes its "To be measured" list and
refines only details a rule names). Base `21f71b1b`. Facts:

- `.omp/run/notes/PlanScoutMrPeopleFacts.md` (cited "facts §n"), used as given.
- The designer's reads of GitLab's own source on 2026-11-03 (cited by URL; `master`).
- The designer's GraphQL calls to gitlab.com, logged out, 2026-11-03 (cited "measured"). Logged out the complexity limit
  is 200; logged in it is 250 (`query.rs:36-40` records 170 of 250 for the list).

The designer had no shell, so nothing was timed and no glab call was made. Timings and the logged-in scores are the
rust slice's step 1. No write was made to any GitLab. Anything else unmeasured is marked `[INFERENCE]`.

## 1. The request's "to be measured", closed

### 1.1 Search: which GitLab field, and what an empty search gives

- **GitLab's own merge-request dropdown asks `Project.autocompleteUsers(search:)`.**
  - Source: `sidebar/queries/constants.js` `userSearchQueries[TYPE_MERGE_REQUEST]` →
    `graphql_shared/queries/project_autocomplete_users_with_mr_permissions.query.graphql`.
  - That query is `project(fullPath) { users: autocompleteUsers(search: $search) { …User … mergeRequestInteraction(id:
    $mergeRequestId) { canMerge } } }`.
  - `vue_shared/components/user_select/user_select.vue` debounces typing by `DEFAULT_DEBOUNCE_AND_THROTTLE_MS`, which is
    250 (`lib/utils/constants.js:2`).
  - It merges the merge request's participants, filtered locally, into the results.
  - After a pick it clears the field and focuses it again (`clearAndFocusSearch`).
  - When the project does not allow several assignees, a pick _replaces_ the one assignee (`selectAssignee`:
    `selected = [user]`).
- **What `autocompleteUsers` finds.**
  - The resolver passes only `search` to `Autocomplete::UsersFinder` (`resolvers/autocomplete_users_resolver.rb`).
  - The finder (`app/finders/autocomplete/users_finder.rb`) searches `project.authorized_users`: everyone with access,
    groups invited to the project included. It keeps active users only, sorts by name, and returns at most `LIMIT = 20`.
    There are no pages.
  - For a project it sets `use_minimum_char_limit: false`, so a one-letter search works.
- **Measured on gitlab-org/gitlab, search "hamm":**
  - `autocompleteUsers` found 7 people, score 13 of 200.
  - `projectMembers(search:, first: 20)` found 4, score 17 of 200. It missed `imohammed-ext`, `kmuhammad-ext` and
    `mahsan-ext`, who have access through an invited group.
  - So `projectMembers` does not find "anyone in the project" (owner #2244).
- **Version.**
  - `autocompleteUsers` exists from GitLab 16.3; `projectMembers(search:)` from 15.6 (facts §6). yamt's floor is 15.6.
  - On 15.6–16.2 the search answers GitLab's error ("Field 'autocompleteUsers' doesn't exist on type 'Project'"
    `[INFERENCE]`), shown as one sentence. "Me" and the people the page knows can still be added from the empty field
    (§1.6).
  - Open question 1.
- **Empty search (measured).**
  - `autocompleteUsers(search: "")` answers the first 20 by name, bots included: `ai-experimental-evaluate-generated-docs-gitlab-org`,
    `project_278964_bot_996f…`, then `ajbiton`, and so on.
  - That list is no use as a suggestion, so the window never sends an empty search. Its empty field shows its own
    suggestions (rule 2, §1.6).
- **Cost and time.**
  - One search is 13 of the 200 logged-out limit (measured; the logged-in score is the rust slice's step 1).
  - Time is not measured here. One glab run on gitlab.com is about 1–2 s `[INFERENCE: the discussions batch of 20 took
    4.47 s, mr-discussions-design.md:18-19]`, so the 250 ms pause (rule 2) saves most calls while typing.
  - The rust slice times one search on gitlab-org/gitlab and on the playground (rust brief step 1).
- **Leading "@".** Users type "@ben". The window drops one leading `@` and the spaces around the text before searching
  (core `searchedText`). An empty result is the empty field.
- **The text crosses as a raw field.** It is sent as `-f search=<text>`, never `-F` (`-F` reads `@file`; `-f` is a raw
  string `[INFERENCE: glab api --help, as gh]`). Rust brief step 1 checks `-f search=@sam` on gitlab.com.

### 1.2 Writes: the two mutations, `APPEND` and `REMOVE`, and their answers

- **The calls.**
  - `mergeRequestSetAssignees(input: {projectPath, iid, assigneeUsernames, operationMode})` and
    `mergeRequestSetReviewers(input: {projectPath, iid, reviewerUsernames, operationMode})` both answer `errors:
    [String!]!` and `mergeRequest` (facts §6).
  - Both exist with `operationMode` at yamt's 15.6 floor (facts §6).
  - They take usernames, so no global id is read first (facts §2).
- **`APPEND` and `REMOVE` work on GitLab's list at that moment** (rule 8).
  - `set_reviewers.rb` `reviewer_ids`: `APPEND` → `user_ids(resource.reviewers) | new_reviewer_ids`; `REMOVE` →
    `user_ids(resource.reviewers) - new_reviewer_ids` (read 2026-11-03).
  - `assignable.rb` `transform_list` does the same for assignees (facts §6).
  - So yamt never reads a list first and never writes a whole list.
- **GitLab Free.**
  - `UpdateReviewersService#reviewer_ids` is `filter_sentinel_values(params.fetch(:reviewer_ids)).first(1)`. `execute`
    returns unchanged when `old_ids.to_set == new_ids.to_set`, and adds no error (`update_reviewers_service.rb`, read
    2026-11-03).
  - So on Free, `APPEND` of a second reviewer builds `[old, new]`, keeps `[old]`, sees no change and answers
    `errors: []` with the old list.
  - Assignees behave the same (`update_assignees_service.rb`, facts §6). EE lifts the cut only with the licensed
    features (facts §6).
  - `REMOVE` works on Free `[INFERENCE: the cut of a shorter list is a no-op]`.
- **A user who may not change people.**
  - `UpdateReviewersService#execute` returns unchanged without `set_merge_request_metadata`, and adds no error.
  - The mutation's `authorized_find!` needs `update_merge_request` (`authorize_granular_token permissions:
    :update_merge_request`, `set_reviewers.rb`). Without it the call answers a top-level GraphQL error `[INFERENCE: the
    resource-not-available message]`.
  - The page shows the controls only when `userPermissions.updateMergeRequest` is true (rule 1; `may_rerequest`,
    `page.rs:222-224`).
- **Unknown usernames.**
  - Current GitLab answers `errors: ["Reviewers not able to be set: <names>"]` for reviewers (`set_reviewers.rb`
    `unresolved_errors`, gitlab!249348). That becomes `Refused`.
  - An older GitLab drops unknown reviewers silently, and the assignee mutation always does (facts §6). That becomes
    `Unchanged` (§1.3).
  - The window only sends usernames GitLab gave it, from a search or a row, so this is rare.
- **"Cannot assign @x to !n"** (a user without `read_merge_request`, `update_service.rb` `new_user_ids`, facts §6)
  arrives in `errors` → `Refused`.
- **The answer patches the row.**
  - The mutation's `mergeRequest` is asked for both lists, with the same fields the list query reads:
    `assignees { nodes { username name avatarUrl } } reviewers { nodes { username name avatarUrl
    mergeRequestInteraction { approved reviewState } } }` (`query.rs:53-54`).
  - So one answer patches both of the row's lists. A change someone else made meanwhile shows too (rule 5).
- **One parser for both mutations.** The mutation field is aliased `changed:` in both texts. One `Deserialize` type
  then reads either answer.
- **Removing a reviewer who approved** changes only `reviewer_ids`. The approval stays (facts §6), and `approvedBy` is
  not in the answer, so the row's approvals stay as listed (rule 7).

### 1.3 Never claiming what GitLab did not do (rule 6)

Rust compares GitLab's answered list with the asked change:

| asked      | the answered group                                                        | reply                                                                  |
| ---------- | ------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| add `u`    | contains `u` (ASCII case-insensitive, as GitLab's `unresolved_usernames`) | `Changed { people }`                                                   |
| add `u`    | lacks `u`                                                                 | `Unchanged { people }`: GitLab Free, no permission, or an unknown user |
| remove `u` | lacks `u`                                                                 | `Changed { people }`                                                   |
| remove `u` | contains `u`                                                              | `Unchanged { people }`                                                 |

`Changed` and `Unchanged` both carry GitLab's two lists, and the row takes them in both cases (rule 5). `Unchanged` also
leaves one sentence in the box (§1.7). A top-level error is `Failed`. A payload `errors` entry is `Refused` with
GitLab's first sentence, as the re-request does (`rerequest.rs:160-181`).

### 1.4 Pictures (RK53)

- Today the re-request answer's pictures are dropped (`rerequest.rs:183-190`). The scheme serves only usernames a list
  offered (`pictures.rs:52-58`, `picture_answer` `:103-123`).
- **Both new paths return their `OfferedPicture`s beside the reply**, as `ReadDiscussions { rows, pictures }` does
  (`discussions.rs:102-107`).
- The shell offers them (`state.pictures.offer`) **before** the reply reaches the window (`merge_requests/discussions.rs:9-25`
  is the pattern).
  - A searched person's uploaded picture loads while they are only a search result.
  - After the change, everyone in GitLab's answer has theirs, including people someone else added meanwhile.
- Gravatar and none pass as today (`people.rs:111-128`).
- The re-request path is unchanged: its people are already on the row, so the list offered them.

### 1.5 Fake glab and scenario

- **Posts stay counted by order** (`scripts/fake-glab/glab:115-124`). A test that needs post n first writes n − 1 to
  its state file through a new `Fake::answered_posts(n)` in `crates/merge-requests/tests/fake_glab/mod.rs`. So each
  test reaches its own answer without running the earlier writes, and the fake stays one counter.
  - Routing by mutation name was rejected: it needs JSON parsing in POSIX sh and a second counter per name.
- **A search route.**
  - `graphql()` answers a field `search=<text>` with `graphql-people-<text>.json` (with `.status`, `.err`, `.exit`,
    `.sleep` as every reply).
  - It sits before the `iid` route (`glab:137`). No other query sends a field `search`.
- **A new scenario `tests/glab/mr-people/`.**
  - The list is `mr-row-details/`'s page.
  - It has search answers and posts 1–8 in the real-app order (rust brief).
  - `mr-row-details/` keeps its posts for the re-request tests.

### 1.6 The box: add field, suggestions, keys

- **Add buttons.** Each group header ("Assignees", "Reviewers") has an add button when `row.mayRerequest` (Lucide
  `user-plus`, tooltip "Add assignee" / "Add reviewer").
  - Both groups then always show, even with nobody in them; an empty group reads "None".
  - A row with nobody keeps today's dimmed icon only when it is not editable. When editable it opens the box like any
    stack (`MergeRequestPeople.vue:103-110` today shows no box).
- **The field.** A click opens a search field in that group, focused. One field is open per box.
- **Empty field: suggestions** (core `peopleSuggestions`, pure):
  - "Me" first: the viewer, `me`, with their picture when they appear on any loaded row, else initials of the username.
  - Then this merge request's own people: author, assignees, reviewers, approvers.
  - Then everyone else on the loaded rows, by how many rows hold them in this group, then by name
    (`byCountThenLabel`, `choices.ts:26-28`).
  - Each person once; at most 20 lines (GitLab's `LIMIT = 20`).
  - The viewer's display name is not known when they are on no loaded row: the list query asks `currentUser {
    username }` only (`query.rs:46`). The "Me" line shows "Me" and `@username`, so it needs no name. Changing
    `MergeRequestPage.me` into a person was rejected: it touches every `me` user (filters, discussions, review mode)
    for a picture.
- **Typing** searches GitLab after a 250 ms pause. The previous results stay shown with "Searching…" until the answer.
  An answer to a search older than the latest one sent is dropped (rule 2).
- **Each line:** picture, full name (`displayName`), muted `@username`.
  - A person already in that group reads "Already an assignee" / "Already a reviewer", is `aria-disabled`, and cannot
    be added (rule 2).
  - A person whose add is queued or running shows the spinner.
- **Picking.**
  - Click, or Enter on the highlighted line (ArrowDown/ArrowUp move it over addable lines, wrapping, as `ARROW_STEPS`
    in `menuKeys.ts`), adds at once.
  - The field clears and keeps focus (GitLab's `clearAndFocusSearch`), so the list is the suggestions again.
- **Escape** in the field closes the field with `preventDefault` (`useHoverBox.ts` keyPressed skips a prevented
  Escape, `:72-78`), and focus returns to the add button. A second Escape closes the box.
- **Accessibility.** The field is `role="combobox"` with `aria-controls` and `aria-activedescendant`; lines are
  `role="option"`. A line's `mousedown` is prevented, so the field keeps focus.

### 1.7 Remove, working, notices

- **Remove (#2245).** Each assignee and reviewer line ends with an `ellipsis-vertical` button (tooltip "More").
  - On reviewers it comes after today's re-request button and state icon (rule 3).
  - It opens a click-only menu with one item, "Remove assignee" / "Remove reviewer" (`role="menuitem"`). Choosing it
    removes the person at once.
  - It is one `useDropdownMenu` per menu (`useDropdownMenu.ts`: click toggle, focus moved into the menu, Escape/Tab
    close with `preventDefault` `:94-104`, click outside closes `:129-142`).
  - `useHoverMenu` was rejected: it opens on hover (`useHoverMenu.ts:24-29`), and rule 3 wants a deliberate click.
- **The menu is a DOM child of the box**, `position: fixed` and placed by `useMenuPlacement`, clamped. So
  `useHoverBox`'s one inside rule (pointer or focus inside the area, `useHoverBox.ts:56-70`) holds the box while the
  menu is open, as `CiStatusJobLog.vue` does.
- **Working.**
  - A person whose remove is queued or running shows the spinner in place of the ellipsis, with `aria-busy` and
    `aria-disabled`; the menu cannot open.
  - An added person shows the spinner on their result line.
  - When a reply removes the focused control, focus moves to the box (today's `keepFocusInBox`,
    `MergeRequestPeople.vue:87-99`, widened to every control).
- **One at a time per merge request** (rule 4).
  - The slice keeps a queue per iid: its head runs, the rest wait.
  - An equal change already queued is not queued again.
  - Changes on different merge requests run side by side.
- **Notices (rule 6).** A change GitLab did not make leaves one sentence:
  - a remove → under that person's line while they are listed;
  - else under its group's list.
  - It stays until the box closes, as the re-request's refusal does (#157). The box's close drops them; running and
    waiting changes are kept.
  - A new change for the same person and group drops that person's old sentence.
  - A thrown IPC call is a notice too, in the problem bar's words for the step, and never reaches the problem bar
    (rule 6: in the box). The discussions box does the same (`mergeRequestsText.ts:83-87`).

### 1.8 Where it lives

- **Rust** decides only GitLab's data:
  - the search and its pictures;
  - the one mutation and its answer;
  - changed or not, by comparing the answer (§1.3).
- **Core** (`mergeRequests/`, pure) holds:
  - the suggestions' order;
  - the search text rule;
  - the one "Me" word, now a constant shared with the filters (`filters.ts:203-204`, `choices.ts:65-67` today spell it
    twice).
- **The state slice** (`ui/mergeRequestPeople.ts`, held by `mergeRequests.ts`) holds:
  - the window's one search (`peopleSearch`);
  - the per-iid queue and notices (`peopleAsks`);
  - the row patch, `withPeople`, the one writer of a row's people after the list. The re-request's `replaced`
    (`mergeRequests.ts:137-148`) goes through it too.
- **The page** reaches all of it through `useMergeRequests()` (PM10; as `CiStatusBox.vue:44` and
  `MergeRequestDiscussions.vue:28`). So `MergeRequestRow.vue` and `MergeRequestsView.vue` do not change.

## 2. Options

The options differ in where the search runs and where the list arithmetic happens.

### Option A — GitLab's autocomplete per paused keystroke; one APPEND or REMOVE per change; the window queues per merge request (recommended)

**Data structures:**

- Rust (`yamt-merge-requests`, two new modules):
  - `people_search.rs`: `PeopleSearchReply` found { people } | glabMissing | notLoggedIn | failed, and the shell's
    `FoundPeople { reply, pictures }`.
  - `people_change.rs`: `PeopleGroup` assignees | reviewers, `PeopleAction` add | remove, `PeopleChange { group,
    action, username }`, `MergeRequestPeople { assignees, reviewers }`, `PeopleChangeReply` changed { people } |
    unchanged { people } | glabMissing | notLoggedIn | refused | failed, and the shell's `ChangedPeople { reply,
    pictures }`.
- Commands: `search_people(text)`, `change_people(iid, change)`.
- Window:
  - `PeopleSearch` empty | searching { text, people } | found { text, people } | refused { text, reply } | failed
    { text, cause };
  - `RowPeopleAsks { queue: PeopleChange[], notDone: NotDone[] }` per iid; the head of `queue` is the running change;
  - `NotDone { change, why: unchanged | refused { reply } | failed { cause } }`.

**Files:**

- Rust (about 20 files):
  - the two modules, `query.rs`, `project.rs`, `lib.rs`;
  - `tests/people.rs`, `tests/rerequest.rs` (the RK54 test), `tests/fake_glab/mod.rs`;
  - `src-tauri/src/merge_requests.rs`, `merge_requests/people.rs`, `merge_requests/tests/people.rs`, `commands.rs`;
  - the fake glab, the scenario and its README.
- Core (5 files): `internal/suggestions.ts` and its test, `filters.ts`, `choices.ts`, `index.ts`.
- State (about 19 files): `ipc/MergeRequestSource.ts`, `mergeRequestDomain.ts`, `tauriMergeRequests.ts`, the
  fixtures (`fixtureMergeRequestPeople.ts` new), `ui/mergeRequestPeople.ts` (new), `mergeRequests.ts`, `problem.ts`,
  `problemText.ts`, and tests.
- Page (8 files): `MergeRequestPeople.vue`, `MergeRequestPeopleSearch.vue` and `MergeRequestPersonMenu.vue` (new),
  `mergeRequestPeopleLines.ts` (new, pure) and its test, `mergeRequestsText.ts` and its test, `ui/AGENTS.md`.

**Risks:**

- GitLab before 16.3 has no search (open question 1).
- A filter the change breaks keeps the row until its box closes (owner #2246, request rule 9).
- A refresh that GitLab answered before the write landed brings the old lists back until the next refresh
  `[INFERENCE: needs a refresh racing the write by ≤ 1 s]`.
- The fixture keeps its changes in memory, and a fixture refresh shows the scripted rows again.

**Tests:**

- Rust:
  - exact argv and body of each call;
  - `Changed`/`Unchanged` from the answer;
  - refusal and failure as one sentence;
  - "only these writes" (RK54);
  - pictures offered before the reply (RK53).
- State:
  - the 250 ms pause and latest-only answers;
  - queue order and dedupe;
  - both lists patched in rows and in a buffering refresh;
  - notices kept until dismissed.
- Core: the suggestions' order and cap.
- Page: line model and highlight stepping; WebKit steps for typing, keys, menus and hover holding.

**Visions:**

- 2: GitLab's answer is the one source of each list; one row-people writer.
- 4: sum types for every reply; a change is one value; the queue's head is the running change by construction.
- 5: two commands, no cache, no new dependency.

### Option B — Load the project's people once, filter in the window; writes as A

**Data structures:**

- `list_project_people() -> ProjectPeople { people: Vec<Person> } | …`, paging `projectMembers(first: 100, after:)`
  until done.
- The slice keeps `projectPeople: Person[] | null`, loaded on the first add and kept for the window's life.
- The search is a core filter over it; there is no pause and no race.

**Files:** as A, plus a paging loop and a cache owner in the slice; minus the search route and the latest-only logic.

**Risks:**

- `projectMembers` misses people with access through an invited group (measured: 4 of 7). Rule 2's "anyone in the
  project" fails.
- gitlab-org/gitlab's members run to thousands `[INFERENCE]`: dozens of glab calls against the 20 s deadline
  (`glab.rs:10`), and thousands of pictures offered.
- The list goes stale: someone given access after the load is not found.

**Tests:** paging limits, a cache cleared on refresh, local matching.

**Visions:** 5 partly (no per-keystroke calls). It fails rule 2 and adds a second copy of GitLab's membership, which
costs vision 2.

### Option C — Read the list afresh, write the whole list with REPLACE

**Data structures:**

- `change_people` reads `mergeRequest { assignees reviewers }` first (as `REVIEWERS_QUERY`, `query.rs:20-23`), computes
  the new list in Rust, and sends `operationMode: REPLACE` (GitLab's own page sends the whole list:
  `update_mr_assignees.mutation.graphql`).
- It can answer `NotOpen` before writing.

**Files:** as A, plus a fresh query and list arithmetic.

**Risks:**

- Two calls per change.
- A change made on GitLab between the read and the write is overwritten (rule 8: "a change made meanwhile on GitLab by
  someone else is kept").
- It cannot detect Free before writing either.

**Tests:** as A, plus the computed list.

**Visions:** 3 at most. It costs vision 2 (yamt computes a list GitLab owns) and rule 8.

## 3. Recommendation

**Option A.** It finds what GitLab's own dropdown finds, with the same query and pause. Each change is one write that
GitLab applies to its own current list (rule 8). The window shows only GitLab's answer, and says so when the answer
lacks the change (rule 6).

**Cost:**

- About 20 Rust files with tests and scenario, 5 core, 19 state and 8 page files: four implementer slices, at most two
  at once.
- A self-managed GitLab older than 16.3 gets no search (open question 1).
- The `may_rerequest` field keeps its name. Its documentation now names all three uses. Renaming it would touch files
  of all three web and Rust slices for a name (`page.rs:222`, `fixtureMergeRequestData.ts:223`,
  `MergeRequestPeople.vue:80` and their tests), and the slices must own disjoint files.

### Proposed plan §2 rows (DR5: the orchestrator records them; numbers as free at commit time)

| #             | **Decision**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Rejected alternatives & why                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Vision  |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------- |
| 153 (amended) | … "no button for assignees; nothing adds a reviewer" becomes "**the re-request never adds a reviewer; adding and removing people is #169**" (owner #2243–#2245 reopen it, DR4). The rest stands.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | (unchanged; add:) superseded in part by #169: the owner now asks to add and remove people (#2243)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | 3, 4, 5 |
| 169           | **People on a merge request: added by GitLab's autocomplete, removed behind a menu, one APPEND or REMOVE of one username per change** (owner #2243–#2245; request `docs/slices/request-mr-people.md` rules 1–8; design `briefs/mr-people-design.md` option A; amends #153; reopens request-mr-row-details rule 3). **Search:** `search_people(text) -> PeopleSearchReply` found { people } \| glabMissing \| notLoggedIn \| failed: `project(fullPath) { autocompleteUsers(search: $search) { username name avatarUrl } }` with `-f search=`, as GitLab's own dropdown (16.3+; at most 20, GitLab's `LIMIT`); the window sends it 250 ms after the last key (GitLab's `DEFAULT_DEBOUNCE_AND_THROTTLE_MS`), never for an empty text (core `searchedText`: trimmed, one leading `@` dropped), and drops an answer older than the latest search sent. **Change:** `change_people(iid, change: PeopleChange { group: assignees \| reviewers, action: add \| remove, username }) -> PeopleChangeReply` changed { people } \| unchanged { people } \| glabMissing \| notLoggedIn \| refused { message } \| failed { message }: one `mergeRequestSetAssignees`/`mergeRequestSetReviewers` aliased `changed:`, `operationMode` `APPEND`/`REMOVE`, `[username]`, body on stdin; its answer's `assignees` and `reviewers` become `MergeRequestPeople`; `unchanged` when the answered group does not show the change (GitLab Free's `.first(1)`, no permission, an unknown user); the payload's first `errors` → `refused`; a top-level error → `failed`. Both paths offer their uploaded pictures before replying (RK53). **Window:** controls only when `mayRerequest` (`updateMergeRequest`); add (`user-plus`) per group header opens a focused field whose empty state suggests Me, this merge request's people, then the loaded rows' people by count (core `peopleSuggestions`, ≤ 20); remove behind `ellipsis-vertical` → "Remove assignee/reviewer" (`useDropdownMenu`, a DOM child of the box); per iid a queue (head runs, equal changes once); `changed`/`unchanged` rewrite both lists of the row in `rows` and a buffering refresh through `withPeople` (the re-request's path too); `unchanged`, `refused`, a failure: one sentence in the box until it closes. | `projectMembers(search:)` (misses people with access through an invited group: 4 of 7 on gitlab-org/gitlab, measured 2026-11-03); the project's people loaded once and filtered in the window (thousands of members on large projects, stale, the same misses); a fresh read then `REPLACE` (two calls; a change made meanwhile is lost, request rule 8); `REPLACE` with the page's list (rule 8); REST `PUT merge_requests/:iid` `assignee_ids`/`reviewer_ids` (whole lists by id); an empty search to GitLab for suggestions (answers 20 by name, bots first, measured); `useHoverMenu` for remove (opens on hover, owner #2245 wants a click); a confirmation (owner #2245); renaming `mayRerequest` (touches every slice's files for a name; its doc names the three uses) | 2, 4, 5 |
| 170           | **Defaults decided with the people design** (orchestrator, OR13; the owner may veto): Lucide `user-plus` and `ellipsis-vertical`, tooltips "Add assignee"/"Add reviewer"/"More"; an empty group shows "None" when editable; an editable row with nobody opens the box; after a pick the field clears and keeps focus (GitLab's `clearAndFocusSearch`); "Searching…" over the last results; "No one found"; the Free sentence "GitLab did not add @olga as assignee (GitLab Free allows one assignee per merge request)." (a person not on the row is named by `@username`: the cleared field no longer holds their name) and "GitLab still lists Anna Berg as reviewer."; a search or change lost to an IPC failure says so in the box only; GitLab before 16.3: its error in the box (open question 1); on Free, a second person is not swapped in (open question 2); a row whose people box is open stays shown until the box closes, even when filters or the search drop it (owner #2246).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | —                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | 1       |

### Risks for the register (`skill://risk-register`, next free id RK64)

| id                          | risk                                                                                                                                                                                                                                                                                                                                    | owner                                                                                                                                                                                                                             | proving test                                                                                                                                                                                                                                                              |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| RK53 (owner and test added) | …                                                                                                                                                                                                                                                                                                                                       | adds `yamt-merge-requests` `search_people`/`change_people` (pictures beside the reply) + `src-tauri` `merge_requests/people.rs` (offered before the reply)                                                                        | adds `a_searched_persons_uploaded_picture_is_offered_before_the_reply`, `every_person_in_a_change_answer_gets_their_picture_offered`                                                                                                                                      |
| RK54 (rewritten)            | a review is re-requested from someone who is no longer a reviewer, or twice while it is still requested; **or yamt writes anything to a merge request's people but the re-request's mutation and, per change, one `APPEND` or `REMOVE` of one username in one list** (never `REPLACE`, never a whole list, never a write from a search) | `yamt-merge-requests` `rerequest_review` (fresh reviewers query, `mergeRequestReviewerRereview` only) + `change_people` (`people_change_body`: one mutation, one username, mode from the action) + `search_people` (no `--input`) | `someone_no_longer_a_reviewer_is_refused_before_any_write`, `a_reviewer_still_awaiting_review_is_not_asked_again`, `the_rerequest_path_writes_only_the_rereview_mutation` (renamed), `each_change_writes_one_append_or_remove_of_one_username`, `a_search_writes_nothing` |
| RK64                        | the page shows an add or remove as done that GitLab did not make (GitLab Free keeps one assignee and one reviewer without an error), or a row shows lists GitLab did not answer                                                                                                                                                         | `yamt-merge-requests` `change_people` (`Unchanged` by the answered group) + `ui/mergeRequestPeople.ts` (the row takes only the answered lists; `unchanged` keeps its sentence)                                                    | `an_append_gitlab_dropped_is_unchanged_with_gitlabs_lists`, `a_remove_gitlab_did_not_make_is_unchanged`, `an_unchanged_reply_takes_gitlabs_lists_and_keeps_its_sentence`, WebKit step "Free"                                                                              |
| RK65                        | the people box closes under the user's typing or an open menu, or a slow search answer replaces a newer one                                                                                                                                                                                                                             | `ui/MergeRequestPeople.vue` (field and menu are DOM children of the hover area; Escape handled inside is prevented) + `ui/mergeRequestPeople.ts` (latest search only)                                                             | `an_older_search_answer_is_dropped_once_a_newer_search_was_sent`, WebKit steps "typing holds the box" and "a menu holds the box"                                                                                                                                          |

### Shared edits for the orchestrator (no slice owns them)

- `just bindings` after `mr-people-rust` lands and before `mr-people-state` starts.
  - It brings `PeopleGroup`, `PeopleAction`, `PeopleChange`, `MergeRequestPeople`, `PeopleSearchReply`,
    `PeopleChangeReply`, `commands.searchPeople(text)` and `commands.changePeople(iid, change)`.
  - The frontend stays green after it: only new types and commands.
- No `Cargo.toml` or `package.json` change.
- Plan rows #153 (amended), #169, #170; RK53, RK54 (rewritten), RK64, RK65.
- **Docs keeper (once, after the page slice):**
  - `docs/architecture.md`:
    - the commands list (`:552-554` area): `search_people`, `change_people`;
    - the crate's "Types crossing the IPC" (`:762`) and a "People" paragraph beside "Re-requesting a review"
      (`:859-866`), with the tests line (`:912-918`, scenario `mr-people`);
    - `MergeRequestSource` (`:1161-1162`): `searchPeople`, `changePeople`;
    - the source paragraph (`:1182-1191`): the conversions and the fixture's people script;
    - the state table (`:1288`): the people search and asks;
    - the problem steps (`:1770`): `searchPeople` and `changePeople`, box only.
  - `.omp/skills/ipc-contract/SKILL.md` (`:103`, `:128`): the two command lines and the two source methods.
  - `skill://project-map/tree.md`: the new files `crates/merge-requests/src/people_search.rs`, `people_change.rs`,
    `tests/people.rs`, `src-tauri/src/merge_requests/people.rs`, `tests/people.rs`, `frontend/src/ipc/fixtureMergeRequestPeople.ts`,
    `ui/mergeRequestPeople.ts`, `ui/MergeRequestPeopleSearch.vue`, `ui/MergeRequestPersonMenu.vue`,
    `ui/mergeRequestPeopleLines.ts`, `mergeRequests/internal/suggestions.ts`.
  - `skill://project-map/state.md`: "merge requests: the people search" and "merge requests: people changes per merge
    request" (`ui/mergeRequestPeople.ts`, written only by its functions); the re-request row's `replaced` now goes
    through `withPeople`.
  - `docs/slices/request-mr-row-details.md` rule 3 and its non-goal: a line "reopened by `request-mr-people.md`".
  - `CHANGELOG.md`: one line.
  - The `AGENTS.md` lines the slices hand on in `deviations_from_brief`. `crates/merge-requests/AGENTS.md`,
    `frontend/src/mergeRequests/AGENTS.md`, `frontend/src/ipc/AGENTS.md` and `frontend/src/ui/AGENTS.md` are each
    owned by one slice. `src-tauri/AGENTS.md` is the keeper's, if it counts the commands.
  - `tests/glab/README.md` is the rust slice's own.

## 4. Slice graph

| wave | brief                                  | owner        | needs                                   | beside              |
| ---- | -------------------------------------- | ------------ | --------------------------------------- | ------------------- |
| 1    | `mr-people-rust.md`                    | rust-impl    | —                                       | core                |
| 1    | `mr-people-core.md`                    | web-impl     | —                                       | rust                |
| —    | orchestrator: `just bindings`          | orchestrator | rust                                    | —                   |
| 2    | `mr-people-state.md`                   | web-impl     | rust + bindings, core                   | —                   |
| 3    | `mr-people-page.md` (wires the window) | web-impl     | state                                   | —                   |
| 4    | docs keeper                            | docs-keeper  | page                                    | verify's smoke pass |
| 4    | `mr-people-verify.md`                  | verifier     | page (smoke); docs (final `just check`) | docs keeper         |

At most two implementers run at once (wave 1). Owned files are pairwise disjoint (each brief's Target).

## 5. Open questions for the owner

Each is decided as written (row #170) and the owner may veto:

1. **GitLab older than 16.3 (August 2023) gets no search.** On a self-managed GitLab 15.6–16.2, typing a name shows
   GitLab's error in the box. "Me" and the people on the loaded rows can still be added from the empty field.
   Supporting those servers costs a second search route, `projectMembers`, used only there. On newer GitLab that route
   would miss people who have access through an invited group.
2. **On GitLab Free, adding a second assignee or reviewer is refused, with a sentence.** GitLab's own page swaps the
   person instead: picking someone replaces the one assignee. Swapping in yamt would mean a remove and an add, two
   writes and two notifications, decided without knowing the tier. As written, yamt says GitLab did not add them, and
   the user removes the first person through the menu, then adds.
3. **Answered by the owner (#2246): the row stays until the box closes.** A change that takes the row out of the
   active filters or the search keeps it on the list while its people box is open; it leaves when the box closes
   (request rule 9). State: the set of rows whose box is open, held by the state slice, read by `shownOf`.
