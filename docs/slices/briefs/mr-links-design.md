# A merge request's epics, issues and commits, one hover away — design

Request: `docs/slices/request-mr-links.md` (rules 1–6 settled; this design closes its "To be measured" list and refines
only details marked "(orchestrator)"). It builds on the description feature (design
`docs/slices/briefs/mr-description-design.md` option A, plan §2 #171–#174 proposed), whose Rust half is on `main` and
whose page slice (`mr-description-page`) is being built now and owns `ui/MergeRequestRow.vue` and
`ui/MergeRequestsView.vue` until it lands.

Facts come from four places:

- `.omp/run/notes/PlanScoutMrDescriptionFacts.md` (cited "facts §n"), used as given.
- The designer's GraphQL and REST calls to gitlab.com, **logged out** (limit 200), on 2026-11-04, by `GET
  https://gitlab.com/api/graphql?query=…[&variables=…]` and `GET https://gitlab.com/api/v4/…` (cited "measured"). The
  playground `samubr/glab-yamt-playground` is private, so every measurement is on public `gitlab-org/*` data. The
  schema read is gitlab.com's own introspection on that day (it already lists fields "Introduced in GitLab 19.6"), and
  GitLab's GraphQL reference at the tags `v15.6.0-ee`, `v16.2.0-ee` and `v16.4.0-ee`
  (`doc/api/graphql/reference/index.md`, cited "reference at <tag>").
- GitLab's source on `master` (cited by file).
- The tree (cited `path:line`).

The designer had no shell: no glab ran, nothing was timed, no logged-in score was read. Those are `mr-links-rust` step
1\. Nothing was written to any GitLab. Anything not seen is marked `[INFERENCE]`.

## 1. The request's "to be measured", closed

### 1.1 Where the links come from: GitLab's own rendering of the description

**What `descriptionHtml` holds for each kind (measured, gitlab-org/gitlab !267460, !264728, !259599):**

- **Issue, short reference** (`Related to #628673`): `<a href="/gitlab-org/gitlab/-/work_items/628673" title="<the
  issue's title>" class="gfm gfm-issue" data-original="#628673" data-reference-type="issue" data-iid="628673"
  data-project-path="gitlab-org/gitlab" data-issue-type="issue" …>#628673</a>`. The address is relative and today
  points at `/-/work_items/`, not `/-/issues/`.
- **Issue or work item written as a full address**: `<a href="https://gitlab.com/gitlab-org/gitlab/-/work_items/630405"
  class="gfm gfm-work_item" data-reference-type="work_item" data-work-item-type="issue" data-link-reference="true" …>
  #630405</a>`. GitLab writes the reference as seen from the project (`#630405`).
- **Epic as an epic address** (`…/groups/gitlab-org/-/epics/22956`): `data-reference-type="epic"`,
  `data-group-path="gitlab-org"`, `data-iid="22956"`, text `&22956`.
- **Epic as a work-item address** (`…/groups/gitlab-org/-/work_items/22961`): `data-reference-type="work_item"`,
  `data-work-item-type="epic"`, `data-namespace-path="gitlab-org"`, text `gitlab-org#22961`.
- **Commit**: `<a href="/gitlab-org/gitlab/-/commit/fa3335f304f9482273040a55bc9386ddffc6a59f" title="Backfill
  policy_violations on sbom_occurrence_refs" class="gfm gfm-commit has-tooltip" data-reference-type="commit"
  data-commit="fa33…a59f" data-project-path="gitlab-org/gitlab" …>fa3335f3</a>`: the `title` is the commit's first
  message line, the text its 8-character short id.
- **Merge requests** (`!260316 (merged)`), labels and people carry their own `data-reference-type` and are not listed
  (rule 2). A merge request's own commits link to `…/-/merge_requests/<iid>/diffs?commit_id=<sha>` (facts §9,
  `commit_reference_filter.rb`).
- The same issue written twice (`#628673` and its full address, !259599) gives two links with the same target.
- An older cached rendering may leave a work-item address a plain `<a href>` (the description design measured that on
  older merge requests, its §1.1); a plain link has no `data-*` at all.
- What the reader may not see is not a link: `ReferenceRedactorFilter` turns a reference into its original text, and
  one written as an address back into a plain link to it (`data-link-reference="true"`) `[INFERENCE: GitLab's
  redactor, not measured — logged out sees no confidential issue in these samples]`. A short reference to something
  that does not exist was never a link.

**So the address is the one uniform key.** Every reference GitLab made, and every address an author wrote, ends as an
`href` on the project's server whose path names the thing: `<project>/-/issues/<n>`, `<project>/-/work_items/<n>`,
`groups/<group>/-/epics/<n>`, `groups/<group>/-/work_items/<n>`, `<project>/-/commit/<sha>`,
`<project>/-/merge_requests/<n>/diffs?commit_id=<sha>`, `<project>/-/compare/<sha>...<sha>`. These are GitLab's
public routes; the `data-*` attributes are its internals. Text inside code never became a link (GitLab's reference
filters skip `code` and `pre`), and the description walk already reads only links (`description/html.rs:225-245`).

