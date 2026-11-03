# Slice mr-description-rust — read a description, reduce GitLab's HTML to a typed tree, fetch uploads; fake glab

Feature: a merge request's description in a floating panel. Sources:

- Request `docs/slices/request-mr-description.md`: rules 1, 3–8 (the Rust side) and the Rust acceptance.
- Design `docs/slices/briefs/mr-description-design.md` option A, §1.1–§1.6, §1.8.
- Proposed plan §2 #171–#174; RK41 (rewritten), RK53 (amended), RK66.

Runs in wave 1 beside `mr-description-look`. Before it starts, the orchestrator has already added `dom_query` and
`url` to the workspace and to this crate's `Cargo.toml` (design "Shared edits"). `mr-description-app` builds on this
slice.

## Target

**Owned:**

- `crates/merge-requests/**` (its `AGENTS.md` included), except `crates/merge-requests/Cargo.toml`
- `scripts/fake-glab/glab`
- `tests/glab/mr-description/**` (new)
- `tests/glab/README.md`

**Read-only:** everything else.

- `crates/merge-requests/Cargo.toml`, the root `Cargo.toml` and `Cargo.lock` are the orchestrator's, already holding
  `dom_query` 0.28.0 and `url` 2.5.8. Add no other dependency.
- `crates/gitio/**`: use `Glab::get` as it is.
- `src-tauri/**`: `mr-description-app`'s. Your types must compile there unchanged (Contract).
- `frontend/**`: `frontend/src/ipc/bindings.ts` comes from the orchestrator's `just bindings` (PM4).
- Other scenarios under `tests/glab/`: copy from them, never edit them.
- `docs/**` and `AGENTS.md` files outside your globs: put their lines in `deviations_from_brief`.

**Non-goals:**

- The command, the offers, the picture scheme, the CSP: `mr-description-app`.
- The links feature's reference lookup (`request-mr-links.md`). Keep `fetch_description` reusable; build nothing for it.
- Drawing diagrams or math; videos; editing; caching descriptions (request non-goals).
- Writing to any GitLab.

## Contract

Fixed; you may add, never change.

- IPC types derive `Clone, Debug, PartialEq, Eq, Serialize, Type`, are documented as their neighbours are, and carry
  `#[serde(rename_all = "camelCase")]`. Enums with payloads also carry `tag = "kind"`.
- `HeadingLevel` carries `rename_all = "lowercase"`.
- New modules:
  - `description.rs`, with the children `description/html.rs`, `description/address.rs` and `description/tests.rs`;
  - the IPC types re-exported from `lib.rs`.

