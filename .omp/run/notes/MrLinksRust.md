# MrLinksRust

Agent output (`agent://MrLinksRust`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-03T21-08-17-015Z_01a1a33d-c5f7-7658-b66f-85ea275269a1/MrLinksRust.md), collected 2026-11-04T01:45:55.344Z.

{
  "summary": "New in `yamt-merge-requests`: `read_links(repository, glab, iid) -> ReadLinks`. It reuses the description request (`fetch_description` now returns `Result<String, String>`) and the description walk, which now also keeps `commit_titles`. It reads each page as an epic, issue, commit or range with `target_of`, keeps one line per thing at its first mention, writes GitLab-style references, and looks up the items with one `MergeRequestLinks` query per call, packed under a score of 200. Also new: the fake-glab `graphql-links-<iids0>` route, the `mr-links` scenario, and unit and integration tests.",
  "files_changed": [
    "crates/merge-requests/src/links.rs",
    "crates/merge-requests/src/links/target.rs",
    "crates/merge-requests/src/links/lookup.rs",
    "crates/merge-requests/src/links/tests.rs",
    "crates/merge-requests/src/description.rs",
    "crates/merge-requests/src/description/html.rs",
    "crates/merge-requests/src/description/element.rs",
    "crates/merge-requests/src/description/tests.rs",
    "crates/merge-requests/src/query.rs",
    "crates/merge-requests/src/project.rs",
    "crates/merge-requests/src/lib.rs",
    "crates/merge-requests/tests/links.rs",
    "crates/merge-requests/AGENTS.md",
    "scripts/fake-glab/glab",
    "tests/glab/README.md",
    "tests/glab/mr-links/project.json",
    "tests/glab/mr-links/graphql-page-1.json",
    "tests/glab/mr-links/graphql-description-62.json",
    "tests/glab/mr-links/graphql-description-61.json",
    "tests/glab/mr-links/graphql-description-60.json",
    "tests/glab/mr-links/graphql-description-59.json",
    "tests/glab/mr-links/graphql-description-58.json",
    "tests/glab/mr-links/graphql-links-12-13-99.json",
    "tests/glab/mr-links/graphql-links-20-21.json",
    "tests/glab/mr-links/graphql-links-30.err",
    "tests/glab/mr-links/graphql-links-30.exit"
  ],
  "tests_added": [
    {
      "name": "links::tests::only_issue_epic_and_commit_addresses_on_the_projects_server_count",
      "proves": "RK68: every contracted route is read; a merge request, label, milestone, person, snippet, /designs, branch compare, non-hex range, bad sha, groups project, other host/port and http give None"
    },
    {
      "name": "links::tests::a_sub_path_install_reads_its_addresses_under_the_sub_path",
      "proves": "routes are read only under the sub-path; a web_path not ending in the full path counts nothing"
    },
    {
      "name": "links::tests::a_merge_requests_own_commit_link_is_that_commit",
      "proves": "diffs?commit_id=<40 hex> is a Commit, the same commit as its short /-/commit/ link, at the first page"
    },
    {
      "name": "links::tests::references_read_as_gitlab_writes_them_from_the_project",
      "proves": "rule 3: #n, sibling#n, path#n, &n, G&n, G#n, 8-character commits with @ prefixes, ranges joined by …"
    },
    {
      "name": "links::tests::one_thing_written_three_ways_is_one_line_at_its_first_mention",
      "proves": "RK68: #12 written three ways and an epic written two ways are one line each and one iid each in the lookup"
    },
    {
      "name": "links::tests::a_short_commit_id_is_the_commit_it_starts",
      "proves": "prefix matching only within the same project, in both orders, earlier mention kept"
    },
    {
      "name": "links::tests::a_work_item_goes_to_epics_only_when_gitlab_types_it_epic",
      "proves": "rule 2: a Task or a group's Issue goes to Issues; a group item not shown goes to Epics, a project item not shown to Issues"
    },
    {
      "name": "links::tests::an_unseen_namespace_or_a_missing_iid_is_not_shown_without_error",
      "proves": "RK69: a null part or an absent iid is not shown and is no error; glab's Err fails in its own words"
    },
    {
      "name": "links::tests::a_parent_on_another_host_gets_no_button / an_epics_own_parent_is_dropped",
      "proves": "RK41: no parent kept for another host, http, a non-item address or an unreadable one; an epic's parent never reaches the reply or the pages"
    },
    {
      "name": "links::tests::a_long_list_is_cut_into_calls_under_the_budget",
      "proves": "RK69: 300 iids plus 7 namespaces: every call ≤ 200 by the estimate, ≤ 100 iids per part, every iid once, order kept, the exact packing"
    },
    {
      "name": "links::tests::the_lookup_names_no_premium_only_field",
      "proves": "RK69: exact argv; the query names none of the Premium-only or post-15.6 fields and does hold the hierarchy widget"
    },
    {
      "name": "links::tests::every_line_and_parent_page_is_in_pages_once / no_https_origin_lists_nothing_and_asks_nothing",
      "proves": "RK41: every line and parent page offered once; without https nothing is listed and nothing asked; commits alone ask nothing"
    },
    {
      "name": "links::tests::each_call_is_counted_the_highest_score_kept_and_a_failure_ends_the_lookup / the_log_counts_each_group_and_what_gitlab_did_not_show",
      "proves": "the log's call count, highest score and counts; a failing call ends the lookup with no later call"
    },
    {
      "name": "description::tests::a_commit_reference_keeps_gitlabs_title_and_no_other_link_does",
      "proves": "only commit or commit_range links with a non-empty title are kept, the first per page"
    },
    {
      "name": "tests/links.rs (9 acceptance tests + every_line_and_parent_is_offered_once)",
      "proves": "!62 equals the expected reply; cross-project, unseen and missing; GitLab Free; no lookup for !61 or !58; failed lookup; glab missing or logged out; read-only argv; one get with fields per part; pages"
    }
  ],
  "smoke_evidence": [
    {
      "command": "cargo fmt --check",
      "observed": "no diff (fmt-ok)"
    },
    {
      "command": "cargo clippy -p yamt-merge-requests --all-targets -- -D warnings",
      "observed": "Finished `dev` profile [unoptimized + debuginfo] target(s) in 0.12s (no warnings)"
    },
    {
      "command": "env -u GIT_CONFIG_PARAMETERS -u GIT_CONFIG_COUNT GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_NOSYSTEM=1 XDG_CONFIG_HOME=/nonexistent cargo nextest run -p yamt-merge-requests",
      "observed": "Summary [   2.318s] 266 tests run: 266 passed, 1 skipped"
    },
    {
      "command": "cargo check -p yamt-app",
      "observed": "Finished `dev` profile [unoptimized + debuginfo] target(s) (the app compiles unchanged)"
    },
    {
      "command": "uvx --from shellcheck-py shellcheck scripts/fake-glab/glab  (ShellCheck 0.11.0; shellcheck is not on PATH here)",
      "observed": "no findings (shellcheck-clean)"
    },
    {
      "command": "YAMT_FAKE_GLAB=tests/glab/mr-links scripts/fake-glab/glab api graphql -f 'query=query MergeRequestLinks($path0: ID!) { x }' -F 'iids0=[\"12\",\"13\",\"99\"]' | cmp - <graphql-links-12-13-99.json>",
      "observed": "same as graphql-links-12-13-99.json; exit=0; output starts {\\n  \"data\": {\\n    \"queryComplexity\": { \"score\": 50, \"limit\": 250 },"
    },
    {
      "command": "YAMT_FAKE_GLAB=tests/glab/mr-links scripts/fake-glab/glab api graphql -F 'iids=[\"82\"]'",
      "observed": "fake glab: the scenario has no answer graphql-discussions-82.json; exit=2 (routes to discussions as before)"
    },
    {
      "command": "step 1: glab --version; time glab api graphql <MergeRequestLinks, gitlab-org/gitlab [628673,630405,630880] + group gitlab-org [22961,22956]> (logged in, in ../glab-yamt-playground)",
      "observed": "glab 1.126.0; {\"score\":50,\"limit\":250}; real 0m6.186s and 0m6.253s on a rerun. Issues come back with their epic parents (Epic, …/groups/gitlab-org/-/work_items/22961), the epics with their own parents, errors null, nodes NOT in the asked order. Group part alone: score 26, 6.95 s"
    },
    {
      "command": "step 1: the same with 100 iids (630781–630880) of gitlab-org/gitlab in part0, first0=100",
      "observed": "{\"score\":124,\"limit\":250}; 55 nodes; errors null; real 0m1.602s (25 + 100 = 125 estimate ≥ 124, so PART_SCORE holds)"
    },
    {
      "command": "step 1: time the description query of gitlab-org/gitlab !264728; playground workItems(first: 3)",
      "observed": "23818 bytes, real 0m0.805s. Playground samubr/glab-yamt-playground: {\"data\":{\"project\":{\"workItems\":{\"nodes\":[]}}}}, no error; it has no issues (REST issues []; issues nodes [])"
    }
  ],
  "mutation": {
    "command": "just mutants HEAD → Found 125 mutants to test; 125 mutants tested in 8m: 1 missed, 103 caught, 21 unviable (no TypeScript changes)",
    "survivors": [
      "crates/merge-requests/src/links.rs:324 replace log_read with () — wiring: it only emits the info line; counts(), outcome(), calls and score are each tested; no tracing-subscriber dev-dep (Cargo.toml read-only)"
    ]
  },
  "acceptance_not_run": [],
  "deviations_from_brief": [
    "Added `pub(crate) fn described_on(project, iid, html) -> Described` in description.rs, so the walk's base (WebPage::merge_request, None off https) is built in one place for read_description and read_links. `Described` is re-exported pub(crate) from description.rs.",
    "GitLab's commit title is read by a new `description/element.rs` `commit_title(link)`; `Walk::keep_page` stores it. This keeps html.rs under 400 lines; the `Described.commit_titles` field is exactly as contracted.",
    "`DescriptionLinks` also derives `Default` (an added derive, used for the empty Read). Added a private `counts()` and `Looked.calls`/`score` so the log is testable.",
    "Decided where the brief was silent: a group item GitLab did not show takes the epic reference rule (`&n` / `G&n`). A commit seen first by its short id keeps that id and page. If the project's web_path does not end in `/<full_path>`, no page counts (`Server::of` returns None).",
    "Measured (step 1): the logged-in lookup with a gitlab-org group part takes 6.2 s; that part alone takes 6.9 s, score 26. Rule 5's 'about a second' does not hold there. Score 50 of 250 matches design §1.2. Please record this in the design/plan #175.",
    "Step 1's playground check: the playground has no issues, so workItems answered `nodes: []` with no error. That a Free project's issues come back as work items is not confirmed.",
    "Docs outside my globs, for the docs keeper: architecture.md §3.9 Links, the read_links command, the mr-links scenario in the tests line; project-map tree.md: links.rs, links/{target,lookup,tests}.rs, tests/links.rs; ipc-contract: read_links. The crate AGENTS.md line 1 project.rs `From` list should also name `LinksReply` (I did not rewrite that very long line).",
    "shellcheck is not installed on this workstation; I ran it through `uvx --from shellcheck-py` (ShellCheck 0.11.0)."
  ],
  "open_risks": [
    {
      "location": "crates/merge-requests/src/links/lookup.rs:118-146",
      "risk": "A big group (gitlab-org) makes one call take about 6–7 s; calls run one after another, so a long description can take several times that (each call stays under glab's 20 s deadline)."
    },
    {
      "location": "crates/merge-requests/src/links/target.rs:95",
      "risk": "The origin is compared as Url serialises it with `Project.web_origin`. A web_url with an explicit default port (:443) or upper-case host would list nothing."
    },
    {
      "location": "crates/merge-requests/src/links/lookup.rs:62-70",
      "risk": "Node parsing is strict: a work item with a null title, state or type fails the whole reply as 'GitLab's answer is not what yamt expects' instead of showing that one line as not shown."
    },
    {
      "location": "crates/merge-requests/src/links/target.rs:98",
      "risk": "Path segments must pass is_path_segment (no %-escapes), so a percent-encoded route segment never counts. GitLab paths have none, but this is not measured."
    }
  ]
}