**The description walk is reused, not copied.** `described()` (`description/html.rs:59-84`) already collects
`pages`: every `http`/`https` link the panel shows, resolved, once each, in document order (`:236-240`). The links
feature classifies those pages, so the box lists exactly the links the panel shows. The one fact the walk does not
keep yet is a commit reference's `title`; it gains `commit_titles`.

**Rejected sources:**

- **The raw Markdown** (`description`) with `workItemsByReference` (16.7+, an experiment; measured "Introduced in
  GitLab 16.7: Status: Experiment"): a second GitLab-Flavoured-Markdown reader (code spans, fences, HTML, escapes), any
  7-hex word is a commit candidate (`1234567` in prose), and commit lookups have no field at the 15.6 floor
  (`Repository.commit` is absent from the reference at v15.6.0-ee; present today). Option C.
- **`MergeRequest.workItemRelations`**: measured schema, `MergeRequestWorkItemRelation.fromMrDescription` is "derived
  from a closing pattern in the merge request description", link types `CLOSES | MENTIONED | RELATED`; no commits, no
  merge-request-independent epics, and "Closes #12" only. It fails rule 2.

### 1.2 Titles, states and parents: one query, one part per namespace

**Fields (all present at every edition, checked against the reference):**

| field                                                  | since                      | source                                                       |
| ------------------------------------------------------ | -------------------------- | ------------------------------------------------------------ |
| `Project.workItems(iids: [String!], first:)`           | 15.1 (experiment), at 15.6 | reference at v15.6.0-ee `:17999-18006`                       |
| `WorkItem.iid title state webUrl workItemType widgets` | at 15.6                    | reference at v15.6.0-ee `:20395-20405`                       |
| `WorkItemWidgetHierarchy.parent: WorkItem`             | at 15.6                    | reference at v15.6.0-ee `:20466`                             |
| `Group.workItems(iids:, first:)`                       | **16.3** (experiment)      | reference at v16.4.0-ee `:18400-18415`; absent at v16.2.0-ee |
| `WorkItemState`                                        | `OPEN`, `CLOSED`           | reference at v15.6.0-ee `:22622-22623`                       |

`Group.workItems` is a Community Edition field (`app/graphql/types/group_type.rb:353-356`, master), and so are the
project's work items and the hierarchy widget (tasks are Free). **No field is Premium-only**, so GitLab Free and a CE
server never refuse the query. Rejected: `Issue.epic` (EE only, "Deprecated in GitLab 17.5", measured; a CE server
refuses a query naming it, facts §11) and `Group.epics` (EE only, "Deprecated in GitLab 17.5", measured).

**The query** (one line, the operation name routes the fake glab):

```graphql
query MergeRequestLinks($path0: ID!, $iids0: [String!], $first0: Int!, …) {
  queryComplexity { score limit }
  part0: project(fullPath: $path0) { workItems(iids: $iids0, first: $first0) { nodes { ...linked } } }
  part1: group(fullPath: $path1) { workItems(iids: $iids1, first: $first1) { nodes { ...linked } } }
}
fragment linked on WorkItem { iid title state webUrl workItemType { name }
  widgets { ... on WorkItemWidgetHierarchy { parent { iid title webUrl workItemType { name } } } } }
```

**Measured answers (logged out, 2026-11-04):**

- `part0` gitlab-org/gitlab `["628673","630405","999999999"]`, `part1` gitlab-org `["22961","22956"]`: **score 50 of
  200**; the missing iid is simply absent from `nodes`; each issue's `parent` is its epic (`workItemType { name:
  "Epic" }`, `webUrl: "https://gitlab.com/groups/gitlab-org/-/work_items/22961"`); each epic also names its own parent
  epic (not shown: rule 4, non-goal).
- A project or group the reader cannot see, or that does not exist (`samubr/glab-yamt-playground` logged out,
  `no-such-group-yamt-xyz`): `"part0": null, "part1": null`, **no error**.
- The legacy epic address's iid and the work item's are the same: `…/-/epics/22956` and `group.workItems(iids:
  ["22956"])` name the same title.
- `workItemType.name` values: `Issue`, `Epic` (measured), `Task` and the others by name `[INFERENCE: GitLab's type
  names]`. Rule: `Epic` → Epics, any other → Issues.

**Cost.** One project part with the fragment: 25 at `first: 1`, 27 at `first: 3`, 74 at `first: 50`, 124 without
`first` (measured; `onlyTypes: [HIERARCHY]` changes the score by nothing, 27 either way, and the reference at v15.6.0-ee
lists `widgets` without arguments, `:20404`, so it is
not asked; the unfiltered `widgets` list costs only bytes, about 26 empty objects per item). So a call scores about
**25 × parts + iids**. Each part holds at most 100 iids (`workItems(iids:)` "maximum is 100 IIDs", facts §11); parts are
packed into glab calls of at most **200** by that sum, below the logged-in limit of 250 (plan #131: the list query's 170
of 250). A description linking 6 namespaces and 30 issues is one call (180); a release note linking 300 issues of one
project is three or four calls, one after another `[INFERENCE: per-call time not measured]`. glab's deadline is 20 s per
call (`crates/gitio/src/glab.rs:10`); the discussions' 20 merge requests per call took 4.47 s (plan #162).

**Calls per hover.** `glab auth status`, the project (`logged_in_project`, `project.rs:38`), the description
(`fetch_description`, `description.rs:327-336`, the same request the panel makes), then the lookup when the
description links an issue or an epic. So three or four glab runs; rule 5's "about a second" was timed in
`mr-links-rust` step 1: it holds for small projects; a lookup with a gitlab-org group part takes 6–7 s per call (plan #176).

### 1.3 Commits: GitLab's own reference, no query

A commit never changes its message, so the `title` GitLab put on its reference link is the commit's first line for
good (measured above). A commit range's link carries GitLab's words for the range, "Commits <a> through <b>"
`[INFERENCE: `CommitRange#reference_title`, not measured]`. A commit link without that title (a plain address GitLab
did not turn into a reference: one the reader may not see, or that does not exist) is "Not found or no access". No
commit query exists at the 15.6 floor anyway (§1.1). Rejected: `Repository.commit(ref:)` per commit (absent at
v15.6.0-ee; a part per project and commit for a fact the description already holds).

### 1.4 The reference each line shows (rule 3)

GitLab's own rules, as seen from the merge request's project `P` (`Project#to_reference_base`; measured texts above):

