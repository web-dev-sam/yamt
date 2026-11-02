# Merge-request row details — design

Request: `docs/slices/request-mr-row-details.md` (rules 1–11, rules 2 and 3 as amended by #2104 and #2105; this design
refines only the details it names). Facts: `.omp/run/notes/PlanScoutMrRowFacts.md` (used as given). Decision record:
plan §2 #128–#150 bind. Owner answers in force:

1. (#2100, corrected by #2104) **"Re-request review", GitLab's own control**: Lucide `rotate-ccw` left of a reviewer's
   state icon, only for reviewers already on the merge request whose review is done (reviewed, approved, changes
   requested); no button for assignees; nothing adds a reviewer.
2. (#2101) The custom tooltip: **the merge-request page only** (`ui/MergeRequest*`, `ui/mergeRequest*`, `ui/CiStatus*`
   and any shared component they render); other windows keep `title`; no slice migrates other windows.
3. (#2102) Order: **merge requests with a due date first, soonest (overdue first) on top, equal dates newest first; the
   rest newest first**; no sort choice.
4. (#2105) **Also load Gravatar** for people with no uploaded picture; GitLab's login never goes to Gravatar; no other
   host.

The local conflict check (plan §2 #149–#150) is still landing in `crates/merge-requests/src/{check,open,readiness}.rs`,
`ui/mergeRequests.ts`, `mergeRequests/internal/readiness.ts` and `ipc/*MergeRequest*`: implementation starts after it
closes, and every citation in those files names a symbol, not a line.

## 1. The request's "to be measured", closed

### 1.1 The list query: fields, first GitLab version, complexity

Today's query is `query.rs:21-43`; its comment records **130 of the 250 allowed, measured on gitlab.com on 2026-10-31
before `targetBranch diffHeadSha`** (`query.rs:15-20`). The limit is 250 logged in, 200 anonymous, and "each field adds
1 … higher or lower for particular fields" (GitLab docs `api/graphql/` "Maximum query complexity", lines 357, 383-385).

| added to each node                                                  | fields | type and source                                                                                              | in the docs at tag                                      |
| ------------------------------------------------------------------- | -----: | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------- |
| `author { username name avatarUrl }`                                |      4 | `MergeRequest.author: MergeRequestAuthor`, nullable                                                          | v15.2.0-ee `doc/api/graphql/reference/index.md:13220`   |
| `avatarUrl` on `assignees`, `reviewers` and `approvedBy` nodes      |      3 | `UserCore.avatarUrl: String` (nullable) and the `User` interface                                             | v15.2.0-ee `:17654`                                     |
| `name` on `approvedBy` nodes (today `username` only, `query.rs:34`) |      1 | `approvedBy: UserCoreConnection`                                                                             | v15.2.0-ee `:13218`                                     |
| `mergeRequestInteraction { approved reviewState }` on `reviewers`   |      3 | `MergeRequestReviewer.mergeRequestInteraction`, `approved: Boolean!`, `reviewState: MergeRequestReviewState` | v15.2.0-ee `:14119`, `:17887`, `:17890`                 |
| `userPermissions { updateMergeRequest }`                            |      2 | `MergeRequest.userPermissions: MergeRequestPermissions!`, `updateMergeRequest: Boolean!`                     | v15.2.0-ee `:13298`, `:14100`                           |
| `color textColor` on `labels` nodes                                 |      2 | `Label.color: String!`, `Label.textColor: String!` (current docs `objects/` `Label`)                         | v15.2.0-ee `:13149`                                     |
| `diffRefs { baseSha }` (rule 10, §1.4)                              |      2 | `MergeRequest.diffRefs: DiffRefs`, `null: true` (`app/graphql/types/merge_request_type.rb:37`)               | in 15.2 (used by today's details query, `query.rs:5-7`) |

- **No new version floor.** Every added field is in the v15.2.0 reference; the list already asks `detailedMergeStatus`,
  which is absent from v15.2.0 and present at v15.6.0 (`index.md:14678` of v15.6.0-ee). The GitLab that runs today's
  query runs the new one.
- **`reviewState`'s values grew over time:** v15.11.0 lists only `REVIEWED`, `UNREVIEWED` (`index.md:24152-24160` of
  v15.11.0-ee); v16.6.0 adds `REQUESTED_CHANGES`; v16.11.0 adds `APPROVED`, `UNAPPROVED`; today's docs add
  `REVIEW_STARTED` (`enums/` `MergeRequestReviewState`). GitLab's own reviewer list decides "approved" by the
  interaction's `approved` flag first, then `reviewState` (`app/assets/javascripts/sidebar/components/reviewers/
  uncollapsed_reviewer_list.vue` `reviewStateIcon`, l. 189-199), which also serves a GitLab older than 16.11. Rust
  does the same, reading the state as a string and folding it (§2.1), as `ci_status` folds the pipeline status
  (`page.rs:291-314`).
- **Score:** 17 more fields by the 1-per-field rule → about **149 of 250** (130 + `targetBranch diffHeadSha` + 17)
  `[INFERENCE: GitLab's rule; a connection's children count once at first: 100, `.omp/run/notes/MrOverviewDesign.md:46-49`]`.
  The query asks `queryComplexity { score limit }` already (`query.rs:24`) and the crate logs it; the Rust slice pastes
  the real score from the owner's playground. The query text stays far below the 10,000-character limit (docs l. 358).

### 1.2 The re-request write

- **GitLab's own control** (`uncollapsed_reviewer_list.vue`): per reviewer, a "Re-request review" button (`redo` icon,
  `__('Re-request review')`, l. 53, 280-295) left of the state icon (l. 296-311), shown when the sidebar may re-request
  (`canRerequest`, passed down by `reviewers.vue:23-26,84`) and the reviewer approved or their `reviewState` is not
  `UNREVIEWED` (`showRequestReviewButton`, l. 214-227). The state icons (l. 22-48): `APPROVED` `check-circle` success;
  `REQUESTED_CHANGES` `error` danger; `REVIEWED` `comment-lines` info; `UNREVIEWED` `dash-circle` default;
  `REVIEW_STARTED` `comment-dots` default. The click sends `request-review` with the reviewer's `userId` (l. 148).
- **The mutation:** `mergeRequestReviewerRereview(input: { projectPath: ID!, iid: String!, userId: UserID! })` →
  `errors: [String!]!`, `mergeRequest` (current docs `mutations/` l. 9552-9571; in v15.2.0-ee, `index.md:3653`). It
  takes the reviewer's **global id** (`gid://gitlab/User/<n>`). Nothing else is written: no `mergeRequestSetReviewers`,
  no REST (owner #2104: nothing adds a reviewer).
- **yamt's button** (rule 3): beside reviewers whose state is reviewed, approved or changes requested, when the list
  says you may update the merge request (`userPermissions.updateMergeRequest`, the same permission GitLab's sidebar
  edits with `[INFERENCE: `canRerequest` is the sidebar's edit permission]`). GitLab also offers it for
  `REVIEW_STARTED`, which yamt folds into "Review requested" (rule 3's four words), so yamt does not; recorded in #157.
- **Asked afresh on each click** (as `BRANCHES_QUERY`, `query.rs:9-13`): `mergeRequest(iid) { state reviewers { nodes {
  id username name avatarUrl mergeRequestInteraction { approved reviewState } } } }`. Not open → `NotOpen`; the person
  no longer a reviewer → `NotReviewer` (no write; owner #2100, #2104, enforced in Rust); already "Review requested"
  afresh → no write, the fresh reviewers back (no second notification); else the mutation by that reviewer's `id`, its
  answer asking the reviewers back with the same fields. The list carries no global ids.
- **Through glab:** GraphQL answers HTTP 200 with its errors in the body; `glab api graphql` copies the body to stdout
  and, when the body's top-level `errors` is set, prints `glab: <message>` on stderr and exits 1
  (`gitlab-org/cli` `internal/commands/api/api.go` `processResponse`, l. 560-601). So the write needs no `--include`:
  `review`'s `posted` (`crates/review/src/glab_answer.rs:25-51`) classifies **REST statuses** (2xx draft, 401/403/429
  stop, other 4xx refusal), which a GraphQL write never sends, and it lives in `yamt-review`, which
  `yamt-merge-requests` may not depend on (PM1). The write goes through `Glab::run` with the JSON body on stdin
  (`gitio/src/glab.rs:70-99`; glab sends an `--input` body as is: `internal/commands/api/http.go` `httpRequest`, the
  `io.Reader` case), and reads its answer as the list does (`page.rs:163-170` `graphql_data`): exit 1 → glab's last
  stderr line (`glab.rs:108-110`) is the sentence; exit 0 with the payload's `errors` → GitLab's first error is the
  sentence. The global id travels as a JSON variable, never spliced into the query text.
- **Fake glab route:** today `POST graphql` always answers a list page or `graphql-merge-request-<iid>`
  (`scripts/fake-glab/glab:126-138,176`) and `POST */draft_notes` counts posts in the state file (`:115-122,175`). The
  write is the only `glab api graphql --input -`; the fake answers it as the n-th post (`post-<n>.json`, status line in
  `post-<n>.status`, default `201 Created` → the scenario sets `200 OK`), logging the body (`stdin:`, `:164-170`). The
  fresh read is `graphql-merge-request-<iid>.json` of the new scenario.

### 1.3 Profile pictures

- **What `avatarUrl` is:** an uploaded picture is a **path** on the GitLab host, `[relative_url_root]/uploads/…`
  (`app/models/concerns/avatarable.rb:34-38,72-97`: `only_path` defaults to true); without an upload it falls back to
  `User#avatar_url` = `GravatarService#execute` (`app/models/user.rb:2091-2093`), which answers `nil` when the instance
  turned Gravatar off, else `sprintf(gravatar_url, hash: SHA-256 of the e-mail (or username), size:, …)`
  (`app/services/gravatar_service.rb`), `gravatar_url` being `ssl_url` on an `https` GitLab and `plain_url` otherwise.
  The defaults: `ssl_url` `https://secure.gravatar.com/avatar/%{hash}?s=%{size}&d=identicon`, `plain_url`
  `https://www.gravatar.com/avatar/%{hash}?s=%{size}&d=identicon` (`config/initializers/1_settings.rb:523-526`); both
  are configurable, so a self-hosted GitLab may name another host (a Libravatar mirror, say). Which form gitlab.com
  answers is measured by the Rust slice's real run `[INFERENCE: gitlab.com runs the https default, secure.gravatar.com]`.
- **Login:** `UploadsController#authorized?` for a `User`: "user avatars are readable by anyone", except that with no
  logged-in user and the instance's public visibility restricted it refuses (`app/controllers/uploads_controller.rb:57-64`).
  So gitlab.com serves them without login; a private GitLab with restricted public visibility does not `[INFERENCE: a
  personal access token, which glab sends, does not log in a web controller; the owner check measures]`.
- **Reaching the window, uploaded pictures:** `img-src 'self' data:` (`src-tauri/tauri.conf.json:14-15`) blocks remote
  images; a GitLab's host is unknown at build. Rust has no HTTP client (crate list, `docs/architecture.md:1670-1674`,
  closed, DR3), but `glab api` takes a full address: "`strings.Contains(p, "://")` → the address as is" (`http.go`
  `httpRequest`) and copies a non-JSON body raw to stdout (`api.go` `processResponse`, the `default` case). Tauri serves a
  custom scheme to the page; its own docs show the CSP shape `img-src 'self' asset: http://asset.localhost` and
  `convertFileSrc(path, protocol)` builds the address per platform (`frontend/node_modules/@tauri-apps/api/core.js:347,
  374-376`). The fake's `answer` prints bodies with `printf '%s'` (`scripts/fake-glab/glab:68-85`), which drops NUL
  bytes: pictures need their own `cat` route.
- **Reaching the window, Gravatar:** Gravatar's two hosts are fixed and known at build, so the boring route works: CSP
  `img-src` gains exactly `https://secure.gravatar.com https://www.gravatar.com`, and the window loads an address Rust
  accepted (`GravatarAddress`: one of those two hosts, the path `/avatar/<32 or 64 hex digits>`, an optional query of
  `[A-Za-z0-9=&%._-]`) directly, with `referrerpolicy="no-referrer"`. glab never sees it, so GitLab's token never goes
  there; no dependency. A redirect elsewhere is blocked by the CSP and shows initials `[INFERENCE: with
  `d=identicon` Gravatar answers the image itself]`. A custom Gravatar host, `http`, or Gravatar turned off →
  initials.
- **Cost at 500 rows:** one glab call per **distinct person** with an uploaded picture, not per row; at most 4 at once;
  cached for the run (failures too); Gravatar pictures load in the webview with its own cache. `[INFERENCE: a few dozen
  people for 500 merge requests; a glab call is a fraction of a second; pictures fill in over a few seconds while
  initials show]`. Memory: at most 1 MiB each (refused above).
- **Initials fallback:** always drawn; the picture covers it once loaded and is never shown when it fails (no broken
  image). The colour derived from the username cannot be a literal (palette fence: a hex, `rgb(`, `oklch(` in a `.ts` or
  `.vue` file is refused, `frontend/scripts/palette.test.ts:24-38,53-71`): the circle is `bg-primary text-on-primary`
  (the primary-button pair, `ChoiceButtons.vue:13`) turned by `filter: hue-rotate(<hue>deg)`, the hue a pure function of
  the username (§2.2).

### 1.4 "+0 −0" and the status icon that disappears

- **The size:** `page.rs:204` sends `diffStats` (null or `[]` alike) to `change_size`, which answers `None` for no
  entries (`page.rs:245-249`). GitLab's `MergeRequest#diff_stats` returns `nil` unless `diff_refs`
  (`app/models/merge_request.rb:1236-1241`), and the GraphQL resolver turns that into `[]` (`Array.wrap(...)`,
  `app/graphql/types/merge_request_type.rb:414-415`). `diff_refs` is `nil` until the diff has a start or base commit
  (`app/models/merge_request_diff.rb:546-553`). So **`diffStats: []` is both "empty diff" and "not computed"**, and
  **`diffRefs` tells them apart**: `diffRefs` non-null and no entries → `ChangeSize { 0, 0, 0 }` ("+0 −0 · 0 files",
  `mergeRequests/internal/size.ts:17-23`); `diffRefs` null and no entries → no size, as today; any entries → their sums
  whatever `diffRefs` says (entries imply `diff_refs`), so every recorded scenario keeps its sizes. `[INFERENCE:
  `diffRefs`in a list does not disturb`detailedMergeStatus`as`diffStatsSummary`does,`briefs/mr-diff-stats.md:7-12`;
  it is a plain read of the diff row, no batch loader; the Rust slice's real run compares the statuses]`.
- **The icon:** no condition in `MergeRequestRow.vue` ties an icon to the size (scout §2; `MergeRequestRow.vue:138-150`:
  only the CI box has a `v-if`, on `row.pipeline`). The likely cause is the build the owner ran: while the local check
  was landing, Rust could send `Readiness::MergesCleanly` (plan §2 #149) before `MergeRequestReadiness.vue`'s `LOOKS`
  had a look for it (scout §2 "Hazard": `LOOKS[undefined].tone` throws while rendering) — and an empty merge request is
  exactly one whose head merges clean into its target. `[INFERENCE: Vue 3 renders a component whose render throws as a
  comment node, so that one icon vanishes]`. The tree now has the look (`MergeRequestReadiness.vue:23`,
  `mergeRequests/internal/readiness.ts` `ICONS.mergesCleanly`), so the cause is gone with that feature; this design adds
  the proof (fixture !635: zero size, `mergesCleanly`, a pipeline; both icons asserted) and the Rust slice reads an
  empty merge request's real answer (`detailedMergeStatus`, `headPipeline`, `diffRefs`, `diffStats`) on the playground.
  A second cause stays by design: no pipeline → no CI icon (request-merge-requests rule 4, `:59-60`).

### 1.5 One tooltip

- Today: one custom tooltip, `OperationLabel.vue:52-74` (`@mouseenter`/`@mouseleave`, a `fixed` `hover-tooltip
  tooltip-text` box placed by `tooltipBox`, `operationTooltip.ts:15-23`: above the anchor, left at the text's left, at
  most 480 px wide, as high as the room above). The CI box is a box the pointer enters (`CiStatusBox.vue:40-117`:
  pointer and focus inside, Escape, closes on a list scroll; placed by `useMenuPlacement`).
- In scope (owner answer 2): 12 `title`s — `MergeRequestRow.vue` 8 (`:100,106,109,112,123,132,156,179`),
  `MergeRequestReadiness.vue:31`, `MergeRequestFilter.vue:93`, `MergeRequestsButton.vue:14`, `CiStatusBox.vue:154`;
  `ChoiceButtons.vue` (rendered by the page) has none. Plus every new hover text (the reviewers' state icons, the
  re-request button).
- `tooltipBox` alone cannot serve the page: the header button and the filter bar sit at the window's top, where the
  room above is a few pixels. A placement that flips below when the tip does not fit above is needed.
- **Directive, not component.** A `v-tooltip="text"` sits on the element that had `:title` — one attribute for one
  attribute, no wrapper in the row's flex layout (`MergeRequestRow.vue:94-189`: fixed-width columns, a `truncate`
  button that must stay a flex child). One tip element for the window, created by the directive's module (a singleton
  like the store, VU9), so "at once when moving to the next" is one piece of state. `aria-label`s stay as they are; the
  directive mirrors its text into `aria-description` unless it equals the element's `aria-label` (so the exact date or
  the approvers' names stay reachable) `[INFERENCE: WebKit exposes aria-description]`.
- Rich hover content (the people box, the "+N" labels) is not a tooltip but a hover box: the CI box's logic, extracted
  into `useHoverBox` (three users: CI box, people box, labels box).

### 1.6 Hover-open checklists and three-state values

- `useDropdownMenu.toggle` opens and moves focus to the first item (`useDropdownMenu.ts:59-74`); `close` returns focus
  to the opener (`:33-40`); `closeAfterClick` returns it only when focus was in the menu (`:42-49`). Each
  `MergeRequestFilter` has its own instance (`MergeRequestFilter.vue:41-44`), so "one open at a time" today rests on
  `onClickOutside` (`:102-114`), which a pointer never triggers.
- The checklist is `absolute top-full`/`bottom-full` inside the filter's `relative` wrapper (`MergeRequestFilter.vue:76,
  100-105`): no gap between button and list; the 300 ms grace covers any.
- Design: **one** hover menu for the bar (`useHoverMenu<ListFilter>` over one `useDropdownMenu<ListFilter>`, the
  `KeymapList.vue:33-36` pattern of one dropdown for many openers): one `openFor` makes "one at a time" true by
  construction. Hover opens without moving focus; leaving opener and list for 300 ms dismisses (focus back to the opener
  only if it was inside); a click on the opener of a hover-opened checklist keeps it open and moves focus in (it would
  otherwise close on every click, since the pointer opened it first); a second click closes. Escape and a click outside
  as today. Shift: `useKeyModifier("Shift")` (vueuse, VU12).
- Values: `filters.ts:9-14` holds `readonly PersonValue[]` per filter; `passes` is "any held matches" (`:66-79`);
  `toggled` adds or removes (`:89-111`); `filterLabel` joins words (`:151-155`). Choices carry `checked: boolean`
  (`choices.ts:3-8`) and sort "Me", "None", then by label (`:16-18,90,117`). Stored words are `"me"|"none"|"user:<u>"`
  and `"none"|"label:<t>"` (`stored.ts:16-41`); an unknown word is dropped (`personFrom`/`labelFrom` return `[]`).
- Three states as one held list of `{ value, mode }` (a value at most once, by `clicked`, as today's `toggledIn`), and
  the stored excluded form as the prefix `not:` on today's word (`"not:me"`, `"not:user:anna"`, `"not:label:bug"`): an
  older yamt drops those words as unknown and keeps reading the rest; this yamt reads every old word as "included".

### 1.7 Due dates

- Storage: `storedRecord(key, warnEvent, storage?)` gives `entryAt`/`set`/`remove` over one JSON map
  (`ui/windowStorage.ts:51-67`); `createRememberedFilters` keys it by repository and removes empty entries
  (`ui/mergeRequestFilters.ts:9-31`); the repository is `GitLabProject::Found { repository }` (plan §2 #130). Due dates
  follow it: `yamt.mergeRequests.dueDates` = `{ [repository]: { [iid]: "YYYY-MM-DD" } }`.
- Days left: whole days between the local calendar day of now and the due day, computed on calendar days
  (`Date.UTC(y, m - 1, d)` differences), never on milliseconds, so daylight-saving days and month ends count one day
  each. Words in the framework-free core, as `createdAgo` (`mergeRequests/internal/relativeTime.ts`).
- The picker: native `<input type="date">` (value `YYYY-MM-DD`). WebKitGTK has editable date fields since r276448
  (`[GTK] Turn on editable <input type=date>`) and a GTK picker since bug 224924 (both fixed 2021); yamt runs on
  WebKitGTK 2.54 (plan §2 #99). No dependency. The picker is GTK's own popover, drawn outside the page `[INFERENCE: it
  follows the GTK theme, not yamt's]`; WebDriver sets the field by typing.

## 2. What every option shares

### 2.1 Data structures — Rust (`yamt-merge-requests`, IPC)

```rust
/// A GitLab user and the picture the window may show for them.
pub struct Person { pub username: String, pub name: String, pub picture: PersonPicture }

/// Which picture the window shows for a person.
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum PersonPicture {
    Uploaded,                              // on the project's GitLab: `yamt-picture://localhost/<username>`
    Gravatar { address: GravatarAddress }, // the window loads this address itself (CSP: Gravatar's two hosts)
    None,                                  // initials only
}

/// How far a reviewer's review is: GitLab's state in the four the window names.
#[serde(rename_all = "camelCase")]
pub enum ReviewState { Requested, Reviewed, Approved, ChangesRequested }
// `approved: true` → Approved; else UNREVIEWED, REVIEW_STARTED, missing or null → Requested; REVIEWED, UNAPPROVED →
// Reviewed; APPROVED → Approved; REQUESTED_CHANGES → ChangesRequested; any other → Requested, one warning per load.

pub struct Reviewer { pub person: Person, pub state: ReviewState }

/// A label's colours as GitLab sends them, each `#rgb` or `#rrggbb`.
pub struct LabelColors { pub background: String, pub text: String }
pub struct Label { pub title: String, pub colors: Option<LabelColors> } // None: no colour, or not #rgb/#rrggbb

pub struct MergeRequestRow {
    // …today's fields, with:
    pub author: Option<Person>,      // new; None when GitLab names none
    pub reviewers: Vec<Reviewer>,    // was Vec<Person>
    pub labels: Vec<Label>,          // was Vec<String>
    pub approved_by: Vec<Person>,    // replaces `approvals: u32`: the count is its length (vision 2)
    pub may_rerequest: bool,         // new: `userPermissions.updateMergeRequest`
    pub size: Option<ChangeSize>,    // Some(0, 0, 0) for a known empty diff (§1.4)
}

#[serde(tag = "kind", rename_all = "camelCase")]
pub enum RerequestReply {
    Requested { reviewers: Vec<Reviewer> }, // the merge request's reviewers as GitLab answered
    NotReviewer,                            // no longer a reviewer of the merge request (owner #2100, #2104)
    NotOpen,
    GlabMissing,
    NotLoggedIn { detail: String },
    Refused { message: String },            // the mutation's first `errors` entry
    Failed { message: String },             // glab failed, timed out, or GitLab's top-level error, in its words
}
```

### 2.2 Data structures — the window's core (`frontend/src/mergeRequests/`)

```ts
type Mode = "included" | "excluded";
type Held<V> = { readonly value: V; readonly mode: Mode };      // a value at most once per filter
type ChoiceState = "off" | Mode;
type Filters = { assignee: readonly Held<PersonValue>[]; reviewer: …; label: readonly Held<LabelValue>[]; draft };
type Choice<V> = { value: V; label: string; count: number; state: ChoiceState };   // `checked` goes
type ReviewState = "requested" | "reviewed" | "approved" | "changesRequested";
type Reviewer = { person: Person; state: ReviewState };
type ListedRequest = { iid; createdAt; draft; assignees: Person[]; reviewers: Reviewer[]; labels: { title }[] };
type CalendarDay = { year: number; month: number; day: number };   // month 1–12; built only by calendarDayFrom
```

`clicked(filters, filter, value, shift)` is rule 7's table: off → included (click) or excluded (Shift); included → off
(click) or excluded (Shift); excluded → off (either). `passes`: inside a filter, (no included value, or any included
matches) and no excluded matches; across filters every one. Choices: "Me", "None" first; the rest by count, highest
first, equal counts by label (`localeCompare(…, "en")`); held values no longer listed (count 0) last. `byDueDate`: rows
with a due day first, earliest day first (overdue first), equal days newest first; then the rest in their order.
`reviewDone(state)`: reviewed, approved or changes requested. The window's picture address: `Uploaded` →
`convertFileSrc(username, "yamt-picture")`, `Gravatar` → its address, `None` → no image.

### 2.3 Details decided here (orchestrator level, proposed row #157; the owner may veto)

- Row layout, left to right: author picture (24 px); the text column (line 1 the title alone; line 2 the meta text,
  then the first label chip and "+N" at its end — the title keeps line 1); the people stack (`w-16`); the due-date
  column (`w-24`: date over days left, or a muted calendar button); discussions; approvals; CI; readiness; action;
  Show Diff. The fixed icon columns keep their widths (`briefs/mr-row-two-lines.md`).
- Author null → a dimmed person icon, "Author: unknown". A blank `name` reads as the username everywhere.
- The people box and the labels box open at once on hover or focus, as the CI box (#128).
- A reviewer's state icon, the Lucide nearest GitLab's (§1.2): requested `circle-minus` muted (GitLab `dash-circle`);
  reviewed `message-square-text` primary (`comment-lines`, info); approved `circle-check` success (`check-circle`);
  changes requested `circle-alert` error (`error`, danger); the words on hover. The re-request button `rotate-ccw`,
  left of it, tooltip "Re-request review" (GitLab's words), accessible name "Re-request review from <name>".
- A re-request's refusal sentence stays in the box until the box closes; a success replaces the row's reviewers by
  GitLab's answer (one writer: the state slice), so the state reads GitLab's word and the button goes.
- A due date's picker is a small box under the calendar button: the date field (focused) and "Clear" when set; a picked
  date saves at once and closes it; Escape or a click outside closes it.
- A click on the opener of a hover-opened checklist keeps it open (§1.6).
- Tooltip warm window: a tip shown within 300 ms of the last one closing shows at once (`TOOLTIP_WARM_MS`); the first
  after 400 ms (`TOOLTIP_DELAY_MS`); placed above the element at its left edge, below when it does not fit above, at most
  480 px wide; gone on leave, scroll, Escape, a press, or the element leaving the page.
- Excluded values in a checklist: the leading slot holds `circle-minus` in the error colour and the label is struck in
  it; their accessible name reads "not <label>", `aria-checked` true.

## 3. Options

### Option A — the list carries every field; uploaded pictures through a yamt scheme, Gravatar by CSP; one tooltip directive (recommended)

- **Structures.** §2.1–2.2, plus Rust `PictureAddress(String)` and `GravatarAddress(String)`, both made only by
  `avatar_source(origin, avatar_url) -> AvatarSource { Uploaded(PictureAddress) | Gravatar(GravatarAddress) | None }`
  (uploaded: a path or a same-origin `https` address under `…/uploads/-/system/user/avatar/<n>/<file>`, no `..`;
  Gravatar: §1.3; anything else → none); `ListedPage { page, pictures: Vec<OfferedPicture { username, address }> }`
  handed to `on_page` (the window never sees an uploaded address); `Picture { kind: ImageKind, bytes }` (PNG, JPEG, GIF,
  WebP by their first bytes; ≤ 1 MiB), `fetch_picture(glab, root, &address)`; src-tauri `MergeRequestState.pictures:
  Mutex<PictureShelf { offered: username → address, fetched: address → Option<Picture> }>` and a gate of 4 fetches;
  the `yamt-picture` scheme registered in `commands.rs` `with_commands` (compare and range windows), answering
  `yamt-picture://localhost/<username>` with the image or 404; CSP `img-src 'self' data: yamt-picture:
  http://yamt-picture.localhost https://secure.gravatar.com https://www.gravatar.com`. The write `rerequest_review(iid,
  username) -> RerequestReply` (§1.2). Window: domain `Person.picture: string | null`;
  `MergeRequestSource.rerequestReview`; `vTooltip`, `useHoverBox`, `useHoverMenu`.
- **Files.** Rust: `crates/merge-requests/src/{lib,query,page,list,project}.rs` + new `rerequest.rs`, `picture.rs`,
  tests; `src-tauri/src/merge_requests.rs`, new `src-tauri/src/merge_requests/pictures.rs`, `commands.rs`,
  `tauri.conf.json`; `scripts/fake-glab/glab`, `tests/glab/mr-row-details/`, `tests/glab/README.md`,
  `scripts/gitlab-playground.sh`. Core: `mergeRequests/internal/{filters,choices,stored,order}.ts` + new `dueDate.ts`,
  `people.ts`, `labels.ts`. State and ipc: `ui/mergeRequests.ts`, new `ui/mergeRequestDueDates.ts`,
  `ui/mergeRequestRerequests.ts`, `ui/problem.ts` (one step), `ipc/*MergeRequest*`. Hover: new `ui/tooltip.ts`,
  `ui/useHoverBox.ts`, `ui/useHoverMenu.ts`, `ui/useDropdownMenu.ts` (added `open`, `dismiss`), `ui/operationTooltip.ts`
  (added `tooltipPlacement`). Page: `ui/MergeRequestRow.vue`, `MergeRequestFilter.vue`, `MergeRequestsView.vue`,
  `CiStatusBox.vue`, `MergeRequestReadiness.vue`, `MergeRequestsButton.vue`, new `MergeRequestPicture.vue`,
  `MergeRequestPeople.vue`, `MergeRequestLabels.vue`, `MergeRequestDueDate.vue`, `ui/mergeRequestsText.ts`.
- **Risks.** A list field disturbing GitLab's merge status (as `diffStatsSummary` did): the real run compares. The
  scheme's platform form (Windows `http://yamt-picture.localhost`): CSP lists both, `convertFileSrc` builds it.
  glab's placeholder filling on an address with a port (`:8443`) `[INFERENCE]`: such a GitLab may show initials.
  Pictures on a private GitLab with restricted public visibility: initials (owner check). Gravatar sees the person's
  hashed e-mail and your address (owner #2105 accepts it). The frontend typecheck is red from `just bindings` (after the
  Rust slice) until the page slice lands (§5).
- **Tests.** Rust: folds (with `approved` first), sizes, label colours, both address kinds, sniffing, the re-request
  flows and exact body through the fake, the scheme's allowlist, one fetch per run, at most 4 at once, Gravatar never
  through glab. Core: rule 7's table, `passes` with excluded values, old and new stored words, count order, days left
  around midnight, month ends and daylight saving, `byDueDate`, stack and "+N", `reviewDone`. Hover: placement, tooltip
  timing, hover-menu timing. Page: WebKit fixture and real app (§5 briefs).
- **Visions.** 2 (the count is the list's length; one tip state; one open checklist; the scheme serves only what a list
  offered), 3 (Rust refuses non-reviewers and other hosts; the CSP names exactly the hosts; a test bans `title` in
  scope), 4 (sum types for pictures, states and replies; `CalendarDay` built by its parser), 5 (no dependency: glab,
  Tauri and the webview carry the bytes; the directive is one attribute).

### Option B — pictures as `data:` addresses on the list channel; a tooltip component

- **Structures.** As A without the scheme: after `End` (and after the local check, on the same worker), Rust fetches
  each offered uploaded picture and sends `ListMessage::Picture { username, data }` (`data:image/png;base64,…`); a
  hand-written base64 encoder in the crate, or the `base64` crate (a DR3 row); Gravatar as A. The window keeps
  `pictures: Map<username, string>` in `ui/mergeRequests.ts`. Tooltips as `<HoverTip :text>` wrapping each element.
- **Files.** As A, minus the scheme; plus a base64 module and a third `ListMessage` kind; every tooltip site gains a
  wrapper element.
- **Risks.** Uploaded pictures wait for the whole list and the local check (up to 60 s, #149) before the first arrives;
  each crosses the IPC as JSON text, a third larger; a second state for pictures in the window; wrappers change the
  row's flex layout (the title button's `truncate`, the fixed columns) and the CI box's hover area.
- **Tests.** As A, plus the encoder; tooltip wrapper placement.
- **Visions.** 5 (no scheme) against 1 and 2 (a hand-written encoder; a second picture store; 15 wrappers).

### Option C — a lean list, people asked on hover

- **Structures.** The list adds only `author`, label colours and `diffRefs`; hovering the stack or the approvals runs
  `merge_request_people(iid)` (assignees, reviewers with states, approvers with names, pictures, the permission) and the
  box shows "Loading…" first. Pictures and tooltip as A.
- **Files.** As A, plus a command, a per-row loading state, a box state machine.
- **Risks.** Plan §2 #131 rejected "failed jobs on hover (an extra call per hover; the score fits)": the score fits here
  too (~149 of 250), so C contradicts a row without new information (DR1). A hover waits 1–2 s on glab; filter counts
  would still need the list's people.
- **Tests.** As A, plus hover loading and failure.
- **Visions.** Fresher review states (none ranked) against 1, 2 and 5.

## 4. Recommendation

**Option A.** Every field fits the list query (about 149 of 250, no new version floor), so the record's own reasoning
(#131) applies. Uploaded pictures load per element as the browser asks, from a cache that only a list's GitLab answer
can fill; Gravatar pictures load from Gravatar's two named hosts, which the CSP names exactly, without glab and so
without GitLab's login; the window never names an address Rust did not accept; no dependency. The re-request is GitLab's
own one mutation, behind a fresh check. The directive replaces each `title` one-for-one. Cost: a Rust slice of about 20
files and 1,200 lines (two crate modules, a scheme with a fetch gate, a new scenario), a core slice, a state-and-ipc
slice, a hover-primitives slice, and a page slice of about 15 files; five implementer runs in three waves, the frontend
typecheck red between the bindings and the page slice.

### Proposed plan §2 rows (DR5: the orchestrator records them)

| #   | **Decision**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Rejected alternatives & why                                                                                                                                                                                                                                                 | Vision  |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| 151 | **Merge-request rows show the author, assignees and reviewers, approvers, labels and a local due date** (owner 2026-11-02, #2095, answers #2100–#2105; request `docs/slices/request-mr-row-details.md` rules 1–11; design `briefs/mr-row-details-design.md` option A; amends #131's fields and request-merge-requests' row and non-goals). The list query (#131) adds `author { username name avatarUrl }`, `avatarUrl` on assignees, reviewers and approvers, approvers' `name`, reviewers' `mergeRequestInteraction { approved reviewState }`, `userPermissions { updateMergeRequest }`, labels' `color textColor`, `diffRefs { baseSha }`. `MergeRequestRow` gains `author: Option<Person>`, `reviewers: Vec<Reviewer { person, state }>` (`ReviewState` = requested \| reviewed \| approved \| changesRequested, `approved` first), `labels: Vec<Label { title, colors }>`, `approved_by: Vec<Person>` replacing `approvals`, `may_rerequest`; `Person` gains `picture: PersonPicture`; `size` is `0 / 0 / 0` when `diffRefs` is set and `diffStats` is empty | the people asked on hover (an extra call per hover; the score fits, #131); `approvals` beside `approved_by` (two sources for one count); `diffStatsSummary` (#138)                                                                                                          | 2, 4, 5 |
| 152 | **Profile pictures: uploaded ones through the `yamt-picture` scheme, Gravatar's straight from Gravatar** (owner #2105; amends the CSP: `img-src 'self' data: yamt-picture: http://yamt-picture.localhost https://secure.gravatar.com https://www.gravatar.com`). `avatar_source` is the only maker of both addresses: an uploaded avatar on the project's origin (`…/uploads/-/system/user/avatar/<n>/<file>`, a path or the same `https` origin) → `Uploaded`, offered by username in `MergeRequestState.pictures`, `yamt-picture://localhost/<username>` answering its bytes (PNG, JPEG, GIF or WebP by their first bytes, ≤ 1 MiB) fetched by `glab api <address>`, at most 4 at once, cached for the run (failures too), else 404; `https://secure.gravatar.com` or `https://www.gravatar.com` `/avatar/<hex>` (GitLab's defaults, `1_settings.rb:523-526`) → `Gravatar { address }`, loaded by the window with `referrerpolicy="no-referrer"`, never through glab; anything else → initials. Initials on a colour from the username underneath, always       | a CSP entry for a GitLab host (unknown at build); `data:` addresses on the list channel (late, a base64 encoder, a second store); an HTTP client crate (DR3); Gravatar through `glab api` (GitLab's token would reach Gravatar); other hosts, custom Gravatar URLs (rule 2) | 3, 5, 2 |
| 153 | **"Re-request review" is GitLab's own control, for reviewers whose review is done** (owner #2104; GitLab's `uncollapsed_reviewer_list.vue`). Lucide `rotate-ccw` left of the reviewer's state icon when `may_rerequest` and the state is reviewed, approved or changes requested; no button for assignees; nothing adds a reviewer. `rerequest_review(iid, username)`: glab, login, project, then afresh `mergeRequest(iid) { state reviewers { id username … } }`; not a reviewer → `NotReviewer` (no write); already requested → the fresh reviewers, no write; else `mergeRequestReviewerRereview(userId)` with the body on stdin (`glab api graphql --input -`); the answer's reviewers back to the row; a mutation's `errors` → `Refused`; glab's failure → `Failed`                                                                                                                                                                                                                                                                                         | `mergeRequestSetReviewers` or REST `reviewer_ids` (adds reviewers: owner #2104); the global id in the query text (escaping); `glab_answer::posted` (REST statuses; a review crate dependency); a button for every person (owner #2104)                                      | 3, 4, 5 |
| 154 | **The merge-request page's hover texts are one tooltip directive** (owner #2101: this page only). `v-tooltip="text"` (`ui/tooltip.ts`) on the element that had `title`; one tip element per window; 400 ms, at once within 300 ms of the last; above at the left edge, below when it does not fit (`tooltipPlacement`); gone on leave, scroll, Escape or a press; `aria-label`s stay, the text mirrored to `aria-description` when it differs. Rich hover content is a box the pointer enters (`useHoverBox`, extracted from the CI box). A test bans `title` in the page's files                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | a wrapper component (an element in every flex row); migrating other windows (owner #2101)                                                                                                                                                                                   | 1, 2, 3 |
| 155 | **Exclude filters, hover-open checklists, choices by count** (amends #134's words and request-merge-requests rule 6). Each filter holds `{ value, mode: included \| excluded }`; click / Shift+click per rule 7; stored words gain the prefix `not:` (`"not:me"`, `"not:user:anna"`, `"not:label:bug"`), old words read as included, an older yamt drops the new ones; one `useHoverMenu` for the bar (one open by construction, 300 ms, a click on a hover-opened opener pins it); "Me", "None", then count, then name                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | a second stored key for excluded values (two writers per repository); one dropdown per filter (two open at once while the first waits to close)                                                                                                                             | 4, 2    |
| 156 | **Due dates are local, per repository and merge request** (owner #2102 for the order). `yamt.mergeRequests.dueDates` = `{ [repository]: { [iid]: "YYYY-MM-DD" } }` through `storedRecord`; a complete load (`loaded`, not `cut`) drops the dates of merge requests it no longer lists; days left on calendar days from local midnight; shown rows: dated first by day (overdue first), equal days newest first, then the rest newest first; the native `<input type="date">` (WebKitGTK's GTK picker)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | GitLab's own due date or milestone (non-goal); an own date picker (no dependency needed); milliseconds for days left (daylight saving)                                                                                                                                      | 5, 1, 4 |
| 157 | **Defaults decided with the row-details design** (orchestrator, OR13; the owner may veto): §2.3 of the design (row layout, author unknown, boxes open at once, the reviewers' state icons as the nearest Lucide to GitLab's, refusal stays until the box closes, the picker box, pinning a hover-opened checklist, tooltip timing and placement, the excluded value's look); `REVIEW_STARTED` → "Review requested" and so no re-request button (GitLab offers one), `UNAPPROVED` → "Reviewed"                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | —                                                                                                                                                                                                                                                                           | 1, 5    |

### Risks for the register (`skill://risk-register`, next free id RK53)

| id   | risk                                                                                                                                                                                   | owner                                                                                                                                                 | proving test                                                                                                                                                                                                                                                                                        |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| RK53 | the window loads or makes glab fetch an address GitLab did not list as an avatar; GitLab's token goes to Gravatar or any other host; a non-image (HTML, SVG) is served into the window | `yamt-merge-requests` `avatar_source`, `fetch_picture` (sniffing, size) + `src-tauri` `merge_requests/pictures.rs` (offered usernames only) + the CSP | `only_an_uploaded_avatar_on_the_projects_origin_is_an_uploaded_address`, `only_gravatars_avatar_path_on_its_two_hosts_is_a_gravatar_address`, `a_gravatar_person_is_never_fetched_through_glab`, `a_picture_that_is_not_png_jpeg_gif_or_webp_is_refused`, `only_an_offered_username_gets_a_picture` |
| RK54 | a review is re-requested from someone who is no longer a reviewer, or twice while it is still requested (a second notification), or anything adds a reviewer                           | `yamt-merge-requests` `rerequest_review` (fresh reviewers query, Rereview only)                                                                       | `someone_no_longer_a_reviewer_is_refused_before_any_write`, `a_reviewer_still_awaiting_review_is_not_asked_again`, `the_only_write_is_the_rereview_mutation`                                                                                                                                        |
| RK55 | filters stored by an older yamt are lost or an excluded value is read as included                                                                                                      | `mergeRequests/internal/stored.ts`                                                                                                                    | `old_words_read_as_included_and_unknown_words_are_dropped`, `an_excluded_word_round_trips`                                                                                                                                                                                                          |
| RK56 | days left off by one at midnight, at a month's end or on a daylight-saving day                                                                                                         | `mergeRequests/internal/dueDate.ts`                                                                                                                   | `days_left_changes_at_local_midnight`, `days_left_across_month_and_year_ends`, `a_daylight_saving_day_counts_once`                                                                                                                                                                                  |

### Shared edits for the orchestrator (no slice owns them)

- `just bindings` after `mr-row-details-rust` lands, before `mr-row-details-state` starts (`MergeRequestRow`,
  `Person`, `PersonPicture`, `Reviewer`, `ReviewState`, `Label`, `LabelColors`, `RerequestReply`,
  `commands.rerequestReview`).
- The docs keeper (`skill://orchestrate` §6): plan rows #151–#157; architecture §2 (crate: `rerequest.rs`,
  `picture.rs`), §3 (the scheme, the CSP's Gravatar hosts), §4/§5.1 (the page: people, labels, due dates, tooltip), the
  IPC command list (`rerequest_review`; `MergeRequestSource.rerequestReview`; PM6 `map-check`);
  `skill://project-map/tree.md` rows for every new file and `state.md` rows for `MergeRequestState.pictures`, the due
  dates (writer `ui/mergeRequestDueDates.ts`), the re-request asks (writer `ui/mergeRequestRerequests.ts`), the tip
  (writer `ui/tooltip.ts`); `ui/AGENTS.md` lines from the state and hover slices' `deviations_from_brief`; RK53–RK56;
  request-merge-requests' reopened non-goals.

## 5. Slice graph

| wave | brief                                       | owner     | needs                                            | beside      |
| ---- | ------------------------------------------- | --------- | ------------------------------------------------ | ----------- |
| 1    | `mr-row-details-rust.md`                    | rust-impl | —                                                | core        |
| 1    | `mr-row-details-core.md`                    | web-impl  | —                                                | rust        |
| 2    | `mr-row-details-state.md`                   | web-impl  | rust (+ `just bindings`), core                   | hover       |
| 2    | `mr-row-details-hover.md`                   | web-impl  | —                                                | state       |
| 3    | `mr-row-details-page.md` (wires the window) | web-impl  | state, hover (and so rust, core)                 | —           |
| 4    | `mr-row-details-verify.md`                  | verifier  | page committed; final pass after the docs keeper | docs keeper |

Why not the request's graph (one page slice owning every merge-request `ui/` file, the tooltip slice small beside it):
the page work is about 30 files (four new components, the filter bar, the state, the ipc layer and fixtures), above the
implementer budget; `ui/mergeRequests.ts` and `MergeRequestsView.vue` cannot be split between two slices; and the
tooltip slice may not own page files the page slice uses. So the state and ipc layer (no `.vue`) is its own slice, the
hover primitives own only generic `ui/` files, and the page slice migrates every page file's `title`. At most two
implementers run at a time. Between `just bindings` and the page slice the frontend typecheck is red in files a later
slice owns (each brief lists which); node tests run regardless (vitest transpiles), and the verifier's `just check` runs
after the page slice.

## 6. Open questions for the owner

None open: the owner answered both earlier questions (#2104 the re-request control, #2105 Gravatar).
