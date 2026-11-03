## Discussion details: facts for the design

**How I got these facts.** I had no shell, so I ran no `glab` command. Instead I sent read-only GraphQL **queries** as plain HTTP GETs to `https://gitlab.com/api/graphql?query=…`, without logging in. I also read GitLab's master source on gitlab.com and the yamt repo.
- The complexity score is computed from the query text before it runs. The baseline below came out at exactly **170**, the same as the logged-in measurement of 2026-11-02 (`query.rs:34-38`), so the scores carry over to a logged-in run.
- Only the limit differs: **200** when logged out, **250** when logged in (`app/graphql/gitlab_schema.rb:4-5,214-221`).
- **The playground could not be read.** `project(fullPath: "samubr/glab-yamt-playground")` answered `null` when logged out, so it is private or hidden. Whether it has discussions is UNKNOWN. Section 3 uses the public project `gitlab-org/cli` instead.

---

### 1. GitLab GraphQL schema

Field lists come from the live gitlab.com schema the endpoint sent back (one introspection answer, saved during the session), checked against GitLab master source.

**`MergeRequest.discussions`**
- Arguments: only `after`, `before`, `first`, `last`. Type `DiscussionConnection!`, described as "All discussions on the noteable."
- It is a plain field with no resolver and no `max_page_size` (`app/graphql/types/notes/noteable_interface.rb`: `field :discussions, Types::Notes::DiscussionType.connection_type`). The schema-wide default page cap is 100 (`gitlab_schema.rb:33`, `default_max_page_size 100`).
- **No server-side filter for unresolved or resolvable discussions.**
- It returns every discussion, including each system note as its own one-note discussion with `resolvable: false`. Observed on gitlab-org/cli !4272: "assigned to @jmrp", "marked this merge request as **ready**", "requested review from @jay_mccure" each came back as a separate discussion.

**Other `MergeRequest` fields that touch discussions:**

| field | arguments | notes |
|---|---|---|
| `notes` | `filter: NotesFilterType = ALL_NOTES` (`ALL_NOTES`, `ONLY_COMMENTS`, `ONLY_ACTIVITY`), `after`, `before`, `first`, `last` | A flat list of notes, not grouped. Resolver: `resolvers/noteable/notes_resolver.rb` |
| `discussionsWithActivity` | `filter: NotesFilterType = ALL_NOTES`, `sort: WorkItemDiscussionsSort = CREATED_ASC`, `after`, `first` | "Introduced in GitLab 19.2: Status: Experiment". Forward-only paging. Includes synthetic system notes. `calls_gitaly!`, multiplier 0.05 (`resolvers/notes/discussions_resolver.rb`) |
| `resolvableDiscussionsCount`, `resolvedDiscussionsCount` | — | "Number of user discussions that are resolvable / resolved" (`merge_request_type.rb:188-191`) |
| `userDiscussionsCount` | — | Has a resolver (`merge_request_type.rb:192-194`) |

**`Discussion` fields** (live schema; `types/notes/discussion_type.rb`, `base_discussion_interface.rb`, `resolvable_interface.rb`):
- `createdAt: Time!`, `id: DiscussionID!`, `replyId`, `noteable`
- `notes(after, before, first, last): NoteConnection!` — "All notes in the discussion.", `max_page_size: 200`. **No `filter` argument.**
- `resolvable: Boolean!`, `resolved: Boolean!`, `resolvedAt`, `resolvedBy: UserCore`
- `truncatedDiffLines` (`calls_gitaly`), `userPermissions`
- `NoteConnection` has `count`, `edges`, `nodes`, `pageInfo` (live schema).

**`Note` fields** (live schema; `types/notes/note_type.rb`, `base_note_interface.rb`):
- `system: Boolean!` — "Indicates whether the note was created by the system or by a user."
- `author: UserCore`; `UserCore` has `username`, `name`, `avatarUrl` ("URL of the user's avatar.") and `bot` ("Indicates if the user is a bot.").
- `body: String!` (the raw note text); `bodyHtml` exists, nullable, `calls_gitaly: true`; `bodyFirstLineHtml` also exists.
- `createdAt: Time!`, `updatedAt`, `lastEditedAt`
- `url: String` — "URL to view the note in the Web UI."; built as `merge_request_url(noteable, anchor: dom_id(note))` (`lib/gitlab/url_builder.rb:100-114`).
- `id`, `resolvable`, `resolved`, `internal`, `discussion`, `systemNoteMetadata`, `systemNoteIconName`
- `position: DiffPosition` with `filePath: String!`, `newPath`, `oldPath`, `newLine`, `oldLine`, `positionType: PositionTypeEnum!`, `diffRefs`, plus `x`/`y`/`width`/`height` for images. `newLine`/`oldLine` are null unless the position is on text (`diff_position_type.rb`).

