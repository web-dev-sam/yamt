# CiLogFacts.md

## 1. Rust side

### Types (`crates/merge-requests/src/lib.rs`)
- `const MAX_FAILED_JOBS: u32 = 50;` (lib.rs:47)
- `pub enum CiStatus { Passed, Failed, Running, Pending, Canceled, Skipped, Manual }`, camelCase (lib.rs:69-85)
- `pub struct WebPage(String);` — "a failed job's log or a merge request; only `WebPage::job` and `WebPage::merge_request` make one" (lib.rs:87-90)
- `pub struct FailedJob { pub name: String, pub stage: String, pub allow_failure: bool, pub page: Option<WebPage> }`, serialized camelCase (lib.rs:92-104). **There is no job id field.**
- `pub struct Pipeline { pub status: CiStatus, pub failed_jobs: Vec<FailedJob>, pub more_failed_jobs: bool }` (lib.rs:106-116)
- `pub enum PageOpened { Opened, NotOffered, Failed { message } }` (lib.rs:333-340)
- The reply enums all repeat `GlabMissing` / `NotLoggedIn { detail }` (lib.rs:271-275, 317-321, 383-387; rerequest.rs:19-35).

### GraphQL job fields (`crates/merge-requests/src/query.rs`)
- query.rs:59-61: `headPipeline { status jobs(statuses: [FAILED], retried: false, first: {MAX_FAILED_JOBS}) { pageInfo { hasNextPage } nodes { name allowFailure webPath stage { name } } } }`. The query does **not** ask for `id`.
- query.rs:34-38: "170 of GitLab's complexity limit of 250, measured on gitlab.com on 2026-11-02". How much complexity adding `id` would cost is UNKNOWN.
- `struct Job { name: String, allow_failure: bool, web_path: Option<String>, stage: Option<Stage> }` (page.rs:137-144). `fn failed_job(job: Job, origin: Option<&str>) -> FailedJob` (page.rs:306-313). `fn pipeline(...)` (page.rs:293-304).
- `WebPage::job(origin, web_path)` (web_page.rs:21-29): `rsplit_once("/-/jobs/")`, requires `is_number(job)`, then `project_page` (https origin only, safe path segments; web_page.rs:50-55). **The REST job id = the digits after `/-/jobs/`.**
- Fake data: `"webPath": "/taskboard/taskboard/-/jobs/302"` (tests/glab/merge-requests/graphql-page-1.json:34, :40).

### glab runner (`crates/gitio/src/glab.rs`)
- `pub const GLAB_TIMEOUT: Duration = Duration::from_secs(20);` and `TIMED_OUT = "glab timed out"` (glab.rs:10-12)
- `pub fn run(&self, cwd: &Path, args: &[&str], stdin: Option<Vec<u8>>) -> Result<GlabRun>` sets `NO_COLOR=1` and `GIT_TERMINAL_PROMPT=0` (glab.rs:70-99). `GlabRun::Printed { stdout: Vec<u8> }` holds **all of stdout in memory, with no limit** (glab.rs:22-33, 89-92).
- `pub fn get(&self, cwd: &Path, args: &[&str]) -> Result<Vec<u8>, String>` (glab.rs:102-104); `pub fn post(..., body: Vec<u8>)` (glab.rs:107-109). On failure, `Err` holds the last line of stderr or "glab exited with status N" (glab.rs:131-139).
- [INFERENCE] `NO_COLOR` only affects glab's own output, not the body GitLab sends.

### Project and routes
- `const PROJECT_ROUTE: &str = "projects/:fullpath";` — glab fills `:fullpath` from the folder's remotes (project.rs:9-10).
- `pub(crate) fn logged_in_project(glab: &Glab, root: &Path) -> Result<Project, NoProject>` runs `auth status`, then `glab api projects/:fullpath` (project.rs:35-45). `Project { full_path, web_path, web_origin: Option<String> }` (project.rs:13-20).
- `GitLabRepository::root()` (detect.rs:70-72).

