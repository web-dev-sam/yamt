# Whose turn it really is, the whole thread beside the box, answering it, and sized images — design

Request: `docs/slices/request-mr-threads.md` (parts A–D settled; this design closes its "To be measured" list and refines
only details marked "(orchestrator)" or named below as a refinement). Base `69ab62d0`. It builds on the discussions box
(`briefs/mr-discussions-design.md`: the queue, the turn rule's home in the core), the description panel
(`briefs/mr-description-design.md`: the reducer `described`, uploads, the renderers), the CI log (`briefs/ci-job-log-design.md`:
the Shift tap, a side panel as the box's DOM child) and the people writes (`briefs/mr-people-design.md`: writes from the
page, the one row patcher `withPeople`, fake glab posts).

Facts come from four places:

- `.omp/run/notes/PlanScoutMrThreadFacts.md` (cited "facts §n"), used as given.
- The designer's GraphQL calls to gitlab.com, **logged out** (limit 200), on 2026-11-04, by `GET
  https://gitlab.com/api/graphql?query=…&variables=…`, and gitlab.com's schema introspection that day (cited
  "measured"). Nothing was written to any GitLab; no glab ran; nothing was timed.
- GitLab's source on `master` (GitHub mirror `gitlabhq/gitlabhq`) and docs.gitlab.com (cited by file or page).
- The tree (cited `path:line`).

Anything not seen is `[INFERENCE]`. Every timing is measured by `mr-threads-crate` step 1 (logged in, read-only).

## 1. The request's "to be measured", closed

### 1.1 A — image sizes

- **GitLab keeps the size on `<img>`, in descriptions and in notes.** `Banzai::Filter::AttributesFilter` sets
  `img[width]`/`img[height]` from `{width=…}`/`{height=…}` when the value matches `VALID_SIZE_REGEX =
  \A\d{1,4}(%|px)?\z`, only those two names, other attributes thrown away (rubydoc `Banzai/Filter/AttributesFilter`);
  it runs **after** `SanitizationFilter` in `GfmPipeline.filters` (`lib/banzai/pipeline/gfm_pipeline.rb`), so nothing
  strips it. Measured: gitlab-org/gitlab !267894, note 4158777417, `bodyHtml` holds `<img … alt="profile link"
  width="12" … class="lazy" data-src="https://user-content.gitlab-static.net/…">` from `![profile
  link](…/_user.png){width=12}` — a bare number, on a lazy image, in a note. The Markdown API answers the same
  pipeline `[INFERENCE: "Render Markdown content", docs.gitlab.com/api/markdown]`.
- **yamt drops it today:** `image()` reads only `data-src`/`src` and `alt`/`title` (`description/html.rs:262-285`); the
  window draws `class="inline h-auto max-w-full"` (`MergeRequestDescriptionImage.vue:28-37`).
- **IPC shape** (sum type, vision 4): `DescriptionInline::Image { image, caption, size: Option<ImageSize> }`,
  `ImageSize = width { width } | height { height } | both { width, height }`, `ImageLength = pixels { value } |
  percent { value }` (`value` ≤ 9999, GitLab's four digits; a bare number is pixels). Rust keeps exactly what GitLab
  kept and validates it with GitLab's own pattern (A3: anything else is ignored, as GitLab ignores it).
- **How the window sizes it** (a pure function `imageStyle(size, natural)`, `ui/mergeRequestImageSize.ts`):
  - width only (px or %): `width: W; height: auto; max-width: 100%` — CSS keeps the proportions and the cap (A1, A2);
    a percentage is of the containing text column, as on GitLab.
  - height only (px): before the picture loads `height: H`; after `load`, with the natural ratio `r`, `width:
    H·r px; height: auto; max-width: 100%`, so a capped picture keeps its proportions (A2). (`height: H` with
    `max-width` alone would squash it.)
  - both: `width: W; aspect-ratio: W / H; height: auto; max-width: 100%` for pixels; a percentage width with a pixel
    height is `width: min(W%, 100%)` and the height scaled by the same factor.
  - **Refinement:** a **percentage height is ignored**, as every browser ignores it on GitLab's own page (a percentage
    height of a box whose container's height is auto computes to auto, CSS 2.1 §10.5). A1's "a percentage is of the
    text column's width" is read for widths.
  - The stand-in text (`MergeRequestDescriptionImage.vue:14-20`) ignores the size (A3).
- **Fixtures with both units:** fake glab `tests/glab/mr-description/graphql-description-54.json` (px, %, bare, both,
  height only, one wider than any panel, `width="abc"`, `width="12345"`, `height="50%"`) and the window's !640
  description (`ipc/fixtureMergeRequestDescriptions.ts`).

### 1.2 B — what the turn rule needs, and what it costs

- **Per discussion the rule needs every person's comment, in order, with its author and the people it mentions** (B2.1
  the starter, B2.2 any comment by someone else, B2.4 the viewer's participation, B3.1 the last comment's mentions, B3.3
  the starter). Today only the last person's note crosses (`discussions.rs:281-300`), the first is dropped (facts §2).