**Can `notes(last: N)` skip system notes?** **No.** `Discussion.notes` takes only connection arguments (live schema, `discussion_type.rb`). The only fields with a `filter` are `MergeRequest.notes` and `MergeRequest.discussionsWithActivity`. What `ONLY_COMMENTS` leaves out exactly (`NotesFinder` `notes_filter`) is `[INFERENCE]`: user notes only. I did not check it against data.

**Can a resolvable discussion contain system notes? Yes.**
- **Source:**
  - `app/models/concerns/resolvable_discussion.rb` `update`: "Do not select `Note.resolvable`, so that system notes remain in the collection".
  - `app/services/system_notes/merge_requests_service.rb:60-84` `diff_discussion_outdated` creates `system: true` notes ("changed this line in version N of the diff") with `discussion.reply_attributes`, so they land inside the diff discussion.
- **Observed:**
  - gitlab-org/cli !4292, open discussion `b59f6542…` (`resolvable: true, resolved: false`): its notes are a person's comment, then a **system** DiffNote "changed this line in [version 2 …]", then a person's reply.
  - Discussion `1d3cb881…` (resolved) has that system note as its **last** note. So `notes(last: 1)` can return a system note.
- The system note's `author` is the person who pushed (`vertisan`), not a bot. Only `system` tells it apart.
- **A resolvable discussion always has at least one person's note:** `resolvable?` = `potentially_resolvable? && notes.any?(&:resolvable?)` (`resolvable_discussion.rb`), and `Note#resolvable?` = `potentially_resolvable? && !system?` (`resolvable_note.rb`).
- How many notes back the last person's note sits is unbounded: one "outdated" system note is added per push that changes the line (`[INFERENCE]` from `diff_discussion_outdated`).
- Bot accounts (`gitlab-bot`, `GitLabDuo`) write non-system notes (observed in !4272 and !4292). `UserCore.bot` exists if the design needs it.

**Discussion order:** `Discussion.build_collection` groups notes with `group_by` in note order (`app/models/discussion.rb:47-50`). The observed answers were in ascending creation time. Ascending-by-creation as the rule is `[INFERENCE]`.

---

### 2. Complexity (measured on gitlab.com, logged out; scores are text-only)

| # | Query | Score (verbatim) |
|---|---|---|
| 0 | `list_query()` exactly as in `query.rs:40-64`, literal `fullPath`, `first: 100` | `"score": 170, "limit": 200` |
| a1 | 0 + `discussions(first: 100) { nodes { resolvable resolved notes(last: 1) { nodes { system author { username name avatarUrl } body createdAt url position { filePath newPath oldPath newLine oldLine positionType } } } } }` inside MR `nodes` | `"Query has complexity of 212, which exceeds max complexity of 200"` |
| a3 | same, `notes(last: 3)` | `… complexity of 212 …` |
| a5 | same, `notes(last: 5)` | `… complexity of 212 …` |
| a′ | a3 + `pageInfo { hasNextPage endCursor }` and `id` on discussions, `pageInfo { hasPreviousPage }` on notes, note `id` | `… complexity of 226 …` |
| b1 | `queryComplexity` + `project { mergeRequests(state: opened, sort: CREATED_DESC, first: 100) { pageInfo { hasNextPage endCursor } nodes { iid <discussions block, last: 1> } } }` | `"score": 60` |
| b5 | b1 with `last: 5` | `"score": 60` |
| c1 | `project { mergeRequest(iid: "1") { <discussions block, last: 1> } }` | `"score": 26` |
| c5 | c1 with `last: 5` | `"score": 26` |
| d | `mergeRequest(iid: "1") { notes(filter: ONLY_COMMENTS, last: 100) { nodes { system author{…} body createdAt url position{…} discussion { id resolvable resolved } } } }` | `"score": 47` |
| e | `mergeRequests(iids: ["1"]) { nodes { iid <discussions block, last: 1> } }` | `"score": 154` |

Variants a1–a′ cleared the 200 logged-out limit, so the logged-in 250 would apply: 212 and 226 both fit under 250. Logged-in acceptance was not run.