- **Issue or work item** `n` in project `Q`: `#n` when `Q = P`; `<Q's last segment>#n` when `Q` is in `P`'s namespace;
  else `<Q>#n`.
- **Epic** `n` in group `G`: `&n` when `G` is `P`'s namespace (measured: `&22956` from gitlab-org/gitlab); else `G&n`.
  A group's work item that is not an epic: `G#n`.
- **Commit**: its first 8 hex digits (measured `fa3335f3`), with `<Q>@` or `<Q's last segment>@` before it as for an
  issue. A range: `<a>…<b>`, each 8 digits, one `…` (U+2026, rule 3).
- **A parent**: the same rules over the address GitLab answered for it (`webUrl`).

### 1.5 The window's queue: a per-row ask on the first hover

- Rule 5 forbids asking a row never hovered, so the discussions' batch per page slice (plan #162) does not apply:
  `read_links(iid)` answers one row.
- **One call at a time, the newest hover first** (`ui/mergeRequestLinks.ts`, the discussions queue's shape,
  `ui/mergeRequestDiscussions.ts:100-115, 175-189`). A sweep of the pointer down the column queues each hovered row;
  the row under the pointer is asked next, and at most three or four glab runs are live.
- An entry `loading | read | refused | failed` per iid, kept until the list is replaced: the slice calls `dropped()`
  where it calls `discussionQueue.replaced` (`ui/mergeRequestsList.ts:63, 106`). A generation number drops an answer
  that arrives after that (as `:111`).
- A box asks when it opens and when its entry vanishes while it is open (`useRowDiscussions`,
  `mergeRequestDiscussions.ts:202-214`). An entry that is `loading` or `read` is never asked again; a `refused` or
  `failed` one is asked at the next open or by Retry (rule 5).

### 1.6 Which address each line opens

- **A line opens the address of its first mention**, as the description resolved it (`link_of`,
  `description/address.rs:94-101`): `#12` opens `…/-/work_items/12`, a merge request's own commit opens its diff in the
  merge request (facts §9), an unseen thing opens what the author wrote (rule 6: the browser asks for a login).
- **The parent button opens GitLab's `webUrl` for the parent**, only when it is an https address on the project's own
  server that names an issue, a work item or an epic (§1.4). Any other parent shows no button.
- Both are offered into `MergeRequestState.pages` before the reply (`merge_requests.rs:94-101` `offer`), so `open_page`
  and its `NotOffered` stay unchanged (RK41).

### 1.7 Fake glab

