I couldn't write `local://PlanScoutMrThreadFacts.md`: this session has only read, grep, glob and web search, and no tool that writes files. The full findings are below for the main agent to save. Everything was read from the repo unless marked **[EXT]** (GitLab's own source or docs, cited by URL), **[INFERENCE]** or **[UNVERIFIED]**.

**Summary**
- **Discussions today:** Rust reads each open thread's last 20 notes, but only the last note written by a person reaches the window. That note carries author, `createdAt`, raw `body` and a GitLab link. No discussion id, no `bodyHtml`, no edited time, no earlier notes.
- **Turn rule (B):** it lives in the TypeScript core. It compares the last note's author with the viewer, and review mode's order is built on its counts, so changing the rule changes the review order too.
- **Side panel (C):** the CI job log is the precedent for a Shift tap opening a big panel to the left of a hover box. The description's HTML reducer (`described`) takes any HTML plus the merge request's page, so it could reduce a note's `bodyHtml` **[INFERENCE]**.
- **Writing to GitLab:** the merge-request page writes only two things today: re-request review, and add/remove one assignee or reviewer (GraphQL mutations). Draft notes are posted only by `yamt-review` (the range window), whose helpers are crate-private and not a dependency of `yamt-merge-requests`. No reply or resolve exists anywhere.
- **Numbering:** the plan's last row is #178 and the last risk is RK70. Features B and C reopen the discussions request's non-goals ("Replying to, resolving…", "showing whole threads"), plan rows #162–#164 and, for C's rendering, #112 again.
- **Images (A):** `image()` reads only `data-src`/`src`/`alt`/`title`. Width and height are dropped and the window shows images at `max-w-full`.

---

# PlanScoutMrThreadFacts

## 1. Discussions today (query, IPC, setting, fixtures)

**GraphQL query** – `crates/merge-requests/src/query.rs:135-149` (`discussions_query`), args `query.rs:152-177`:
```
query MergeRequestDiscussions($fullPath: ID!, $iids: [String!], $first: Int!, $discussionsAfter: String) {
 queryComplexity { score limit }
 project(fullPath:$fullPath){ mergeRequests(iids:$iids, first:$first){ nodes { iid
  discussions(first: 100, after: $discussionsAfter) { pageInfo { hasNextPage endCursor } nodes {
   resolvable resolved
   notes(last: 20) { pageInfo { hasPreviousPage } nodes {
     system author { username name avatarUrl } body createdAt url position { filePath newLine oldLine } }}}}}}}}
```
- It is sent as `glab api graphql -f query=… -f fullPath=… -F iids=<JSON> -F first=<n> [-f discussionsAfter=<cursor>]` (`query.rs:154-177`).
- Constants (`discussions.rs:17-26`): `DISCUSSION_BATCH = 20` iids per glab call, `DISCUSSIONS_PER_PAGE = 100`, `NOTES_READ = 20`, `MAX_DISCUSSION_PAGES = 10`.
- **Fields read** (`discussions/answer.rs:28-65`):
  - Discussion: `resolvable` and `resolved` only. **No discussion `id`.**
  - Note: `system`, `author` (`UserNode` username/name/avatarUrl, `people.rs:63-69`), `body`, `createdAt`, `url`, `position{filePath,newLine,oldLine}`.
  - **Not read:** `bodyHtml`, `updatedAt`, `lastEditedAt`/`lastEditedBy`, note id, note-level resolvable/resolved.
- **Which notes reach the window:** all 20 are parsed, but `last_persons_notes` (`discussions.rs:282-303`) keeps only the last note with `system == false` of each discussion that is resolvable and not resolved.
  - If all 20 are system notes and earlier notes exist, the row answers `Failed`.
  - So the IPC carries **one note per discussion**, not the thread.
- **Place:** `open_discussion` (`discussions.rs:305-327`) gives `Overview` when `position` is null, else `File{path, line: newLine ?? oldLine}`.
- **Link:** the note's `page` comes from `WebPage::note(origin, web_path, iid, url)` (`web_page.rs:49`) and is accepted only in the form `<MR page>#note_<digits>`.
- **IPC types** (Rust `discussions.rs:29-104`, TS `frontend/src/ipc/bindings.ts:514-547,1071-1077`):
  - `RowDiscussions{iid, answer}`.
  - `DiscussionsAnswer = open{discussions} | glabMissing | notLoggedIn{detail} | failed{message}`.
  - `OpenDiscussion{place, last: DiscussionNote}`.
  - `DiscussionNote{author: Person|null, createdAt: string, text: string, page: WebPage|null}`.
  - Window domain conversion: `frontend/src/ipc/mergeRequestDomain.ts:67-79,191-198` (`createdAt` becomes milliseconds).
  - Core's own structural copy: `frontend/src/mergeRequests/internal/discussions.ts:4-12`.