**Why the scores come out this way** (GitLab source; it matched every measurement):
- A plain field costs 1 plus its children. A connection field without a resolver gets **no page-size multiplier** (`types/base_field.rb` `field_complexity` → `base_complexity`). So `discussions` and `notes` cost the same whatever `first`/`last` is. The unchanged score across N = 1/3/5 confirms this. That `discussions(first:)` values other than 100 also score the same is `[INFERENCE]`; only `first: 100` was measured.
- Fields with a resolver get `× (1 + min(first, max_page) × multiplier)`. The default multiplier is 0.01; a single `iid` gets 0; an `iids` array of 1–100 gets 0.05 (`resolvers/base_resolver.rb:134-155`).
- So per-MR fields under `mergeRequests(first: 100)` count **×2**: the discussions block adds 21 per node → +42 (170 → 212). Under `iids:` they count ×6 (variant e).
- Depth limit is 20 logged in, 15 logged out (`gitlab_schema.rb:11-12`). All variants passed at 15.

**Page sizes and nested pagination:**
- The discussions cap is 100 (schema default, no field override). The `Discussion.notes` cap is 200 (`discussion_type.rb`, `max_page_size: 200`).
- `discussions(first: 150)` and `notes(first: 250)` were accepted without error on gitlab-org/gitlab !263536. That MR had fewer items than either cap, so whether GitLab silently trims to the cap was **not observed** (UNKNOWN).
- Because every system note is its own discussion, an MR with more than 100 discussions in total needs `discussions(after:)` paging per MR to reach later open ones. No filter avoids that (see §1).
- `MAX_MERGE_REQUESTS = 500` and `PAGE_SIZE = 100` (`lib.rs:45-47`) mean 5 list pages (`list.rs:14`). Each page is one query, so the per-page scores above apply to each of the 5 pages.

---

### 3. A real answer (public gitlab-org/cli, 2026-11-03; the playground's content is UNKNOWN)

One open discussion, trimmed to its first and middle notes, verbatim:

```json
{ "id": "gid://gitlab/Discussion/b59f654276534407af61b8f0a4bb78d767dd9ae1",
  "resolvable": true, "resolved": false,
  "notes": { "pageInfo": { "hasPreviousPage": false }, "nodes": [
    { "id": "gid://gitlab/DiffNote/4148865003", "system": false,
      "author": { "username": "ck3g", "name": "Vitali Tatarintev",
                  "avatarUrl": "/uploads/-/system/user/avatar/3714742/avatar.png?v=1793713611" },
      "body": "**suggestion:** `ResolveID` loads every page with the default `per_page` of 20, …",
      "createdAt": "2026-11-03T10:04:53Z",
      "url": "https://gitlab.com/gitlab-org/cli/-/merge_requests/4292#note_4148865003",
      "position": { "filePath": "internal/commands/service-account/serviceaccountutils/serviceaccountutils.go",
                    "newPath": "internal/commands/service-account/serviceaccountutils/serviceaccountutils.go",
                    "oldPath": "internal/commands/service-account/serviceaccountutils/serviceaccountutils.go",
                    "newLine": 128, "oldLine": null, "positionType": "text" } },
    { "id": "gid://gitlab/DiffNote/4150047473", "system": true,
      "author": { "username": "vertisan", "name": "Paweł Farys", "avatarUrl": "/uploads/-/system/user/avatar/939514/avatar.png?v=1793709083" },
      "body": "changed this line in [version 2 of the diff](/gitlab-org/cli/-/merge_requests/4292/diffs?diff_id=2165092330&start_sha=…#b1e7…_128_149)",
      "createdAt": "2026-11-03T12:31:15Z", "url": "https://gitlab.com/gitlab-org/cli/-/merge_requests/4292#note_4150047473", "position": { "…": "same file, newLine 128" } },
    { "id": "gid://gitlab/DiffNote/4150048144", "system": false, "author": { "username": "vertisan", "…": "…" }, "body": "Good call, done in 1aa07bace. …", "…": "…" } ] } }
```