```rust
// description.rs
/// How reading a merge request's description ended.
pub enum DescriptionReply {                               // tag = "kind"
    /// GitLab's rendering of the description as yamt shows it; no blocks for an empty one.
    Read { description: Description },
    GlabMissing,
    NotLoggedIn { detail: String },
    /// glab's or GitLab's words; `page.rs` NO_MERGE_REQUEST when GitLab names no such merge request.
    Failed { message: String },
}
pub struct Description { pub blocks: Vec<DescriptionBlock> }

pub enum DescriptionBlock {                               // tag = "kind"
    Paragraph { inlines: Vec<DescriptionInline> },
    Heading { level: HeadingLevel, inlines: Vec<DescriptionInline> },
    /// `language`: GitLab's `data-canonical-lang` on the `<pre>` (else its `lang`), None when neither or empty;
    /// `text`: the `<pre>`'s text, one final "\n" removed. Mermaid, math and other undrawn diagrams are code too.
    Code { language: Option<String>, text: String },
    List { numbering: ListNumbering, items: Vec<DescriptionItem> },
    Quote { blocks: Vec<DescriptionBlock> },
    Rule,
    Table { head: Vec<DescriptionRow>, body: Vec<DescriptionRow> },
    Details { open: bool, summary: Vec<DescriptionInline>, blocks: Vec<DescriptionBlock> },
}
pub enum HeadingLevel { H1, H2, H3, H4, H5, H6 }          // "h1" … "h6"
pub enum ListNumbering { Bullets, Numbers { start: u32 } }  // tag = "kind"; `start` from <ol start>, else 1
pub struct DescriptionItem { pub task: TaskBox, pub blocks: Vec<DescriptionBlock> }
/// GitLab's task box: `input.task-list-item-checkbox` first in the item; `data-inapplicable` → Inapplicable,
/// `checked` → Done, else Open; no such input → None.
pub enum TaskBox { None, Open, Done, Inapplicable }       // "none" | "open" | "done" | "inapplicable"
pub struct DescriptionRow { pub cells: Vec<DescriptionCell> }
/// `header` for a `th`; `align` from `style="text-align: left|center|right"` exactly as GitLab keeps it, else Start.
pub struct DescriptionCell { pub header: bool, pub align: CellAlign, pub inlines: Vec<DescriptionInline> }
pub enum CellAlign { Start, Center, End }

pub enum DescriptionInline {                              // tag = "kind"
    Text { text: String },
    Emphasis { inlines: Vec<DescriptionInline> },          // em, i
    Strong { inlines: Vec<DescriptionInline> },            // strong, b
    Strike { inlines: Vec<DescriptionInline> },            // del, s, strike
    Code { text: String },                                 // code outside pre (inline math too)
    /// Never holds an Image: an image inside a link is lifted out after it; a link left with no inline is dropped.
    Link { link: DescriptionLink, inlines: Vec<DescriptionInline> },
    /// `caption`: alt, else title, else the address as written (empty when there is none).
    Image { image: DescriptionImage, caption: String },
    LineBreak,                                             // br
}
pub enum DescriptionLink {                                // tag = "kind"
    /// An http or https address, absolute or resolved against the merge request's GitLab page.
    Page { page: WebPage },
    /// Any other address, or one yamt cannot read: as written, for the tooltip; opens nothing.
    Refused { address: String },
}
pub enum DescriptionImage {                               // tag = "kind"
    /// Uploaded to the project's GitLab: the window asks the picture scheme by `key` (offered with the reply).
    Uploaded { key: UploadKey },
    /// Any other https address (`url`'s serialisation): the window loads it itself, without the login.
    Web { address: String },
    /// http, data, file, anything else or unreadable: nothing loads, the caption shows.
    Refused,
}
/// `upload~<the upload's 32 hex digit secret>`; `~` is in no username, so it never names an avatar. Only
/// `description/address.rs` makes one.
#[serde(transparent)]
pub struct UploadKey(String);                             // + PartialOrd, Ord; `pub fn as_str(&self) -> &str`

/// Not IPC: what the shell offers before it replies.
pub struct ReadDescription { pub reply: DescriptionReply, pub pages: Vec<WebPage>, pub uploads: Vec<OfferedUpload> }
/// Not IPC: an upload a description named.
pub struct OfferedUpload { pub key: UploadKey, pub address: PictureAddress }

/// glab missing → GlabMissing; `logged_in_project` (From<NoProject>, as for the other replies, `project.rs`);
/// `fetch_description`; then `described`. `pages` and `uploads` once each, in document order; both empty unless Read.
/// One `tracing::info!`: iid, outcome kind, blocks, pages, uploads, web images; never text or an address.
pub fn read_description(repository: &GitLabRepository, glab: Option<&Glab>, iid: MergeRequestIid) -> ReadDescription;

/// The one request for a description (request-mr-links reuses it): one `Glab::get` of `description_args`; Err(line)
/// or a GraphQL error → Failed in those words; `project: null` → Failed(NO_PROJECT); `mergeRequest: null` →
/// Failed(NO_MERGE_REQUEST); `descriptionHtml: null` → "".
pub(crate) fn fetch_description(glab: &Glab, root: &Path, project: &Project, iid: MergeRequestIid)
    -> Result<String, DescriptionReply>;