- **Command and shell:**
  - `read_discussions(iids)` at `src-tauri/src/merge_requests.rs:288-302` runs through `blocking_reply`.
  - `src-tauri/src/merge_requests/discussions.rs:10-26` offers each note's page and the authors' pictures before replying.
  - Binding: `bindings.ts:87`. Source method: `frontend/src/ipc/MergeRequestSource.ts:42-44`; Tauri side `tauriMergeRequests.ts:129-133`.
- **Window queue** – `frontend/src/ui/mergeRequestDiscussions.ts`:
  - Load states `loading | read | refused | failed` (`:16-24`).
  - One call at a time with a generation counter (`send`, `:101-117`).
  - `listed` queues rows in "full" mode (`:119-137`); `replaced` drops everything on a list refresh (`:263-266`).
  - `askDiscussions` asks only in "lazy" mode and only when the row has no entry (`asked`, `:179-193`).
  - **No per-MR re-read exists** (relevant to D). The only way to drop a row's details is `dropped` (`:139-144`), which clears all rows.
- **Setting:** `DiscussionDetails { Full (default), Lazy, Off }` (`crates/settings/src/lib.rs:73-78,103-104`).
  - Written only when it is not `full` (`crates/settings/src/file.rs:59-61`); `set_discussion_details` at `lib.rs:216-224`.
  - Settings UI: `frontend/src/ui/MergeRequestDiscussionSetting.vue`; words in `ui/mergeRequestsText.ts:58-61`.
- **Fake glab scenario `tests/glab/mr-discussions/`** (`tests/glab/README.md:182-197`):
  - Files: `graphql-discussions-82-81-79-78.json`, `-79-after-d-2.json`, `-81.json` (the lazy ask), and `-77.err/.exit`.
  - Cases: !82 has a system note between replies and one after the last reply; a non-https `url`; resolved and non-resolvable discussions. !81 has markup in its body. !79 is paged. !78 is missing from the answer.
  - Viewer `sam`. Routing rule: `README.md:41`. Also `mr-review-mode/` (`README.md:198-207`).
  - Tests: `crates/merge-requests/tests/discussions.rs`, `src-tauri/src/merge_requests/tests/discussions.rs`.
- **`?mr=list` fixture** – `frontend/src/ipc/fixtureMergeRequestDiscussions.ts`:
  - 400 ms pause, first 10 iids answered (`:19-20,101-118`).
  - Per row: discussion 0's last note is by the next row's author; discussion 1's is by the row's first reviewer (`:65-79`).
  - A markup text, !638's 400-character line, and no page on every 6th row (`:26-62`).
  - !615 answers `failed`, !629 answers `notLoggedIn` (`:15-16,84-99`). Documented in `frontend/src/ipc/AGENTS.md:21`.

## 2. The turn rule

- **Where it lives:** `frontend/src/mergeRequests/internal/discussions.ts`.
  - `turnOf` (`:34-36`): `last.author !== null && last.author.username === viewer ? "waiting" : "viewer"`. An unknown author or a null viewer means it is the viewer's turn.
  - `Turn = "viewer" | "waiting"` (`:16`).
  - Order: `discussionTurns` (`:40-50`) puts the viewer's turn first, then newest last comment, ties in GitLab's order.
  - `turnCounts` (`:53-58`).
- **Words:**
  - `turnText` (`:88-93`): "Your turn", or "<name>'s turn" via `viewerPossessive` (`:81-86`).
  - `WAITING_TEXT = "Waiting for an answer"` (`:32`).
  - Header from `turnSummaryText` (`:95-102`): "N of M wait(s) for you|<name>", or "No open discussions".
  - Excerpt from `noteExcerpt` (`:123-…`); "Someone" for a deleted author (`:25`).
  - Tests: `internal/discussions.test.ts:58-133`.