- **Route.** In `graphql()` (`scripts/fake-glab/glab:134-162`), first: a field `query` starting `query
  MergeRequestLinks` answers `graphql-links-<iids0>` (the `iids0` field's JSON array without quotes, brackets and
  spaces, commas as `-`), as the discussions name theirs (`:135-142`). `iids0` never matches the discussions' `field
  iids` (`sed -n "s/^iids=//p"`, `:101`), so the two cannot collide.
- **Scenario `tests/glab/mr-links/`** (`mr-links-rust` brief): an epic parent, a task's parent issue, a cross-project
  issue, a sibling project's issue, an unseen project, a missing iid, a closed issue and epic, a parent on another host,
  this merge request's commit, a range, a commit given twice, an unseen commit; a description linking nothing of rule 2
  (no lookup call); a GitLab Free row (no parents, an epic not shown); a failing lookup; commits alone (no lookup
  call).

## 2. Options

The options differ in where a description's links are found and who names what GitLab is asked.

### Option A — Rust finds the links in the description's walk and asks GitLab once; the window shows the answer (recommended)

**Data structures** (Rust, `yamt-merge-requests`; IPC through specta; `mr-links-rust` has the exact shapes):

- `LinksReply` `read { links }` | `glabMissing` | `notLoggedIn { detail }` | `failed { message }`.
- `DescriptionLinks { epics: LinkedEpic[], issues: LinkedIssue[], commits: LinkedCommit[] }`, each group in order of
  first mention, each thing once.
- `LinkedEpic { reference, page, shown: ShownEpic { title, closed } | null }`.
- `LinkedIssue { reference, page, shown: ShownIssue { title, closed, parent: LinkedParent | null } | null }`.
- `LinkedParent { reference, title, page }`.
- `LinkedCommit { reference, page, title: string | null }`.
- `shown: null` / `title: null` is "Not found or no access". An epic can hold no parent and a commit no state: the
  types cannot say it (vision 4).
- Not IPC: `ReadLinks { reply, pages }`; `Target` = `item { namespace: project(path) | group(path), iid }` | `commit {
  project, sha }` | `range { project, from, to }`; `Part { namespace, iids }`.
- Window: `LinksLoad` per iid (`loading | read | refused | failed`), the discussions queue's shape.

**Files:**

- Rust crate, about 22: `links.rs`, `links/target.rs`, `links/lookup.rs`, `links/tests.rs`; `description.rs`,
  `description/html.rs`, `description/tests.rs` (the commit titles, `fetch_description`'s error type); `query.rs`,
  `query/tests.rs`, `project.rs`, `lib.rs`, `tests/links.rs`, `AGENTS.md`; the fake glab, the scenario and the README.
- App, 5: `merge_requests/links.rs`, `merge_requests.rs`, `commands.rs`, `merge_requests/tests.rs`,
  `merge_requests/tests/links.rs`.
- State, about 16: the source, the domain conversion, the app's and the fixture's calls, `ui/mergeRequestLinks.ts`,
  `mergeRequests.ts`, `mergeRequestsList.ts`, `problem.ts`, `problemText.ts` and tests.
- Page, 5: the row, `MergeRequestLinks.vue`, `mergeRequestLinkLines.ts` and its test, `ui/AGENTS.md`.

**Risks:**

- GitLab renames a route (`/-/work_items/` appeared beside `/-/issues/`). A link whose address no rule knows is simply
  not listed: the box shows less, never something wrong. The owner check catches it.
- A short reference the reader may not see is plain text in GitLab's rendering, so it is not listed (decided, §4).
- On GitLab 15.6–16.2 a description linking an epic makes GitLab refuse the group part: one sentence with Retry.
- On a self-managed GitLab whose epics are not yet work items (before 17.x–18.1), epics may show "Not found or no
  access" and issues no epic parent `[INFERENCE: GitLab's epic-to-work-item migration; gitlab.com moved in 17.6, facts
  §11]`.
- `Project.workItems` was an experiment before 16.x; whether a 15.x server answers it without a feature flag is
  unmeasured `[INFERENCE]`. Worst case: every issue "Not found or no access" there.

**Tests:**

- Rust unit tests: every route and its refusals (other host, other server, sub-path, MR, label, milestone, user,
  branches in a compare), the reference rules, one entry per thing (a commit's short id), the group by type, the
  packing under the budget, the query text naming no Premium-only field, the answer's null part, missing iid, parent off
  host, epic's own parent dropped.
- Integration over the fake glab: one hover's three groups in order; the cross-project, unseen and Free rows without
  error; no lookup when nothing or only commits are linked; a failing lookup; argv (one `api graphql` with fields, never
  stdin).
- App: line and parent pages offered before the reply; no project; the command.
- Window: the queue (first hover only, newest first, one at a time, refresh drops, an answer after a refresh dropped, a
  failure asked again), the box's lines; WebKit fixture and real app.

**Visions:**

- 2: one walk decides what a description links, for the panel and the box; GitLab's answer is the one source of titles
  and parents.
- 3: Rust offers exactly the pages it answered; the opener's allow-list stays.
- 4: per-kind line types; `Target` and `Namespace` sum types.
- 1: the window gets three lists to draw.
- Cost to 5: no dependency; one new command.

### Option B — the window classifies the panel's links and names the things Rust looks up

**Data structures:**

- `readDescription`'s tree (already in the window) is walked by a new core module `mergeRequests/links.ts`: each
  `DescriptionLink.page` classified by the same address rules, grouped and deduplicated in TS.
- A new command `look_up_items(items: { namespace, iid }[]) -> ItemsReply` answers titles, states and parents.
- Commit titles need the tree to carry GitLab's `title` on commit links (a new field on `DescriptionLink`).

**Files:** fewer Rust files; a core slice in TS (the request's proposed slice 3).

**Risks:**

- Two commands per hover; the whole description tree crosses the IPC to find a few addresses.
- The address rules exist twice (Rust resolves and offers, TS classifies), or the window names namespaces and iids that
  Rust must re-validate before querying; the parent's page still needs Rust to offer it.
- The panel's tree gains a field only the box uses.

**Tests:** core tests over hand-built trees; Rust tests for the lookup.

**Visions:** 1 (the classifying in TS). It costs 2 (two places know what a link to an issue is) and 3 (the window
names what GitLab is asked).

### Option C — the raw Markdown, read for references, looked up by `workItemsByReference`

**Data structures:**

- The list's `description` text (already fetched for `hasDescription`) parsed for GLFM references (`#12`, `&3`,
  `[issue:…]`, `ns/proj@sha`, `a...b`, addresses), skipping code spans, fences and HTML.