// description/html.rs
/// What a description's HTML gives: the tree, and every page and upload it names.
pub(crate) struct Described { pub description: Description, pub pages: Vec<WebPage>, pub uploads: Vec<OfferedUpload> }
/// `base`: the merge request's GitLab page (`WebPage::merge_request`), None off https.
pub(crate) fn described(html: &str, base: Option<&WebPage>) -> Described;
pub(crate) const MAX_NESTING: usize = 32;

// description/address.rs
impl WebPage {
    /// An http or https `url` as `url` serialises it.
    pub(crate) fn linked(url: &url::Url) -> Option<WebPage>;
}
pub(crate) fn link_of(base: Option<&url::Url>, href: &str) -> DescriptionLink;
/// The image and, for an upload, what to offer.
pub(crate) fn image_of(base: Option<&url::Url>, src: &str) -> (DescriptionImage, Option<OfferedUpload>);
```

**The walk** (`described`; design §1.1, row #171):

- `dom_query` parses the fragment.
- Block elements: `p`, `h1`–`h6`, `pre`, `ul`, `ol`, `blockquote`, `hr`, `table`, `details`.
- Inline elements: `em`/`i`, `strong`/`b`, `del`/`s`/`strike`, `code`, `a`, `img`, `br`.
- `li`, `tr`, `th`, `td`, `summary`, `thead`, `tbody` inside their parents.
- **Left out with their text:** `script`, `style`, `template`, `noscript`, `iframe`, `frame`, `frameset`, `object`,
  `embed`, `applet`, `video`, `audio`, `source`, `track`, `canvas`, `svg`, `math`, `link`, `meta`, `base`, `head`,
  `title`, `button`, `select`, `textarea`, `option`, every `input` but the task box, and comments.
- **Every other element gives its content** (`div`, `span`, `gl-emoji`, `copy-code`, `sup`, `kbd`, …).
- **Inline runs beside blocks** in a block container (`li`, `blockquote`, `details`, `td`, a `div`) become a
  `Paragraph`. White-space-only text between blocks is dropped. Text inside inlines is kept as GitLab wrote it.
- **Images.** `img`'s address is `data-src` when present, else `src`. A `picture` gives its `img`.
- **Nesting.** Content more than `MAX_NESTING` elements deep is left out, with one `tracing::warn!` per read.
- `<base>` and `<meta>` change nothing.

**Addresses** (`address.rs`, design §1.4–§1.6):

- **`link_of`:**
  - `url::Url::parse(href)`, else `base.join(href)`;
  - scheme `http`/`https` → `Page(WebPage::linked)`;
  - else, or unreadable, or relative without `base` → `Refused { address: href }`.
- **`image_of`:**
  - resolved the same way;
  - `https` on `base`'s origin, with a path of the form `[<segments>]/-/project/<digits>/uploads/<32 lowercase
    hex>/<file>` or `<project web path>/uploads/<32 hex>/<file>` → `Uploaded`;
    - `<file>` is one segment of `[A-Za-z0-9._~%+-]`, not `..` (`web_page.rs` `is_web_path` for the segments);
    - the upload's `PictureAddress` holds the REST route `projects/<digits or the project path with "/" as
      "%2F">/uploads/<secret>/<file>` and the web address;
  - any other `https` → `Web { address: url.as_str() }`;
  - anything else → `Refused`.

**`picture.rs`:**

- `PictureAddress` stays opaque, `Ord` and `as_str()`, which returns the https address: the avatar's, or the upload's
  web address. Inside it is an avatar or an upload; only `avatar_source` and `image_of` make one.
- `pub const MAX_UPLOAD_BYTES: usize = 10 << 20;`
- `fetch_picture(glab, root, address)` is unchanged for avatars. For an upload:
  1. `Glab::get(root, &["api", <the REST route>])`;
  2. on an `Err` ending in `(HTTP 403)` or `(HTTP 404)`, `Glab::get(root, &["api", <the web address>])`;
  3. then the four kinds by first bytes and at most `MAX_UPLOAD_BYTES`.
- Never `-X`, `--method`, `--input` or a field.

**Queries** (`query.rs`, one line each):

```rust
/// A merge request's description as GitLab renders it, asked afresh on every open of the panel: 10 of GitLab's limit
/// of 200 logged out on gitlab.com, measured 2026-11-04. The operation name routes the fake glab.
const DESCRIPTION_QUERY: &str = "query MergeRequestDescription($fullPath: ID!, $iid: String!) { \
     project(fullPath: $fullPath) { mergeRequest(iid: $iid) { descriptionHtml } } }";