### Size-limit pattern (pictures)
- `pub const MAX_PICTURE_BYTES: usize = 1 << 20;` (picture.rs:10)
- `pub fn fetch_picture(glab: &Glab, root: &Path, address: &PictureAddress) -> Result<Picture, String>` calls `glab.get(root, &["api", address.as_str()])?` then `picture_from` (picture.rs:166-175). `picture_from` checks `bytes.len() > MAX_PICTURE_BYTES` → `Err(TOO_LARGE)` (picture.rs:177-183). The check runs **after** the whole answer has been read.
- RK53 (risk-register SKILL.md:67): never fetch an address GitLab did not list; never serve a non-image.

### Fetch-on-demand: the IPC patterns in `src-tauri`
- **Pictures** use a URI scheme, not a command: `PICTURE_SCHEME = "yamt-picture"` (pictures.rs:11). Registered in commands.rs:100-111. `answer_picture` runs `tauri::async_runtime::spawn_blocking` (pictures.rs:94-107). `picture_answer` serves only usernames a list offered, by way of `Pictures { shelf: Mutex<PictureShelf>, turns: Condvar }`: at most `PICTURE_FETCHES` 4 at once, and each result (a failure too) is kept for the run (pictures.rs:17-38, 110-130).
- **Commands:** `MergeRequestState { gitlab, range_dir, ai, pages: Mutex<BTreeSet<WebPage>>, merged, pictures }` (merge_requests.rs:63-75).
  - `forward_page` records each row's and failed job's `page` in `pages` before sending the page (merge_requests.rs:94-108).
  - `open_page(state, page: WebPage) -> PageOpened` refuses anything not in `pages` (`NotOffered`) (merge_requests.rs:345-356).
  - Async template: `#[tauri::command] #[specta::specta] pub(crate) async fn rerequest_review<R: Runtime>(window: WebviewWindow<R>, iid, username) -> Result<RerequestReply, IpcError> { blocking_reply(move || Ok(rerequested(&window.state(), Glab::find().as_ref(), iid, &username))).await }` (merge_requests.rs:282-298). Its helper `rerequested` handles a missing project (`NO_PROJECT`) (merge_requests.rs:148-160).
  - The crate side follows `glab missing → logged_in_project → glab.get` (rerequest.rs:107-139).
- **Registration:** `specta_builder()` → `collect_commands![… merge_requests::open_page, … merge_requests::rerequest_review::<tauri::Wry>]` (commands.rs:16-84).
- **Frontend interface:** `interface MergeRequestSource { findGitLabProject; listMergeRequests(onPage, onChecked); openMergeRequest; openPage(page: WebPage): Promise<SourceResult<PageOpened>>; resolveMergeRequest; continueMergeRequest; findLocalMerge; rerequestReview }` (ipc/MergeRequestSource.ts:15-31).
  - Tauri implementation: `tauriMergeRequests.ts:74-76` (`openPage` → `commands.openPage`).
  - Fixture implementation: `fixtureMergeRequests.ts:261-264`.
  - `WebPage` brand and `isWebPage` (an `https://` prefix): ipc/domain.ts:66, 202-204.
- **Slice:** `openPage(clicked: PageKind, page)` → `state.source.openPage` → `pageProblem` (ui/mergeRequests.ts:56, 197-201, 273). `PageKind = "job" | "mergeRequest"` (mergeRequestsText.ts:17).

### Fixtures and the fake glab
- `?mr=<script>`: `createFixtureMergeRequests(log, search)` (fixtureMergeRequests.ts:228-229). Scripts are `list, local, slow, many, empty, noGlab, loggedOut, timeout, refused, pageFails` (fixtureMergeRequests.ts:47-58).
- Fixture jobs (fixtureMergeRequestData.ts:134-145): `lint:docs` (allowed to fail) at `${ORIGIN}/-/jobs/${9000+10·i}`, `test:unit` at `…/${+1}`, `test:e2e` with `page: null`. `ORIGIN = "https://gitlab.example/taskboard/taskboard"`, `FIRST_JOB = 9000`, `JOBS_PER_ROW = 10`, `MORE_JOBS_AT = 8` (fixtureMergeRequestData.ts:11, 23-25).
- Fake glab (`scripts/fake-glab/glab`):
  - Its routes are `case "$method $endpoint"`; an unknown endpoint answers `404 Not Found` (glab:192-208).
  - `picture()` serves full addresses from `$scenario/pictures/<path>` with `cat` (glab:140-156).
  - There is **no trace route.** The scenario file table is in tests/glab/README.md:21-40, and the job-bearing scenario is `merge-requests/` (!13: two failed jobs, README.md "Scenarios").

