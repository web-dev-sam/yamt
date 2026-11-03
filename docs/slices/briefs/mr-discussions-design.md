# Open discussions on a merge-request row: whose turn it is — design

Request: `docs/slices/request-mr-discussions.md` (rules 1–8 settled; this design closes its "To be measured" list and
refines only details a rule names). Next in line: `docs/slices/request-mr-review-mode.md`. Its order needs, for every
listed row and for any reviewer, the number of open discussions that are that reviewer's turn and the number where the
reviewer waits. This design shapes the data for that and designs nothing of review mode.

Facts:
- `.omp/run/notes/PlanScoutMrDiscussionFacts.md` (cited "facts §n"): logged out, gitlab.com, 2026-11-03.
- The orchestrator's measurements of 2026-11-03, logged in as `samubr`, glab 1.126.0 (cited "Main, measured"):
  - `-F 'iids=["4272","4292"]'` with `mergeRequests(iids: $iids)` on gitlab-org/cli is accepted and answers both, in
    1.71 s.
  - The query of §1.1 below, without `iids`, run as `mergeRequests(state: opened, sort: CREATED_DESC, first: N)` on
    gitlab-org/gitlab:

    | N | wall time | stdout | score / limit | discussions with more pages | notes with an earlier page |
    | --- | --- | --- | --- | --- | --- |
    | 100 | 22.22 s | 1,166,754 bytes | 58 / 250 | 0 of 100 | 0 |
    | 20 | 4.47 s | 151,961 bytes | 36 / 250 | 0 | 0 |

    `errors` was null both times.
  - The playground's !1 "Due dates on cards" has 4 open discussions. Every note is by `samubr` with `system: false`;
    one example has `url` `https://gitlab.com/samubr/glab-yamt-playground/-/merge_requests/1#note_4131301160` and
    `position {filePath: "src/board/card.ts", newLine: 4, oldLine: null}`. !2–!6 have none.

Anything else unmeasured is marked `[INFERENCE]`.

## 1. The request's "to be measured", closed

### 1.1 Where the query sits, and what it costs

- **Not inside the list query.**
  - Adding the discussions block to `list_query()` (`crates/merge-requests/src/query.rs:40-64`) scores 212 of
    gitlab.com's logged-in limit of 250 (facts §2, a1; limit `gitlab_schema.rb`, facts header). That fits.
  - But the discussions of 100 merge requests took **22.22 s** (Main, measured). One glab call has a 20 s deadline
    (`crates/gitio/src/glab.rs:10` `GLAB_TIMEOUT`), so on a busy project every list page would time out.
  - Rule 7 needs the list to keep its count when details fail. A failing block inside the list query fails the page
    (`list.rs:88-91`).
  - "Off" would still pay for the block unless there were a second list query.
- **A second query of its own, by iids, 20 rows per glab call.** One text serves every case (§1.6):

  ```
  query MergeRequestDiscussions($fullPath: ID!, $iids: [String!], $first: Int!, $discussionsAfter: String) {
    queryComplexity { score limit }
    project(fullPath: $fullPath) { mergeRequests(iids: $iids, first: $first) { nodes { iid
      discussions(first: 100, after: $discussionsAfter) { pageInfo { hasNextPage endCursor } nodes {
        resolvable resolved
        notes(last: 20) { pageInfo { hasPreviousPage } nodes {
          system author { username name avatarUrl } body createdAt url position { filePath newLine oldLine } } } } } } } } }
  ```

  It is sent on one line, as the list query is (`query.rs:39`), so the fake glab logs each call on one line. The
  arguments are `api graphql -f query=… -f fullPath=<path> -F iids=<JSON array of strings> -F first=<n> [-f
  discussionsAfter=<cursor>]`. `-F` with a JSON array was measured working on glab 1.126.0 (Main, measured).