pub(crate) fn description_args(full_path: &str, iid: MergeRequestIid) -> Vec<String>;   // merge_request_args
```

**The list.**

- `list_query` asks `description` after `title`. +2: measured 12 → 14 at `first: 100` logged out. Update the
  comment's score after step 1.
- `MergeRequestRow` gains `pub has_description: bool` (`hasDescription`), documented as "GitLab's description holds
  more than white space".
- `page.rs` sets it from the node's `description: Option<String>`. The text goes nowhere else.

**`WebPage`'s doc** (`lib.rs:87-88`) becomes: "… a failed job's log, a merge request, a note on one or a link in a
description; only `WebPage::job`, `::merge_request`, `::note` and `::linked` make one."

**Fake glab** (`scripts/fake-glab/glab`):

- `graphql()`: before the `iid` route (`:142-145`), a `query` field starting `query MergeRequestDescription` answers
  `$scenario/graphql-description-<iid>` through `reply`. The comment above `graphql()` (`:124-127`) says so.
- `api()`: `"GET projects/"*"/uploads/"*` answers `$scenario/uploads/<the endpoint after projects/>` through
  `serve_file`. `GET *://*` (`picture()`) already serves web paths from `pictures/`.

**Scenario `tests/glab/mr-description/`:**

- `project.json` as `mr-row-details/project.json`: id 7, `https://gitlab.example/taskboard/taskboard`.
- `graphql-page-1.json`, user `sam`, rows !52–!47. Each node has `description`:
  - !52–!48 a short text;
  - !47 `"  \n "`;
  - !46 `null`.
