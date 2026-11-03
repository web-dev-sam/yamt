I found every item. Two findings matter most for the design:

- **Rendering:** the page has no HTML-rendering path, and the decision record forbids one. Plan #112 rules out `marked`/`markdown-it` + DOMPurify and allows links only as text; #133/#137/#162 make only exceptions for job, merge-request and note pages. So rendering GitLab's description and opening issue, epic and commit pages both need the owner to amend the record.
- **Cost:** asking `descriptionHtml` in the list query (#131) would add about +10 complexity (≈180/250), but adds HTML for up to 500 rows to every load.

The GitLab facts come from docs.gitlab.com and GitLab master source; nothing was measured against a live server. Anything marked `[INFERENCE]` I worked out from source rather than saw stated.

## 1. Row template — `frontend/src/ui/MergeRequestRow.vue`
- **Row:** the `<li>` at `:107-113` opens the merge request on any click (`@click="openPage"`). It gets the hover background only when the pointer is not over a `[data-row-control]` (`:110`). Each control's wrapper carries `data-row-control` and `@click.stop`.
- **Columns, in the `flex items-center gap-3` row at `:114`:**
  - People: `w-16` (`:150-160`)
  - Due date: `w-24`
  - Discussions: `w-12` (`:161-163`)
  - **Approvals:** `<span v-tooltip="approvals.names" class="flex w-12 shrink-0 items-center gap-1">` with `<ThumbsUp class="size-4">` and the count (`:164-172`)
  - **What sits between them today: the CI box**, `w-7 justify-center`, `<CiStatusBox v-if="row.pipeline !== null" … data-row-control @click.stop>` (`:173-182`)
  - **Merge status:** `<MergeRequestReadiness>`, `w-7` (`:183-185`). It is a `v-tooltip` span, `class="flex p-1"`, with a `size-4` Lucide icon (`MergeRequestReadiness.vue`, template).
  - Action `w-7` (`:186-`), then the open-changes button
- **No header row** aligns the columns (`MergeRequestsView.vue:255` only renders rows).
- **Icon look:** `size-4` icons. Buttons use `rounded p-1`/`p-0.5`/`p-1.5 hover:bg-hover`.
- **Hover mechanisms:**
  - Plain text: `v-tooltip` (`ui/tooltip.ts`; plan #154, `docs/plan.md:186`). A test bans `title` in `MergeRequest*.vue`/`CiStatus*.vue` (`mergeRequestTitles.test.ts:5-8`).
  - Rich hover box: `useHoverBox` (`ui/useHoverBox.ts`). It opens at once on pointerenter or focusin, below the opener (`belowLeft`), and stays while the pointer or focus is inside. It closes on leaving, on Escape (focus returns to the opener) and on a scroll outside (`useScrollOutside`). Users: `CiStatusBox.vue:48`, `MergeRequestDiscussions.vue:31-35`, People, Labels.
  - Box look: `fixed z-10 max-h-[60vh] w-max max-w-[30rem] overflow-y-auto rounded-md border border-control-border bg-panel-inline p-1 shadow-lg` (`MergeRequestDiscussions.vue` template; same in `CiStatusBox.vue`).
  - `useHoverMenu` (`ui/useHoverMenu.ts:1-40`, 300 ms close, a click pins it) is used only by the filter bar (`docs/architecture.md:1890-1895`).

## 2. List query and lazy loads
- **List query fields** (`crates/merge-requests/src/query.rs:44-67`, `list_query()`):
  - Top level: `queryComplexity{score limit}`, `currentUser{username}`, then `mergeRequests(state: opened, sort: CREATED_DESC, first, after)`.
  - Per merge request: `iid title createdAt draft`, `author`, `labels{title color textColor}`, `assignees`, `reviewers{…mergeRequestInteraction{approved reviewState}}`, `approvedBy`, `userPermissions{updateMergeRequest}`, `resolvableDiscussionsCount resolvedDiscussionsCount`, `detailedMergeStatus conflicts diffStats{additions deletions} diffRefs{baseSha}`, `sourceProjectId targetProjectId targetBranch diffHeadSha`, `headPipeline{status jobs(FAILED, retried:false, first:50){…name allowFailure webPath stage{name}}}`.
  - **Neither `description` nor `descriptionHtml` is fetched.**
- **Cost notes:**
  - Code comment: "170 of GitLab's complexity limit of 250, measured on gitlab.com on 2026-11-02" (`query.rs:36-41`). Plan #131 is an older record of the same query: "about 112 of the 250" (`docs/plan.md:163`).
  - Scoring rules (`.omp/run/notes/PlanScoutMrDiscussionFacts.md:81-85`): per-MR fields under `mergeRequests(first:100)` count ×2, and under `iids:` ×6. A connection without a resolver gets no page-size multiplier. Logged out the limit is 200, logged in 250 (`:5`).
  - Discussions query: 58/250 for 20 merge requests (`query.rs:101-103`).
- **Pages:** `PAGE_SIZE = 100`, `MAX_MERGE_REQUESTS = 500` (`lib.rs:51,53`).
- **Lazy-load pattern (discussions):**
  - Rust command `read_discussions(iids) -> Vec<RowDiscussions>` (`src-tauri/src/merge_requests.rs:335-349`). It goes to `discussions_reply`, which offers the note pages and pictures before replying (`merge_requests/discussions.rs:10-23`).
  - The crate answers a prefix of at most `DISCUSSION_BATCH = 20` distinct iids. Comment: "20 took 4.47 s … 100 took 22.22 s, past glab's 20 s deadline" (`crates/merge-requests/src/discussions.rs:18-20`; `batch()` at `:158-165`).
  - Query: `mergeRequests(iids:$iids, first:$first)`, sent as `-F iids=<JSON>` (`query.rs:105-139`).
  - Window side (`ui/mergeRequestDiscussions.ts`):
    - `Queue {queued, unhovered, running, generation}` (`:44-55`).
    - `send` runs one call at a time with **all** queued iids, then recurses until the queue is empty; an answer from an older generation is dropped (`:100-115`). `settle` (`:74-98`).
    - Mode "full": `listed` queues each row with a count above 0 (`:117-135`). Mode "lazy": `asked` puts the hovered row first (`:172-187`). `useRowDiscussions` asks when the box opens (`:202-213`).
  - The slice holds it as `discussionQueue` (`ui/mergeRequests.ts:94,246,297`). Decision: plan #162 (`docs/plan.md:194`).

## 3. Existing floating panels and dialogs
- **CI job log box** (`ui/CiStatusJobLog.vue`):
  - `role="dialog"`, `fixed z-10`, `h-[min(36rem,calc(100vh-2rem))] w-[min(56rem,calc(100vw-2rem))]`.
  - Placed by `useMenuPlacement` to the left of the CI box's anchor; the field takes focus on mount.
  - Escape → `emit("close")` (`keydown`). There is **no outside-click handler**.
  - It is a DOM child of the CI hover area (`CiStatusBox.vue:183-190`), so it closes when that hover box closes (`watch(open)` → `closeJobLog`, `CiStatusBox.vue` around `:76-86`) and on a scroll outside. One log per window is held in the slice (`mergeRequestJobLogs.ts:97-100`).
- **Click-opened box pattern:** `MergeRequestDueDate.vue:37-49,96-101`. It uses `onClickOutside(box, …, {ignore:[opener]})` + `useScrollOutside`, and Escape returns focus to the opener (`aria-haspopup="dialog"`).
- **Modal dialogs:** `QuestionDialog.vue` and `KeyRecorder.vue` use a native `<dialog>` with `showModal()`, `m-auto w-[30rem]`. They are specific to their windows, not generic.
- **No reusable dialog or panel component exists.**
- **Z-order:** boxes use `z-10`. The tooltip is `z-500` (`tooltip.ts:10`). `ServerMenu`, `ToolbarMenu` and `ServerGroup` teleport to `body`; the page's boxes are "not teleported, so Tab reaches it" (`docs/architecture.md:1886-1887`).
- **Placement:** `useMenuPlacement(menu, at)` keeps the box inside the viewport (`useMenuPlacement.ts`).

## 4. Opening the system browser
- **No plugin:** `tauri-plugin-opener` was rejected (plan #133, `docs/plan.md:165`: "DR3: std runs the three programs"), and there is no tauri plugin in `src-tauri/Cargo.toml`.
- **Implementation:** `yamt_merge_requests::open_page` (`crates/merge-requests/src/web_page.rs` `open_page`/`opener`) runs `xdg-open`, `/usr/bin/open` or `rundll32 url.dll,FileProtocolHandler`. Streams go to null, the process is detached into its own group, and a thread waits for it.
- **IPC:** command `open_page(page: WebPage) -> PageOpened` (`src-tauri/src/merge_requests.rs:395-407`). On the frontend: `commands.openPage` (`ipc/tauriMergeRequests.ts:75-76`), `MergeRequestSource.openPage` (`MergeRequestSource.ts`), and `slice.openPage(clicked: PageKind, page)` (`ui/mergeRequests.ts:216-220`).
- **Allow-list:**
  - `MergeRequestState.pages: Mutex<BTreeSet<WebPage>>` (`merge_requests.rs:66-80`). A page not in it gets `PageOpened::NotOffered`.
  - Pages are added by `offer()` (`:101-108`) from `forward_page` (`:123-127`) and `discussions_reply`.
  - A `WebPage` is built only by `WebPage::job`, `::merge_request` or `::note` (`web_page.rs:21-60`): https origin, path segments `[A-Za-z0-9._~-]`, no `..`.
  - Risk RK41/RK60 (`.omp/skills/risk-register/SKILL.md:55,74`). Links in issues, epics and commits would need new constructors and new offers.

## 5. Images, the picture route and the CSP
- **Scheme:** `yamt-picture://localhost/<username>` (`src-tauri/src/merge_requests/pictures.rs:11`), registered at `commands.rs:109`.
  - The path must be a username (`is_username`). It maps through `offered: BTreeMap<username, PictureAddress>`, with at most 4 fetches at once.
  - Answers are 404 or the bytes with the image's own content type plus `nosniff`.
- **Fetch rules** (`crates/merge-requests/src/picture.rs`):
  - A `PictureAddress` is built only by `avatar_source`, and only for `…/uploads/-/system/user/avatar/<digits>/<file>` (`is_uploaded_avatar`).
  - `fetch_picture` runs `glab api <full https address>`, at most 1 MiB, and accepts only PNG, JPEG, GIF or WebP by their first bytes.
  - Risk RK53 (`SKILL.md:67`).
- **CSP** (`src-tauri/tauri.conf.json:14`): `img-src 'self' data: yamt-picture: http://yamt-picture.localhost https://secure.gravatar.com https://www.gravatar.com`. No GitLab host is allowed.
- **Uploads through it:** not possible as it stands. It is keyed by username and limited to the avatar path, so `/uploads/<secret>/…` and `/-/project/<id>/uploads/…` need a new key and path rule.

## 6. Markdown, HTML and how notes are shown
- **No markdown or sanitizer dependency.**
  - `frontend/package.json`: no marked, markdown-it or DOMPurify.
  - `html5ever`/`dom_query` appear in `Cargo.lock:686-698,3515,4553` only as transitive dependencies of tauri/wry.
- **yamt's own markdown:** `editor/markdown.ts` `MarkdownView`, reached only through `ui/useMarkdown.ts` (fence PM2, `frontend/scripts/markdownFence.ts`).
  - Plan #112 (`docs/plan.md:144`) is quoted in the summary. It also keeps "raw HTML literal; images as `alt (url)` text, never loaded".
  - The DOM builder uses `createElement`, `textContent` and `className` only, never `innerHTML` (`editor/AGENTS.md:17`).
  - It supports GFM tables, lists and fenced code with colours. It has no task-list checkboxes and no reference links.
- **`v-html`:** none in `frontend/src`. `innerHTML` appears only for static icon SVG (`editor/internal/find.ts:139,160`, `stripIcons.ts:40`).
- **No lint rule** in `eslint.config.js` or `.oxlintrc.json` bans `v-html`. The ban is a decision-record and risk rule: RK57 and RK60 say "text interpolation only, no `v-html`".
- **Discussion text is plain:** `noteExcerpt` takes the first 3 lines and at most 280 code points; "Plain text, never markup" (`mergeRequests/internal/discussions.ts:121-130`). It is shown with `line-clamp-3 whitespace-pre-line` (`MergeRequestDiscussions.vue` template).

## 7. Decision record and risk register
- **Plan rows:**
  - #112: markdown subset, no HTML, links as text (`plan.md:144`).
  - #131: one list query; "A field an older GitLab lacks refuses the query: one sentence with Retry" (`:163`).
  - #133: browser through std, "Links in threads, AI answers and Markdown stay text" (`:165`).
  - #137: the merge request's row page (`:169`).
  - #154: tooltip or hover box (`:186`).
  - #162: discussions batch of 20, with "per-row queries for 'fully' (up to 500 glab calls)" rejected (`:194`).
- **Risks:**
  - RK41: browser gets an address GitLab did not list.
  - RK53: pictures, token sent to another host, non-images.
  - RK57/RK60: markup interpreted.
  - No row covers HTML rendering yet.
- **Version floor 15.6:** "`projectMembers(search:)` from 15.6 … yamt's floor is 15.6" (`docs/slices/briefs/mr-people-design.md:41`). `detailedMergeStatus` is present at v15.6.0 (`mr-row-details-design.md:39-41`).
- **Free vs Premium:** the only notes are in `.omp/run/notes/PlanScoutMrPeopleFacts.md:7,144-148`: on Free, extra reviewers and assignees are silently dropped. Nothing about epics.

## 8. Adding a field or route to the fixture and fake glab
- **Fixture rows:** `ipc/fixtureMergeRequestData.ts:208-235` `row(index)` builds `Generated.MergeRequestRow`; add a new field there. It is converted by `mergeRequestDomain.ts` `toMergeRequestPage`.
- **New lazy method:** add it to `MergeRequestSource.ts`, pass it through `tauriMergeRequests.ts`, and give the fixture a script spread like `...discussionsScript(log, LISTED_ROWS)` (`fixtureMergeRequests.ts`, the end of `createFixtureMergeRequests`).
- **Fake glab** (`scripts/fake-glab/glab`):
  - `graphql()` routes by field. `iids` → `graphql-discussions-<iids>[-after-<c>]`; `iid` → `graphql-merge-request-<iid>`; otherwise `graphql-page-<n>`.
  - **A second `iids` query would collide with the discussions route**, so it needs a new routing field.
  - `GET *://*` → `pictures/<path>`; `GET projects/*/jobs/*/trace` → `traces/`.
- **Scenarios:** `tests/glab/<scenario>/`, documented in `tests/glab/README.md` (that table must be updated). Rust tests use `Fake::new(scenario)` (`crates/merge-requests/tests/fake_glab/mod.rs`).

## 9. `description` vs `descriptionHtml`
- **Both exist on `MergeRequest`** today ([objects reference](https://docs.gitlab.com/api/graphql/reference/objects/#mergerequest)) and at **v15.6.0-ee** (`doc/api/graphql/reference/index.md:14676-14677` at that tag). So they are within the floor.
- **Cost:** every `*_html` markdown field has complexity 5 (`lib/gitlab/graphql/markdown_field.rb`). In the list that is ≈ +10 [INFERENCE from the ×2 rule]; under `iids:` ×6 ≈ +30.
- **Reference links carry data attributes** (master source):
  - Every reference gets `data-reference-type`, `data-original`, `data-link`, `data-project` or `data-group`/`data-namespace`, plus `data-<object>` = **the database id**, not the iid (`lib/banzai/filter/references/reference_filter.rb:157-175`, `abstract_reference_filter.rb:263-281`).
  - Issue: `data-iid`, `data-namespace-path`, `data-project-path`, `data-issue-type` (`issue_reference_filter.rb:41-54`).
  - Epic (EE only): `data-group`, `data-group-path`, `data-iid`, `data-epic` (`ee/lib/ee/banzai/filter/references/epic_reference_filter.rb`; the CE class is an empty shell).
  - Work item: reference type `work_item` (`work_item_reference_filter.rb:10-16`).
  - Commit: `data-commit`, `data-project-path`. **A commit of this merge request links to `…/merge_requests/<iid>/diffs?commit_id=`**, otherwise to the commit page (`commit_reference_filter.rb:50-79`).
- **Relative URLs:** the GFM pipeline defaults to `only_path: true` (`gfm_pipeline.rb:75-76`), so links and images are relative.
  - Uploads `/uploads/<secret>/f` are rewritten to `<root>/-/project/<id>/uploads/<secret>/f` (`upload_link_filter.rb`).
  - `<img>` gets `src` = a placeholder and the real URL in `data-src`, `class="lazy"` (`image_lazy_load_filter.rb`).
  - Whether GraphQL's `markdown_field` path keeps `only_path` true end to end: UNVERIFIED (not measured).
- **REST alternative:** `POST /markdown {text, gfm, project}` → `{html}`, authentication required since 15.3 ([docs](https://docs.gitlab.com/api/markdown/)).

## 10. Reference syntax in GLFM ([docs](https://docs.gitlab.com/user/markdown/#gitlab-specific-references))
| Kind | Forms |
|---|---|
| Issue | `#123`, `GL-123`, `[issue:123]`; `ns/proj#123`, `[issue:ns/proj/123]`; `proj#123` |
| Work item | `[work_item:123]`, `[work_item:ns/proj/123]` (GA in 18.2) |
| Epic | `#123`, `&123`, `[work_item:123]`, `[epic:123]` (18.4); `group/sub&123`, `[epic:group/sub/123]` |
| Commit | `9ba12248`, `ns/proj@9ba12248`; range `9ba12248...b19a04f5` |

- Full URLs to issues and comments are recognised and shown as `#1234`; `+`/`+s` suffixes expand titles (same docs page, lines around 784-826).
- **Alternative to parsing:** `MergeRequest.workItemRelations(types: [CLOSES|MENTIONED|RELATED])` with `fromMrDescription` and `workItem` ([objects reference](https://docs.gitlab.com/api/graphql/reference/objects/#mergerequestworkitemrelation)). The version it was introduced in is UNVERIFIED. It does not cover commits or epics-by-group.

## 11. Parent of an issue
- **`Issue.epic`:**
  - EE-only field (`ee/app/graphql/ee/types/issue_type.rb:9-13`), "Deprecated in GitLab 17.5. Replaced by WorkItem type". Present at v15.6.0-ee (`index.md:14267`).
  - `hasEpic` is there too; `hasParent` is an experiment from 16.5 (`issue_type.rb:15-25`).
  - The epic GraphQL API is planned for removal in 19.0 ([migration guide](https://docs.gitlab.com/api/graphql/epic_work_items_api_migration_guide/)). The guide's history: epics as work items GA in 18.1, on gitlab.com from 17.6, tier Premium/Ultimate.
- **`WorkItemWidgetHierarchy`:** `parent: WorkItem`, `hasParent`, `ancestors` ([reference](https://docs.gitlab.com/api/graphql/reference/objects/#workitemwidgethierarchy)). Present at v15.6.0-ee (`index.md:20457-20466`).
- **Free:** an issue's parent is an epic, which is Premium, so expect `null` / `hasParent: false` [INFERENCE]. On a CE edition `epic` is absent from the schema, so a query asking it is refused [INFERENCE from the EE prepend], which hits plan #131's "older GitLab" sentence.
- **Batching:**
  - `Project.issues(iids: [String!])` ([reference](https://docs.gitlab.com/api/graphql/reference/objects/#project)).
  - `Project.workItems(iids:)`, "maximum is 100 IIDs" (experiment from 15.1).
  - `workItemsByReference(contextNamespacePath, refs: [String!]!)`, "short reference or URL", experiment since **16.7**, above the floor ([queries reference](https://docs.gitlab.com/api/graphql/reference/queries/#workitemsbyreference)). Its limit on the number of refs is UNVERIFIED.
  - Cost: `iids:` fields count ×6 (scout rule above); a real score is UNVERIFIED.

## 12. Uploaded images
- **Auth:** on private or internal projects, non-image uploads need a project member. **Images are public by URL unless "Require authentication to view media files" is on** ([user_file_uploads](https://docs.gitlab.com/security/user_file_uploads/)).
- **Documented API:** `GET /projects/:id/uploads/:secret/:filename`, from **17.4**, Guest role or higher ([markdown uploads API](https://docs.gitlab.com/api/project_markdown_uploads/#download-an-uploaded-file-by-secret-and-filename)). Through glab that would be `glab api projects/<id>/uploads/<secret>/<file>`. On 15.6–17.3 there is no API route.
- **Web path with a token:** yamt already runs `glab api <full https URL>` for avatars (`picture.rs`, `fetch_picture`). Whether the web path `/-/project/<id>/uploads/…` accepts glab's token header: UNVERIFIED.