- **Cost per call.**
  - 20 rows took 4.47 s for 152 KB and scored 36 in the list form (Main, measured).
  - The `iids` form counts its per-merge-request fields ×(1 + first × 0.05) = ×2 for `first: 20`, against ×1.2 in the
    list form (facts §2, "Why the scores come out this way"). That puts it near 36 + 0.8 × ~25 ≈ 56 `[INFERENCE]`.
  - Either way the score is far below 250, and it does not depend on the number of notes or discussions asked for:
    a connection without a resolver gets no page multiplier (facts §2).
  - The rust slice measures the real score and time once (its step 1) and logs `queryComplexity` of the first batch
    of each call, as the list does (`list.rs:92-98`).
- **At 100 rows per page and up to 500 rows** (`lib.rs:45-47`): the list query stays at 170 per page. The details
  take ⌈rows with open discussions / 20⌉ calls of about 56 each. At the 500-row maximum that is 25 calls of about
  4.5 s on gitlab-org/gitlab (≈ 2 min); a typical project is one or two calls `[INFERENCE]`.
- **`DISCUSSION_BATCH = 20`** is the one tunable. It sits in Rust next to its only user, and the window never knows
  it (§1.6). 20 is the measured size under the deadline with a 4× margin. 100 was measured over the deadline.

### 1.2 The last person's note; how many notes are read

- `Discussion.notes` takes only connection arguments; there is no `filter` (facts §1). So `notes(last: 1)` can return
  a system note: observed on gitlab-org/cli !4292 discussion `1d3cb881…` (facts §1).
- **Read `notes(last: 20)` and take the last note with `system: false`.**
  - A resolvable discussion always holds a person's note (`resolvable?` needs a `resolvable?` note, and a system note
    never is one; facts §1).
  - The system notes inside a resolvable discussion are the "changed this line in version N" notes, one per push that
    changes the line (facts §1 `[INFERENCE]`).
  - In the measured 100 merge requests, no discussion had a note beyond its last 20 (`hasPreviousPage` true in 0;
    Main, measured).
  - `last: 20` costs the same score as `last: 1` (facts §2: a1 = a3 = a5).
- When all of the last 20 notes are system notes and earlier notes exist, the row answers `Failed` with "a discussion's
  last 20 notes are all GitLab's own; yamt reads no further". The box says so (rule 7); a wrong turn is never shown.
- **Discussions per merge request.**
  - `discussions(first: 100)` is the schema's page cap (facts §2), and every system note is its own discussion (facts
    §1). Measured: 0 of 100 merge requests needed a second page (Main, measured).
  - A merge request with more is asked again, alone, with the same query text, `-F iids=["<iid>"] -F first=1 -f
    discussionsAfter=<endCursor>`, until no page is left.
  - The limit is `MAX_DISCUSSION_PAGES = 10` pages (1,000 discussions). Beyond it the row answers `Failed` ("more
    than 1,000 discussions"); a partial list is never shown.
- **Which discussions are open.** A discussion is open when it is `resolvable` and not `resolved`. This matches the
  count, `resolvableDiscussionsCount − resolvedDiscussionsCount` (`page.rs:252-256`; "user discussions",
  `merge_request_type.rb:188-191`, facts §1).
- **Where a discussion is (its place).** The place comes from the last person's note's `position`:
  - `null` → Overview.
  - Otherwise → `filePath` and `newLine ?? oldLine` (both may be null, facts §1).
  - Every note of a diff discussion carries the discussion's position `[INFERENCE]`: the observed system note in the
    middle had "same file, newLine 128" (facts §3). A Rust test pins this reading.
- **Bots.** Bot accounts write `system: false` notes (facts §1), and rule 4 skips only "GitLab's system notes". So a
  bot's comment counts as the last comment. This is decided here and offered to the owner as open question 1.

### 1.3 The viewer

- The viewer is the slice's `me`: the list's `currentUser { username }` (`query.rs:44`, `page.rs:167`,
  `ui/mergeRequests.ts:43,94`).
- It is the same value the filters call "Me" (`ui/mergeRequestsShown.ts:36,42`, `mergeRequests/internal/filters.ts:57-60`).
  No new glab call and no second source.
- The core's turn rule takes the viewer as a plain `username | null` parameter. Review mode will pass its chosen
  reviewer there (`request-mr-review-mode.md` rule 5) and nothing else changes.

### 1.4 Where the turn rule, the order and the box's words live

- **Rust** decides only what is GitLab's data: which discussions are open, which note is the last person's (system
  notes skipped), its place, whether its `url` is GitLab's link for that note, and the author's picture source. These
  are boundary facts, parsed once (`skill://principles` §1 "external data is untyped until parsed").
- **The framework-free core** (`frontend/src/mergeRequests/internal/discussions.ts`) holds the turn rule, the order
  and every word of the box: the turn words, the header sum, the place text, the cut text, the author's name and "…
  ago".
  - The turn depends on a viewer that review mode changes per reviewer. Rust would have to answer per viewer or
    send every author anyway.
  - The owner reads TypeScript (vision 1).
  - The core already holds the page's other word rules (`readinessText`, `reviewStateText`, `ciStatusText`,
    `mergeRequests/index.ts`).