What the answers show:
- **`url`** is absolute: `<web_url>/-/merge_requests/<iid>#note_<id>`, for DiffNote, DiscussionNote and Note alike.
  - yamt's `WebPage` makers refuse it today: `project_page` takes only a web path of `[A-Za-z0-9._~-]` segments (`web_page.rs:53-56,119-129`), and the test lists `"/a/b#c"` as no page (`web_page.rs:224-228`).
  - Making a note link needs a new `WebPage` maker plus an entry in the offered set (plan #137; RK41).
- **`position`** is `null` for notes on the merge request itself (Overview). For diff notes it has `filePath`, `newLine`/`oldLine` (one may be null) and `positionType` `"text"`.
- **`system`** is a boolean on every note. System notes can be authored by a person (the pusher).
- **`author.avatarUrl`** comes in two forms:
  - a relative uploaded path with a query, `/uploads/-/system/user/avatar/<n>/<file>.png?v=<digits>`;
  - a Gravatar URL, `https://secure.gravatar.com/avatar/<64 hex>?s=80&d=identicon`.

  Both already go through `avatar_source` (`people.rs` `People::person`).

---

### 4. Code map

**Rust list (`crates/merge-requests`)**
- `query.rs:40-64` `list_query()`: one line, `queryComplexity { score limit } currentUser { username } project { mergeRequests(state: opened, sort: CREATED_DESC, first: $first, after: $after) … resolvableDiscussionsCount resolvedDiscussionsCount … }`.
  - `query.rs:67-84` `list_args` passes `-f query=… -f fullPath=… -F first=100 [-f after=…]`.
  - The per-MR queries (`DETAILS_QUERY` `:7`, `REVIEWERS_QUERY` `:19`) use `merge_request_args` with `-f iid=<n>`.
- `lib.rs:45` `PAGE_SIZE = 100`, `:47` `MAX_MERGE_REQUESTS = 500`, `:92` `WebPage(String)`, `:234` `MergeRequestRow.open_discussions: u32`, `:254-259` `MergeRequestPage { me: Option<String>, rows }`.
- `page.rs`:
  - `:106-107` node fields `resolvable_discussions_count` and `resolved_discussions_count`;
  - `:217-220` → `open_discussions()` at `:252-256` (saturating difference);
  - `:167` `me: data.current_user.map(|user| user.username)`;
  - `:152` `parsed`; `:197` `row` (the `People` collector gathers uploaded pictures).
- `list.rs`:
  - `:14` `MAX_PAGES = 5`;
  - `:44-77` `list_merge_requests` (glab → `logged_in_project` → fetch per cursor);
  - `:80-121` `pages`: logs the first page's complexity at `:93`, sends `MergeRequestPage { me, rows }` per page at `:104`, ends `Cut { limit: 500 }`; a failing page gives `Failed` and earlier pages stay.
- `project.rs`: `logged_in_project` (auth status, then `glab api projects/:fullpath`); `Project { full_path, web_path, web_origin }`, with an https origin only.
- `people.rs`: `Person { username, name, picture: PersonPicture }` with `Uploaded | Gravatar { address } | None`; `UserNode` deserialises `username name avatarUrl`; `People::person` pushes an `OfferedPicture` for uploaded avatars.

**Tauri (`src-tauri/src/merge_requests.rs`)**
- `:37-41` `ListMessage = Page | End | Checked`, sent on a `Channel` (the comment explains why the end also travels on the channel).
- `:98-111` `forward_page`: adds each row's page and its failed-job pages to `pages` (the offered set), calls `state.pictures.offer(...)` (`merge_requests/pictures.rs:53`), then sends the `Page`.
- `:121-140` `list`: pages, then `End`, then the local check (`Checked`).
- Command `list_merge_requests(window, messages: Channel<ListMessage>)` runs in `blocking_reply`.
- `:369-375` `open_page(page: WebPage)`: `NotOffered` unless the page is in `pages`, else `yamt_merge_requests::open_page`, which runs `xdg-open` / `open` / `rundll32` detached (`web_page.rs:68`).
- Registered in `commands.rs:77-81`. TS bindings: `bindings.ts:73` `listMergeRequests`, `:79` `openPage`, `:560` `ListMessage`.

**Frontend load path**
- `ipc/MergeRequestSource.ts:22-27`: `listMergeRequests(onPage, onChecked)`, `openPage(page)`.
- `ipc/tauriMergeRequests.ts:38-75`: a `Channel<ListMessage>` routes `page`/`checked`/`end`; `openPage` passes straight through.
- `ipc/mergeRequestDomain.ts:96-110` `toPerson`: uploaded → `uploadedPicture(username)` (the `yamt-picture://localhost/<username>` scheme), Gravatar → its address, none → `null`; domain `Person = { username, name, picture: string | null }` (`:16-18`).
- `ui/mergeRequests.ts` (the state slice):
  - `received` (`:87`) writes `rows` and `me`, or the refresh buffer;
  - `ended` (`:97`) swaps the buffer in on a successful refresh and sets `listing = done { at }`;
  - `load` (`:134`); `show` (`:165`) reloads when `notLoaded` or older than `RECHECK_PAUSE_MS = 30_000` (`ui/glab.ts:3`);
  - `refresh: () => load(state)` (`:273`).
- `ui/MergeRequestsView.vue:132,203`: Refresh and Retry → `requests.refresh`.
- **"Me":** `me` is the `currentUser.username` of the last page (`mergeRequests.ts:43,74`). `ui/mergeRequestsShown.ts:36,42` passes `me.value` to `filtered`/`choicesOf`; `mergeRequests/internal/filters.ts:57-60` matches `{ kind: "me" }` by `person.username === me`. `request-mr-review-mode.md` rules 5 and 7 swap in a chosen reviewer.
- Core barrel: `mergeRequests/index.ts` (people helpers `displayName`, `initials`, `pictureHue`, `createdAgo`, …).

**Row, count and hover boxes**
- `ui/MergeRequestRow.vue`:
  - `:64` `discussions = discussionsText(row.openDiscussions)`;
  - `:163-171` the count: `<span v-tooltip="discussions" … :aria-label="discussions">` with `MessageSquare` and the number;
  - `:110-114` a row click → `openPage` → emits `openPage("mergeRequest", row.page)`; controls opt out with `@click.stop` and `data-row-control`;
  - `:152-159` `MergeRequestPeople`.
- `ui/mergeRequestsText.ts:87-89` `discussionsText(count)` → "N open discussion(s)".
- `ui/MergeRequestPeople.vue`, the people box:
  - `useHoverBox({ area, opener, box })` (`:54-59`);
  - the area span has `data-row-control @click.stop` and pointer/focus/keydown handlers;
  - the opener is a `<button :aria-expanded="open">`;
  - the box is `v-if="open"`, `fixed z-10 max-h-[60vh] w-max max-w-[30rem] overflow-y-auto rounded-md border … bg-panel-inline p-1 shadow-lg`, placed with `:style="placement"`;
  - a person line is `<MergeRequestPicture :person size="box" aria-hidden="true"/> <span>{{ displayName(person) }}</span>`.
- `ui/MergeRequestPicture.vue`: initials on `bg-primary` turned by `hue-rotate(pictureHue(username))`, an `<img referrerpolicy="no-referrer">` shown once loaded and removed on error, sizes `row`/`stack`/`box`.
- `ui/useHoverBox.ts`: opens on pointerenter or focusin (`show` → `belowLeft(opener)`), held while pointer or focus is inside, closes on Escape (back to the opener) or on any scroll outside (`useScrollOutside`). Used by `CiStatusBox.vue:48`, `MergeRequestLabels.vue:22`, `MergeRequestPeople.vue:55`.
- `ui/tooltip.ts`: `vTooltip` is one tip element per window; 400 ms delay, 0 within 300 ms of the last; text via `textContent`; mirrored to `aria-description`. Plan #154: rich content uses `useHoverBox`; a test bans `title`.

**Settings**
- `crates/settings/src/lib.rs`:
  - `:53-57` `enum Antialiasing { Subpixel (default), Greyscale }`, `#[serde(rename_all = "lowercase")]`, plus `name()`;
  - `:73-80` `StoredSettings { theme, antialiasing, keys, languageServers, agent }`;
  - `:183` `set_antialiasing` → `change` (`:289`): load the file, edit, `write_entries`.
- `file.rs`:
  - the JSON keys are constants (`THEME`, `ANTIALIASING`, …); `Loaded::entries` writes `theme`/`antialiasing` always and other keys only when not default;
  - unknown keys are kept as written (`others`);
  - `parsed` reads each key with `entry()`, where missing means `Default`;
  - writes go through a temp file and a rename (`write_text`).
- File: `<config>/yamt/settings.json`, or the path in `settings-location` (`places.rs:8-10`).
- `src-tauri/src/settings.rs:56-64` `set_antialiasing(window, current, antialiasing)`; `load_settings`/`set_theme` follow the same pattern.
- Frontend: `ipc/ChunkSource.ts:41`, `ipc/tauri.ts:59`, `ipc/fixtureSettings.ts:145`, `ui/settings.ts:31,48,248`, `ui/settingsStore.ts:14`.
- `ui/SettingsView.vue:14-17` `ANTIALIASINGS = [{ value, label }]`; `:82-90` `<section aria-labelledby><h3>Antialiasing</h3><ChoiceButtons :options :pressed="settings.antialiasing" @pick="setAntialiasing"/><p class="mt-1 text-fg-muted">…</p>`.

**Fake glab and fixture**
- `tests/glab/README.md`: the scenario folder comes from `$YAMT_FAKE_GLAB`.
  - `graphql-page-<n>.json` answers `glab api graphql` **with no `iid` field**: page 1 when there is no `after`, page n for `after=page-<n>`.
  - `graphql-merge-request-<iid>.json` answers any graphql call **with an `iid` field** (`scripts/fake-glab/glab:124-138`). The details and reviewers queries already use that route, so a per-MR discussions query sent with `-f iid=` would share those files.
  - Calls with `--input -` are posts (`post-<n>.json`).
  - Log lines: `argv: …`, `cwd:`, `env:`, `stdin:` (with `--input -`), `answered:`.
- `tests/glab/mr-row-details/`: `project.json`, `graphql-page-1.json` (score 170), `graphql-merge-request-{50,52}.json`, `post-{1,2}.{json,status}`, `pictures/uploads/-/system/user/avatar/{1,2}/avatar.png`, and `crowd/`.
- Rust harness `crates/merge-requests/tests/fake_glab/mod.rs`: `Fake::new(scenario)` writes `glab.env` (with the LOG and STATE paths) plus a symlink; `logged(prefix)` reads the log lines.
- WebKit fixture `?mr=list`:
  - `ipc/fixtureMergeRequests.ts:108-113` gives 2 pages of 20 rows; on load 2 (a refresh) the `backend` label is dropped;
  - row data is in `ipc/fixtureMergeRequestData.ts` (`row()` at `:208`, `openDiscussions: index % 3` at `:221`, `PEOPLE` at `:54-60`, `FIXTURE_ME = "sam"` at `:4`, `fixtureUploadedPicture` at `:82`);
  - `openPage` logs `mergeRequests.fixture_page` and answers `opened` (`:231-236`).

---

### 5. Risk register and plan rows

Risk register (`.omp/skills/risk-register/SKILL.md`):

| id | risk | owner today | relevance |
|---|---|---|---|
| RK57 (`:71`) | "the app reads a log for a page no list offered …, or the window interprets log text as markup" | core `jobLogView` (text runs only) + `CiStatusJobLog.vue` (text interpolation, no `v-html`); tests `markup_in_a_log_stays_text`, WebKit "markup line" | rule 5 points here |
| RK41 (`:55`) | the opener hands the browser an address GitLab did not list | `WebPage::job`/`merge_request` + `src-tauri` `pages`, `NotOffered` | note links |
| RK53 (`:67`) | the window loads or makes glab fetch an address GitLab did not list as an avatar; the token goes to another host; a non-image is served | `avatar_source`, `fetch_picture`, `pictures.rs` `picture_answer` (offered usernames) | discussion authors' pictures |
| RK54 (`:68`) | re-request safety | — | context only |
| RK55 (`:69`) | stored filters from an older yamt | — | context only |

Plan §2 (`docs/plan.md`):

| row | line | what it says | relevance |
|---|---|---|---|
| #131 | 163 | one list query paged by Rust; `currentUser { username }` ("Me"); `queryComplexity` logged; 5 × 100 then `Cut`; each page its own 20 s glab call on a `Channel<ListMessage>` | glab, list |
| #133 | 165 | failed job page opened via the offered set and `xdg-open` | opening URLs |
| #137 | 169 | one opener rule `WebPage` (`job`, `merge_request` = https origin + web path + `/-/merge_requests/<iid>`, both checked by path rules); the window's offered set holds every row's page and every job's page; a refused open shows in the page's one problem line | opening URLs, rule 6 |
| #152 | 184 | uploaded avatars via `yamt-picture` and the offered-by-username set; Gravatar direct; CSP `img-src` list | discussion authors' pictures |
| #154 | 186 | one tooltip directive; rich hover content is `useHoverBox`; `title` banned | the hover box |
| #155 | 187 | stored filter words (`"me"`, `not:`) | context |
| #158 | 190 | log read only for an offered job page | offered-set pattern |

No §2 row covers settings for merge requests. Settings rows sit elsewhere in the plan; the `crates/settings` pattern is described in §4.

**For the designer to note, both sourced above:**
- (a) Rule 6 needs a note-URL maker outside today's `WebPage` path rules, because the URL contains `#note_<id>`.
- (b) A row's discussion authors with uploaded avatars must be offered by username, as `forward_page` does for list people. Otherwise `yamt-picture` answers 404 (RK53).