- `workItemsByReference(contextNamespacePath, refs)` for issues and epics; commits per project by
  `repository.commit(ref:)`.

**Risks:**

- A second GLFM reader, beside GitLab's renderer and yamt's own Markdown (#112).
- Every 7–40-digit hex word is a commit candidate: unseen-commit lines for numbers in prose.
- `workItemsByReference` is 16.7+ and an experiment; `Repository.commit` is absent at 15.6.
- It would list short references GitLab does not link (rule 6 read literally), at the price of the false commits.

**Tests:** parser goldens; lookup tests.

**Visions:** 5 (no description request per hover). It costs 2 (a second reader of GitLab's syntax) and 1 (a parser a
TS reader must trust).

## 3. Recommendation

**Option A.** The description walk the panel uses decides what is linked; one GraphQL query per hover answers titles,
states and parents from fields every GitLab edition has; Rust offers every page it answers; the window draws three
lists.

**Cost:**

- No dependency; one command (`read_links`), one source method (`readLinks`).
- Four implementer slices (crate, app, state, page) and a verifier; at most two at once.
- Three or four glab runs per first hover of a row; a long description's lookup is cut into calls of score ≤ 200.
- The request's slice 3 ("core") folds into Rust (finding, grouping, order, one entry per thing, references) and the
  page slice (the box's words): no `mergeRequests/` core module is needed.

### Proposed plan §2 rows (DR5: the orchestrator records them; numbers after the description's #171–#174)

| #   | **Decision**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Rejected alternatives & why                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Vision     |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| 175 | **A merge request's linked epics, issues and commits are the links of its description as GitLab rendered it, looked up by one query per hover** (owner #2247, #2250; request `docs/slices/request-mr-links.md` rules 2–6; design `briefs/mr-links-design.md` option A). `read_links(iid) -> LinksReply` = read { links: DescriptionLinks { epics: LinkedEpic[], issues: LinkedIssue[], commits: LinkedCommit[] } } \| glabMissing \| notLoggedIn { detail } \| failed { message }: `logged_in_project`, the description's own request (`fetch_description`, its error now the message), the description walk (`described`: its `pages`, and `commit_titles`, GitLab's `title` on each commit or commit-range reference link); a page counts when it is https on the project's origin under its sub-path and names `<project>/-/issues/<n>`, `/-/issues/incident/<n>`, `/-/work_items/<n>`, `groups/<group>/-/epics/<n>`, `groups/<group>/-/work_items/<n>`, `<project>/-/commit/<7–40 hex>`, `<project>/-/merge_requests/<n>/diffs?commit_id=<40 hex>` or `<project>/-/compare/<7–40 hex>...<7–40 hex>` (also `..`); each thing once (a commit id that starts another of the same project is that commit), placed at its first mention, whose page its line opens. Issues and epics: `query MergeRequestLinks`, one `part<k>: project\|group(fullPath: $path<k>) { workItems(iids: $iids<k>, first: $first<k>) { nodes { iid title state webUrl workItemType { name } widgets { ... on WorkItemWidgetHierarchy { parent { iid title webUrl workItemType { name } } } } } } }` per namespace (≤ 100 iids), packed into glab calls of `25 × parts + iids` ≤ 200 (measured logged out 2026-11-04: 25 for one part of 1, 27 of 3, 74 of 50, 50 for two parts of 3 + 2); a null part or a missing iid is shown as "not found or no access", never an error (measured). Only fields every edition has (`Group.workItems` 16.3+, the rest at 15.6); never `Issue.epic`, `Group.epics`, `onlyTypes`. `workItemType.name` `Epic` → Epics, any other → Issues with its hierarchy parent when that is an issue, work item or epic address on the same server; a group's work item not shown → Epics, a project's → Issues. Commits: no query; GitLab's `title` on the reference link, none → not shown. References as GitLab writes them from the project (`#n`, `<sibling>#n`, `<path>#n`, `&n`, `<group>&n`, 8 hex digits, `<a>…<b>`). Every line's and parent's page is offered (`offer`) before the reply; `open_page` unchanged. | The raw Markdown with `workItemsByReference` (16.7+ experiment; a second GLFM reader; every 7-hex word a commit; option C); the window classifying the panel's tree and naming lookups (two commands per hover, address rules in two languages, option B); `MergeRequest.workItemRelations` (closing patterns only, no commits; measured schema); `Issue.epic`/`Group.epics` (EE only: a CE server refuses the query; deprecated 17.5); issue titles from the description's `title` attributes (cached with the description, stale after a rename `[INFERENCE]`, and parents need the query anyway); `Repository.commit` per commit (absent at 15.6; the description already holds the title). | 2, 3, 4, 1 |
| 176 | **The window asks a row's links on its first hover, one call at a time, newest first, and keeps them until the list is replaced** (request rules 1, 5; design §1.5). `ui/mergeRequestLinks.ts`: `links: ReadonlyMap<iid, LinksLoad>` (`loading \| read \| refused \| failed`), `askLinks(iid)` (nothing while loading or read; a refused or failed entry asked again), one `readLinks` in flight, `dropped()` called where `discussionQueue.replaced` is (a refresh's end, a failed first load) bumps a generation so a later answer is dropped; `useRowLinks` asks when the box opens and when its entry vanishes while open. The row: a `w-7` column right after the description's info column, holding (only with `hasDescription`) a Lucide `link` button whose hover box (`useHoverBox`) shows Epics, Issues, Commits — a kind icon, the reference, the title, "Closed", or "Not found or no access"; a line press opens its page (`openPage("link", …)`), the box stays; an issue with a parent ends in a Lucide `arrow-up-to-line` button, tooltip "Open parent: <reference> <title>".                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | One batch per page slice as discussions (asks rows never hovered, rule 5); asking with the list (#2250); one ask per hovered row in parallel (a sweep down the column starts a dozen glab runs at once).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | 2, 1, 5    |
| 177 | **Defaults decided with the links design** (orchestrator, OR13; the owner may veto): §4 of the design.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | —                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | 1          |

### Risks for the register (`skill://risk-register`; next free id after the description's RK66, RK67: RK68)

| id             | risk                                                                                                                                                                                                                                                                                        | owner                                                                                                                                                                                                                          | proving test                                                                                                                                                                                                                                                                                                                                |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| RK41 (amended) | the merge-request page's opener hands the system browser an address GitLab did not list for a failed job, a merge request, a note, a link in a description **or a line or parent in a merge request's links box that its `read_links` reply did not name**; or a parent on another host     | as today + `yamt-merge-requests` `links.rs` (`ReadLinks.pages`: every line's and parent's page) + `links/target.rs` (a parent only on the project's server) + `src-tauri` `merge_requests/links.rs` (offered before the reply) | the existing tests, plus `every_line_and_parent_page_is_in_pages_once`, `a_parent_on_another_host_gets_no_button`, `a_line_and_a_parent_page_are_offered_before_the_reply`                                                                                                                                                                  |
| RK68           | the links box lists something the description does not link to as an epic, issue or commit (text in code, a merge request, a label, a milestone, a person, another server's page, a compare of branches), lists one thing twice, puts it in the wrong group or order, or drops one it links | `yamt-merge-requests` `links/target.rs` (`target_of`) + `links.rs` (one entry per target, first mention, group by `workItemType`) + `description/html.rs` (the one walk)                                                       | `only_issue_epic_and_commit_addresses_on_the_projects_server_count`, `one_thing_written_three_ways_is_one_line_at_its_first_mention`, `a_short_commit_id_is_the_commit_it_starts`, `a_work_item_goes_to_epics_only_when_gitlab_types_it_epic`, `one_hovers_lookup_answers_epics_issues_and_commits_in_order_with_titles_states_and_parents` |
| RK69           | the lookup is refused or fails where nothing is wrong (GitLab Free, a CE server, a project or group the reader may not see, an iid that is gone) or runs past GitLab's complexity limit or glab's deadline for a long description                                                           | `links/lookup.rs` (`calls`: ≤ 100 iids a part, `25 × parts + iids` ≤ 200 a call) + `query.rs` `links_args` (CE fields only)                                                                                                    | `the_lookup_names_no_premium_only_field`, `an_unseen_namespace_or_a_missing_iid_is_not_shown_without_error`, `a_long_list_is_cut_into_calls_under_the_budget`, `on_gitlab_free_issues_have_no_parent_and_an_epic_is_not_shown_without_error`                                                                                                |
| RK70           | the window asks GitLab for a row never hovered, shows an answer from before a refresh, keeps a failure so a later hover never asks again, or starts more than one ask at a time                                                                                                             | `ui/mergeRequestLinks.ts` (`askLinks`, the generation, one call in flight) + `ui/mergeRequestsList.ts` (`dropped()` beside `replaced`)                                                                                         | `only_a_hovered_row_is_asked`, `an_answer_after_a_refresh_is_dropped`, `a_failure_is_asked_again_at_the_next_open`, `asks_run_one_at_a_time_newest_first`, `a_read_or_loading_row_is_never_asked_again`                                                                                                                                     |

### Shared edits for the orchestrator (no slice owns them)

- **After `mr-links-app`, before `mr-links-state`:** `just bindings`. It brings `LinksReply`, `DescriptionLinks`,
  `LinkedEpic`, `ShownEpic`, `LinkedIssue`, `ShownIssue`, `LinkedParent`, `LinkedCommit` and `commands.readLinks(iid)`.
  The frontend type check stays green (a pure addition).
- Plan rows #176–#178 (recorded so: #175 is the uploads rule); RK41 (amended), RK68–RK70.
- **Docs keeper (once, after `mr-links-page`):**
  - `docs/architecture.md`: §3.9 a "Links" paragraph beside "Description" (the walk's `commit_titles`, the routes, the
    query and its budget, the offer), the tests line (scenario `mr-links`), the commands list (`read_links`); §4
    `MergeRequestSource.readLinks`; §5.1 state table "merge requests: each row's links" (`ui/mergeRequestLinks.ts`);
    §5.4 the problem step `links`; the box.
  - `.omp/skills/ipc-contract/SKILL.md`: `read_links` and `readLinks`.
  - `skill://project-map/tree.md`: `links.rs`, `links/{target,lookup,tests}.rs`, `tests/links.rs`,
    `src-tauri/src/merge_requests/links.rs` and its test; `ipc/fixtureMergeRequestLinks.ts`,
    `ui/mergeRequestLinks.ts`, `ui/MergeRequestLinks.vue`, `ui/mergeRequestLinkLines.ts`.
  - `skill://project-map/state.md`: each row's links (`ui/mergeRequestLinks.ts`, written only by its queue; cleared by
    `dropped()`).
  - `CHANGELOG.md`: one line. `src-tauri/AGENTS.md` and the lines the slices hand on in `deviations_from_brief`.

## 4. Decided without the owner

The owner will not answer this session (#2260). Each item is recorded as row #178 and the owner may veto any:

1. **What a line opens.** A line opens the address the description used the first time it named the thing: `#12`
   opens issue 12; a link to a comment on an issue opens at that comment; a commit of this merge request opens it in
   the merge request's changes. The parent button opens the parent's own GitLab page.
2. **References GitLab itself does not link are not listed.** A `#99` that does not exist, or names an issue you may
   not see, is plain text on GitLab's own page, and the box does not list it either. Only a thing written as a full
   address keeps its line with "Not found or no access" (rule 6); its click still opens the address.
3. **Commit titles** come from the description as GitLab rendered it (a commit's message never changes); a commit range
   shows GitLab's words for it, "Commits a1b2c3d4 through e5f6a7b8".
4. **How references read.** As GitLab writes them on this project's pages: `#12` here, `web#12` in a sibling project of
   the same group, `group/other#12` elsewhere; epics `&3` in the project's own group, `group&3` elsewhere; commits by
   their first 8 characters (as GitLab shows them), a range as `a1b2c3d4…e5f6a7b8`.
5. **Icons and words.** Epics Lucide `layers`, issues `circle-dot`, commits `git-commit-horizontal`; group headings
   "Epics", "Issues", "Commits"; the button's label "Linked epics, issues and commits" (no tooltip: the box opens at
   once, as the discussions box does).
6. **Tasks, incidents and other work items** sit among Issues with the issue icon. A work item of a group that GitLab
   does not show goes to Epics (on GitLab a group's work items are its epics); one of a project goes to Issues.
7. **Only links to this merge request's own GitLab server** are listed; an issue on another GitLab server is not. On a
   GitLab not served over https the box always says "No linked epics, issues or commits."
8. **One ask at a time.** Sweeping the pointer down the column asks each row passed over, one after another, the row
   under the pointer first.
9. **Long descriptions.** A description linking more than about 170 issues and epics is looked up in several GitLab
   calls one after another, so "Loading…" lasts longer.
10. **Older GitLab.** On GitLab 15.6–16.2 (before August 2023) a description that links an epic shows GitLab's error
    with Retry; issues and commits alone work. On a self-managed GitLab whose epics are not yet work items (before
    GitLab 18), epics may show "Not found or no access" and issues no epic parent button.
11. **An epic's own parent** is never shown (rule 4, non-goal); an issue whose parent is on another host shows no
    button.
12. **Failures.** A failure says one sentence with Retry in the box ("Could not read the links: …", or the glab words
    the other boxes use); the next hover asks again. A link that the browser cannot open shows its sentence in the
    page's problem bar, as a description link does.

## 5. Slice graph

| wave | brief                                                                                                      | owner        | needs                               | beside                                 |
| ---- | ---------------------------------------------------------------------------------------------------------- | ------------ | ----------------------------------- | -------------------------------------- |
| 1    | `mr-links-rust.md` (crate: walk's commit titles, routes, references, lookup, packing; fake glab; scenario) | rust-impl    | this design (rows #176–#178)        | `mr-description-page` (still running)  |
| 2    | `mr-links-app.md` (command, offers, tests)                                                                 | rust-impl    | rust                                | —                                      |
| —    | orchestrator: `just bindings`                                                                              | orchestrator | app                                 | —                                      |
| 3    | `mr-links-state.md` (source, conversion, fixtures, queue, refresh rule)                                    | web-impl     | app + bindings                      | `mr-description-page` if still running |
| 4    | `mr-links-page.md` (column, button, box, lines, parent button; wires the window)                           | web-impl     | state, `mr-description-page` landed | —                                      |
| 5    | docs keeper                                                                                                | docs-keeper  | page                                | verify's smoke                         |
| 5    | `mr-links-verify.md`                                                                                       | verifier     | page (smoke); docs (final)          | docs keeper                            |
| 6    | owner check on the playground                                                                              | human        | verify                              | —                                      |

Owned globs are pairwise disjoint across the four implementer briefs and disjoint from `mr-description-page`'s
(`MergeRequestRow.vue` is owned by `mr-links-page` only after `mr-description-page` lands). At most two implementers
run at once.

### Rule coverage

| request item                                                                                                     | brief and acceptance                                                                                                                                                                                                                             |
| ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Rule 1 (column, hover/keyboard, stays open, no row open, no button without description, empty sentence)          | page: WebKit steps 1, 2, 7, 8; `mergeRequestLinkLines.test.ts` `loading_empty_refused_and_failed_have_their_sentence_and_only_failures_retry`                                                                                                    |
| Rule 2 (kinds, forms, groups, order, once, work items, code, exclusions)                                         | rust: `only_issue_epic_and_commit_addresses_on_the_projects_server_count`, `one_thing_written_three_ways_is_one_line_at_its_first_mention`, `a_work_item_goes_to_epics_only_when_gitlab_types_it_epic`, integration !62/!61; page: WebKit step 3 |
| Rule 3 (icon, reference, title, Closed, click opens, box stays)                                                  | rust: `references_read_as_gitlab_writes_them_from_the_project`; page: `a_line_keeps_its_reference_title_and_closed`, WebKit step 4                                                                                                               |
| Rule 4 (parent button, direct parent only, none for epics and commits)                                           | rust: integration !62, `an_epics_own_parent_is_dropped`; page: `only_an_issue_with_a_parent_gets_the_parent_button_with_its_tooltip`, WebKit step 5                                                                                              |
| Rule 5 (first hover asks, Loading…, kept until refresh, never-hovered never asked, failure + Retry, asked again) | state: RK70 tests; page/verify: WebKit steps 6–9 (fixture log)                                                                                                                                                                                   |
| Rule 6 (not found or no access, Free, never refused)                                                             | rust: `an_unseen_namespace_or_a_missing_iid_is_not_shown_without_error`, `on_gitlab_free_…`, `the_lookup_names_no_premium_only_field`; page: `a_thing_gitlab_did_not_show_says_not_found_or_no_access_and_keeps_its_page`                        |
| Acceptance: Rust against the fake glab                                                                           | `mr-links-rust` Acceptance                                                                                                                                                                                                                       |
| Acceptance: WebKit fixture, dark and light; real app                                                             | `mr-links-page` smoke, `mr-links-verify` B–C                                                                                                                                                                                                     |
| Acceptance: `just check`                                                                                         | `mr-links-verify` A                                                                                                                                                                                                                              |
| Acceptance: owner check                                                                                          | `mr-links-verify` "Owner check"                                                                                                                                                                                                                  |