- The core stays self-contained (PM3). It declares its own structural `OpenDiscussion` (as `filters.ts` declares
  `Person`), so the window's domain type passes into it unchanged.

### 1.5 The IPC types (`skill://ipc-contract`)

Every type below is generated by tauri-specta.
- Brands: `MergeRequestIid` and `WebPage` (validated in `mergeRequestDomain.ts` as `toRow` does,
  `mergeRequestDomain.ts:119-139`).
- Sum types: the place (`overview | file`) and the per-row answer (`open | glabMissing | notLoggedIn | failed`).
- Every failure is a reply value, never an `IpcError` (IPC4: "GitLab, git and launch problems … are replies").

```rust
// crates/merge-requests/src/discussions.rs (re-exported from lib.rs)
pub struct RowDiscussions { pub iid: MergeRequestIid, pub answer: DiscussionsAnswer }
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum DiscussionsAnswer {
    Open { discussions: Vec<OpenDiscussion> },     // GitLab's order
    GlabMissing,
    NotLoggedIn { detail: String },
    Failed { message: String },
}
pub struct OpenDiscussion { pub place: DiscussionPlace, pub last: DiscussionNote }
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum DiscussionPlace { Overview, File { path: String, line: Option<u32> } }
pub struct DiscussionNote {
    pub author: Option<Person>,   // People::person: uploaded pictures offered by username (#152)
    pub created_at: String,       // as GitLab sent it
    pub text: String,             // the raw body: plain text to the window (rule 5)
    pub page: Option<WebPage>,    // WebPage::note: only GitLab's own url for this note (rule 6)
}
// crates/settings: the setting (§1.10)
#[serde(rename_all = "lowercase")] pub enum DiscussionDetails { #[default] Full, Lazy, Off }
```

The window's domain (`ipc/mergeRequestDomain.ts`) turns `createdAt` into milliseconds (as `toRow`), `author` into the
domain `Person` (`toPerson`, `:96-110`) and `page` into the `WebPage` brand. `DiscussionDetails` is an alias of the
generated union `"full" | "lazy" | "off"`.

### 1.6 One load path for "fully" and "lazily", without two query shapes

**One command, `read_discussions(iids) -> Vec<RowDiscussions>`.**
- It answers a non-empty prefix of `iids`: at most `DISCUSSION_BATCH`, in the asked order, each iid once. It answers
  nothing only when nothing was asked.
- A glab or login failure answers each row of that prefix with its reason, so even a failure moves on.

**The window keeps the one queue and decides what is asked** (`ui/mergeRequestDiscussions.ts`):
- **Fully:** every listed row with `openDiscussions > 0` and no entry, as pages arrive. After a refresh's rows replace
  the old ones, all of them again. On a switch to "Load fully", the rows still missing.