## 2. GitLab job log API
- `GET /projects/:id/jobs/:job_id/trace` — "Retrieve a job log (trace) for a specified job ID"; `job_id` is an integer; 200 "Serves the log file", 404 "Job not found or no log file" ([docs.gitlab.com/api/jobs](https://docs.gitlab.com/api/jobs/#retrieve-a-log-file-for-a-job)). The yamt-shaped call would be `glab api projects/:fullpath/jobs/<n>/trace`.
- **GraphQL id:** `field :id, ::Types::GlobalIDType[::CommitStatus].as('JobID')`; `field :web_path` ([job_type.rb](https://gitlab.com/gitlab-org/gitlab/-/raw/master/app/graphql/types/ci/job_type.rb) :25, :130). [INFERENCE] The gid looks like `gid://gitlab/Ci::Build/<n>`, and `<n>` is the REST id, the same number as in `webPath` `/-/jobs/<n>`.
- **GraphQL alternative:** `CiJobTrace.htmlSummary(lastLines ≤ 100)`, at most 16 KB, already converted to HTML, marked experiment ([job_trace_type.rb](https://gitlab.com/gitlab-org/gitlab/-/raw/master/app/graphql/types/ci/job_trace_type.rb)). Too small for a full log.
- **Section markers:**
  - `\e[0Ksection_start:UNIX_TS:NAME[collapsed=true]\r\e[0K` + header text, and `\e[0Ksection_end:UNIX_TS:NAME\r\e[0K` ([docs.gitlab.com/ci/jobs/job_logs](https://docs.gitlab.com/ci/jobs/job_logs/) lines 57-58, 146).
  - Regex `/section_((?:start)|(?:end)):(\d+):([a-zA-Z0-9_.-]+)/` + optional `[k=v, …]` + `/\r\033\[0K/` ([regex.rb](https://gitlab.com/gitlab-org/gitlab/-/raw/master/lib/gitlab/regex.rb) :125-147).
- **Timestamps:** GA in 18.9, on by default, `FF_TIMESTAMPS: false` turns them off (job_logs doc :175-204).
  - Prefix regex `/(\d{4}-…\.[0-9]{6}Z) [0-9a-f]{2}[EO][+ ]/`, `TIMESTAMP_HEADER_LENGTH = 32`; a `+` means the line continues the previous one ([stream.rb](https://gitlab.com/gitlab-org/gitlab/-/raw/master/lib/gitlab/ci/trace/stream.rb) :10-13; ansi2html.rb :9-17, 104-127).
  - [INFERENCE] The raw `/trace` keeps these prefixes, because ansi2html has to skip them.
- **How GitLab renders the log** ([ansi2html.rb](https://gitlab.com/gitlab-org/gitlab/-/raw/master/lib/gitlab/ci/ansi2html.rb)):
  - Tokens, in order: section marker, `\e([@-_])(.*?)([@-~])` sequence, `\r*\n` → line break, anything else literally. A **lone `\r` is written as a character**, not used to overwrite the line (:142-160).
  - Only `\e[…m` is used; every other CSI (`\e[0K`, cursor moves) is dropped; `\e[m` resets (:225-243).
  - SGR codes:
    - 0 reset
    - 1 bold, 3 italic, 4 underline, 8 conceal, 9 cross
    - 21/22/23/24/28/29 turn those off
    - 30-37 / 40-47 foreground / background (black, red, green, yellow, blue, magenta, cyan, white)
    - 90-97 / 100-107 light variants
    - 39/49/99/109 default
    - 38;5;n / 48;5;n 256-colour, n from 0 to 255
    - **No truecolor**: `38;2` is ignored, and its numbers are then read as further codes
    - (:20-37, :386-397, :404-602)
  - A bold foreground colour becomes the light variant (`fg-l-*`) (:274-278).
- **Size:** the raw `/trace` has no documented size cap. GitLab's own viewer limit is `Stream::LIMIT_SIZE = 500.kilobytes` (stream.rb:8; [INFERENCE] the job page uses it to show the tail). The instance's maximum log size is UNKNOWN (not checked).

## 3. Frontend

### `frontend/src/ui/CiStatusBox.vue`
- Props: `defineProps<{ pipeline: Pipeline }>()`; emit: `defineEmits<{ openJob: [page: WebPage] }>()` (:26-27).
- `LOOKS` maps status → Lucide icon and tone (:29-37).
- `useHoverBox({ area: () => area.value, opener: () => icon.value, box })` → `{ open, placement, on }` (:39-46).
- `view = ciBox(status, failedJobs, moreFailedJobs)` (:49-51). `openJob({page})` emits only when the page is not null (:54-58).
- Template:
  - `<span ref="area" class="flex">` carries `@pointerenter/@pointerleave/@focusin/@focusout/@keydown` from `on.*` (:62-70).
  - The icon is `<button ref="icon" :aria-expanded="open">` (:71-79).
  - The box is `<div v-if="open" ref="box" role="group" class="fixed z-10 max-h-[60vh] w-max max-w-[30rem] overflow-y-auto rounded-md border border-control-border bg-panel-inline p-1 … shadow-lg" :style="placement">` (:80-87).
  - Inside: a title `FAILED_JOBS_TITLE`, then `<ul><li v-for … v-tooltip="jobTitle(job.name, job.page)"><button :disabled="job.page === null" class="… hover:bg-hover focus:bg-row-selected disabled:pointer-events-none" @click="openJob(job)">` with name, stage and `ALLOWED_TO_FAIL` (:90-110), then `MORE_FAILED_JOBS` (:112).
  - **No per-job hover state is tracked; hover shows only through CSS.**
- Used at MergeRequestRow.vue:182-189: `<CiStatusBox … data-row-control @click.stop @open-job="emit('openPage', 'job', $event)" />`.
- Pure core `ciBox<J extends { allowFailure }>(status, jobs, more): CiBoxView<J>` (mergeRequests/internal/ciBox.ts:10-37).
- Words: `FAILED_JOBS_TITLE`, `ALLOWED_TO_FAIL`, `MORE_FAILED_JOBS`, `jobTitle(name, page)` (mergeRequestsText.ts:35-37, 95-98).

### `frontend/src/ui/useHoverBox.ts`
- `type HoverBoxParts = { area: () => HTMLElement | null; opener: () => HTMLElement | null; box: MaybeRefOrGetter<HTMLElement | null> }` (:7-11).
- `export type HoverBox = { open; placement: ComputedRef<{left; top}>; on: { pointerenter; pointerleave; focusin; focusout; keydown }; close }` (:20-31).
- `show` sets `at = belowLeft(opener)` (:33-39).
- `hideUnlessHeld` closes unless `pointerInside || focusInside` (:41-45).
- Focus enter/leave only counts when `relatedTarget` is outside `area` (:56-68).
- Escape: `preventDefault`, close, focus the opener. It is **only on the area's keydown**, so focus must be inside the area (:70-76).
- `useScrollOutside(area, scrolled)`: a window `scroll` listener (capture, passive) that ignores scrolls whose target is inside `area` (:99-110). `useHoverBox` closes on such a scroll (:112-131).
- [INFERENCE] pointerenter/leave follow the DOM tree, so a second box that is a DOM child of `area`, even `position: fixed` elsewhere on screen, keeps the box open. A scroll inside it does not close it.

### Placement
- `belowLeft(opener): Point` = the opener's rect `{x: left, y: bottom}`. `useMenuPlacement(menu, at)` measures the menu with `useElementSize` and the window with `useWindowSize`, then calls `menuPosition` (useMenuPlacement.ts:8-27).
- `menuPosition` clamps x and y into the viewport: `max(0, min(p, viewport − size))` (menuPosition.ts:7-12).

### Shift state
- `useKeyHold(rule: HoldRule, pointerEvents: string[]): Readonly<ShallowRef<boolean>>`:
  - window `keydown` and `keyup` in capture phase, sent as `KeyHoldEvent` (keydown carries `repeat`);
  - `blur` and a hidden page as `left`;
  - pointer events only while held.
  - (keyHold.ts:4-55)
- `shiftHeldAfter`: on at Shift keydown, off at Shift keyup by key name (WebKitGTK/X11 reports Shift still set on its own release), off on a pointer event without `shiftKey` or on `left`. `export const useShiftHeld = createSharedComposable(() => useKeyHold(shiftHeldAfter, POINTER_EVENTS))` (useShiftHeld.ts:13-31).
- It is a **held** state; no "Shift was pressed" event exists.
- Brief: docs/slices/briefs/mr-shift-held.md (rules 1-3: on from Shift down to up, off on blur/hidden or a pointer event without shiftKey).
- Architecture: "Other keys keep it, … so capitals can be typed in the narrowing box" (architecture.md:1745-1748).
- Altmap twin: `altHold.ts` (tree.md:234).

### `frontend/src/ui/tooltip.ts`
- One tip per window, `TOOLTIP_DELAY_MS = 400`, `TOOLTIP_WARM_MS = 300`, `TIP_CLASSES` (:7-10).
- While a tip waits or shows, it listens on the window for `pointerdown`/`scroll` (capture) and `keydown` Escape, and hides on them (:70-85).
- `vTooltip: Directive<HTMLElement, string | null>` (:189).
- No `title` attributes in page files (ui/AGENTS.md:49, detector `mergeRequestTitles.test.ts`).

### Existing ANSI or search pieces
- No ANSI parsing in `frontend/src`: a grep for `\x1b`, `\u001b`, `\033` and SGR found nothing; the `(?i)ansi` hits are only `transition` class names.
- No ANSI package in frontend/package.json. Its dependencies: `@codemirror/*`, `@fontsource/jetbrains-mono`, `@lezer/highlight`, `@tauri-apps/api`, `@vueuse/core`, `valibot`, `vue` (package.json:18-32).
- No Rust ANSI crate either.
- Search pieces that exist:
  - `search/` `matcherOf(query: {text, matchCase}): Matcher | null`: an escaped `RegExp` with `gu`/`giu`; `Matcher.hits(text, limit)` gives `{line, from, to}` in UTF-16 (search/internal/match.ts:13-61). `search/` is fenced (imports no other src module; others may import it through `search/index.ts`).
  - Highlight: `<mark class="shrink-0 rounded-sm bg-search-match text-inherit">` (SearchResults.vue:211). The `--color-search-match` token is in every theme (style.css:59; themes/*.css).
  - CodeMirror's `.cm-searchMatch` lives in the editor only (editor/internal/pane.ts:111).
  - Following the end: `useFollowEnd(scroller, content): { following, scrolled }`, which sets `scrollTop = scrollHeight` when the scroller appears and on each content change while following (useFollowEnd.ts:10-47). ServerLogView.vue uses it (:17-18, 117-133: `font-mono whitespace-pre-wrap opaque-scroller`). ui/AGENTS.md:15: "A new follower uses it, never a copy."

## 4. Fences
- **PM3:** `mergeRequests/**` (also editor, model, connectors, lsp, jsonrpc, agent, search) never imports vue, `@vueuse/*`, `@tauri-apps/*` or `~icons/*` without `?raw`; `jsonrpc/`, `search/` and `mergeRequests/` import no other `src/` module. Detector: oxlint + `frontend/scripts/fences.test.ts` (project-map SKILL.md:45).
- **PM10:** `ui/MergeRequest*`, `ui/mergeRequest*` and `ui/CiStatus*` never import a window root (`store.ts`, `App.vue`, `compareStore.ts`, `CompareApp.vue`, `rangeStore.ts`, `RangeApp.vue`) or `lsp/`; they use `useMergeRequests()` (SKILL.md:52).
- **PM2:** `ui/**` never imports `@tauri-apps/*`; only `ipc/` talks to the app (SKILL.md:44).
- **PM4:** `ipc/bindings.ts` is generated (`just bindings-check`) (SKILL.md:46).
- **PM6:** every new source file is named in `tree.md`; every IPC command and MergeRequestSource method is named in architecture and ipc-contract (`just map-check`) (SKILL.md:48).
- **PM1:** `merge-requests` depends only on `range`, `gitio`, `merge-core` among `yamt-*`, never tauri (SKILL.md:43).
- **CSP** (src-tauri/tauri.conf.json:14): `connect-src 'self' ipc: http://ipc.localhost`, so the webview cannot fetch GitLab itself and the log must come through IPC. `img-src` adds the picture scheme and Gravatar. `style-src 'self' 'unsafe-inline'`, so inline `style` for colours is allowed.
- **Risks:** RK41 — the opener hands the browser only addresses a list sent. RK53 — never fetch what GitLab did not list (risk-register SKILL.md:55, 67).

## 5. Plan and architecture
- plan #133 (plan.md:165): a failed CI job opens in the system browser. Only `WebPage::job` makes the address; `webPath` must match `^/[A-Za-z0-9._~/-]+/-/jobs/[0-9]+$`; only offered pages open; "No capability or CSP change". Rejected: `tauri-plugin-opener`, http pages.
- Names in #133 were renamed `JobPage` → `WebPage`, `open_job_page` → `open_page` (plan.md:193).
- plan #131 (plan.md:163): one GraphQL list query, `jobs(statuses: [FAILED], retried: false, first: 50) { name allowFailure webPath stage }`.
- plan #135 (plan.md:167): "at most 50 failed jobs per box, then 'more on GitLab'; the CI box closes on scroll".
- plan #154 (plan.md:186): "Rich hover content is a box the pointer enters (`useHoverBox`, extracted from the CI box)."
- plan #112 (plan.md:144): links are never navigable, reopened only for the failed CI job (#133). #115/#118 (plan.md:150): no opening links, with the same exception.
- request-merge-requests.md:66-67: "A click on a job opens that job's log page on GitLab in the system browser … nothing else on the page opens a browser." A log box inside yamt does not conflict with this wording.
- architecture.md:518-532: `MergeRequestState` and its commands; `open_page` only for pages in `pages`.
- architecture.md:746-748: `FailedJob { name, stage, allowFailure, page }`, `Pipeline { … }`.
- architecture.md:844-848: the WebPage rules.
- architecture.md:1083: `openPage` in the source contract.
- architecture.md:1186: the state table row for `pages`.
- architecture.md:1682-1685: a job click → slice `openPage(kind, page)` → `pageProblem`.
- architecture.md:1734-1737: the hover box rules.
- architecture.md:1744-1748: the Shift rules.
- Grep found no plan row about job logs, ANSI or traces.

## 6. Request document format
`docs/slices/request-mr-row-details.md` headings:
- `# Request — <title>`, followed by an intro paragraph with date, asker, base and the "(orchestrator)" note (:1-4)
- `## Owner's words` (:10)
- `## Rules` (:27, numbered and bolded)
- `## To be measured by the design (unverified)` (:86)
- `## Acceptance` (:99)
- `## Non-goals` (:112)
- `## Reopens (DR4: the owner's changed requirement)` (:118)
- `## Owner's answers` (:128)
- `## Slice graph (proposal; refined after the design)` (:138, a table: row | slice | owner | owns | needs)

## UNKNOWN
- The complexity cost of adding `id` to the list query.
- Whether the raw `/trace` keeps the timestamp prefix on gitlab.com today (inferred, not measured).
- The instance's maximum log size.
- Whether GitLab's current Vue job-log viewer renders anything differently from `ansi2html.rb`.