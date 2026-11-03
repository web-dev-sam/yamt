# A merge request's description in a floating panel — design

Request: `docs/slices/request-mr-description.md` (rules 1–8 settled; this design closes its "To be measured" list and
refines only details marked "(orchestrator)"). It builds on "People on a merge request" (base: main once that feature
closes; planned on `21f71b1b`). Current line numbers below are from today's tree: `src-tauri/src/merge_requests.rs` and
`crates/merge-requests/src/lib.rs` are being split by the people feature, so a cited item may have moved to a sibling
file. Facts come from four places:

- `.omp/run/notes/PlanScoutMrDescriptionFacts.md` (cited "facts §n"), used as given.
- The designer's GraphQL calls to gitlab.com, logged out (limit 200), on 2026-11-04, by `GET
  https://gitlab.com/api/graphql?query=…` (cited "measured"). The playground project `samubr/glab-yamt-playground` is
  private: logged out it answers `project: null` (measured), so every measurement is on public `gitlab-org/*` projects.
- The designer's reads of GitLab's own source on `master`, 2026-11-04 (cited by file name).
- The tree (cited `path:line`).

The designer had no shell: nothing was timed, no glab ran, no logged-in score was read. Those are `mr-description-rust`
step 1. Nothing was written to any GitLab. Anything else not seen is marked `[INFERENCE]`.

## 1. The request's "to be measured", closed

### 1.1 `descriptionHtml` against `description` with yamt's Markdown

**What GitLab's rendering holds (measured on `gitlab-org/gitlab` !200000, !267727, !50000):**