- **Lazily:** the one row whose count is hovered or focused for the first time, put first in the queue.
- **Off:** nothing. The queue and the entries are dropped, and an answer in flight is dropped too.
- One call runs at a time. Each answer removes the answered iids from the queue. The window calls again until the
  queue is empty.

The query text is the same in every case (§1.1); only the variables differ.

Rows whose count is 0 are never asked: no entry and a count of 0 mean "none open". This saves a call per quiet row,
and review mode reads "not loaded" as "none" anyway (its rule 6).

### 1.7 Freshness and failure (rule 7)

- **Freshness.**
  - Details live as long as the rows they belong to. A Refresh keeps the shown rows and their details until its own
    rows replace them (`ui/mergeRequests.ts:97-106`, the buffered load).
  - At that swap every entry and queued ask is dropped, and "Load fully" asks again for the new rows. "Load lazily"
    asks again on the next hover.
  - A call answered after the swap or after "Off" is dropped (a generation number), as `mergeRequestJobLogs.ts:65-67`
    drops a reply for a log no longer shown.
- **Failure.**
  - The count always comes from the list (rule 1).
  - The box's header gives the reason:
    - "Loading discussions…" while the row's ask is queued or running.
    - For a refused answer, the glab words the list already uses (`ui/glab.ts`: `GLAB_MISSING_TEXT`,
      `glabNotLoggedInText`, `glabFailedText`).
    - For an IPC failure, `problemText` with the new step `discussions` ("Could not read the discussions").
  - Nothing goes to the problem bar.
  - A failed row is asked again only after the next refresh. A switch between modes does not retry it.

### 1.8 Plain text and links

