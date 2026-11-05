# MentionFacts: `@` completion in comment fields

## Summary
- Text that reaches GitLab is typed in three textareas (no CodeMirror):
  - the merge-request thread panel's reply field;
  - the range window's thread box, which only makes local notes;
  - the range window's Post and Edit editor. Only the Post box queues text for GitLab.
- A people search already exists: `searchPeople` → GraphQL `autocompleteUsers`, at most 20, sorted by name. The range window can call it too, since its source includes `MergeRequestSource`.
- That search keeps one shared state per window, so a second consumer would collide with the people box.
- `@` completion is listed as a non-goal in `request-mr-threads.md`. Adding it reopens that request.
- `@codemirror/autocomplete` is not a direct dependency, and `ui/` has no caret or mirror helper.

## 1. Where comment text is typed

### A. `ui/MergeRequestReplyField.vue` (bottom of the thread panel)
- **Element:** `<textarea v-show="writing" v-model="text" @keydown="keyPressed">` (:183-191).
  - It grows to fit its content, 3 to 12 lines (`fit`, :36-37, :106-121).
- **Owning state:** the window's merge-request slice, reached through `useMergeRequests()` (:41).
  - `replyTexts`/`setReplyText` are keyed by `DiscussionId`, owned by `mergeRequestThread.ts` (:46-47, :145-151, :249).
  - `setText` resets the preview to writing (:151).
- **Windows:** the merge-request page appears in the **compare** and **range** windows only.
  - Each creates the slice through `windowMergeRequests`: `compareStore.ts:128`, `rangeStore.ts:181`.
  - Each renders `MergeRequestsView`: `CompareApp.vue:96`, `RangeApp.vue:153`.
  - No merge-window root renders it (grep found only these two).
