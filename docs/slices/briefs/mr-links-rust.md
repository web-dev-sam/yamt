# Slice mr-links-rust — a description's epics, issues and commits: found in the walk, looked up in one query; fake glab

Feature: a merge request's epics, issues and commits, one hover away. Sources:

- Request `docs/slices/request-mr-links.md`: rules 2–6 (the Rust side) and the Rust acceptance.
- Design `docs/slices/briefs/mr-links-design.md` option A, §1.1–§1.4, §1.6, §1.7, §4.
- Proposed plan §2 #175, #177; RK41 (amended), RK68, RK69.

Runs in wave 1, beside `mr-description-page` (frontend only). `mr-links-app` builds on this slice.

## Target

**Owned:**

- `crates/merge-requests/**` (its `AGENTS.md` included), except `crates/merge-requests/Cargo.toml`
- `scripts/fake-glab/glab`
- `tests/glab/mr-links/**` (new)
- `tests/glab/README.md`

**Read-only:** everything else.

- `crates/merge-requests/Cargo.toml`, the root `Cargo.toml`, `Cargo.lock`: no dependency is added (`dom_query`, `url`,
  `serde_json` are already this crate's).
- `crates/gitio/**`: use `Glab::get` as it is.
- `src-tauri/**`: `mr-links-app`'s. Your types must compile there unchanged (Contract); the description's app code
  (`src-tauri/src/merge_requests/description.rs`) uses `read_description` and `ReadDescription` exactly as today.
- `frontend/**`: `frontend/src/ipc/bindings.ts` comes from the orchestrator's `just bindings` (PM4).
- Other scenarios under `tests/glab/`: copy from them, never edit them.
- `docs/**` and `AGENTS.md` files outside your globs: put their lines in `deviations_from_brief`.

**Non-goals:**

- The command and the offers: `mr-links-app`.
- Links to merge requests, labels, milestones, people, snippets or other websites; parents of epics; ancestors beyond
  the direct parent; editing (request non-goals).
- Issues GitLab relates to the merge request outside its description (`workItemRelations`, closing issues).
- Caching an answer: the window keeps it (`mr-links-state`).
- Writing to any GitLab.

## Contract

Fixed; you may add, never change.

- IPC types derive `Clone, Debug, PartialEq, Eq, Serialize, Type`, are documented as their neighbours are, carry
  `#[serde(rename_all = "camelCase")]`; enums with payloads also `tag = "kind"`.
- New modules: `links.rs`, with the children `links/target.rs`, `links/lookup.rs` and `links/tests.rs`; the IPC types,
  `ReadLinks` and `read_links` re-exported from `lib.rs`.

```rust
// links.rs
/// How reading the epics, issues and commits a merge request's description links to ended.
pub enum LinksReply {                                      // tag = "kind"
    /// The description's links, looked up.
    Read { links: DescriptionLinks },
    GlabMissing,
    NotLoggedIn { detail: String },
    /// glab's or GitLab's words, `page.rs` NO_MERGE_REQUEST or NO_PROJECT.
    Failed { message: String },
}
/// Every epic, issue and commit the description links to, each once, each group in the order of first mention.
pub struct DescriptionLinks { pub epics: Vec<LinkedEpic>, pub issues: Vec<LinkedIssue>, pub commits: Vec<LinkedCommit> }
pub struct LinkedEpic {
    /// As GitLab writes it from the merge request's project: `&3`, `group/sub&3`.
    pub reference: String,
    /// Its first mention's address, as the description resolved it.
    pub page: WebPage,
    /// None: GitLab did not show it to this user ("Not found or no access").
    pub shown: Option<ShownEpic>,
}
pub struct ShownEpic { pub title: String, pub closed: bool }
pub struct LinkedIssue { pub reference: String, pub page: WebPage, pub shown: Option<ShownIssue> }
/// `parent`: the direct parent (an epic, or the issue above a task) when GitLab names one on the project's server.
pub struct ShownIssue { pub title: String, pub closed: bool, pub parent: Option<LinkedParent> }
pub struct LinkedParent { pub reference: String, pub title: String, pub page: WebPage }
pub struct LinkedCommit {
    /// `fa3335f3`, `web@fa3335f3`, `other/lib@fa3335f3`, `a1b2c3d4…e5f6a7b8`.
    pub reference: String,
    pub page: WebPage,
    /// GitLab's `title` on its reference link (a commit's first message line; a range's "Commits … through …");
    /// None: GitLab made no reference of it for this user ("Not found or no access").
    pub title: Option<String>,
}

/// Not IPC: what the shell offers before it replies: every line's page and every parent's page, each once.
pub struct ReadLinks { pub reply: LinksReply, pub pages: Vec<WebPage> }

/// glab missing → GlabMissing; `logged_in_project` (From<NoProject>); `fetch_description`; `described`; the lookup
/// calls when an issue or epic is linked. `pages` empty unless Read. One `tracing::info!`: iid, outcome kind, epics,
/// issues, commits, not shown, calls, the highest `queryComplexity` score; never a title, reference or address.
pub fn read_links(repository: &GitLabRepository, glab: Option<&Glab>, iid: MergeRequestIid) -> ReadLinks;
```

**Changes to the description code** (`description.rs`, `description/html.rs`):

```rust
// description.rs — the error is now the message alone; `read` makes its DescriptionReply::Failed from it.
pub(crate) fn fetch_description(glab: &Glab, root: &Path, project: &Project, iid: MergeRequestIid)
    -> Result<String, String>;
// description/html.rs — `Described` gains one field; `pages` and the tree stay as they are.
pub(crate) struct Described {
    pub description: Description,
    pub pages: Vec<WebPage>,
    /// GitLab's non-empty `title` on each link it made from a commit or a commit range (`data-reference-type`
    /// `commit` or `commit_range`), by the link's page; no other link's `title` is kept.
    pub commit_titles: BTreeMap<WebPage, String>,
    pub uploads: Vec<OfferedUpload>,
    pub web_images: usize,
}
```

**Which pages count** (`links/target.rs`; design §1.1, row #175). Suggested shape (add-only types are yours):

```rust
pub(crate) enum Namespace { Project(String), Group(String) }      // full paths
pub(crate) enum Target {
    Item { namespace: Namespace, iid: u64 },
    Commit { project: String, sha: String },                      // lowercase hex as written, 7–40
    Range { project: String, from: String, to: String },
}
/// `page` as a thing on the project's server: https, the project's origin, under its sub-path; None for any other.
pub(crate) fn target_of(server: &Server, page: &WebPage) -> Option<Target>;
```

- **The server**: `Project.web_origin` (`https://host[:port]`, `project.rs:20-22`) and the sub-path GitLab is installed
  under: `Project.web_path` without its final `/<full_path>` (`""` on gitlab.com). No `web_origin` (not https): no page
  counts, the reply is `Read` with three empty groups and no lookup.
- **After the sub-path**, the path's segments each pass `web_page.rs` `is_path_segment`, numbers `is_number`; query and
  fragment are ignored except `commit_id`:
  - `/groups/<g…>/-/epics/<n>` and `/groups/<g…>/-/work_items/<n>` → `Item { Group(g), n }`;
  - `/<p…>/-/issues/<n>`, `/<p…>/-/issues/incident/<n>`, `/<p…>/-/work_items/<n>` → `Item { Project(p), n }`
    (`p` never starts with the segment `groups`);
  - `/<p…>/-/commit/<7–40 hex>` → `Commit`;
  - `/<p…>/-/merge_requests/<n>/diffs` with the query `commit_id=<40 hex>` → `Commit` (a merge request's own commit,
    facts §9);
  - `/<p…>/-/compare/<7–40 hex>...<7–40 hex>` (also `..`) → `Range`;
  - anything else (a merge request, a label, a milestone, a person, a snippet, a compare of branches, `/designs`, a
    longer path, another host or port, http) → None.
- **One entry per thing**, at its first page in `Described.pages` (already document order, once per page): equal
  targets are one; a `Commit` whose sha starts another `Commit`'s sha in the same project is that commit (at the
  earlier mention); a `Range` is equal only to the same project, `from` and `to`.

**References** (design §1.4; `P` = the merge request's project, its namespace `P` before the last `/`):

- `Item` in `Project(Q)`: `#n` when `Q = P`; `<Q's last segment>#n` when `Q`'s namespace is `P`'s; else `<Q>#n`.
- `Item` in `Group(G)` that is an epic: `&n` when `G` is `P`'s namespace, else `<G>&n`; one that is not: `<G>#n`.
- `Commit`: the first 8 characters of the sha (all, when shorter), after `<Q>@` or `<Q's last segment>@` as above.
- `Range`: `<from 8>…<to 8>` (U+2026), with the same prefix.
- A parent: its `webUrl` read with `target_of`; the epic rule when its `workItemType.name` is `Epic`.

**The lookup** (`links/lookup.rs`, `query.rs`):

```rust
/// GitLab's largest `workItems(iids:)` list (facts §11).
pub(crate) const MAX_IIDS_PER_PART: usize = 100;
/// What one part adds to GitLab's score beside its iids: 25 for one iid, 27 for three, 74 for fifty (measured
/// logged out on gitlab.com, 2026-11-04, design §1.2).
pub(crate) const PART_SCORE: u32 = 25;
/// The highest estimated score of one call, below GitLab's limit of 250 logged in (plan §2 #131).
pub(crate) const LOOKUP_BUDGET: u32 = 200;
pub(crate) struct Part { pub namespace: Namespace, pub iids: Vec<u64> }
/// The parts in order of each namespace's first mention, its iids in order of first mention, cut at
/// MAX_IIDS_PER_PART; packed in that order into calls whose `PART_SCORE × parts + iids` stays ≤ LOOKUP_BUDGET.
pub(crate) fn calls(parts: Vec<Part>) -> Vec<Vec<Part>>;

// query.rs — one line; `<k>` from 0 within each call.
// "query MergeRequestLinks($path0: ID!, $iids0: [String!], $first0: Int!, …) { queryComplexity { score limit } \
//  part0: project(fullPath: $path0) { workItems(iids: $iids0, first: $first0) { nodes { ...linked } } } \
//  part1: group(fullPath: $path1) { … } … } \
//  fragment linked on WorkItem { iid title state webUrl workItemType { name } \
//  widgets { ... on WorkItemWidgetHierarchy { parent { iid title webUrl workItemType { name } } } } }"
/// `glab api graphql -f query=<that> -f path<k>=<full path> -F iids<k>=<JSON array of strings> -F first<k>=<count>`.
pub(crate) fn links_args(call: &[Part]) -> Vec<String>;
```

- Each call is one `Glab::get(root, &links_args(call))` (never `--input`, `-X` or stdin). glab's `Err` or any GraphQL
  `errors` entry (`page.rs` `graphql_data`) → `Failed` in those words; later calls are not made.
- **Answers**: `part<k>: null` (a namespace the user may not see, or none) → every iid of it not shown; an iid absent
  from `nodes` → not shown. Never an error.
- **A node**: `workItemType.name == "Epic"` → an epic, else an issue (a task, an incident, …). `state == "CLOSED"` →
  closed. The parent is read only for issues, only from the hierarchy widget, and kept only when its `webUrl` parses,
  is https on the project's origin and `target_of` reads it as an `Item`; its page is `WebPage::linked` of that URL.
  An epic's parent is dropped (rule 4).
- **Groups**: an `Item` shown as an epic → Epics, shown as anything else → Issues; not shown → Epics when its namespace
  is a group, Issues when a project. `Commit` and `Range` → Commits, titled from `Described.commit_titles` of their
  first page; no entry → `title: None`. No commit is ever looked up.
- **Fields asked**: only those of the fragment and `queryComplexity`. Never `epic`, `epics`, `hasEpic`, `hasParent`,
  `onlyTypes`, `reference`, `namespace` or `project` on a work item (RK69: every edition has the asked ones at 15.6,
  `Group.workItems` at 16.3, design §1.2).

**Fake glab** (`scripts/fake-glab/glab`):

- `graphql()`, first of all: a field `query` starting `query MergeRequestLinks` answers
  `$scenario/graphql-links-<iids0>` through `reply`, where `<iids0>` is the field `iids0` without `[`, `]`, `"` and
  spaces, its commas as `-` (`iids0=["12","13","99"]` → `graphql-links-12-13-99`). The comment above `graphql()` says
  so; `tests/glab/README.md`'s table gains the row and the "Scenarios" list the scenario.

**Scenario `tests/glab/mr-links/`** (the project and origin of `merge-requests/`: `taskboard/taskboard`, id 7, on
`https://gitlab.example`; user `sam`):

- `project.json` as `merge-requests/project.json`; `graphql-page-1.json`, one page, the last, rows !62–!57 with the
  list query's fields and each node's `description` (!57 `null`), no `diffHeadSha`.
- `graphql-description-62.json`, GitLab's shapes (design §1.1, copied from the measured snippets), in this order:
  1. `#12` (`gfm-issue`, `href="/taskboard/taskboard/-/work_items/12"`, `data-reference-type="issue"`);
  2. `&3` (`href="https://gitlab.example/groups/taskboard/-/epics/3"`, `data-reference-type="epic"`);
  3. `#13` (`href="/taskboard/taskboard/-/work_items/13"`, `data-reference-type="work_item"`,
     `data-work-item-type="task"`);
  4. `other/lib#5` (`href="/other/lib/-/issues/5"`); `taskboard/web#6` (`href="/taskboard/web/-/issues/6"`);
  5. a plain link `https://gitlab.example/secret/vault/-/issues/9`;
  6. `#12` again as `https://gitlab.example/taskboard/taskboard/-/issues/12#note_7`;
  7. a plain link `https://gitlab.example/taskboard/taskboard/-/work_items/99`;
  8. `https://gitlab.example/groups/taskboard/-/work_items/4`; `https://gitlab.example/groups/design/-/epics/2`;
  9. the commit `fa3335f3` (`href="/taskboard/taskboard/-/commit/fa3335f304f9482273040a55bc9386ddffc6a59f"`,
     `title="Backfill due dates"`, `data-reference-type="commit"`);
  10. this merge request's commit (`href="/taskboard/taskboard/-/merge_requests/62/diffs?commit_id=6ea97d8c` followed
      by 32 more hex digits, `title="Snooze a reminder"`, `data-reference-type="commit"`);
  11. the range `a1b2c3d4…e5f6a7b8` (`href="/taskboard/taskboard/-/compare/a1b2c3d4<32 hex>...e5f6a7b8<32 hex>"`,
      `data-reference-type="commit_range"`, `title="Commits a1b2c3d4 through e5f6a7b8"`);
  12. a plain link `https://gitlab.example/taskboard/taskboard/-/commit/fa3335f3` (the same commit, short);
  13. a plain link `https://gitlab.example/secret/vault/-/commit/0badc0de` + 32 more hex digits;
  14. never listed: `!7` (a merge-request reference), a label, `@anna`, `<code>#12</code>`, a `pre` holding
      `https://gitlab.example/taskboard/taskboard/-/issues/14`, `https://gitlab.other/x/y/-/issues/1`,
      `https://gitlab.example/taskboard/taskboard/-/milestones/1`, `https://gitlab.example/taskboard/taskboard/-/compare/main...feature`,
      `https://docs.example/x`.
- `graphql-links-12-13-99.json` (one call: parts taskboard/taskboard [12, 13, 99], group taskboard [3, 4], other/lib
  [5], taskboard/web [6], secret/vault [9], group design [2]; `queryComplexity` 50 of 250, the measured shape):
  - part0: 12 `Issue` "Snooze a reminder" `OPEN`, parent 3 `Epic` "Board redesign"
    `https://gitlab.example/groups/taskboard/-/work_items/3`; 13 `Task` "Write the snooze test" `OPEN`, parent 12
    `Issue` `https://gitlab.example/taskboard/taskboard/-/work_items/12`; no 99.
  - part1: 3 `Epic` "Board redesign" `OPEN` with a parent epic of its own; 4 `Epic` "Old board" `CLOSED`.
  - part2: 5 `Issue` "Fix date parsing" `CLOSED`, no parent. part3: 6 `Issue` "Web card" `OPEN`, parent on
    `https://evil.example/groups/x/-/work_items/1`. part4: `null`. part5: 2 `Epic` "Design system" `OPEN`.
- `graphql-description-61.json`: only links of item 14 (nothing of rule 2).
- `graphql-description-60.json`: `#30`; `graphql-links-30.err` "glab: a deadline line" and `.exit` 1.
- `graphql-description-59.json` (GitLab Free): `#20`, `#21` (a task), `https://gitlab.example/groups/taskboard/-/epics/8`;
  `graphql-links-20-21.json`: part0 20 `Issue` "Free issue" with the hierarchy widget's `parent: null`, 21 `Task` "Free
  task" with parent 20; part1 `{ "workItems": { "nodes": [] } }`.
- `graphql-description-58.json`: item 9 and item 13 only (commits alone).
- **Expected for !62** (the acceptance's first test):
  - Epics: `&3` "Board redesign" (page `…/groups/taskboard/-/epics/3`); `&4` "Old board" closed; `design&2` "Design
    system".
  - Issues: `#12` "Snooze a reminder", parent `&3` "Board redesign" (page `…/groups/taskboard/-/work_items/3`); `#13`
    "Write the snooze test", parent `#12`; `other/lib#5` "Fix date parsing" closed; `web#6` "Web card", no parent;
    `secret/vault#9` not shown; `#99` not shown.
  - Commits: `fa3335f3` "Backfill due dates"; `6ea97d8c` "Snooze a reminder" (page
    `…/merge_requests/62/diffs?commit_id=6ea97d8c…`); `a1b2c3d4…e5f6a7b8` "Commits a1b2c3d4 through e5f6a7b8";
    `secret/vault@0badc0de` not shown.

## Change

1. **Measure first**, read-only, with the logged-in glab in `../glab-yamt-playground` (as `briefs/mr-people-rust.md`
   step 1). Paste each result. Write nothing to GitLab.
   - `glab --version`.
   - `time glab api graphql -f query='query MergeRequestLinks($path0: ID!, $iids0: [String!], $first0: Int!, $path1:
     ID!, $iids1: [String!], $first1: Int!) { queryComplexity { score limit } part0: project(fullPath: $path0) {
     workItems(iids: $iids0, first: $first0) { nodes { ...linked } } } part1: group(fullPath: $path1) { workItems(iids:
     $iids1, first: $first1) { nodes { ...linked } } } } fragment linked on WorkItem { iid title state webUrl
     workItemType { name } widgets { ... on WorkItemWidgetHierarchy { parent { iid title webUrl workItemType { name } }
     } } }' -f path0=gitlab-org/gitlab -F 'iids0=["628673","630405","630880"]' -F first0=3 -f path1=gitlab-org -F
     'iids1=["22961","22956"]' -F first1=2`. Record the logged-in score, the wall time, and that the answer matches
     design §1.2.
   - The same with 100 iids of gitlab-org/gitlab in part0: score and time, to confirm `PART_SCORE` and that one call
     of the budget stays well inside glab's 20 s.
   - `time` the description query of gitlab-org/gitlab !264728 (design §1.1): with the lookup, one hover's glab time.
   - On the playground: `glab api graphql` of `project(fullPath: "<playground path>") { workItems(first: 3) { nodes {
     iid workItemType { name } } } }`: a Free personal project answers its issues as work items.
2. `links/target.rs` (`target_of`, the references) with unit tests.
3. `description/html.rs` (`commit_titles`) and `description.rs` (`fetch_description`'s error), with their tests updated.
4. `links/lookup.rs` (`calls`, the answer), `query.rs` (`links_args`), `links.rs` (`read_links`, groups, pages, log),
   `project.rs` (`From<NoProject> for LinksReply`), `lib.rs` re-exports, `links/tests.rs`.
5. Fake glab route, the scenario, `tests/links.rs`, `tests/glab/README.md`, then the crate's `AGENTS.md`: the links,
   their routes, the lookup and its budget.

## Acceptance

**Tests** (`cargo nextest run -p yamt-merge-requests` with the hermetic prefix as `just test`), each named for the bug
it catches, at least:

- `links/tests.rs`:
  - `only_issue_epic_and_commit_addresses_on_the_projects_server_count` (RK68: every route of the Contract read; a
    merge request, label, milestone, person, snippet, `/designs`, a compare of branches, another host, another port,
    http, a path outside the sub-path → None)
  - `a_sub_path_install_reads_its_addresses_under_the_sub_path`
  - `a_merge_requests_own_commit_link_is_that_commit`
  - `references_read_as_gitlab_writes_them_from_the_project` (rule 3: same project, sibling, elsewhere; `&n`,
    `G&n`, `G#n`; commits and ranges, 8 characters, `…`)
  - `one_thing_written_three_ways_is_one_line_at_its_first_mention` (RK68: `#12`, its `/-/issues/12#note_7` address,
    its work-item address)
  - `a_short_commit_id_is_the_commit_it_starts`
  - `a_work_item_goes_to_epics_only_when_gitlab_types_it_epic` (rule 2: `Task` → Issues; a group's unseen item → Epics)
  - `an_unseen_namespace_or_a_missing_iid_is_not_shown_without_error` (RK69, rule 6)
  - `a_parent_on_another_host_gets_no_button` (RK41) and `an_epics_own_parent_is_dropped` (rule 4)
  - `a_long_list_is_cut_into_calls_under_the_budget` (RK69: 300 iids of one project and 7 namespaces → each call ≤ 200
    by the estimate, ≤ 100 iids a part, every iid once, order kept)
  - `the_lookup_names_no_premium_only_field` (RK69: the query text holds none of `epic(`, `epics`, `hasEpic`,
    `hasParent`, `onlyTypes`; it holds `widgets { ... on WorkItemWidgetHierarchy`)
  - `every_line_and_parent_page_is_in_pages_once` (RK41)
  - `no_https_origin_lists_nothing_and_asks_nothing`
- `description/tests.rs`: `a_commit_reference_keeps_gitlabs_title_and_no_other_link_does` (only `commit` and
  `commit_range` links, non-empty titles); the existing tests pass with `fetch_description`'s new error.
- `tests/links.rs` over `Fake::new("mr-links")`:
  - `one_hovers_lookup_answers_epics_issues_and_commits_in_order_with_titles_states_and_parents` (!62 equals the
    expected reply above)
  - `a_cross_project_an_unseen_and_a_missing_reference_answer_without_error` (!62's `other/lib#5`, `secret/vault#9`,
    `#99`)
  - `on_gitlab_free_issues_have_no_parent_and_an_epic_is_not_shown_without_error` (!59)
  - `a_description_linking_nothing_asks_no_lookup` (!61: `Read` with empty groups; the log has no `MergeRequestLinks`)
  - `commits_alone_ask_no_lookup` (!58)
  - `a_failed_lookup_fails_the_reply_in_glabs_words` (!60)
  - `glab_missing_or_logged_out_answers_before_any_query` (`logged-out` scenario as `tests/description.rs:309-321`)
  - `reading_links_writes_nothing` (no `stdin:`, no `-X`; argv = auth status, the project, the description, one
    lookup)
  - `the_lookup_is_one_get_with_fields_per_part` (its argv holds `path0=taskboard/taskboard`, `iids0=["12","13","99"]`,
    `first0=3`, … `path5=design`)

**Commands:** `cargo fmt --check`, `cargo clippy -p yamt-merge-requests --all-targets -- -D warnings`, `cargo nextest
run -p yamt-merge-requests`, `cargo check -p yamt-app` (the app still compiles), `shellcheck scripts/fake-glab/glab`:
their summary lines. `just mutants HEAD` in your workspace (SP11).

**Smoke** (the fake by hand, no window yet): `YAMT_FAKE_GLAB=tests/glab/mr-links scripts/fake-glab/glab api graphql -f
'query=query MergeRequestLinks($path0: ID!) { x }' -F 'iids0=["12","13","99"]'` prints `graphql-links-12-13-99.json`;
the same with `-F 'iids=["82"]'` and no `MergeRequestLinks` still routes to discussions (exit 2 here: no such file in
this scenario, as before). Paste both.

## Skills

`skill://rust-conventions`, `skill://risk-register` (proposed RK41 amended, RK68, RK69), `skill://verification`,
`skill://ipc-contract`.