- **Second user — review mode.** `reviewOrder.ts:39-54` sorts due rows that have `viewersTurn > 0` first, then by fewest `waiting`. Any new turn rule (B) changes review mode's order. Documented in `mergeRequests/AGENTS.md:23`.
- **How the viewer is known:**
  - `me` comes from the list query's `currentUser { username }` (`query.rs:74`, `page.rs:63-71,173`), set in `ui/mergeRequestsList.ts:45-62`, stored in `ui/mergeRequests.ts:58,184`.
  - `viewer = viewerOf(filters.review, me, rows)` (`ui/mergeRequestsShown.ts:81`; `discussions.ts:62-80`). Review mode's person replaces `me`.
  - **Only the username is known; the numeric user id is not read.**
- **MR author per row:** yes. `MergeRequestRow.author: Person | null` (`bindings.ts:954`), and the box already receives `row` (`MergeRequestDiscussions.vue:26`). The core rule does not use it today.
- **Can mentions be known?**
  - **Today, no:** only the raw `body` text crosses (`answer.rs:53`), and only for the last person's note.
  - Option (a): the raw body contains `@username` as plain text **[INFERENCE]**.
  - Option (b): GitLab's rendered HTML marks a mention as `<a href="/anna" data-reference-type="user" data-user="2" class="gfm gfm-project_member" title="Anna Berg">@anna</a>`. This is seen in the description fixture `tests/glab/mr-description/graphql-description-52.json` (around column 5595).
    - The description reducer keeps no `data-user` or `data-reference-type` except a commit's title (`description/element.rs:7-8,82-86`).
    - `data-user` is a numeric id that yamt never reads. The `href` path `/username` could identify the user **[INFERENCE]**.
  - GitLab's `Note.bodyHtml` exists **[EXT]** (`base_note_interface.rb`, https://gitlab.com/gitlab-org/gitlab/-/raw/master/app/graphql/types/notes/base_note_interface.rb).
  - Group, `@all` and `@here` mentions **[UNVERIFIED]**.
- **"Viewer started the discussion"** needs the first note's author. It is in the 20 notes read (true when `hasPreviousPage` is false) but dropped in Rust (`discussions.rs:291-292`).

## 3. The discussions hover box, Shift, panels