- **Plain text** (rule 5, RK57's text rule): the body crosses as `text: String` and is shown by Vue text
  interpolation only, never `v-html`. The core cuts it with `noteExcerpt` into at most three lines and 280 characters,
  ending in "…" when anything was cut, and the box also clamps to three lines in CSS. `**bold**`, `<b>` and capitals
  show as typed.
- **Links** (rule 6, plan §2 #137, RK41):
  - A new maker `WebPage::note(origin, web_path, iid, url)` accepts GitLab's `url` only when it equals the merge
    request's own page (`WebPage::merge_request`, `web_page.rs:35-42`) followed by `#note_<digits>`. That is the form
    GitLab builds (`merge_request_url(noteable, anchor: dom_id(note))`, facts §1; observed, facts §3 and Main). Any
    other address → `page: None`, and the line is not clickable.
  - `src-tauri` adds every note page to the window's offered `pages` before the reply is sent (as `forward_page`,
    `src-tauri/src/merge_requests.rs:98-111`). A click goes through the existing `open_page` (`:369-375`),
    `PageKind` `"discussion"`.
- **Pictures** (RK53, plan §2 #152): authors go through `People::person` (`people.rs:110-125`). Their uploaded
  pictures are offered by username through `state.pictures.offer` before the reply, otherwise the picture scheme
  answers 404 (facts §5 note b).

### 1.9 The box: the people box's pieces, one hover rule

- The new `ui/MergeRequestDiscussions.vue` replaces the count span (`MergeRequestRow.vue:163-171`). Its shape is
  `MergeRequestPeople.vue`'s:
  - `useHoverBox({ area, opener, box })` (`MergeRequestPeople.vue:52-59`). This is the one hover rule (plan §2 #154);
    the CI box and the labels use it too (facts §4).
  - An area span with `data-row-control @click.stop`.
  - A `<button :aria-expanded>` opener showing the icon and count (`aria-label` = `discussionsText`).
  - The same box classes (`:147`).
  - `MergeRequestPicture :person size="box"` and the person's name for each author (`:158-159`).
- There is no second hover rule, no second picture component and no tooltip on the opener (rich content is a box,
  #154).
- "Load lazily" asks the row's details by `watch(open)`, so pointer and keyboard focus both ask once (useHoverBox opens
  on either, `useHoverBox.ts:80-92`).
- **Off, or a count of 0:** today's span with `v-tooltip="discussionsText(count)"`, unchanged, and no box.
- Extracting a shared box component for the four hover boxes is out of scope. The class string is copied once more,
  as the CI and labels boxes already do.

### 1.10 The setting

- **File:** the key `"discussionDetails"`, with the values `"full"` (default), `"lazy"` or `"off"`.
  - It is written only when it is not `"full"`. A file without the key reads as "Load fully", so a later default still
    reaches users who never chose (#57's rule as #113 restates it).
  - Unknown keys are kept as they are today (`file.rs:102-113`).
- **Rust:** `DiscussionDetails` in `StoredSettings`, `set_discussion_details(places, current, details)` as
  `set_antialiasing` (`crates/settings/src/lib.rs:183-189`), and the command `set_discussion_details(current,
  details)` as `src-tauri/src/settings.rs:56-64`.
- **Window:**
  - `SettingsInUse.discussionDetails` (start `"full"`, as `antialiasing` starts `"subpixel"`, `ui/settings.ts:63-72`)
    and `setDiscussionDetails` beside `setAntialiasing`.
  - A section "Discussion details" with three `ChoiceButtons` ("Load fully", "Load lazily", "Off"). It is a component
    `MergeRequestDiscussionSetting.vue` that the compare and range roots put into `SettingsView`'s slot, as the range
    root puts `AgentSettings` (`RangeApp.vue:148-150`). The merge window has no merge-request page, so it shows no
    such choice.
- **Applied at once:** the slice reads the mode through a getter on the window's `settings` ref and watches it (§1.6).
  There is no reload.

## 2. Options

The options differ in where loading is driven and where the details travel.

### Option A — one command answering a batch prefix; the window's queue drives every mode (recommended)

**Data structures:**
- Rust:
  - The IPC types of §1.5.
  - `ReadDiscussions { rows: Vec<RowDiscussions>, pictures: Vec<OfferedPicture> }` (shell only, as `ListedPage`).
  - `DISCUSSION_BATCH`, `NOTES_READ`, `DISCUSSIONS_PER_PAGE`, `MAX_DISCUSSION_PAGES`.
- Window state: `ReadonlyMap<MergeRequestIid, DiscussionLoad>` with `DiscussionLoad = loading | read { discussions } |
  refused { answer } | failed { cause }`, plus a private queue `MergeRequestIid[]`, the call in flight and a
  generation number.
- Core: `Turn = "viewer" | "waiting"`, `TurnLine<D> { discussion, turn }`, `TurnCounts { viewersTurn, waiting }`.

**Flow:**
- The list pages arrive.
- With "full", the slice queues the new rows that have open discussions.
- The queue sends all queued iids. Rust reads the first 20 in one glab call (plus any later-pages calls), offers pages
  and pictures, and answers those rows.
- The window stores them and sends the rest.
- A hover with "lazy" puts one row first. "Off" clears the queue and the entries.

**Files:**
- Rust: new `crates/merge-requests/src/discussions.rs` (+ tests). Changed: `query.rs`, `web_page.rs`, `project.rs`
  (`From<NoProject>`), `lib.rs`, `crates/settings/src/{lib,file}.rs` (+ `tests/discussion_details.rs`),
  `src-tauri/src/merge_requests.rs` (+ `merge_requests/discussions.rs`, tests), `src-tauri/src/settings.rs`,
  `src-tauri/src/commands.rs`, `scripts/fake-glab/glab`, `tests/glab/mr-discussions/**`.
- Core: `mergeRequests/internal/discussions.ts`, `relativeTime.ts`, `index.ts`.
- State: `ipc/` sources, domain and fixtures, `ui/mergeRequestDiscussions.ts`, `ui/mergeRequests.ts`,
  `ui/mergeRequestsStore.ts`, `ui/settings.ts`, plus the settings-source literals in five tests.
- Page: `ui/MergeRequestDiscussions.vue`, `ui/MergeRequestDiscussionSetting.vue`, `ui/MergeRequestRow.vue`, texts,
  `problem.ts`, `problemText.ts`, `settingsStore.ts`, and the two roots' Settings slot.

**Risks:**
- On a 500-row busy project "fully" takes ≈ 2 min to fill every row (§1.1). Rows fill top-down in list order, 20 at a
  time.
- Each call checks the login and project again (`logged_in_project`: `auth status` and `api projects/:fullpath`, as
  `read_job_log` does, `job_log.rs:89-90`): two more glab runs per batch.
- glab before JSON-array `-F` (the fake stands in for 1.124.0, `tests/glab/README.md:3`; Main measured 1.126.0) would
  send the array as a string. GitLab then refuses the variable, and every row shows GitLab's words in its box: visible,
  never wrong `[INFERENCE]`.
- The queue must end. Rust's contract (a non-empty prefix for a non-empty ask) is pinned by a Rust test and by the
  fixture's own prefix answers.

**Tests:**
- Rust: system notes skipped (inside and last), resolved and non-resolvable excluded, place, note link accepted and
  refused, a later discussions page asked alone, 20 notes all system → `Failed`, a missing iid → `Failed`, batch
  prefix and dedupe, glab missing and logged out per row, the setting's three values read and written (default not
  written).
- App: pages and pictures offered before the reply; a note link opens, another address `NotOffered`.
- Core: the turn for a viewer and for another username, order (turn first, newest first, ties stable), counts, words,
  excerpt cut.
- State: full queues as pages arrive, the refresh swap drops and re-asks, lazy asks once, off asks nothing and drops
  an answer in flight, switching applies, a prefix answer continues the queue, an IPC failure is kept per row.
- WebKit and the real app per setting (verify).

**Visions:** 1 (one path, rules in TS, one constant), 2 (one source per fact: viewer = `me`, the batch size only in
Rust, the setting only in the file), 4 (sum types for place, answer and load), 5 (no new dependency, one new command).

### Option B — Rust drives "fully" on the list's channel; a second entry point for "lazily"

**Data structures:**
- `list_merge_requests(messages, details: DiscussionDetails)`.
- `ListMessage` gains `Discussions { rows: Vec<RowDiscussions> }`, sent after `End` in batches from a second scoped
  thread beside the conflict check (`src-tauri/src/merge_requests.rs:121-140`).
- `read_discussions(iid)` for one row. The window applies `Discussions` messages as it applies `Checked`
  (`ui/mergeRequests.ts:113-119`, shown rows or the refresh buffer).

**Files:** as A, plus the list command, `ListMessage`, `tauriMergeRequests.ts`'s channel and the list's tests.

**Risks:**
- The setting has to cross into the list command.
- Rule 8's "switching to Load fully loads what is missing" needs a whole reload, or a third path that asks rows
  outside a load.
- Two threads send on one channel, and the conflict check's single log line per load (`merge_requests.rs:119-120`)
  must stay single.
- The window's queue disappears, but the lazy path still needs its own loading state.

**Tests:** as A, plus channel ordering (pages, End, then `Checked` and `Discussions` interleaved) and a second load
discarding the first's late messages.

**Visions:** 2 (details tied to their load like `Checked`). It costs 1 and 5: two entry points for one fact, the setting
in two layers.

### Option C — the discussions block inside the list query; a per-row query for "lazily"

**Data structures:**
- `MergeRequestRow.discussions: Option<Vec<OpenDiscussion>>`, filled by the list.
- `mergeRequest(iid) { discussions … }` for one row (facts §2 c1, score 26).
- A second list query text without the block for "lazily" and "Off".

**Files:** `query.rs`, `page.rs`, `MergeRequestRow` and its domain, plus a details command.

**Risks:**
- Measured: 100 rows' discussions take 22.22 s, over glab's 20 s deadline (Main, measured; `glab.rs:10`). The whole
  list page fails on a busy project, against rule 7 ("the count still shows").
- Two query shapes, which the request rules out.
- Every list page grows by about 1.2 MB (Main, measured).

**Tests:** the list's page tests with the block, and the timeout scenario.

**Visions:** 5 (fewest moving parts). It fails rule 7 by measurement.

## 3. Recommendation

**Option A.**
- It is one command, one query text and one queue for all three settings. Its batch size is measured to fit glab's
  deadline with a 4× margin, and a slow or failing detail can never cost the list its rows (rule 7).
- The turn rule takes any viewer, so review mode passes its reviewer and reuses everything.
- **Cost:**
  - About 25 Rust files with their tests and scenario, about 6 core files, about 27 state files (five of them get a
    one-line addition), and about 13 page files.
  - One new IPC command per concern (`read_discussions`, `set_discussion_details`).
  - Two more glab runs per batch for the login check.
  - On the largest projects, about 2 minutes until every row's details are in.

### Proposed plan §2 rows (DR5: the orchestrator records them; numbers as free at commit time)

| # | **Decision** | Rejected alternatives & why | Vision |
| --- | --- | --- | --- |
| 162 | **A merge request's open discussions are read by their own query, 20 rows per glab call, driven by the window's queue** (owner #2193, #2199–#2200; request `docs/slices/request-mr-discussions.md`; design `briefs/mr-discussions-design.md` option A). `read_discussions(iids) -> Vec<RowDiscussions>` answers a non-empty prefix of at most `DISCUSSION_BATCH` 20 (measured 4.47 s for 20 and 22.22 s for 100 on gitlab-org/gitlab, glab's deadline 20 s): `mergeRequests(iids:, first:) { iid discussions(first: 100, after:) { … notes(last: 20) { system author body createdAt url position } } }` with `-F iids=<JSON>`; a later discussions page asked alone (at most 10); open = resolvable and not resolved; the last note with `system: false` is the last comment (20 system notes in a row → `Failed`); place from its `position` (`null` → Overview); `WebPage::note` accepts only GitLab's `url` of the form `<merge request page>#note_<digits>`, offered in `pages` before the reply, authors' uploaded pictures offered by username; failures are row answers. The window asks: "fully", every listed row with open discussions as pages arrive, again after a refresh replaces the rows; "lazily", the hovered row first; "off", nothing; one call at a time; answers after a refresh or "off" dropped. | The block inside the list query (212/250, but 100 rows took 22.22 s: the list would time out, and rule 7 wants the count kept); Rust driving "fully" on the list channel (the setting in the list command, a reload to switch to "fully", two senders on one channel); per-row queries for "fully" (up to 500 glab calls). | 1, 2, 4, 5 |
| 163 | **The turn rule, its order and the box's words live in the core; the box is the people box's pieces** (rules 2–5). `discussionTurns(open, viewer)`: the viewer's turn when the last comment's author is not the viewer (an unknown author too), first, newest last comment first within each group, ties in GitLab's order; the viewer is the list's `me`, review mode passes its reviewer. Words: "Your turn", "Waiting for an answer", "N of M wait(s) for you", "Overview", `path:line`, three lines / 280 characters then "…", "3 hours ago". `MergeRequestDiscussions.vue` uses `useHoverBox`, `MergeRequestPicture` and the people box's classes; text by interpolation only; Off or a count of 0 keeps today's tooltip. Settings' "Discussion details" (`discussionDetails`: `full` default, written only when not, `lazy`, `off`) is a section the compare and range roots put in the Settings slot, applied at once. | Turns computed in Rust (a viewer per call; the owner reads TS); a second hover rule or a shared box component (one more user only); the setting in `SettingsView` for every window (the merge window has no merge-request page). | 1, 2, 4 |
| 164 | **Defaults decided with the discussions design** (orchestrator, OR13; the owner may veto): a bot's comment counts as a person's; rows with no open discussion are never asked; a failed row is asked again only after a refresh; "Off" drops loaded details; the excerpt cut at 280 characters; "Someone" for a deleted author; the header for details that list none "No open discussions". | — | 1 |

### Risks for the register (`skill://risk-register`, next free id RK60)

| id | risk | owner | proving test |
| --- | --- | --- | --- |
| RK60 | a click on a discussion opens an address GitLab did not give for that note, or a comment's text is interpreted as markup | `yamt-merge-requests` `WebPage::note` + `src-tauri` `merge_requests/discussions.rs` (pages offered) + `MergeRequestDiscussions.vue` (text interpolation only) | `a_note_url_is_a_page_only_as_gitlab_builds_it`, `a_note_page_is_offered_before_the_reply`, WebKit "markup in a comment shows as text" |
| RK61 | a system note shown as a discussion's last comment (a wrong "Your turn"), or details asked while the setting is "Off" | `yamt-merge-requests` `discussions.rs` (last `system: false`) + `ui/mergeRequestDiscussions.ts` (no ask with "off") | `a_system_note_after_the_last_reply_is_skipped`, `off_asks_nothing_and_drops_an_answer_in_flight`, real app "no discussion query with off" |

### Shared edits for the orchestrator (no slice owns them)

- `just bindings` after `mr-discussions-rust` lands and before `mr-discussions-state` starts. It brings
  `RowDiscussions`, `DiscussionsAnswer`, `OpenDiscussion`, `DiscussionPlace`, `DiscussionNote`, `DiscussionDetails`,
  `StoredSettings.discussionDetails`, `commands.readDiscussions(iids)` and `commands.setDiscussionDetails(current,
  details)`.
  - The frontend typecheck fails after it until the state slice lands, because `StoredSettings` literals lack the new
    field.
  - Run the two back to back, or accept the known red step between them, as `setAgent` did
    (`.omp/run/notes/RVAgentSettingsWeb.md`).
- No `Cargo.toml` or `package.json` change: `serde_json` is already a dependency of the crate (`query.rs:1`).
- Plan rows #162–#164 and RK60–RK61 above.
- **Docs keeper (once, after the page slice):**
  - `docs/architecture.md`:
    - §3.6: the key and `set_discussion_details`.
    - §3.9: `discussions.rs`, `WebPage::note`, the types.
    - §4: the two commands.
    - §5: `ui/mergeRequestDiscussions.ts` in the state table.
  - `.omp/skills/ipc-contract/SKILL.md`: the two command lines and `MergeRequestSource.readDiscussions`.
  - `skill://project-map/tree.md` and `state.md`: the new files; `discussions` owned by `mergeRequestDiscussions.ts`.
  - `src-tauri/AGENTS.md`: the settings command count.
  - The `AGENTS.md` lines of `crates/merge-requests`, `crates/settings`, `frontend/src/ipc`, `frontend/src/ui` and
    `frontend/src/mergeRequests` that the slices report in `deviations_from_brief`.
  - `tests/glab/README.md` is the rust slice's own.

## 4. Slice graph

| wave | brief | owner | needs | beside |
| --- | --- | --- | --- | --- |
| 1 | `mr-discussions-rust.md` | rust-impl | — | core |
| 1 | `mr-discussions-core.md` | web-impl | — | rust |
| — | orchestrator: `just bindings` | orchestrator | rust | — |
| 2 | `mr-discussions-state.md` | web-impl | rust + bindings | core (if still running) |
| 3 | `mr-discussions-page.md` (wires the window) | web-impl | state, core | — |
| 4 | docs keeper | docs-keeper | page | verify's smoke pass |
| 4 | `mr-discussions-verify.md` | verifier | page (smoke); docs (final `just check`) | docs keeper |

## 5. Open questions for the owner

Each is decided as written (row #164) and the owner may veto:

1. A bot's comment (GitLab Duo, gitlab-bot) counts as the last comment. With a bot's reply last, the reviewer sees
   "Your turn" even when the author has not answered. Skipping bots would instead show the human comment before it.