- `graphql-description-52.json`, the rich description, in GitLab's own shapes (design §1.1, copied from the
  measured snippets):
  - h1–h3; a paragraph with `em`, `strong`, `del`, `code`, a `br` and a `gl-emoji`;
  - a ruby code block (GitLab's `div`/`pre`/`span.line` shape) and one without a language;
  - a mermaid block; inline math;
  - `ul`; `ol start="3"`; a task list with done, open and inapplicable;
  - a table with left, centre and right columns;
  - a `blockquote`, an `hr`, a `details` with `summary`;
  - links:
    - `https://docs.example/x`;
    - `http://plain.example/`;
    - `#12` as GitLab's issue reference (`/taskboard/taskboard/-/issues/12`, its `data-*`);
    - `@anna` (`/anna`);
    - a commit (`/taskboard/taskboard/-/commit/<40 hex>`);
    - a label (span with `style`);
    - `#section` (a heading anchor written by the author);
    - `mailto:anna@example.com`, `file:///etc/passwd`, `javascript:alert(1)`;
  - images, each lazy as GitLab writes them (placeholder `src`, real `data-src`, inside
    `a.no-attachment-icon`):
    - `/-/project/7/uploads/<hex A>/shot.png`, served by REST;
    - `/-/project/7/uploads/<hex B>/old.png`, REST 404, served on the web path;
    - `/-/project/7/uploads/<hex C>/gone.png`, neither;
    - `https://images.example/cat.png`;
    - `https://evil.example/-/project/7/uploads/<hex D>/x.png`;
    - `http://plain.example/p.png`.
- `graphql-description-51.json`: `descriptionHtml: ""`.
- `graphql-description-50.json`, planted:
  - `<script>window.yamtPlanted=1</script>`;
  - `<img src="x" onerror="window.yamtPlanted=1">`;
  - `<iframe src="https://evil.example/">`;
  - `<style>body{display:none}</style>`;
  - `<link rel="stylesheet" href="https://evil.example/s.css">`;
  - `<base href="https://evil.example/">` and a relative link after it;
  - `<meta http-equiv="refresh" content="0;url=https://evil.example/">`;
  - `<form action="https://evil.example/"><input name="q"><button>Go</button></form>`;
  - `<p onclick="…" style="color:red" class="x" id="y">text</p>`;
  - `<svg onload="…">`, `<object data="…">`, `<video src="…">`, `<audio src="…">`;
  - 40 nested `<blockquote>`s.
- `graphql-description-49.err` "glab: a deadline line" with `.exit` 1.
- `graphql-description-48.json`: `mergeRequest: null`.
- `uploads/7/uploads/<hex A>/shot.png`: a small PNG.
- `pictures/-/project/7/uploads/<hex B>/old.png`: a small PNG.
- `tests/glab/README.md`: the two routes and the scenario paragraph.

## Change

1. **Measure first**, read-only, with the logged-in glab in `../glab-yamt-playground` (as `briefs/mr-people-rust.md`
   step 1). Paste each result. Write nothing to GitLab.
   - `glab --version`.
   - `time glab api graphql -f query='query MergeRequestDescription($fullPath: ID!, $iid: String!) { queryComplexity {
     score limit } project(fullPath: $fullPath) { mergeRequest(iid: $iid) { descriptionHtml } } }' -f
     fullPath=gitlab-org/gitlab -f iid=200000`. Record the logged-in score, the wall time, and that the HTML matches
     design §1.1.
   - The list query with `description` added on the playground's own project path: `queryComplexity` logged in.
   - `glab api projects/278964/uploads/4c42842bb87d2c84d498a2c3c6cf4adb/Screenshot_2025-08-01_at_4.25.21_pm.png | wc
     -c` and the same with `| head -c 8 | od -An -tx1`. Record the size, PNG or not, or glab's error line. The user is no
     member of gitlab-org/gitlab.
   - `glab api https://gitlab.com/-/project/278964/uploads/4c42842bb87d2c84d498a2c3c6cf4adb/Screenshot_2025-08-01_at_4.25.21_pm.png
     | wc -c`.
   - The sizes of !200000's other three uploads, to judge `MAX_UPLOAD_BYTES`.
   - If any playground merge request holds an upload: both routes for it, private project.
2. `description/address.rs` (`WebPage::linked`, `link_of`, `image_of`, `UploadKey`) and the upload side of
   `picture.rs`, with unit tests.
3. `description/html.rs` (`described`) and `description/tests.rs`, over inline snippets: the measured GitLab shapes
   from design §1.1 and the planted HTML.
4. `description.rs` (`read_description`, `fetch_description`), `query.rs`, `project.rs` (`From<NoProject>`), the list
   field (`query.rs`, `page.rs`, `row.rs`), `lib.rs` re-exports and docs.
5. Fake glab routes, the scenario, `tests/description.rs`, `tests/glab/README.md`, then the crate's `AGENTS.md`: the
   description, the walk, uploads.

## Acceptance

**Tests** (`cargo nextest run -p yamt-merge-requests` with the hermetic prefix as `just test`), each named for the bug
it catches, at least:

- **Walk** (`description/tests.rs`):
  - `every_element_of_rule_3_becomes_its_block_or_inline`
  - `gitlabs_code_block_keeps_its_language_and_text_without_the_colour_spans` (the measured !267727 shape)
  - `a_lazy_image_is_read_from_data_src_and_its_link_is_dropped` (the measured !200000 shape)
  - `a_heading_anchor_link_leaves_nothing`
  - `task_boxes_are_done_open_inapplicable_or_none` (the measured !50000 shape and `data-inapplicable`)
  - `table_cells_keep_gitlabs_alignment_and_header`
  - `details_keep_their_summary_and_open_state`
  - `an_ordered_list_keeps_its_start`
  - `inline_runs_beside_blocks_become_paragraphs_and_white_space_between_blocks_vanishes`
  - `an_empty_or_comment_only_description_has_no_blocks`
  - `planted_script_style_frame_object_media_and_form_leave_nothing` (RK66, rule 6): no text of theirs anywhere in the
    tree.
  - `no_key_but_the_contracts_crosses` (RK66): the serialised planted tree's JSON keys are a subset of the Contract's
    field names, and no string holds `onerror`, `onclick` or `display:none`.
  - `a_base_or_meta_element_changes_no_address` (RK66): the link after `<base>` resolves on gitlab.example.
  - `nesting_past_32_levels_is_left_out` (RK66)
- **Addresses** (`description/tests.rs` or `address.rs`):
  - `an_https_or_http_link_is_a_page` (rule 4)
  - `a_relative_link_resolves_on_the_merge_requests_gitlab_page`: `/x`, `x`, `#frag`, and a sub-path install (RK41).
  - `mailto_file_javascript_data_and_unreadable_links_are_refused_with_their_address` (rule 4, RK41)
  - `a_described_page_has_no_space_quote_or_control_character` (RK41): hrefs holding ` `, `"`, `<`, a tab and `\u{7}`.
  - `without_an_https_origin_a_relative_link_is_refused`
  - `an_upload_on_the_projects_origin_is_uploaded_in_both_path_forms` (rule 5, RK53)
  - `an_upload_path_on_another_host_is_another_sites_image` (rule 6, RK53)
  - `http_data_and_file_images_are_refused`
  - `an_upload_key_is_never_a_username` (RK53)
  - `pages_and_uploads_are_collected_once_each_in_order`
- **Pictures** (`picture/tests.rs`):
  - `an_upload_is_asked_through_the_uploads_api_route` (argv for both forms)
  - `an_upload_up_to_10_mib_is_taken_and_larger_is_refused` (RK53)
  - `an_avatar_still_stops_at_1_mib`
- **Queries** (`query/tests.rs`):
  - `the_description_query_is_one_line_and_asks_only_description_html`
  - `the_list_query_asks_the_description_and_stays_one_line`
- **List** (`page/tests.rs`): `a_description_of_white_space_or_none_is_no_description`
- **Integration** (`tests/description.rs`, scenario `mr-description`):
  - `a_description_comes_back_with_its_pages_and_uploads` (!52)
  - `an_upload_is_fetched_with_the_login_through_the_uploads_api` (rule 5): the log has `argv: api
    projects/7/uploads/<hex A>/shot.png`, no `-X`, no `--input`.
  - `an_upload_the_api_does_not_know_is_fetched_on_its_web_path` (hex B: REST 404, then `argv: api
    https://gitlab.example/-/project/7/uploads/<hex B>/old.png`)
  - `an_upload_missing_on_both_routes_is_an_error`
  - `another_sites_image_never_reaches_glab` (rule 6): after reading !52 and fetching every offered upload, no `argv:`
    line names `images.example`, `evil.example` or `plain.example`.
  - `an_empty_description_has_no_blocks` (!51)
  - `the_planted_description_keeps_only_text_and_safe_pieces` (!50)
  - `a_failed_read_keeps_glabs_words` (!49)
  - `a_missing_merge_request_fails` (!48)
  - `glab_missing_or_logged_out_answers_before_any_query` (scenario `logged-out`)
  - `the_list_says_which_rows_have_a_description` (!52 true, !47 and !46 false)
  - `reading_a_description_writes_nothing`: no `stdin:` line; every argv is `api graphql -f …` or a GET of an upload.

**Commands:**

- `cargo clippy --workspace --all-targets -- -D warnings`, `cargo fmt --all --check` and `just arch-check`: their
  summary lines.
- `sh -n scripts/fake-glab/glab`: no output.
- Step 1 pasted.
- `cargo run -p yamt-app --features bindings --bin export-bindings -- target/bindings-description.ts`, then `diff -u
  frontend/src/ipc/bindings.ts target/bindings-description.ts`: only `hasDescription` and the `WebPage` doc. The
  description types reach the bindings with the app slice's command.
- `just mutants HEAD` in your workspace (SP11).

## Skills

`skill://rust-conventions`, `skill://ipc-contract`, `skill://risk-register` (RK41, RK53; proposed RK66),
`skill://verification`.