- **Component** – `frontend/src/ui/MergeRequestDiscussions.vue`:
  - With setting "off" or a count of 0: just the count with a tooltip (`:101-109`).
  - Otherwise the area has `data-row-control` and `@click.stop` (`:108-117`), plus an opener button.
  - Box styling (`:132-133`): `class="fixed z-10 max-h-[60vh] w-max max-w-[30rem] overflow-y-auto … bg-panel-inline p-1 … shadow-lg"`, `tabindex=-1`, `:style="placement"`.
  - Header is `role="status"` (`:136`).
  - Each row is a `button` when the note has a page, else a `div`; a click calls `openLine` → `openPage("discussion", page)` (`:88-92,149`).
  - Row content: picture (`MergeRequestPicture size="box"`), name, `agoText(createdAt, now)`, turn text (`text-primary` when it is the viewer's turn), place, 3-line clamp.
  - `now` ticks once a minute (`MergeRequestsView.vue:78`).
  - Rows are keyed by index; the box has **no stable discussion id** to key on (`:51-52`).
- **`useHoverBox`** (`frontend/src/ui/useHoverBox.ts`):
  - Opens on pointer enter or focus entering the area (`:36-42,66-78,92-109`).
  - Stays open while the pointer or focus is inside the **area**, which is the DOM parent of the box: one inside rule (`:44-48`).
  - Escape closes it and focuses the opener, unless the event is already `defaultPrevented` (`:84-90`).
  - A scroll outside the area closes it (`:111-123,133-138`).
  - Placement: `belowLeft(opener)` (`useMenuPlacement.ts:8-11`), clamped by `useMenuPlacement` (`:13`). `keepFocus` at `:60-64`.
- **Keyboard:** Tab moves through the row buttons; Escape closes. No arrow keys.
- **Shift precedent – CI job log:**
  - `useShiftTaps()` (`ui/useShiftHeld.ts:56-66`). The tap rule `shiftAfter` (`:20-50`): Shift down then up with no other key and no pointer press in between. Listeners come from `ui/keyHold.ts:38-…` (capture keydown/keyup, pointer events only while held, blur/hidden counts as left).
  - `CiStatusBox.vue` (`:54-55,70-86,98-112`) tracks the **pointed** `<li>` (pointer enter/leave) and the **focused** button. On a tap it shows the log only if the box is open, a job is pointed or focused, and `!isTypingTarget(document.activeElement)` (`ui/typingTarget.ts:11-27`: textarea and text-like inputs).
  - The log closes when the CI box closes. The button carries `aria-keyshortcuts="Shift"` (`:166`).
  - Filters also read `useShiftHeld()` (`MergeRequestFilter.vue:56`).
  - Design: `docs/slices/briefs/ci-job-log-design.md:86-110`; risk RK59 (`.omp/skills/risk-register/SKILL.md:73`).
- **Side-panel precedent – `CiStatusJobLog.vue`:**
  - It is a DOM child of the CI box's area, so the one inside rule holds both (`CiStatusBox.vue:183-190`).
  - Anchored at the CI box's left/top (`CiStatusBox.vue:53,67`). Placement `x = anchor.left − own width, y = anchor.top` via `useMenuPlacement` (`CiStatusJobLog.vue:56-60`).
  - Size `h-[min(36rem,calc(100vh-2rem))] w-[min(56rem,calc(100vw-2rem))]` (`:237`).
  - Its own Escape does `preventDefault` and emits close (`:224-228`). The window holds one log (`ui/mergeRequestJobLogs.ts`; `ui/AGENTS.md:57`).
- **Description panel precedent:** `MergeRequestDescription.vue:84` is a centred `fixed z-20 max-h-[85vh] w-[min(64rem,calc(100vw-4rem))]` panel. `onClickOutside` ignores `[data-description-opener]` and `[data-refreshes-list]` (`:33-35`); Escape at `:68-72`. Its request lists "comments and discussions in the panel" as a non-goal (`docs/slices/request-mr-description.md:87`).
- **Text fields:**
  - Existing textareas: `RangeThreadBox.vue:189-198` (`rows` 3 or 1, `resize-y`) and `RangeMessageEditor.vue:65-73` (`rows="4"`).
  - **No auto-growing textarea and no Markdown preview toggle exist anywhere** (search for preview, autosize, `field-sizing` and `scrollHeight` in `frontend/src/ui` and `frontend/src/editor`).
  - The Markdown preview engine available is yamt's own subset `MarkdownView` via `ui/useMarkdown.ts:7-11` (plan #112: images never loaded, links as text).

## 4. Rendering a thread

- **HTML reducer:** `described(html, base: Option<&WebPage>)` (`crates/merge-requests/src/description/html.rs:63-91`).
  - Allow-list walk; `LEFT_OUT` at `:21-25`; `MAX_NESTING = 32` at `:17`.
  - Returns `Described{description, pages, commit_titles, uploads, web_images}` (`:29-38`); `pub(crate)` (`description.rs:17`).
  - `described_on(project, iid, html)` (`description.rs:326-332`) uses the MR page as the base for relative links.
  - Nothing in it is description-specific, so it could reduce a note's `bodyHtml` from the same MR **[INFERENCE]**.
  - The shell offers the resulting pages and uploads with `offer_described` (`src-tauri/src/merge_requests.rs:106-109`); required by RK41 and RK53.
  - Its output types are named `Description*` (`description.rs:44-243`); a thread would reuse or rename them **[INFERENCE]**.
- **Window renderers:** `MergeRequestDescriptionBlocks.vue`, `…Inlines.vue` (text interpolation only, links via `openPage("link")`), `…Image.vue`, `…Code.vue`.
- **Pictures:**
  - Avatars: `People::person` (`people.rs:110-125`) → `avatar_source` (`picture.rs:132`). An uploaded avatar is offered per username and served as `yamt-picture://localhost/<username>`; Gravatar loads directly (plan #152, `docs/plan.md:184`). Rendered by `MergeRequestPicture.vue` (sizes row/stack/box, initials fallback).
  - Uploads in HTML: `image_of` (`description/address.rs:105-119`) → `uploaded{key}` (gitlab.com only, #175), `web{address}`, or `refused`. `imageAddress` is in `ui/mergeRequestDescriptions.ts:74-…`.
- **Relative time words:**
  - `agoText(time, now)` (`frontend/src/mergeRequests/internal/relativeTime.ts:17-21`): "just now", else the largest whole unit with `Intl.RelativeTimeFormat("en")`, e.g. "3 days ago". Also `createdAgo` (`:23-25`).
  - `useListAge` (`ui/useListAge.ts:13`) is the list header's age.
  - The row hover uses `dateTimeText` "30.10.2026, 15:04" (`ui/AGENTS.md:55`).
  - No "edited" wording exists. GitLab offers `lastEditedAt`, `lastEditedBy` and `updatedAt` on notes **[EXT]** (base_note_interface.rb, above).

## 5. Writing to GitLab today

- **Merge-request page writes** (both GraphQL mutations sent as `glab api graphql --input -`, `GRAPHQL_BODY_ARGS`, `query.rs:39`, via `Glab::post`, `crates/gitio/src/glab.rs:107-109`; 20 s deadline, `glab.rs:10`):
  - **Re-request review** – `crates/merge-requests/src/rerequest.rs:92-142`. It reads the reviewers fresh first, then sends the `mergeRequestReviewerRereview` mutation (`query.rs:28-31,255-261`). Reply variants: requested, notReviewer, notOpen, glabMissing, notLoggedIn, refused (the mutation's first `errors` entry), failed (`rerequest.rs:14-44`).
  - **People** – `people_change.rs` with `mergeRequestSetAssignees` / `mergeRequestSetReviewers`, one `APPEND` or `REMOVE` per change (`query.rs:49-59,263-288`).
  - Commands: `rerequest_review` (`merge_requests.rs:254-270`), `change_people` (`:317-334`).
  - `resolve_merge_request` (`:336-352`) is **local conflict resolution, not discussions**.
- **No command posts notes, replies or resolves discussions.** A grep for `createNote`, `discussionToggleResolve`, `discussions/` and `noteCreate` across `crates`, `src-tauri/src` and `frontend/src` finds nothing.
- **Draft notes exist only in `yamt-review`** (range window, plan #118, `docs/plan.md:150`):
  - REST `GET --paginate` and `POST --include --method POST projects/<id>/merge_requests/<iid>/draft_notes --input -` (`crates/review/src/gitlab.rs:75-100`).
  - Drafts are listed first and matched to avoid duplicates (`crates/review/src/send.rs:74-87,244-247`, RK33).
  - These helpers are `pub(crate)`. `yamt-merge-requests` depends on `yamt-review` only as a dev-dependency (`crates/merge-requests/Cargo.toml:8-20`).
- **Fake glab writes:** each POST to `…/draft_notes` and each `graphql --input -` is answered from `post-<n>.json`, counted in `YAMT_FAKE_GLAB_STATE` (`tests/glab/README.md:8-21,27-31`). Any other endpoint answers 404 (`README.md:~49`), so a REST note or discussion route would need a fake extension **[INFERENCE]**.
- **GitLab APIs [EXT]:**
  - `createNote(input:{noteableId, body, discussionId?, mergeRequestDiffHeadSha?})` replies in a discussion (https://gitlab.com/gitlab-org/gitlab/-/raw/master/app/graphql/mutations/notes/create/note.rb).
  - `discussionToggleResolve(input:{id: DiscussionID!, resolve: Boolean!}) { discussion errors }` (https://gitlab.com/gitlab-org/gitlab/-/raw/master/app/graphql/mutations/discussions/toggle_resolve.rb).
  - Draft notes REST `POST /projects/:id/merge_requests/:iid/draft_notes` takes `note`, `in_reply_to_discussion_id`, `resolve_discussion`; also publish and `bulk_publish` with `reviewer_state` (https://docs.gitlab.com/api/draft_notes/).
  - `Discussion.notes` has `max_page_size: 200` (discussion_type.rb).
  - The `Discussion.id` field and the permissions shape (e.g. `resolveNote`) **[UNVERIFIED]**.
  - A GraphQL draft-note mutation **[UNVERIFIED / unknown]**.
- **Risk-register rules about writes** (`.omp/skills/risk-register/SKILL.md`):
  - RK33 (`:47`): duplicate or stale draft.
  - RK41 (`:55`): only addresses GitLab listed get opened.
  - RK53 (`:67`): login and uploads.
  - RK54 (`:68`): no write but the rereview mutation and one APPEND/REMOVE per change; **would need amending or a new RK for note, reply and resolve writes**.
  - RK60 (`:74`): note links only as GitLab gave them; text never interpreted as markup.
  - RK61 (`:75`): system notes.
  - RK66 (`:80`): description markup.

## 6. Plan and risk numbering, settled decisions reopened

- **Last plan row:** #178 (`docs/plan.md:210`). No #179 or later exists; the next free number is #179.
- **Last risk:** RK70 (`SKILL.md:84`); the next free id is RK71. The format is a 4-column row (`:86-87`).
- **Reopened by B, C, D:**
  - Discussions request rule 3, the turn words (`docs/slices/request-mr-discussions.md:29-33`).
  - Rule 2: the "last comment only" box (`:24-28`).
  - Rule 5: plain text, never markup (`:36`).
  - Non-goals "Replying to, resolving or reacting to a discussion from yamt … showing whole threads" (`:69-70`).
  - Plan #162 (Rust reads only the last person's note), #163 (turn rule, words, plain text), #164 (defaults) at `docs/plan.md:194-196`.
  - #165 and #166: review order built on `turnCounts`.
  - #112's "images never loaded; links as text; raw HTML literal" for threads (`docs/plan.md:144`, already reopened once for the description panel).
  - #171–#174, if the description reducer and panel shape are reused (`:203-206`).
  - #118: draft-notes posting lives in `yamt-review` (`:150`).
  - The range request's non-goal "showing, replying to or resolving existing GitLab discussions in yamt" (`docs/slices/request-review-range.md:155`).
  - Description request non-goal "comments and discussions in the panel" (`request-mr-description.md:87`).
  - Risks RK54, RK60, RK61.
- **D, refresh one MR:** no such path today. The page's Refresh (`MergeRequestsView.vue:158-167`) has `data-refreshes-list` and reloads the whole list, and `replaced` drops all details.

## 7. Images in descriptions

- **`image()`** (`crates/merge-requests/src/description/html.rs:262-286`, called from `:224`):
  - Reads only `data-src` (else `src`) and `alt` (else `title`) for the caption (`CAPTION_ATTRIBUTES`, `:26`).
  - **`width`, `height` and `style` are ignored.** A grep for `width`, `height` and `style` in `description/` finds only table-cell `style` alignment (`element.rs:72-78`).
- **IPC type:** `DescriptionInline::Image { image: DescriptionImage, caption: String }` (`description.rs:231-237`).
  - `DescriptionImage = uploaded{key} | web{address} | refused` (`description/address.rs:55-…`; `bindings.ts:368-…,409-412`).
- **`MergeRequestDescriptionImage.vue`:**
  - `<img :src="address" :alt="caption" referrerpolicy="no-referrer" loading="lazy" draggable="false" class="inline h-auto max-w-full" @error>` (`:28-37`).
  - Stand-in text is the caption, else the `web` address, else "picture" (`:14-20,27`).
  - Request rule 5: "An image fits the panel's width at most" (`request-mr-description.md:45-47`).
- **GitLab's side [EXT]:**
  - `Banzai::Filter::AttributesFilter` turns `![](x){width=50%}` into `img[width]` / `img[height]` attributes.
  - Accepted values match `\A\d{1,4}(%|px)?\z`, and only `width` and `height` are supported (https://www.rubydoc.info/github/gitlabhq/gitlabhq/Banzai/Filter/AttributesFilter).
  - Whether the sanitizer keeps them in `descriptionHtml` **[INFERENCE: yes, the filter output is rendered]**.
- **Fixtures:**
  - `tests/glab/mr-description/graphql-description-52.json`: lazy images (placeholder `src`, real `data-src`, inside `a.no-attachment-icon`). **No width/height anywhere in `tests/glab`.**
  - `-53.json`: plain `<img src alt>`. `self-managed/graphql-description-52.json`. `-50.json` holds the planted `img onerror`.
  - Documented in `tests/glab/README.md:~225-245`.
  - Frontend fixture !640 (`RICH_DESCRIPTION_IID`, `frontend/src/ipc/fixtureMergeRequestDescriptions.ts:12,150-168`): uploaded loading/broken, web `GREEN_BANNER` data-PNG, refused. No sizes.
  - Tests: `fixtureMergeRequestDescriptions.test.ts:140-221`; Rust image tests `description/tests.rs:96-117,233-281,708,774,840`.

---

**Checks for the main agent:** none were run (read-only investigation).