- **Sent to GitLab:** yes.
  - "Add comment" calls `sendReply("comment")`, which posts a note to the discussion.
  - "Add review" calls `sendReply("draft")`, which posts a draft note. Both via REST (plan §2 #181).
  - Mod-Enter is the same as "Add comment" (:147-150).
- **Keys:**
  - Only `boxKeydown` is bound (`boxKeys.ts`): `Mod-Enter` submits, `Escape` cancels (closes the panel).
  - Both call `preventDefault` and `stopPropagation`. IME composing is ignored (`boxKeys.ts:12-15, 17-19, 31-35`).
  - No Tab or arrow handlers; every other key behaves as normal in the textarea.
  - The panel's own element `keydown` and a window `keydown` both close the panel on any Escape that is not `defaultPrevented`, except while `asking` or while a description is open (`MergeRequestThread.vue:53, 108-119, 141`).
  - **So a completion popup must consume Escape before `boxKeydown`, or Escape closes the panel.**
- **Shift tap:** not in `boxKeys.ts`. It is `useShiftTaps()` in `MergeRequestDiscussions.vue:112-117`, guarded by `isTypingTarget(document.activeElement)`, so Shift typed in a textarea never switches the thread (RK73).
- **Write/Preview:** two `aria-pressed` buttons (:166-181).
  - Preview hides the field.
  - `keepFocus` moves focus to the panel while previewing (:131-137), because of the focus-fixup rule.
  - A text containing `@` always previews through GitLab: trigger T1 (`mr-fast-preview-design.md:101-102`).

### B. `ui/RangeThreadBox.vue` (range window, one box per thread)
- **Element:** `<textarea :value @input="typed" @keydown="keydown">` (:189-197). Draft prompt is 3 rows, reply prompt 1 row.
- **Owning state:** `useRangeStore().threads`.
  - A new thread's draft is `rangeDrafts.ts` `writeDraft`.
  - A reply is `writeNote` → `note-<id>` (`rangeDrafts.ts:205-208, 216-221`).
- **Window:** range only. Boxes are teleported into CodeMirror hosts (`ui/AGENTS.md:11`).
- **Sent to GitLab:** no.
  - Comment calls `threads.addThread`/`addNote`, which store a local note in `threads.json` (:131-133).
  - "Ask AI" sends the text to the AI only (:96).
- **Keys:**
  - `boxKeydown`: Mod-Enter submits; Escape drops the draft or clears the reply (:146, `cancel` :138-143).
  - Buttons use `@mousedown.prevent` so focus stays in the field.
  - Typing does not reach the editor: RK35, and the WebKit test `rangeThreads.browser.test.ts:389`.
  - The window `keydown` calls `fileListKey` and the search toggle (`RangeApp.vue:54-57`).
- **Write/Preview:** none.

### C. `ui/RangeMessageEditor.vue` (`box="post" | "edit"`, in place of a message)
- **Element:** `<textarea rows=4 @input @keydown>` (:65-73), keys via `boxKeydown` (:59).
- **Owning state:** drafts keyed by `MessageId`: `postDraft`/`writePost` and `editDraft`/`writeEdit`.
- **What is sent:**
  - **Post** ("Text to post", Queue) is the only text that goes to GitLab. It is prefilled with the note's text (`RangeMessage.vue:63`), queued with `queueMessage`, and sent later by Send as a draft note (plan §2 #118).
  - **Edit** changes a local note only (`editNote`).
- **Write/Preview:** none.

### D. `ui/rangeGitLab.ts`
Holds the check, Send and the post/send button views. It has no text field.

## 2. Existing people search

### Frontend state
- **Where:** `ui/mergeRequestPeople.ts`.
- **Debounce:** `SEARCH_PAUSE_MS = 250`, from GitLab's `DEFAULT_DEBOUNCE_AND_THROTTLE_MS` (:15-16).
- **Calls:**
  - `searchPeople(typed)`: `searchedText(typed) === ""` → `empty` at once; otherwise `searching { text, people: last }`, then `source.searchPeople` after the pause (:115-124).
  - `endPeopleSearch()` resets the state.
  - A stale answer is dropped by the `calls` counter (:99-110).
- **State type:** `PeopleSearch` = `empty | searching | found | refused { reply } | failed { cause }` (:18-29).
- **Single window-wide state:** one `shallowRef` per slice (`searchOf`, :96-128), exposed as `peopleSearch` on `useMergeRequests()` (`ui/AGENTS.md:75` says "the window's one search").
  - Any second caller cancels the people box's search and replaces what it shows.
  - `MergeRequestPeople.vue` calls `searchPeople("")` when the field opens (:209) and `endPeopleSearch()` when it closes (:193). Both would reset another consumer's search.
  - The people box (a row's hover box) and the thread panel are separate hover areas. Whether both can be open at once: `[INFERENCE: yes]`.
- **`searchedText`:** trims, drops one leading `@`, trims again (`mergeRequests/internal/suggestions.ts:74-78`).
- **Empty-field suggestions:**
  - `peopleSuggestions(rows, row, group, me)`: Me, then the row's author, assignees, reviewers and approvers, then the loaded rows' people by count. At most `SUGGESTED_PEOPLE = 20` (`suggestions.ts:5-6, 38`; `mergeRequests/AGENTS.md:27`).
  - An empty text is never sent to GitLab. Measured: GitLab answers 20 by name with bots first (plan §2 #169, rejected-alternatives column).

### IPC
- `MergeRequestSource.searchPeople(text): Promise<SourceResult<PeopleSearchReply>>` (`ipc/MergeRequestSource.ts:54-55`).
- Tauri wrapper: `tauriMergeRequests.ts:74-80` → `commands.searchPeople(text)` (`bindings.ts:93`).
- Fixture: `ipc/fixtureMergeRequestPeople.ts:105`.

### Rust
- **Tauri command:** `src-tauri/src/merge_requests.rs:322-332`, `search_people(window, text)` → `blocking_reply` → `people::search_reply`.
  - No `state.gitlab` → `Failed(NO_PROJECT)`.
  - Otherwise it calls the crate, then `state.pictures.offer(found.pictures)` before replying (RK53) (`merge_requests/people.rs:9-23`).
- **Crate function:** `pub fn search_people(repository: &GitLabRepository, glab: Option<&Glab>, text: &str) -> FoundPeople` (`crates/merge-requests/src/people_search.rs:56-61`).
  - No glab → `GlabMissing`.
  - Then `repository.logged_in_project(glab)`: the remembered project, otherwise `glab auth status` plus `glab api projects/:fullpath`, i.e. the project of the repository's remotes (`project.rs:15, 91-110`, plan §2 #187).
  - Then one `glab api graphql` call.
  - On failure, `refusal` turns the error into `NotLoggedIn` or `Failed` (:79-95).
- **Query** (`query.rs:48-52, 190-203`):

  ```graphql
  query PeopleSearch($fullPath: ID!, $search: String!) { project(fullPath: $fullPath) { autocompleteUsers(search: $search) { username name avatarUrl } } }
  ```

  - Sent as `-f query=… -f fullPath=… -f search=<text>`. The raw field means a leading `@` is never read as a file (measured).
  - Complexity score 13 of 250.
- **Reply:** `PeopleSearchReply` = `found { people: Person[] }` (GitLab's order, at most 20 from `Autocomplete::UsersFinder::LIMIT`) | `glabMissing` | `notLoggedIn { detail }` | `failed { message }`. An older GitLab's "Field 'autocompleteUsers' doesn't exist" is a `failed` (:13-33).
  - `autocompleteUsers` needs GitLab 16.3+; yamt's floor is 15.6 (`mr-people-design.md:40-45`).
  - It finds `project.authorized_users`, active users only, invited groups included, sorted by name, no pages. A 1-letter search works (`mr-people-design.md:29-34`).
- **Person and picture:** the domain type is `{ username, name, picture: string | null }` (`ipc/mergeRequestDomain.ts:14-18`).
  - `toPerson`: `uploaded` → `yamt-picture://localhost/<username>`, served only after Rust offered it; `gravatar` → the address as given; `none` → null (:109-122).
  - Rendering: `MergeRequestPicture.vue` shows initials on a hue (`pictureHue(username)`) with an `<img referrerpolicy=no-referrer>` on top. Sizes `row | stack | box`.

### Listbox and keyboard pattern (`MergeRequestPeopleSearch.vue`)
- `<input role=combobox aria-autocomplete=list aria-expanded=true aria-controls aria-activedescendant>` (:113-128).
- `<ul role=listbox>` with `<li role=option aria-selected aria-disabled @mousedown.prevent @click>` (:129-140).
- ArrowUp/Down use `ARROW_STEPS` (`menuKeys.ts:3`) with `steppedHighlight` (wraps, skips disabled lines).
- Enter adds the highlighted line; Escape emits close. All three call `preventDefault` (:92-106).
- The highlight survives a list change (`keptHighlight`). The active option is scrolled into view (`scrollIntoView` with `block: "nearest"`, :45-56).
- Each line shows the picture, the name and a muted `@username` (:141-143). A `role=status` note shows "Searching…", "No one found" or a failure (:155-160).

## 3. Range window context
- `RangeSource extends SettingsSource, ReviewSource, MergeRequestSource` (`ipc/RangeSource.ts:7`), so the range window can call `searchPeople`.
- The range window also has the merge-request slice (`rangeStore.ts:181`) and `MergeRequestState` built on `range.root()` (`src-tauri/src/range.rs:61`).
  - The window fence has no rule against `Range*` files importing `mergeRequestsStore` (`frontend/scripts/windowFence.ts:19-23, 47-61`).
- Posting goes through `yamt-review`'s own code path:
  - `glab auth status` (`send.rs:287-291`).
  - `projects/:fullpath/merge_requests?source_branch=` or `…/commits/<sha>/merge_requests` (`crates/review/src/gitlab.rs:54-67`).
  - `lines_up` (#119), then `POST projects/<project_id>/merge_requests/<iid>/draft_notes` (`gitlab.rs:80-99`).
  - It does not use `GitLabRepository`'s remembered project (grep found none).
- **What the window knows:** `GitLabCheck.linedUp { mergeRequest: { reference: "!12", title, webUrl } }` (`ipc/reviewDomain.ts:42-45, 73-75`).
  - It has no numeric iid and no project path. Rust's internal `MergeRequest` has `iid` and `project_id` but they are not exposed over IPC (`gitlab.rs:23-24`).
  - It is known only after `checkGitLab` (`rangeGitLab.ts:122-136`).

## 4. GitLab's own `@` autocomplete

### Frontend (`app/assets/javascripts/gfm_auto_complete.js`, master, read 2026-11-05)
- `at: '@'` → `members` (:1646); backend-filtered (:1663).
- Inserts `${atwho-at}${username}`. Shows 10 (`limit: 10`), debounce 250 ms, first item highlighted (:607-643).
- Sort for a query: members whose name or username *includes* the query, with *starts-with* matches first (`Members.sort`, :1740-1747). Matching uses `"<NameWithoutSpaces> <username>"` (:154-156).
- Docs agree: starts-with first, then includes; a full name works without spaces (`@rosygrant`); "Users and groups, 10" (https://docs.gitlab.com/user/project/autocomplete_characters/).

### Backend
- Route: `Projects::AutocompleteSourcesController#members` → `Projects::ParticipantsService#execute(target)`, where `target` comes from `params[:type]`/`type_id` (an iid) (https://gitlab.com/gitlab-org/gitlab/-/raw/master/app/controllers/projects/autocomplete_sources_controller.rb).
- Order of results (https://gitlab.com/gitlab-org/gitlab/-/raw/master/app/services/projects/participants_service.rb and `users/participable_service.rb`):
  1. the noteable's author;
  2. its participants, sorted by username;
  3. project members (`project.authorized_users`: `gfm_autocomplete_search(...).limit(10)` when searching, otherwise all, sorted by username);
  4. users already mentioned in the editor (`mentioned[]`, up to 10);
  5. the current user's authorized groups (when the members did not hit the limit), as `{type:"Group", username: full_path, count}`.
- Duplicates are removed. EE adds the Duo review bot.
- **`@all`:** absent from master's ParticipantsService and from gfm_auto_complete.js. I found no `all_members`. Older versions offered it: unverified.

### Reachable through `glab api`?
**Unverified.**
- `glab api` takes "a path to a GitLab API v4 endpoint, or `graphql`" (https://docs.gitlab.com/cli/api/).
- `/<project>/-/autocomplete_sources/members` is a web route (Rails controller), not `/api/v4`.
- Whether a token (`PRIVATE-TOKEN`) is accepted there, and whether `glab api` accepts a non-v4 path, was not measured.
- GraphQL has no participants-first autocomplete. `autocompleteUsers` is name-sorted and limited to 20 (§2).

## 5. Prior decisions to reopen or amend
- **Non-goal:** `docs/slices/request-mr-threads.md:184-187`, "a Markdown editor (toolbar, colours, `@` completion)". Repeated in `docs/slices/briefs/mr-threads-panel.md:34-35`. A mention feature reopens this (DR4).
- I found no other `@`-completion decision in `docs/`, `docs/slices/archive`, `SLICES.md` or `findings.jsonl` (grep).
- **Plan rows affected:**
  - #169: search used only by the people box; "the window's one search".
  - #170: Escape closes the field, then the box; refocus only from the body.
  - #181: reply/draft writes.
  - #183: the panel and Shift via `isTypingTarget`.
  - #185 and #189: no Escape leaves the page.
  - #186 and #188: an `@` text previews through GitLab.
  - #118–#120 for the range window. #120: text typed but not added is not kept.
- **Same decision in a different place:** `docs/plan.md:407-409` rejects the `codemirror` bundle: "no completion popups in a merge window".
- **Risks** (`.omp/skills/risk-register/SKILL.md`):
  - RK35 (:49): typing in a thread box loses focus or reaches the editor. Owners: `threadHosts.ts`, `boxKeys.ts`.
  - RK65 (:79): the people box closes under typing; a slow search answer replaces a newer one.
  - RK73 (:87): panel Escape and focus rules (Escape order, the focus-fixup rule, Shift in the field).
  - RK53: pictures only after an offer.
  - RK54: no write from a search.
  - RK71: `@all`/groups/code never count as mentions.
  - RK74: a mention previewed locally.

## 6. Completion and caret helpers
- `frontend/package.json:19-25` lists only `@codemirror/{commands,language,language-data,lint,search,state,view}`.
- `@codemirror/autocomplete@6.20.3` appears only as a transitive dependency of the `lang-*` packages (`frontend/pnpm-lock.yaml:447, 3404-3434…`).
- No `frontend/src` file imports it (grep `autocomplete|completion`).
- `ui/` has no caret helper, mirror div, `selectionStart`/`setRangeText` use, or textarea coordinate code. Grep outside `editor/` found only theme `--color-caret` and a `SearchPanel.vue` select workaround.
- All three comment fields are plain `<textarea>`s (§1). A caret-position measure would be new code.

## Files
- `frontend/src/ui/MergeRequestReplyField.vue`: the thread panel's reply field.
- `frontend/src/ui/MergeRequestThread.vue:53, 108-119`: the panel's Escape handling.
- `frontend/src/ui/mergeRequestThread.ts:45-60, 145-151, 219-251`: reply texts, send, preview.
- `frontend/src/ui/boxKeys.ts`: the Mod-Enter/Escape box keys.
- `frontend/src/ui/RangeThreadBox.vue`, `frontend/src/ui/RangeMessageEditor.vue`, `frontend/src/ui/RangeMessage.vue:59-145`: the range window's fields.
- `frontend/src/ui/rangeDrafts.ts`, `frontend/src/ui/rangeGitLab.ts`: range drafts, check and Send.
- `frontend/src/ui/mergeRequestPeople.ts:15-128`: search state.
- `frontend/src/ui/MergeRequestPeopleSearch.vue`: the combobox pattern.
- `frontend/src/ui/mergeRequestPeopleLines.ts:15-143`: lines and highlight.
- `frontend/src/mergeRequests/internal/suggestions.ts`: suggestions and `searchedText`.
- `frontend/src/ipc/{MergeRequestSource,RangeSource,ReviewSource,reviewDomain,mergeRequestDomain,tauriMergeRequests}.ts`: IPC.
- `crates/merge-requests/src/{people_search.rs,query.rs:44-52,186-203,project.rs:91-110}`: search and project.
- `src-tauri/src/merge_requests.rs:60-90, 322-332`, `src-tauri/src/merge_requests/people.rs`, `src-tauri/src/range.rs:61`, `src-tauri/src/window.rs:98`: commands and per-window state.
- `crates/review/src/{gitlab.rs,send.rs,lines_up.rs}`: range posting.

**Checks for main:** none run. This was an investigation only.