- Addresses are relative to the server (`only_path`, so facts §9's open point is settled): an upload is
  `href="/-/project/278964/uploads/<32 hex>/<file>"`; a label `href="/gitlab-org/gitlab/-/merge_requests?label_name=…"`.
  A link the author wrote in full stays absolute.
- Images are lazy: `src` is a 1×1 GIF `data:` placeholder, the real address is `data-src`, `class="lazy gfm"`. Each
  uploaded image is wrapped in `<a class="no-attachment-icon gfm" href="<the same upload>" target="_blank">`.
- Headings carry `id="user-content-…"` and end in an empty `<a class="anchor" href="#…">`.
- Code blocks: `<div class="gl-relative markdown-code-block js-markdown-code"><pre data-canonical-lang="ruby"
  class="code highlight js-syntax-highlight language-ruby" v-pre="true"><code><span id="LC1" class="line"
  data-lang="ruby">…Rouge spans…</span>\n<span id="LC2" …>…</span></code></pre><copy-code></copy-code>
  <insert-code-snippet></insert-code-snippet></div>`. The language is `data-canonical-lang`; the text is the `<code>`'s
  text (lines joined by `\n` text nodes).
- Task lists: `<ul class="task-list"><li class="task-list-item"><input type="checkbox"
  class="task-list-item-checkbox" checked="" disabled="" aria-label="Check option: …"> text</li>`. GitLab also allows
  `data-inapplicable` on that input (`sanitization_filter.rb` `allow_tasklists`).
- Table alignment is `style="text-align: left|center|right"` on `th`/`td`, the only style GitLab keeps there
  (`sanitization_filter.rb` `TABLE_ALIGNMENT_PATTERN`). The measured tables had none.
- References: an MR written as a full URL became `<a href="https://gitlab.com/gitlab-org/gitlab/-/merge_requests/254367"
  class="gfm gfm-merge_request" data-reference-type="merge_request" data-iid="254367" data-project-path="gitlab-org/gitlab"
  title="Add a rate limit to pipeline retry" …>!254367 (merged)</a>`; a work-item URL stayed a plain `<a href>`; a
  label became `<span class="gl-label"><a href="/…?label_name=security" data-reference-type="label"><span …
  style="background-color: #d9534f">security</span></a></span>`. Facts §9 lists the other reference attributes.
- Emoji: `<gl-emoji title="robot" data-name="robot">🤖</gl-emoji>`. HTML comments in the source render to nothing.
  External links carry `rel="nofollow noreferrer noopener" target="_blank"`.
- Mermaid and math stay text for the browser to draw (`language-mermaid`, `js-render-math`) `[INFERENCE: GitLab's
  `MermaidFilter`/`MathFilter` only mark the element]`. PlantUML and Kroki, when the server enables them, become an
  `<img>` of the diagram server `[INFERENCE: `PlantumlFilter`, `KrokiFilter`]`.

**`description` with yamt's Markdown** (plan #112, `editor/markdown.ts`) has no task lists, references, `<details>` or
raw HTML (facts §6). References cannot be rebuilt in the window: `#12` is an issue, a work item or an epic depending on
the server (facts §10), `@anna` needs GitLab's user list, a commit id needs the repository. So GitLab's rendering is the
one source of "formatted as GitLab shows it" (rule 3).

**Shown without interpreting markup the page did not allow (RK57, RK60).** The window never receives HTML. Rust parses
`descriptionHtml` and walks it with an allow-list into a typed tree (§2, option A). The tree has no attribute bag, so an
`onerror`, a `style` or a `class` cannot cross. Its text is shown by Vue text interpolation only, with no `href` and no
`v-html`.

**Dependency (vision 5, DR3).** Rust cannot parse HTML or resolve a relative URL with what the crate has today
(`crates/merge-requests/Cargo.toml:8-14`). Both crates the design needs are already compiled into the app:

- `dom_query` 0.28.0, through `tauri-utils` 2.10.1 and `wry` 0.57.0 (`Cargo.lock:686-699, 3506-3515, 4543-4553`);
- `url` 2.5.8, through tauri (`Cargo.lock:3959`).

So making them direct dependencies of `yamt-merge-requests` adds no code to the build. arch-check forbids only `yamt-*`
and `tauri*` there (`scripts/arch-check.sh:72-77`). Both need a §2 row and §7's list (proposed #171).

### 1.2 The per-open request

- **A new query, not the details query.** The details query (`query.rs:6-10`, plan #132) serves opening the changes;
  adding HTML to it would ship HTML on every "Show Diff". `MergeRequestDescription($fullPath, $iid) { project {
  mergeRequest(iid) { descriptionHtml } } }`, through the same `merge_request_args` (`query.rs:217-228`).
- **Cost: 10 of the logged-out limit of 200** (measured, with `queryComplexity`; `mergeRequest { iid }` alone is 6).
- **Calls.** Like every per-click command, it goes through `logged_in_project` (auth status and the project, arch
  §3.9 "The list"), so one open is three glab runs. Timing is the rust slice's step 1.
- **One source per open.** `read_description` fetches in one place (`fetch_description`, `pub(crate)`) and walks the
  parsed document in another. `request-mr-links.md` reuses the fetch and reads the reference attributes from the same
  document (facts §9). It does not need a second request for the description.

### 1.3 The empty check (rule 1)

- **Measured on `gitlab-org/gitlab-foss`, `mergeRequests(state: opened, first: 100)`:**
  - `{ iid }` costs 12;
  - `{ iid description }` costs 14;
  - `{ iid descriptionHtml }` costs 22.
- So `description` adds 2 to the list query's 170 of 250 (`query.rs:55-60`), about 172 `[INFERENCE: the same +2
  logged in]`. `descriptionHtml` would add 10, plus HTML for up to 500 rows (facts §2).
- **Kept** (rule 1 "at small cost"). Rust folds the text to `MergeRequestRow.hasDescription`: true when it holds more
  than white space. The text never reaches the window.
- **Bytes.** Two `gitlab-org/gitlab` descriptions measured 2.6 KB and 3.4 KB (!267728, !267727). A team's list grows by
  roughly that per row on each load `[INFERENCE]`. That cost is accepted (row #174).
- A description made only of HTML comments shows the button, and the panel says "No description." (row #174).

### 1.4 Uploads

- **Web path.** `UploadLinkFilter` writes every `/uploads/<secret>/<file>` as `<relative_url_root>/-/project/<id>/…`
  (`-/group/<id>/` for a group) (`upload_link_filter.rb`, measured). Older servers wrote
  `/<namespace>/<project>/uploads/<secret>/<file>` `[INFERENCE: the ID-based path is upload version 2,
  `UploadsActions::ID_BASED_UPLOAD_PATH_VERSION`]`.
- **Who may read it.**
  - `Banzai::UploadsController` serves the ID path. `authorize_access!` passes when `bypass_auth_checks_on_uploads?`,
    that is, for an image ("embeddable") unless the project is private and has `enforce_auth_checks_on_uploads` ("Require
    authentication to view media files") (`uploads_actions.rb`). Otherwise it needs `read_project` for the session's
    `current_user`.
  - A web controller reads no token header `[INFERENCE: neither controller calls `authenticate_sessionless_user!`]`.
    So `glab api <web address>` works only when authentication is not required.
- **REST.** `GET /projects/:id/uploads/:secret/:filename`, GitLab 17.4+, Guest role or more (docs, "Markdown uploads
  API"). It takes glab's token.
- **Decision.**
  - First `glab api projects/<id or url-encoded path>/uploads/<secret>/<file>`.
  - On glab's `(HTTP 403)` or `(HTTP 404)`, `glab api <the web address>`. That covers GitLab 15.6–17.3 and a public
    project the user is not a member of `[INFERENCE]`.
  - Any other failure, or both refused, leaves the image's caption in its place.
  - Rust step 1 measures both routes on `gitlab-org/gitlab` !200000's screenshots.
- **Limits.**
  - Uploads take the four kinds the picture route sniffs (PNG, JPEG, GIF, WebP, `picture.rs:52-94`). An uploaded SVG
    or other file shows its caption (RK53: no SVG into the window).
  - At most `MAX_UPLOAD_BYTES` 10 MiB; avatars keep 1 MiB (`picture.rs:10`). A screenshot is often over 1 MiB
    `[INFERENCE]`; step 1 records the four sizes.
  - An upload's address never changes (its secret is in it), so the shelf keeps it for the run as it keeps avatars
    (`pictures.rs:17-33`).
- **Key.** The window asks `yamt-picture://localhost/upload~<secret>`:
  - `~` is never in a username (`pictures.rs:129-132`), so an upload key never names an avatar;
  - `convertFileSrc` leaves `~` as it is (`encodeURIComponent`).

### 1.5 Other sites' images and the content security policy

- **Not through glab:** `glab api <another host>` would send the login there (RK53).
- **Not through a Rust HTTP client:** that is a new dependency the webview makes needless.
- **The webview loads them.**
  - `img-src` becomes `'self' data: yamt-picture: http://yamt-picture.localhost https:`. `https:` covers Gravatar's two
    hosts, which are dropped from the list.
  - The webview holds no GitLab login, so nothing of the user's reaches those sites but the request itself.
  - The window adds `referrerpolicy="no-referrer"`.
- **`http:` images** show their caption: the CSP admits `https:` only (row #174). WebKit's mixed-content rules would
  likely block them anyway `[INFERENCE]`.
- **Everything else stays as `default-src 'self'` sets it** (`tauri.conf.json:14-15`): no script, frame, media, object
  or font from elsewhere, and no inline script. That is a second wall behind rule 6.

### 1.6 The opener and any `http`/`https` link (RK41)

- Every link is resolved by `url::Url::join` against the merge request's GitLab page
  (`WebPage::merge_request(origin, web_path, iid)`, `web_page.rs:36-43`):
  - an `http`/`https` result → `WebPage::linked` → `DescriptionLink::Page { page }`;
  - the page is offered into `MergeRequestState.pages` before the reply (`merge_requests.rs:93-100` `offer`, as
    discussions do, `merge_requests/discussions.rs:10-26`);
  - so `open_page` (the command at the end of `merge_requests.rs`, read 2026-11-04 while the people feature splits
    that file) and its allow-list stay as they are.
- **Windows.** `WebPage` passes no quoting to `rundll32` (`web_page.rs:115-121`). `url` serialises with spaces, quotes,
  `<`, `>` and control characters percent-encoded (WHATWG percent-encode sets), so a linked page holds none. A test pins
  it.
- **Refused links.** Any other scheme (`mailto:`, `file:`, `javascript:`, `data:`, a custom one), or an address `url`
  cannot read, → `Refused { address }` as written. It opens nothing; its tooltip shows it (rule 4).
- **Without an https origin** (`project_page`, `web_page.rs:67-73`), a relative link is refused. An absolute
  `http`/`https` link still opens.

### 1.7 Code colours, focus and Tab order

- **Colours.** Code blocks use `MarkdownView`'s own painter (`editor/markdown.ts:14-19`, `editor/internal/codeBlock.ts:21-38`:
  `languageNamed` + the panes' highlighters, plan #112's one colour table).
  - A new `MarkdownView.showCode(language, text)` shows one block; `ui/useMarkdown.ts` gains `useMarkdownCode`.
  - The markdown fence still allows `MarkdownView` only through `useMarkdown.ts` (`frontend/scripts/markdownFence.ts:15-17`),
    so no new seam and no fence change.
  - Mermaid and math are code blocks whose language yamt does not colour.
- **Focus on open.** The panel itself (`tabindex="-1"`) takes focus, so arrows and Page Down scroll it.
- **Tab order:**
  1. the close button;
  2. the content's links and `<summary>`s, in document order.
- **Not modal, no trap.** Escape closes from anywhere while open, unless something inside already handled it
  (`defaultPrevented`, as `useHoverBox`). The keyboard goes back to the row's info button when it is still listed.

### 1.8 Fake glab

- **Description route.** `graphql()` routes by the operation name:
  - a query field starting `query MergeRequestDescription` → `graphql-description-<iid>`;
  - placed before the `iid` route (`scripts/fake-glab/glab:142-145`);
  - so `iid`-routed details, branches and reviewers queries and the discussions' `iids` route (`:129-137`) are untouched.
- **Upload routes.**
  - `GET projects/<p>/uploads/<secret>/<file>` → `uploads/<p>/<secret>/<file>` through `serve_file`, so it is logged.
  - The web path already reaches `picture()` (`:170-176, 223`).
- **Scenario `tests/glab/mr-description/`** (rust brief):
  - the list, with each row's `description`;
  - a rich description holding every element of rule 3;
  - an empty one;
  - a planted one: script, `onerror`, frame, style, object, media, form, base, meta, deep nesting;
  - a glab failure and a missing merge request;
  - uploads by both routes, a missing upload, another site's image and an upload-looking path on another host.

## 2. Options

The options differ in where GitLab's HTML becomes something safe, and so in who knows which links and uploads a
description holds.

### Option A — GitLab's rendering, reduced by Rust to a typed tree; the window renders the tree (recommended)

**Data structures** (Rust, `yamt-merge-requests`, IPC through specta; the brief has the exact shapes):

- `DescriptionReply` `read { description }` | `glabMissing` | `notLoggedIn { detail }` | `failed { message }`.
- `Description { blocks }`.
- `DescriptionBlock`:
  - `paragraph { inlines }`;
  - `heading { level: HeadingLevel h1–h6, inlines }`;
  - `code { language: Option<String>, text }`;
  - `list { numbering: bullets | numbers { start }, items: DescriptionItem { task: TaskBox none|open|done|inapplicable,
    blocks } }`;
  - `quote { blocks }`;
  - `rule`;
  - `table { head, body: DescriptionRow { cells: DescriptionCell { header, align: CellAlign start|center|end, inlines }
    } }`;
  - `details { open, summary, blocks }`.
- `DescriptionInline`:
  - `text`, `emphasis`, `strong`, `strike`, `code`, `lineBreak`;
  - `link { link: DescriptionLink, inlines }`, where `DescriptionLink` is `page { page: WebPage }` | `refused { address }`;
  - `image { image: DescriptionImage, caption }`, where `DescriptionImage` is `uploaded { key: UploadKey }` | `web {
    address }` | `refused`.
- Not IPC:
  - `ReadDescription { reply, pages: Vec<WebPage>, uploads: Vec<OfferedUpload> }`;
  - `OfferedUpload { key, address: PictureAddress }`.
  - `PictureAddress` becomes an avatar or an upload inside; it stays opaque.
- List: `MergeRequestRow.hasDescription`.
- Window: `ShownDescription { row: { iid, title }, load: loading | shown { description } | refused { reply } | failed {
  cause } }`, one per window, the job log's shape (`mergeRequestJobLogs.ts:9-15`).

**Files:**

- Rust crate, about 22:
  - `description.rs`, `description/html.rs`, `description/address.rs`, `description/tests.rs`;
  - `picture.rs` and its tests, `query.rs`, `page.rs`, `row.rs`, `lib.rs`, `tests/description.rs`;
  - the fake glab, the scenario and its README.
- App, 7: `merge_requests/description.rs`, `pictures.rs`, `merge_requests.rs`, `commands.rs`, `tauri.conf.json` and
  two tests.
- Look, 5: `editor/markdown.ts`, a WebKit test, `ui/useMarkdown.ts`, `eslint.config.js` and its test.
- State, about 14: the ipc source, the fixtures, `ui/mergeRequestDescriptions.ts`, `mergeRequests.ts`, `problem.ts`,
  `problemText.ts`, `mergeRequestsText.ts` and tests.
- Page, about 12: the row, the view, five components, the words and tests.

**Risks:**

- GitLab changes its HTML. Unknown elements fall back to their text, so it degrades to plain text, never to markup.
  Owner check.
- A screenshot over 10 MiB, an uploaded SVG or a GitLab older than 17.4 that requires authentication for media shows
  the caption.
- Loading… lasts three glab runs.

**Tests:**

- Rust unit tests over measured GitLab snippets and planted HTML (rule 6), plus the address rules (rules 4–5);
  integration over the fake glab (argv: a GET, the uploads route, never another host); shell offering and the CSP.
- Window: the slice's latest-only answers and Retry; SSR renders proving text interpolation, no `href`, no `on*`.
- WebKit fixture and real app.

**Visions:**

- 3: no HTML crosses the IPC, and the CSP stays a second wall.
- 4: the tree's sum types; the illegal "link holding an image" is never built.
- 2: GitLab's rendering is the one source; Rust offers exactly what it read.
- 1: a `match` on tag names.
- Cost to 5: two direct crates, already compiled.

### Option B — the webview parses GitLab's HTML (inert `DOMParser`); the window's core reduces it; Rust opens any http(s) and fetches any upload path the window names

**Data structures:**

- `read_description` returns `descriptionHtml` as a string.
- `mergeRequests/` reduces a `DescriptionNode { tag, attributes, children }` (built from `DOMParser` in one `ui/` file)
  to the same tree as A, in TS.
- New commands:
  - `open_link(address)` accepts any `http`/`https`;
  - `yamt-picture://localhost/upload/<path>` accepts any upload-shaped path on the project's origin.

**Files:** fewer Rust files; one more web slice (the core walker).

**Risks:**

- The `DOMParser` adapter cannot run in the node tests: the node project has no DOM (`vite.config.ts:31-45`), and the
  WebKit project includes only `src/editor/**` (`:13-14`).
- So the one place markup becomes data is unmutated (`just mutants` runs node only, `vite.config.ts:49`).
- Rust no longer knows what GitLab listed. RK41 weakens to a scheme check, and RK53's "only what GitLab listed" to a
  path pattern the window may name freely.
- HTML strings sit in Vue state, one `v-html` away from rule 6.

**Tests:** core walker tests over hand-built nodes; the adapter only through WebKit.

**Visions:** 5 (no Rust crate) and 1 (TS). It costs 3 (the boundary is a convention in the window) and 2 (the window,
not GitLab's answer, decides what opens).

### Option C — the raw `description` through yamt's own Markdown, extended (#112)

**Data structures:**

- `editor/markdownBlocks.ts` gains task items, `<details>`, an HTML subset and reference links.
- References are resolved by a second query per open (`workItemsByReference`, 16.7+, facts §11) or left as text.

**Files:** the editor's Markdown parser and DOM builder, a reference lookup in Rust, the same panel.

**Risks:**

- It is not "as GitLab shows it": no labels' links, no `@` mentions, no commit links, no `(merged)` suffixes.
- References on servers older than 16.7 are not links.
- A second parser of raw HTML in the window anyway (`<details>` is HTML).
- About twice the code of A for a worse match.

**Tests:** parser goldens.

**Visions:** 5 (no dependency). It fails rule 3 and duplicates GitLab's renderer (vision 2).

## 3. Recommendation

**Option A.** GitLab renders, Rust reduces, the window renders a typed tree.

- Rules 4–6 are enforced where the data enters, by types and tests that run in `cargo nextest` and `just mutants`.
- The opener and the picture route keep their allow-lists: every link and upload they accept came from an answer
  GitLab gave in this run.
- `request-mr-links.md` reads the same fetch.

**Cost:**

- Two direct crates already in the build.
- Five implementer slices (crate, app, look, state, page) and a verifier; at most two at once.
- A heavier list load: about 3 KB of description text per row on `gitlab-org/gitlab`, folded in Rust to one bool.
- Three glab runs per open.
- Uploads keep the run's memory as avatars do (bounded by what the user opens).

### Proposed plan §2 rows (DR5: the orchestrator records them; numbers as free at commit time, after #170)

| #              | **Decision**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Rejected alternatives & why                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Vision     |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| 112 (reopened) | … "images … never loaded; links shown as text … never navigable; raw HTML literal" stands for the AI's answers and threads; a merge request's description in its panel is #171–#173 (owner #2252, #2248, #2249, request `docs/slices/request-mr-description.md` "Reopens").                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | —                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | —          |
| 171            | **A merge request's description is GitLab's own rendering, reduced in Rust to a typed tree, shown in one panel per window** (owner #2252; request rules 1–3, 6–8; design `briefs/mr-description-design.md` option A; reopens #112 for this panel; amends §7: `yamt-merge-requests` adds `dom_query` 0.28 and `url` 2.5, both already in the app through tauri-utils/wry and tauri, `Cargo.lock`). The list query (#131) adds `description`, folded by Rust to `MergeRequestRow.hasDescription` (more than white space; +2 of the limit, measured 12→14 at `first: 100`); the row shows an `info` button (tooltip "Show description") in its own `w-7` column after the approvals, kept empty without a description. `read_description(iid)` asks `MergeRequestDescription { mergeRequest(iid) { descriptionHtml } }` afresh on every open and Retry (10 of 200 logged out, measured) through `fetch_description`, the one fetch `request-mr-links.md` reuses. `dom_query` parses it; an allow-list walk builds `Description { blocks }`: paragraphs, headings h1–h6, code (`data-canonical-lang`, the `<code>`'s text), lists (`start`; task boxes open/done/inapplicable from GitLab's task input), quotes, rules, tables (alignment only from `text-align: left\|center\|right`), `<details>` (`open`, summary); inlines text, emphasis, strong, strike, code, line break, links, images (`data-src` before `src`; an image inside a link is lifted out, the link dropped when left empty). No attribute crosses but these typed fields. Unknown elements give their content; `script`, `style`, `template`, `noscript`, `iframe`, `frame(set)`, `object`, `embed`, `applet`, `video`, `audio`, `source`, `track`, `canvas`, `svg`, `math`, `link`, `meta`, `base`, `head`, `title`, `input` (but the task box), `button`, `select`, `textarea`, `option`, comments give nothing; content nested deeper than 32 elements is left out. The window renders the tree with text interpolation only: no `href` on any element, no `v-html` (`vue/no-v-html` an ESLint error), task boxes as icons, images `max-w-full` with `referrerpolicy="no-referrer"` and their caption on error, code through `MarkdownView.showCode` in the panes' colours. One panel per window (`ShownDescription`, the job log's shape): about `min(64rem, 100vw − 4rem)` wide, up to `85vh`, centred, its content scrolling inside, not modal; closes on its `x` button, Escape (focus back on the info button), a press outside it, a second click on the same button; another row's button replaces it; a page scroll or a list refresh leaves it as loaded. | Option B (`DOMParser` in the window: the adapter untestable in node and unmutated, Rust no longer knowing what GitLab listed); option C (own Markdown: references, mentions and labels not as GitLab makes them, a second HTML parser anyway); `descriptionHtml` in the list (+10 and the HTML of 500 rows per load); DOMPurify + `v-html` (#112's reason: a sanitiser as the boundary in a page that reaches the IPC); a webview navigation guard (nothing has an `href`; a guard would touch every window). | 3, 4, 2, 1 |
| 172            | **Every `http`/`https` link in a description opens in the system browser through the one opener** (owner #2248; request rule 4; amends #133 and #137's "Links … stay text" and RK41 for links in a description). Each `href` is resolved by `url::Url::join` against the merge request's GitLab page (`WebPage::merge_request`); an `http`/`https` result becomes a `WebPage` through `WebPage::linked` (serialised by `url`: no space, quote or control character, so Windows' one command line needs no quoting) and is offered into `MergeRequestState.pages` with the reply, before it returns; `open_page` and its `NotOffered` stay as they are. Any other scheme (`mailto:`, `file:`, `javascript:`, `data:`, custom) or an unreadable address is `refused { address }`: it opens nothing and shows its address in its tooltip. Without an https origin a relative link is refused.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | An `open_link(any address)` command (the window could hand any address to the system); an `http`/`https` check in the window only (rule 3 of vision 3: enforced where the data enters).                                                                                                                                                                                                                                                                                                                       | 3, 2       |
| 173            | **A description's uploaded images load through the picture scheme with the login; other sites' images load straight from those sites** (owner #2249; request rules 5–6; amends #152 and the CSP; RK53). An image on the project's https origin whose path is `[<sub-path>]/-/project/<digits>/uploads/<32 hex>/<file>` or `<project path>/uploads/<32 hex>/<file>` (file of `[A-Za-z0-9._~%+-]`, no `..`) is `uploaded { key: "upload~<secret>" }`, offered with the reply; the scheme fetches it by `glab api projects/<id or encoded path>/uploads/<secret>/<file>` (17.4+), and on glab's `(HTTP 403)` or `(HTTP 404)` by `glab api <its web address>` (servers 15.6–17.3, public projects); PNG, JPEG, GIF or WebP by their first bytes, at most `MAX_UPLOAD_BYTES` 10 MiB, kept for the run as avatars. Any other `https` image is `web { address }` and the window loads it itself; `http:`, `data:`, `file:` or unreadable → `refused`, the caption shows. CSP `img-src 'self' data: yamt-picture: http://yamt-picture.localhost https:` (Gravatar's two hosts inside `https:`); nothing else in the CSP changes.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Fetching other sites through glab (the login to another host, RK53) or a Rust HTTP client (a dependency the webview makes needless); `http:` in the CSP (mixed content; rare); the web path alone (fails with "Require authentication to view media files", `uploads_actions.rb`); the REST route alone (absent before 17.4, the floor is 15.6); not keeping uploads (their address never changes).                                                                                                           | 3, 5       |
| 174            | **Defaults decided with the description design** (orchestrator, OR13; the owner may veto): §4 of the design.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | —                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | —          |

### Risks for the register (`skill://risk-register`; next free id after the people feature's RK64, RK65: RK66)

| id               | risk                                                                                                                                                                                                                                                                                     | owner                                                                                                                                                                                                                                                               | proving test                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| RK41 (rewritten) | the merge-request page's opener hands the system browser an address GitLab did not list for a failed job, a merge request, a note **or a link in a description it answered in this run**; or a described address that is not `http`/`https` or holds a space, quote or control character | `yamt-merge-requests` `WebPage::job`/`merge_request`/`note`/`linked` (`description/address.rs`) + `src-tauri` `merge_requests.rs` (`pages`, `NotOffered`) + `merge_requests/description.rs` (offered before the reply)                                              | the existing tests, plus `mailto_file_javascript_data_and_unreadable_links_are_refused_with_their_address`, `a_relative_link_resolves_on_the_merge_requests_gitlab_page`, `a_described_page_has_no_space_quote_or_control_character`, `a_described_page_is_offered_before_the_reply`, `an_address_no_reply_named_is_not_offered`                                                                                                          |
| RK53 (amended)   | the window loads or makes glab fetch an address GitLab did not list as an avatar **or as an upload in a description it answered**; GitLab's token goes to Gravatar or any host but the project's GitLab; a non-image (HTML, SVG) is served into the window; **an upload over 10 MiB**    | as today + `description/address.rs` (the only maker of an upload `PictureAddress` and `UploadKey`) + `fetch_picture` (the uploads route, then the web path) + `pictures.rs` `offer_uploads`                                                                         | the existing tests, plus `an_upload_on_the_projects_origin_is_uploaded_in_both_path_forms`, `an_upload_path_on_another_host_is_another_sites_image`, `another_sites_image_never_reaches_glab`, `an_upload_is_fetched_with_the_login_through_the_uploads_api`, `an_upload_up_to_10_mib_is_taken_and_larger_is_refused`, `an_upload_no_reply_offered_gets_404_and_runs_no_glab`, `the_csp_admits_the_scheme_and_any_https_image_only`       |
| RK66             | a description's markup runs, submits, navigates or loads anything but its images (script, event handler, frame, style, font, media, form, `base`, `meta` refresh), or the window interprets any of its text as markup                                                                    | `yamt-merge-requests` `description/html.rs` (allow-list walk; typed fields only; nesting ≤ 32) + `tauri.conf.json` CSP (`default-src 'self'`, `img-src` adds `https:` only) + `MergeRequestDescription*.vue` (text interpolation, no `href`, `vue/no-v-html` error) | `planted_script_style_frame_object_media_and_form_leave_nothing`, `no_key_but_the_contracts_crosses`, `a_base_or_meta_element_changes_no_address`, `nesting_past_32_levels_is_left_out`, `the_csp_loads_scripts_frames_media_and_fonts_from_the_app_only`, `text_that_looks_like_markup_renders_as_text`, `no_description_element_has_an_href_or_an_on_attribute`, `v_html_is_an_error_in_a_vue_file`, WebKit and real-app step "planted" |
| RK67             | the description panel shows an older answer after a newer open or a close (a slow reply for a row the user left), or a list refresh closes or changes an open panel                                                                                                                      | `ui/mergeRequestDescriptions.ts` (the shown entry's identity, as `mergeRequestJobLogs.ts:65`) + `ui/mergeRequests.ts` (a refresh never writes it)                                                                                                                   | `an_answer_for_a_closed_or_replaced_panel_is_dropped`, `a_refresh_keeps_the_open_description`, `each_open_asks_gitlab_again`                                                                                                                                                                                                                                                                                                              |

### Shared edits for the orchestrator (no slice owns them)

- **Before wave 1** (needs rows #171–#173 accepted, DR3):
  - root `Cargo.toml` `[workspace.dependencies]` gains `dom_query = "0.28.0"` and `url = "2.5.8"`;
  - `crates/merge-requests/Cargo.toml` `[dependencies]` gains `dom_query.workspace = true` and `url.workspace = true`;
  - `cargo metadata --format-version 1 >/dev/null` refreshes `Cargo.lock`, which then names both under
    `yamt-merge-requests` and no new package;
  - `just arch-check` and `just deny` pass.
- **After `mr-description-app`, before `mr-description-state`:** `just bindings`.
  - It brings `DescriptionReply`, `Description`, `DescriptionBlock`, `DescriptionInline`, `DescriptionItem`,
    `DescriptionRow`, `DescriptionCell`, `DescriptionLink`, `DescriptionImage`, `HeadingLevel`, `ListNumbering`,
    `TaskBox`, `CellAlign`, `UploadKey`, `MergeRequestRow.hasDescription` and `commands.readDescription(iid)`.
  - The frontend type check is red until the state slice adds `hasDescription` to the fixture rows and test literals.
    That is the state slice's first step.
- Plan rows #112 (reopened note), #171–#174; RK41 (rewritten), RK53 (amended), RK66, RK67.
- **Docs keeper (once, after the page slice):**
  - `docs/architecture.md`:
    - §3.9: the types, a "Description" paragraph beside "Open discussions", the tests line (scenario
      `mr-description`), the opener's fourth maker `WebPage::linked`, and "People and pictures": uploads and
      `MAX_UPLOAD_BYTES`;
    - §3.5/the commands list: `read_description`; the CSP's `img-src`;
    - §4 `MergeRequestSource`: `readDescription`, `uploadedImage`;
    - §5.1 state table: "merge requests: the description panel";
    - §5.4: the problem steps `description`, `link`; the panel;
    - §7: `dom_query`, `url` for `yamt-merge-requests`.
  - `.omp/skills/ipc-contract/SKILL.md`: the command and the two source methods.
  - `skill://project-map/tree.md`, every new file:
    - Rust: `description.rs`, `description/{html,address,tests}.rs`, `tests/description.rs`,
      `src-tauri/src/merge_requests/description.rs`, its test;
    - window: `ui/mergeRequestDescriptions.ts`, `ui/mergeRequestDescriptionText.ts`, `ui/MergeRequestDescription.vue`,
      `…Blocks.vue`, `…Inlines.vue`, `…Image.vue`, `…Code.vue`, `ipc/fixtureMergeRequestDescriptions.ts`,
      `frontend/scripts/eslintRules.test.ts`.
  - `skill://project-map/state.md`: the panel (`ui/mergeRequestDescriptions.ts`, written only by its functions).
  - `CHANGELOG.md`: one line.
  - The `AGENTS.md` lines the slices hand on in `deviations_from_brief`. `src-tauri/AGENTS.md` is the keeper's.

## 4. Decided without the owner

The owner will not answer this session (#2260). Each item is recorded as row #174 and the owner may veto any:

1. **The empty check stays.**
   - A merge request with no description shows no info button; its column stays empty, so the icons stay aligned.
   - A description made only of hidden comments still shows the button, and the panel says "No description.".
   - This makes each list load about 3 KB per row heavier on a busy project like gitlab-org/gitlab.
2. **The CI box stays where it is.** The info button sits between the approvals and the CI box, as the request
   placed it.
3. **The panel is not modal.**
   - It takes the keyboard when it opens.
   - Tab can leave it; Escape closes it from anywhere.
   - A press anywhere else on the page closes it. That press also does what it would do (a row press still opens
     that merge request in the browser).
4. **The panel's header keeps the title the list showed when it was opened.** A refresh that renames the merge
   request does not change an open panel.
5. **Diagrams.** Mermaid diagrams and math show as their code. A PlantUML or Kroki diagram that GitLab itself turns
   into a picture shows as that picture, loaded from the diagram server without your login, as GitLab shows it.
6. **Plain-`http` images show their caption.** Plain-`http` links still open in the browser.
7. **Some uploads show their caption.** An uploaded file that is not a PNG, JPEG, GIF or WebP picture (an SVG, say),
   or a picture over 10 MiB.
8. **Pictures from the repository itself** (not uploaded, e.g. `/-/raw/…`) load without your login. On a private
   project they show their caption.
9. **GitLab older than 17.4** shows uploaded pictures only when the project does not "Require authentication to view
   media files".
10. **Links.**
    - Hovering a link shows the address it opens.
    - A picture inside a link shows as a picture and a click on it does nothing (rule 5). The link is dropped.
    - A link to a heading in the description (`#section`) opens the merge request's GitLab page at that heading.
11. **GitLab-only pieces.**
    - Labels show as their linked name, without their colour.
    - Emoji show as characters.
    - A task GitLab marks "not applicable" shows a crossed box with the tooltip "Not applicable".
    - Description headings keep their own sizes, h1 to h6.
12. **Videos and audio** are not played. The download link GitLab puts beside them stays.
13. **Very deep nesting.** Content nested more than 32 levels deep (32 quotes inside each other) is left out.
14. **Uploaded pictures are kept until yamt closes**, as profile pictures are: their address never changes. Opening the
    same description again shows them at once. The description itself is asked afresh on every open (rule 7).
15. **Failures.**
    - A link the browser cannot open, or one GitLab did not list, shows its sentence in the page's problem bar, as a
      job's link does.
    - A failure to read the description shows one sentence and Retry in the panel.

## 5. Slice graph

| wave | brief                                                                     | owner        | needs                      | beside         |
| ---- | ------------------------------------------------------------------------- | ------------ | -------------------------- | -------------- |
| —    | orchestrator: shared edits "before wave 1"                                | orchestrator | rows #171–#173             | —              |
| 1    | `mr-description-rust.md` (crate, fake glab, scenario)                     | rust-impl    | shared edits               | look           |
| 1    | `mr-description-look.md` (`showCode`, `useMarkdownCode`, `vue/no-v-html`) | web-impl     | —                          | rust           |
| 2    | `mr-description-app.md` (command, offers, upload scheme, CSP)             | rust-impl    | rust                       | —              |
| —    | orchestrator: `just bindings`                                             | orchestrator | app                        | —              |
| 3    | `mr-description-state.md` (source, fixtures, panel state)                 | web-impl     | app + bindings             | —              |
| 4    | `mr-description-page.md` (button, panel, renderers; wires the window)     | web-impl     | state, look                | —              |
| 5    | docs keeper                                                               | docs-keeper  | page                       | verify's smoke |
| 5    | `mr-description-verify.md`                                                | verifier     | page (smoke); docs (final) | docs keeper    |
| 6    | owner check on the playground                                             | human        | verify                     | —              |

Owned globs are pairwise disjoint (each brief's Target). At most two implementers run at once (wave 1).