- **Mentions come from GitLab's rendering, read in Rust.** GitLab's user link is `<a href="/vertisan" title="Paweł
  Farys" class="gfm gfm-project_member js-user-link" data-user="939514" data-original="@vertisan" …
  data-reference-type="user">@vertisan</a>` (measured, gitlab-org/cli !4292). `UserReferenceFilter` gives a user
  `data-user`, a group `data-group`, `@all` `data-project` + `data-author`, the href `user_url(username)`, the title the
  owner's name (`lib/banzai/filter/references/user_reference_filter.rb` `link_to_user`, `link_to_group`, `parent_url`).
  So a mention is an `a[data-reference-type="user"][data-user]`; its username is the href's last path segment, its name
  the `title`. Group and `@all` links lack `data-user` (the request's rule). The raw text is rejected: GitLab renders
  `` `@vertisan` `` as `<code>@vertisan</code>`, no link (measured, !4292 note 4142381748), so a raw `@name` reader would
  count code, e-mail addresses and unknown names.
- **Which side computes what** (as `mr-discussions-design.md` §1.4): Rust parses GitLab's facts once (person notes,
  their authors, their mentions, the place, the id); the framework-free core (`mergeRequests/internal/discussions.ts`)
  computes the turn for any viewer, because review mode changes the viewer per reviewer (#165) and the owner reads TS
  (vision 1).
- **The read changes** (`query.rs:135-150`): `notes(last: 20)` → `notes(first: 200)` (`Discussion.notes` has
  `max_page_size: 200`, facts §5), plus `bodyHtml`, the discussion's `id`, and the thread's fields (§1.3). One query text
  for the box, the reload and the thread (vision 5).
- **Cost (measured, logged out, 20 iids of gitlab-org/gitlab, the `iids` form):** score **64** of 200 with `notes(first:
  200) { … body bodyHtml … }`, **88** with the thread's fields too (`id`, `userPermissions`, `discussionLocked`,
  `lastEditedAt`, `lastEditedBy`), against 58 today (`query.rs:135-137`). Logged in the limit is 250 (plan #131), so a
  20-row batch stays under it. Bytes grow with every note's HTML `[INFERENCE: two to three times #162's 152 KB]`; #162
  measured 4.47 s for 20 rows. `mr-threads-crate` step 1 times 20 busy rows logged in; **over 10 s, `DISCUSSION_BATCH`
  drops to 10** (the one tunable, `discussions.rs:18-20`). "Load fully" at 500 rows: the same ⌈rows/20⌉ calls, each
  heavier.
- **A discussion of more than 200 notes** answers its row `Failed` ("a discussion has more than 200 notes; yamt reads
  no further") instead of a wrong turn, as today's "last 20 are all GitLab's own" rule (`discussions.rs:291-294`), which
  goes: with every note read, a resolvable discussion always has a person's note (facts §2, `resolvable?`).
- **Review mode after B5** (`reviewOrder.ts:39-64`): "waiting on the author" counts the discussions whose turn is
  `author`. The tooltip keeps its sentence, now exact: "Sorted for your review: due with your turn first, then fewest
  waiting on the author" (`reviewOrder.ts:77`). The row's author is already on `MergeRequestRow` (facts §2), so
  `reviewOrdered`'s rows type gains `author` and no caller changes.

### 1.3 C — the thread, its writes, its preview

- **No GraphQL field reads one discussion by id** (measured: `Query` has no `discussion`; `Query.note(id:)` is "Status:
  Experiment, introduced in 15.9"; `MergeRequest.discussions` takes only `after/before/first/last`). So **the thread is
  the discussions query for one iid**, the discussion picked by its `id`: measured score **46** of 200 for one merge
  request with every field (gitlab-org/cli !4292). One query, one parser, one source of truth for the box and the panel.
- **The id.** `Discussion.id` is `gid://gitlab/Discussion/<40 hex>` for every kind (measured); `replyId` varies
  (`IndividualNoteDiscussion`, `DiffDiscussion`, measured) and is not used. The 40 hex digits are the REST routes' and a
  draft's `discussion_id` (docs.gitlab.com/api/discussions, /api/draft_notes). The box gains it (`DiscussionId`; rows are
  keyed by index today, `MergeRequestDiscussions.vue:51-52`).
- **Edited, as GitLab means it.** `Note#last_edited_at` falls back to `updated_at`, and `edited?` is false unless the
  column or `updated_by` is set (`app/models/note.rb:533-545`), because resolving touches `updated_at`. Measured: a
  never-edited note has `lastEditedAt == createdAt`, `lastEditedBy: null`; two notes of a resolved discussion share
  `lastEditedAt 2026-11-03T13:12:59Z` with `lastEditedBy: null`. **Rule: edited when `lastEditedBy` is a person and
  `lastEditedAt` is after `createdAt`.** "by <name>" when that person is not the author (C3).
- **Permissions** (measured schema): `Discussion.userPermissions.resolveNote`, `MergeRequest.userPermissions.createNote`,
  `MergeRequest.discussionLocked` ("comments … locked to members only"). GitLab answers booleans, no reason; the window
  words them (§4 item 7).
- **Writes are one REST call each, all through `glab api --include --method … --input -`** (vision 5: one way to send,
  one reader of the answer):
  - reply: `POST projects/:id/merge_requests/:iid/discussions/:discussion_id/notes` `{ body }`;
  - draft reply: `POST …/draft_notes` `{ note, in_reply_to_discussion_id }`;
  - resolve / unresolve: `PUT …/discussions/:discussion_id` `{ resolved }`;
  - submit review: `POST …/draft_notes/bulk_publish` `{}` — "Publishes all pending draft notes for a merge request that
    belong to the user", no `reviewer_state` (non-goal).
    (docs.gitlab.com/api/discussions "PUT …/discussions/:discussion_id", "POST …/discussions/:discussion_id/notes";
    /api/draft_notes.) Rejected: GraphQL `createNote` (needs `noteableId`, the merge request's global id — one more read
    per reply; measured `CreateNoteInput`) and `discussionToggleResolve` (a second answer format beside REST). Drafts have
    **no** GraphQL mutation (measured: no `draft*` mutation in the schema), so REST is needed anyway.
- **The viewer's drafts**: `GET …/draft_notes` (`--paginate`) lists the logged-in user's drafts ("visible only to the
  author", /api/draft_notes): `discussion_id` and `note` (raw text, no HTML). The panel shows those of this discussion
  and counts all of them (C9).
- **Reading the HTTP answer.** `yamt-review` already parses `glab api --include` (`glab_answer.rs:25-72`) and GitLab's
  error body (`gitlab.rs:147-155`), crate-private, and `yamt-merge-requests` may not depend on it (PM1). Two users now:
  it moves to `yamt-gitio` (`HttpAnswer`, `Glab::send`), which needs `serde_json` (`crates/gitio/Cargo.toml:8-10` has
  none) — a shared edit (§3.3). RK33's duplicate rule stays in `yamt-review`; the panel's protection is §4 item 9.
- **Preview** (C7): GitLab's Markdown API `POST /markdown { text, gfm: true, project }` → `{ html }`
  (docs.gitlab.com/api/markdown; authenticated; one glab run plus the login check `[INFERENCE: about a second]`), reduced
  by `described_on` (`description.rs:326-332`) like a note. No GraphQL preview exists (measured: no `markdown*` query or
  mutation). Rejected: yamt's own Markdown subset (plan #112) — it would not match what GitLab renders (references,
  mentions, images).
- **Reusing the description reducer.** `described(html, base)` is not description-specific (facts §4); a note's
  `bodyHtml` and a preview's `html` go through `described_on` with the merge request's page as the base, so links,
  uploads (#173, #175), code colours, tables and image sizes come for free, offered by the shell as today
  (`offer_described`, `src-tauri/src/merge_requests.rs:106-109`). The types keep their `Description*` names: a comment's
  `body` is a `Description`, documented as "GitLab's rendering reduced to what yamt shows" (a rename of ~25 types across
  both layers would serve no reader).
- **The panel** is a DOM child of the box's hover area (`CiStatusBox.vue:183-190`), anchored at the box's left and top
  (`CiStatusBox.vue:53,68`, `CiStatusJobLog.vue:56-60`), `w-[min(40rem,calc(100vw-2rem))]
  h-[min(48rem,calc(100vh-2rem))]`. The hover rule needs one addition: **`useHoverBox` gains `pinned?: () => boolean`** —
  while pinned, leaving with the pointer or focus, a window blur and a scroll outside do not close the box; a pointer
  press outside the area closes it (C2). The CI log instead holds its box by focus (its field takes focus,
  `CiStatusJobLog.vue:101`), which a click on a comment's link would break: the browser takes the focus and `focusLeft`
  closes the box (`useHoverBox.ts:74-79`) `[INFERENCE: WebKit fires focusout on window deactivation]`.
- **Shift** is `useShiftTaps()` (`useShiftHeld.ts:63-67`) with the pointed or focused row, the box open and
  `!isTypingTarget(document.activeElement)`, as `CiStatusBox.vue:70-76`. The panel focuses its own root on open (not
  the field), so the next tap over another row switches (C1).
- **The growing field.** `field-sizing: content` is "newly available since 2026-06-16" across browsers
  (web-platform-dx web-features explorer), unmeasured on WebKitGTK 2.54, and `just app-session` has no command that
  evaluates script (its commands: click, press, type, scroll, hover, drag, read, shot, colours;
  `frontend/scripts/app-session/args.ts:182-213`), so its support could only be seen once the panel is in the window,
  one slice too late. **Decided: the height is measured** — on input and on mount the field's `height` is set from its
  `scrollHeight`, clamped to 3–12 lines (`line-height` × lines + padding), `overflow-y: auto` past 12 — about fifteen
  lines that work in any engine (vision 5). `field-sizing` rejected: unproven where yamt runs.
- **Fake glab** (`scripts/fake-glab/glab:244-262`, other routes answer 404, facts §5): new routes `POST
  */discussions/*/notes`, `PUT */discussions/*`, `POST */draft_notes/bulk_publish` (counted posts, `post-<n>`), `POST
  markdown` (not counted: no write), `GET */merge_requests/<iid>/draft_notes` → `draft-notes-<iid>.json` before
  `draft-notes.json`; and reads after a write: **any answer `<name>.json` is replaced by `<name>.after-post-<k>.json` for
  the largest k ≤ the posts answered so far**, so a thread read after a reply shows the reply.

### 1.4 D — one row reloaded

- **Through the existing queue, no second path.** `read_discussions([iid])` already answers one row
  (`discussions.rs:122-147`); the queue's `send` runs one call at a time with a generation (`mergeRequestDiscussions.ts:100-115`).
  `reloadDiscussions(iid)` puts the iid first among the queued asks and marks it `reloading`; the entry stays as it was
  until the answer (D2), a list refresh's `dropped` cancels it (`:137-142`).
- **The count.** The row's `openDiscussions` is replaced by the answer's open discussions' count through the slice's one
  row patcher (`withPeople`, `mergeRequests.ts:99-107`, generalised to `withRow`: `rows` and a buffering refresh's
  buffer), never by touching the list's load.

## 2. Options

The options differ in where the thread comes from, how writes travel and which side knows whose turn it is.

### Option A — one discussions read serves the box, the reload and the thread; writes are one REST call each; the core decides turns (recommended)

**Data structures** (Rust `yamt-merge-requests`, IPC by specta; the briefs hold the exact shapes):

- `DiscussionId` (40 lowercase hex; deserialises only that).
- `OpenDiscussion { id, place, earlier: TurnComment[], last: DiscussionNote }` — `earlier` the person comments before
  the last, oldest first (head + rest: never empty by construction); `TurnComment { author, mentions }`;
  `DiscussionNote` gains `mentions`; `Mention { username, name }`.
- `DiscussionThreadReply = read { thread } | notFound | glabMissing | notLoggedIn { detail } | failed { message }`;
  `DiscussionThread { discussion: OpenDiscussion, resolved, comments: DiscussionComment[], drafts: PendingDraft[],
  pending, commenting: allowed | locked | notAllowed, mayResolve }`; `DiscussionComment { author, createdAt, edited:
  NoteEdit { at, by } | null, body: Description, page }`.
- `ReplyKind = comment | draft`; `DiscussionWriteReply = sent | refused { reason } | glabMissing | notLoggedIn {
  detail } | failed { message }`; `MarkdownPreviewReply = read { preview: Description } | …`.
- `yamt-gitio`: `HttpAnswer { status, body }`, `Glab::send`.
- Window: the queue's read entry gains `resolved: ReadonlySet<DiscussionId>` (marks until the box closes), a
  `reloads` map; `ui/mergeRequestThread.ts` holds the one shown thread, the reply texts by discussion, the send state
  and the preview; the core's `Turn = viewer | author | person { name } | waiting | open`.

**Flow:** the box's batch reads every person note with its mentions; the core orders and words turns for the viewer and
the row's author. A Shift tap shows a thread: the window asks `read_discussion_thread` (the same query for the one iid,
the viewer's drafts by REST), the panel renders GitLab's HTML through the description renderers, and the answer's
`discussion` replaces the box's row (C8.3). A write is one REST call; on `sent` the window reads the thread again; a
submit also reloads the row. A resolve marks the row; closing the box drops marked rows and sets the count.

**Files:** about 75 across ten slices (§5).

**Risks:**

- Heavier batches (§1.2): measured score fine, time unmeasured; the batch size is the one tunable.
- A timed-out write may have landed; a second press could duplicate it (RK71; §4 item 9).
- GitLab renames the user link's attributes: mentions vanish and turns fall back to B3.2/B3.3 — visible, never "Your
  turn" wrongly (the owner check catches it).
- REST paths take the project path `%2F`-encoded, as the job log does (`job_log.rs`, facts §5); a discussion id is
  validated before it enters a path.

**Tests:** Rust unit tests for mentions, `earlier`/`last`, the 200-note rule, edits, the thread pick, drafts, every
write's argv and body and answer, the preview; app tests over the fake (one post per write, refusals, offers); core
tests for every B case by name and review order; window tests for the queue's reload, marks and count, the thread
state, sends, texts and preview; SSR tests for the panel; WebKit and the real app (`mr-threads-verify`).

**Visions:** 2 (one read, one builder of `OpenDiscussion`, one row patcher, one HTTP reader), 4 (sum types for turns,
replies, sizes, permission; head + rest), 1 (the turn rule in TS), 5 (no dependency beyond `serde_json` in `gitio`; REST
only for writes), 3 (ids validated at the boundary; pages offered before replies).

### Option B — a thread read of its own by note, GraphQL mutations, mentions from the raw text

**Data structures:** the box keeps `notes(last: 20)` raw bodies; the core finds `@username` in the text; the thread is
`Query.note(id:) { discussion { notes(first: 200) { … bodyHtml } } }` by the last note's id; replies through
`createNote(noteableId, discussionId)` after a `mergeRequest { id }` read, resolves through `discussionToggleResolve`,
drafts and submit through REST.

**Risks:** `Query.note` is an experiment (measured) and may change without notice; raw mentions count code spans, e-mail
addresses and unknown names (§1.2); B2.1 needs the first note, not in the last 20 of a long thread; two write formats
(GraphQL `errors` and HTTP statuses); a reply costs two calls.

**Tests:** as A, plus the raw-mention parser.

**Visions:** 5 (a lighter batch: no `bodyHtml` in it). Costs 2 (GitLab's mentions and the raw reader can disagree) and 3
(an experiment field as the one way to the thread).

### Option C — Rust decides the turn per viewer and answers words

**Data structures:** `read_discussions(iids, viewer)` answers each discussion's `turn` (and words) for one viewer; the
thread reply carries the reasons for disabled buttons as text.

**Risks:** review mode changes the viewer per reviewer (#165), so every reviewer switch re-asks GitLab for every row, or
Rust sends every author anyway; the rule a TS owner reads moves into Rust (vision 1); the core's words and Rust's words
split.

**Visions:** 3 (the window never sees mentions). Costs 1 and 2.

## 3. Recommendation

**Option A.** One GraphQL read of a merge request's discussions answers the box, a row's reload and a thread; the core
turns GitLab's facts into the one turn rule; four REST writes through one HTTP reader; GitLab renders previews and
comments, the description's reducer and renderers show them.

**Cost:**

- One dependency edge (`yamt-gitio` → `serde_json`, already in the workspace); no new crate or package.
- Five commands (`read_discussion_thread`, `reply_to_discussion`, `resolve_discussion`, `submit_review`,
  `preview_markdown`), five source methods.
- Ten implementer slices and a verifier; at most two at once (§5).
- Heavier discussion batches (§1.2); four glab runs per thread open (login, project, discussions, drafts), three per
  write (login, project, write), then a thread read.

### 3.1 Proposed plan §2 rows (DR5: the orchestrator records them; next free #179)

| #   | **Decision**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Rejected alternatives & why                                                                                                                                                   | Vision  |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| 179 | **A discussion's turn is the core's rule over every person comment and GitLab's mentions** (owner #2330, #2334; request parts B1–B6; design `briefs/mr-threads-design.md` option A; replaces #163's turn rule and amends #162). The discussions query reads `notes(first: 200)` with `bodyHtml`, the discussion `id`, `userPermissions { resolveNote }`, the merge request's `discussionLocked`, `userPermissions { createNote }` and each note's `lastEditedAt`/`lastEditedBy` (88 of 200 logged out for 20 rows, measured). `OpenDiscussion { id: DiscussionId, place, earlier: TurnComment[], last: DiscussionNote }`, `TurnComment { author, mentions }`, `DiscussionNote.mentions`, `Mention { username, name }` = each `a[data-reference-type="user"][data-user]` of a person note's `bodyHtml` (href's last segment, `title`), never a group or `@all`. More than 200 notes → the row `Failed`. `turnOf(discussion, viewer, author)`: B1 → `author` (viewer not the author) or the starter's `person` / `waiting` (viewer the author); B2 (the viewer started, is mentioned by someone else, is the author, or took part) → `viewer`; B3 first of: the last comment's first mention other than its writer (`author` when that is the author), `author`, the starter's `person`, `open`; a deleted person is never viewer, author or mentioned. Words "Your turn"/"<name>'s turn", "Author's turn", "<Name>'s turn", "Waiting for an answer", "Open"; header counts the viewer's turn; order the viewer's turn first, newest last comment first. `reviewOrdered` counts `author` turns as "waiting on the author" (amends #165). | B (raw `@name` in the text: counts code spans, measured; `Query.note` an experiment), C (Rust per viewer: review mode re-asks per reviewer)                                   | 1, 2, 4 |
| 180 | **A discussion's thread is the same query for one merge request, picked by id; a comment is GitLab's rendering through the description's reducer; the viewer's drafts by REST** (owner #2331, #2333; request C3–C5, C9; reopens #112 for the panel, #162's "last person's note only", request-mr-discussions rules 2 and 5 for the panel). `read_discussion_thread(iid, discussion) -> DiscussionThreadReply` read { thread: DiscussionThread { discussion, resolved, comments: DiscussionComment { author, createdAt, edited: NoteEdit { at, by } \| null (`lastEditedBy` set and `lastEditedAt` after `createdAt`, as `Note#edited?`), body: Description (`described_on` of `bodyHtml`), page }[], drafts: PendingDraft { text }[], pending, commenting: allowed \| locked \| notAllowed, mayResolve } } \| notFound \| glabMissing \| notLoggedIn \| failed: login, project, the discussions query for `[iid]` (every page), `GET …/draft_notes --paginate`; system notes left out; every comment's and link's page, upload and picture offered before the reply. Asked afresh at every open, after every write and with a row reload.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | `Query.note(id:)` (experiment, measured); REST `GET …/discussions/:id` (raw bodies only, no edit author)                                                                      | 2, 3    |
| 181 | **Replies, draft replies, resolves and the review's submit are one REST call each through `glab api --include --method … --input -`, read by `yamt-gitio`'s `HttpAnswer`** (owner #2331, #2333; request C8–C10; amends #118: draft notes are also posted by `yamt-merge-requests`; RK54 amended; adds `serde_json` to `yamt-gitio`). `reply_to_discussion(iid, discussion, kind: comment \| draft, text)`: `POST …/discussions/<id>/notes { body }` or `POST …/draft_notes { note, in_reply_to_discussion_id }`; `resolve_discussion(iid, discussion, resolve)`: `PUT …/discussions/<id> { resolved }`; `submit_review(iid)`: `POST …/draft_notes/bulk_publish {}` (no `reviewer_state`, no approval) → `DiscussionWriteReply` sent (2xx) \| refused { reason } (4xx, GitLab's `message`/`error`, else "HTTP <code>") \| glabMissing \| notLoggedIn \| failed (no HTTP answer, a 5xx, glab's words); an empty text refused before any glab run. `yamt-gitio` `Glab::send` + `HttpAnswer::gitlab_message` replace `yamt-review`'s `http_answer_from`/`error_message_from` (its `posted` keeps its own outcomes). Always the logged-in user's writes, also in review mode.                                                                                                                                                                                                                                                                                                                                                                                                                                                               | GraphQL `createNote` (needs the merge request's global id: a second call) and `discussionToggleResolve` (a second answer format); no GraphQL draft mutation exists (measured) | 2, 5    |
| 182 | **Preview is GitLab's Markdown API** (request C7). `preview_markdown(iid, text) -> MarkdownPreviewReply` read { preview: Description } \| glabMissing \| notLoggedIn \| failed: `glab api markdown --method POST --input -` with `{ text, gfm: true, project: <full path> }`, `described_on` of its `html`, pages and uploads offered; an empty text reads as no blocks without glab.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | yamt's Markdown subset (#112: would not match GitLab's references, mentions, images)                                                                                          | 2       |
| 183 | **The thread panel, the pinned box and the reload** (request C1, C2, C6–C11, D1–D3). The panel (`ui/MergeRequestThread.vue`) is a DOM child of the discussions box's hover area, left of the box, tops aligned, `min(40rem, 100vw − 2rem)` × `min(48rem, 100vh − 2rem)`, comments scrolling, field and buttons fixed at its bottom; opened by a Shift tap over or on a row (`useShiftTaps`, `isTypingTarget`), focus to its root; `useHoverBox` gains `pinned` (while the panel is open: no close on leave, blur or outside scroll; a press outside closes both); Escape closes the panel (focus to its row), then the box. `ui/mergeRequestThread.ts`: one shown thread (`loading \| read \| refused \| failed`, a generation), reply texts by `DiscussionId` for the window's life (cleared on `sent`), one send at a time, the preview. The field grows from 3 to 12 lines by its measured `scrollHeight`. The queue: `reloadDiscussions(iid)` through the one queue (rows kept while it runs; a failure keeps them and says why), a read entry's `resolved` marks (from thread answers) dropped with their rows when the box closes, the row's count set through `withRow` (the one row patcher) by a reload or that drop.                                                                                                                                                                                                                                                                                                                                                                                                         | the CI log's focus hold (a link click blurs the window and closes the box); a second load path for one row; `field-sizing: content` (unproven on WebKitGTK 2.54)              | 2, 4    |
| 184 | **Image sizes** (owner #2329; request A1–A3; amends description request rule 5). `DescriptionInline::Image.size: ImageSize \| null` = width \| height \| both of `ImageLength` pixels \| percent, GitLab's `\A\d{1,4}(%\|px)?\z` only; the window's `imageStyle(size, natural)`: width as given, capped at the column with proportions; height only scaled from the natural ratio after load; both by their ratio; a percentage height ignored (CSS 2.1 §10.5, as on GitLab).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | CSS `height` + `max-width` alone (squashes a capped picture)                                                                                                                  | 4       |
| 185 | **Defaults decided with the threads design** (orchestrator, OR13; the owner may veto): §4 of the design.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | —                                                                                                                                                                             | —       |

### 3.2 Risks for the register (`skill://risk-register`; next free id RK71)

| id             | risk                                                                                                                                                                                                                                              | owner                                                                                                                                                 | proving test                                                                                                                                                                                                       |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| RK33 (amended) | … as today, **plus**: a panel write retried after a timeout or a failure posts a duplicate reply or draft                                                                                                                                         | as today + `ui/mergeRequestThread.ts` (one send at a time; after a failure that was not a refusal the thread is read again before the buttons enable) | as today + `a_failed_send_reads_the_thread_again_before_another_send`, `a_second_send_while_one_runs_sends_nothing`                                                                                                |
| RK41 (amended) | … **or a link, a comment's page or a preview's link in the thread panel that its `read_discussion_thread` or `preview_markdown` reply did not name**                                                                                              | as today + `src-tauri` `merge_requests/thread.rs` (offered before the reply)                                                                          | as today + `a_threads_pages_and_uploads_are_offered_before_the_reply`, `a_previews_pages_are_offered_before_the_reply`                                                                                             |
| RK53 (amended) | … **or an upload a comment or a preview names, fetched without being offered**                                                                                                                                                                    | as today + `merge_requests/thread.rs`                                                                                                                 | `a_threads_pages_and_uploads_are_offered_before_the_reply`                                                                                                                                                         |
| RK54 (amended) | … **or yamt writes anything to a merge request's discussions but, per press, one reply, one draft reply, one resolve or unresolve of that discussion, or one `bulk_publish`; a write with an empty text; a preview or a thread read that writes** | as today + `discussion_thread/write.rs` (one `Glab::send` per call, the body from `query.rs`) + `markdown_preview.rs`                                 | as today + `each_write_sends_one_call_with_its_body`, `an_empty_reply_runs_no_glab`, `reading_a_thread_writes_nothing`, `a_preview_writes_nothing` + app `each_panel_write_is_one_post`                            |
| RK60 (amended) | a click on a discussion opens an address GitLab did not give for that note, or **the box's excerpt** is interpreted as markup; **the panel shows a comment only through the description's reducer**                                               | as today + `discussion_thread/read.rs` (`described_on`)                                                                                               | as today + `a_comments_html_reaches_the_window_only_as_blocks`                                                                                                                                                     |
| RK61 (amended) | a system note shown as a comment or counted in a turn, or details asked while the setting is "Off"                                                                                                                                                | `discussions.rs` (person notes only, for `earlier`, `last` and the thread) + the queue                                                                | as today + `a_system_note_is_no_comment_of_the_thread`, `system_notes_count_in_no_turn`                                                                                                                            |
| RK66 (amended) | … **a comment's or a preview's markup** … (the same rule for every rendering through `described`)                                                                                                                                                 | as today                                                                                                                                              | as today + `a_planted_handler_in_a_comment_is_left_out`                                                                                                                                                            |
| RK71           | a turn shown for the wrong person: a group, `@all`, a code span or a deleted user counted as a mention; the viewer's own mention of themself counted; a discussion over 200 notes shown with a wrong starter; an author not known as the author   | `discussions/mentions.rs` + `discussions.rs` (`earlier`, the 200 rule) + core `turnOf`                                                                | `only_a_user_link_with_data_user_is_a_mention`, `a_discussion_over_200_notes_fails_its_row`, each B case by name in `discussions.test.ts`                                                                          |
| RK72           | the box loses a resolved row before it closes, keeps one after, shows a count the reload did not answer, applies a reload answered after a list refresh, or shows a thread answer for a discussion no longer shown                                | `ui/mergeRequestDiscussions.ts` (marks, `boxClosed`, generation) + `ui/mergeRequests.ts` `withRow` + `ui/mergeRequestThread.ts` (generation)          | `a_resolved_row_stays_until_the_box_closes_then_the_count_drops`, `a_reload_keeps_the_rows_until_its_answer`, `a_reload_after_a_refresh_is_dropped`, `an_answer_for_a_thread_no_longer_shown_changes_only_the_box` |
| RK73           | the panel closes under the user (pointer leaving, a link click, a scroll), a Shift typed in the field switches the thread, a chord opens one, or Escape closes the box before the panel                                                           | `ui/useHoverBox.ts` (`pinned`) + `MergeRequestDiscussions.vue` (`isTypingTarget`, `useShiftTaps`) + `MergeRequestThread.vue` (its own Escape)         | `a_pinned_box_stays_when_the_pointer_and_focus_leave`, `a_press_outside_closes_a_pinned_box`, WebKit recipe "C2 What stays open", "C1 Shift"                                                                       |

RK59 (Shift chords) covers the new tap through `useShiftTaps` unchanged; its proving tests stand.

### 3.3 Shared edits (the orchestrator or the docs keeper applies them; no slice owns them)

- **Before `mr-threads-http`:** `crates/gitio/Cargo.toml` gains `serde_json.workspace = true` (row #181; `Cargo.lock`
  changes by a `cargo` run, no new package).
- **After `mr-threads-app`, committed together with `mr-threads-state-ipc`:** `just bindings`. It brings `DiscussionId`,
  `Mention`, `TurnComment`, the new fields of `OpenDiscussion`/`DiscussionNote`, `ImageSize`, `ImageLength`,
  `DescriptionInline`'s `size`, `DiscussionThreadReply`, `DiscussionThread`, `DiscussionComment`, `NoteEdit`,
  `PendingDraft`, `Commenting`, `ReplyKind`, `DiscussionWriteReply`, `MarkdownPreviewReply` and five commands. **Not a
  pure addition**: the fixtures build `Generated.OpenDiscussion` and description inlines, so the frontend type check is
  red until `mr-threads-state-ipc` lands; hand the regenerated file to that slice's workspace.
- Plan rows #179–#185 (§3.1); risk rows RK33, RK41, RK53, RK54, RK60, RK61, RK66 amended, RK71–RK73 (§3.2).
- **Docs keeper, once after `mr-threads-box`:**
  - `docs/architecture.md`: §3.2 (`gitio`'s `Glab::send`, `HttpAnswer`); §3.8 (`yamt-review`'s `posted` on it); §3.9 a
    "Threads" paragraph (the query's new fields and score, the thread pick, the drafts, the four writes, the preview,
    the offers) and "Discussions" amended (mentions, `earlier`, the 200 rule, image sizes in "Description"); §4 the five
    commands and source methods; §5.1 state rows (reply texts, the shown thread, the queue's marks and reloads); §5.4
    the panel and the pinned box.
  - `.omp/skills/ipc-contract/SKILL.md`: the five commands; `read_discussions`' new shape; `readDiscussionThread`,
    `replyToDiscussion`, `resolveDiscussion`, `submitReview`, `previewMarkdown`.
  - `skill://project-map/tree.md`: `discussions/mentions.rs`, `discussion_thread.rs`, `discussion_thread/{read,write,
    drafts,tests}.rs`, `markdown_preview.rs`, `crates/gitio/src/glab/http.rs` (if the slice makes it a file),
    `src-tauri/src/merge_requests/thread.rs` + test; `ipc/fixtureMergeRequestThreads.ts`, `ui/mergeRequestThread.ts`,
    `ui/MergeRequestThread.vue`, `ui/MergeRequestThreadComment.vue`, `ui/MergeRequestReplyField.vue`,
    `ui/mergeRequestThreadText.ts`, `ui/mergeRequestImageSize.ts`.
  - `skill://project-map/state.md`: reply texts and the shown thread (`ui/mergeRequestThread.ts`, its only writer);
    the queue's marks and reloads; the row count's second writer (`withRow`, after the list).
  - `tests/glab/README.md` is `mr-threads-fixtures`'; `CHANGELOG.md` one line; the lines slices hand on in
    `deviations_from_brief`.
  - `docs/slices/request-mr-discussions.md` and `request-mr-description.md`: a "Reopened by
    `request-mr-threads.md`" note beside the rules it reopens.

## 4. Decided without the owner (row #185; the owner may veto)

1. **A mention of the author is the author's turn.** When the last comment's first mention (B3.1) is the merge
   request's author, the row reads "Author's turn", so review mode's "waiting on the author" (B5) counts it. Refines
   B3.1's "the first one mentioned".
2. **A percentage height is ignored**, as browsers ignore it on GitLab's page (§1.1). Refines A1.
3. **Pending drafts show their text as written**, plain, with "Pending": GitLab's draft list answers no rendering, and
   rendering each would cost a call per draft per open.
4. **Writes are always yours.** In review mode for another reviewer the turn words speak for that reviewer, but "Add
   comment", "Add review" and "Submit review" post as the logged-in user and the pending count is yours.
5. **A pinned box ignores scrolling.** While the panel is open the box and panel stay where they are when the list
   scrolls (C2's "whatever the pointer does"); a press outside closes both.
6. **A discussion with more than 200 notes** fails its row with one sentence instead of showing a wrong turn.
7. **Words.** Panel header: the place, the turn words (or a check and "Resolved"), "Open on GitLab" (Lucide
   `external-link`), "Submit review" with "3 pending" (tooltip "Publish your 3 pending comments on this merge request";
   one: "Publish your pending comment on this merge request"), "Close" (Lucide `x`). A draft: "Pending". Disabled
   buttons: "Comments on this merge request are locked to project members." (GitLab's `discussionLocked` description),
   "You may not comment on this merge request.", "You may not resolve this thread.". Failures: "Could not add the
   comment: …", "Could not add the review comment: …", "Could not resolve the thread: …", "Could not unresolve the
   thread: …", "Could not submit the review: …", "Could not read the thread: …" with Retry, "This discussion is no longer
   on GitLab.", "Could not preview: …". The box: refresh button "Reload discussions"; a row's tooltip "Shift: show the
   thread"; a resolved row a check and "Resolved".
8. **Ctrl+Enter adds the comment**; Enter types a line. A Shift tap over the row already shown does nothing.
9. **After a failed send that was not GitLab's refusal** (a timeout may still have landed) the thread is read again and
   the text stays, so the user sees whether it arrived before pressing again.
10. **The box stays while its panel is open** even when a reload leaves the row with no open discussion (D3's
    "Resolved" panel keeps its text); it goes when the box closes.
11. **No viewer, no "Your turn".** When glab names no user (the viewer is null), no discussion is the viewer's turn
    (B1 and B2 need a viewer); B3 decides the words. Today's rule made every discussion the viewer's turn then
    (`mergeRequests/internal/discussions.ts:34-36`).
12. **A deleted starter has no turn** (B6): when the viewer is the author, wrote last and the starter's account is
    deleted, the row reads "Waiting for an answer"; in B3.3 it falls to B3.4 "Open".
13. **Clicking a row still opens its comment on GitLab** (today's rule, `MergeRequestDiscussions.vue:88-92`); Shift
    shows the thread.

## 5. Slice graph

| wave | brief                                                                                                                                                                                   | owner        | needs                     | beside                |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ | ------------------------- | --------------------- |
| 1    | `mr-threads-fixtures.md` (fake glab routes, after-post answers, scenarios `mr-threads`, `mr-threads-refused`, new fields in `mr-discussions`/`mr-review-mode`, description !54, README) | rust-impl    | rows #179–#184            | `mr-threads-http`     |
| 1    | `mr-threads-http.md` (`gitio` `HttpAnswer`, `Glab::send`; `yamt-review` migrated)                                                                                                       | rust-impl    | shared edit `serde_json`  | `mr-threads-fixtures` |
| 2    | `mr-threads-images.md` (Rust image sizes)                                                                                                                                               | rust-impl    | fixtures                  | —                     |
| 3    | `mr-threads-crate.md` (turn data, mentions, 200 rule, thread read, drafts, four writes, preview, query texts, lib.rs)                                                                   | rust-impl    | fixtures, http, images    | —                     |
| 4    | `mr-threads-app.md` (five commands, offers, app tests over the fake)                                                                                                                    | rust-impl    | crate                     | —                     |
| —    | orchestrator: `just bindings` (committed with state-ipc)                                                                                                                                | orchestrator | app                       | —                     |
| 5    | `mr-threads-state-ipc.md` (source methods, domain, brands, tauri, fixtures incl. stateful threads and sized images)                                                                     | web-impl     | app + bindings            | —                     |
| 6    | `mr-threads-state-ui.md` (queue reload, marks, count; thread state, texts, sends, preview; `withRow`; problem steps)                                                                    | web-impl     | state-ipc                 | —                     |
| 7    | `mr-threads-panel.md` (panel components, field, Write/Preview, buttons, words, image sizing)                                                                                            | web-impl     | state-ui                  | —                     |
| 8    | `mr-threads-box.md` (core turn rule and review order; the box's words, refresh, marks, Shift, pinned hover; **wires the window**)                                                       | web-impl     | panel                     | —                     |
| 9    | docs keeper                                                                                                                                                                             | docs-keeper  | box                       | verify's smoke        |
| 9    | `mr-threads-verify.md`                                                                                                                                                                  | verifier     | box (smoke); docs (final) | docs keeper           |
| 10   | owner check on the playground                                                                                                                                                           | human        | verify                    | —                     |

Owned globs are pairwise disjoint; no slice owns a shared or generated file (`.omp/hooks/lib/policy.ts:18-40`). At most
two implementers run at once (wave 1 only). `mr-threads-box` wires the window: its WebKit and real-app run is the
feature's first end-to-end proof.

### Rule coverage (each rule's one owning acceptance; other briefs only support it)

| request item                                                                                                | owning brief and acceptance                                                                                                                                   |
| ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1 size kept (px, %, bare; width/height/both)                                                               | `mr-threads-panel`: `imageStyle` cases + WebKit step "A Sizes"                                                                                                |
| A2 never wider than the panel                                                                               | `mr-threads-panel`: `a_size_wider_than_the_column_shrinks_with_its_proportions` + WebKit "A Sizes"                                                            |
| A3 nothing else changes (no size, bad form, stand-in)                                                       | `mr-threads-images`: `a_size_outside_gitlabs_form_is_ignored`, `an_image_without_size_has_none`                                                               |
| B1 waiting on someone else                                                                                  | `mr-threads-box`: `b1_*` core tests                                                                                                                           |
| B2 the viewer's turn (1–4)                                                                                  | `mr-threads-box`: `b2_*` core tests                                                                                                                           |
| B3 someone else's turn (1–4)                                                                                | `mr-threads-box`: `b3_*` core tests                                                                                                                           |
| B4 header and order                                                                                         | `mr-threads-box`: `b4_header_counts_only_the_viewers_turn_and_orders_them_first`                                                                              |
| B5 one rule everywhere (review order, words)                                                                | `mr-threads-box`: `b5_review_order_counts_authors_turns_as_waiting_on_the_author`                                                                             |
| B6 a deleted person                                                                                         | `mr-threads-box`: `b6_a_deleted_person_is_never_viewer_author_or_mentioned`                                                                                   |
| C1 opening by Shift, switching, typing, mark, tooltip                                                       | `mr-threads-box`: WebKit "C1 Shift"                                                                                                                           |
| C2 what stays open, Escape order, close button, press outside                                               | `mr-threads-box`: `useHoverBox` pinned tests + WebKit "C2 What stays open"                                                                                    |
| C3 header, comments, picture, name, @username, crown, ago, edited                                           | `mr-threads-panel`: SSR `the_comment_header_*` tests                                                                                                          |
| C4 formatted as GitLab (code, table, image, links, suggestion)                                              | `mr-threads-panel`: SSR `a_comment_renders_gitlabs_blocks`                                                                                                    |
| C5 fresh at every open, Loading, failure + Retry, every comment                                             | `mr-threads-state-ui`: `each_open_reads_the_thread_afresh`, `a_failed_read_retries`                                                                           |
| C6 the field: placeholder, grows 3→12 lines, text kept per discussion                                       | `mr-threads-box`: WebKit "C6 Field" (the first slice with the panel in the window; panel SSR and state-ui `texts_are_kept_per_discussion_until_sent` support) |
| C7 Write / Preview                                                                                          | `mr-threads-panel`: SSR `preview_shows_loading_then_blocks_and_nothing_for_empty` (verify re-runs it in WebKit)                                               |
| C8 buttons row, add comment, add review, disabled, success, failure                                         | `mr-threads-panel`: SSR `the_buttons_row_*`, `a_failed_send_says_why_under_the_row` (verify re-runs it in WebKit)                                             |
| C9 submit review: count, publish all, reload, failure                                                       | `mr-threads-state-ui`: `submit_publishes_then_reloads_the_thread_and_the_row`, `a_failed_submit_keeps_the_drafts_pending`                                     |
| C10 resolve/unresolve, the row stays until close, count drops, disabled with reason                         | `mr-threads-box`: WebKit "C10 Resolve" (state-ui tests support)                                                                                               |
| C11 settings                                                                                                | `mr-threads-box`: WebKit "C11 Off"                                                                                                                            |
| D1 the refresh button reloads one row                                                                       | `mr-threads-box`: WebKit "D1 Refresh" (fixture log)                                                                                                           |
| D2 rows stay while loading, new answer, count set, failure                                                  | `mr-threads-state-ui`: `a_reload_keeps_the_rows_until_its_answer`, `a_reload_sets_the_rows_count`, `a_failed_reload_keeps_the_rows_and_says_why`              |
| D3 an open panel reloads with the row; "Resolved" keeps the text                                            | `mr-threads-state-ui`: `a_reload_reads_the_shown_thread_again`, `a_thread_resolved_elsewhere_reads_resolved_and_keeps_its_text`                               |
| Acceptance: Rust — image sizes                                                                              | `mr-threads-images` (descriptions); `mr-threads-crate` `a_notes_image_keeps_its_size`                                                                         |
| Acceptance: Rust — turn data arrives; one row reloads alone                                                 | `mr-threads-crate` integration `tests/discussions.rs`                                                                                                         |
| Acceptance: Rust — a thread whole with edits and drafts; each write one call; refusals with GitLab's reason | `mr-threads-app` (over the fake)                                                                                                                              |
| Acceptance: core tests B1–B6, review order                                                                  | `mr-threads-box`                                                                                                                                              |
| Acceptance: WebKit dark and light; real app; `just check`                                                   | `mr-threads-verify` A–C (smoke parts in `mr-threads-box`)                                                                                                     |
| Acceptance: owner check on the playground                                                                   | `mr-threads-verify` "Owner check"                                                                                                                             |
