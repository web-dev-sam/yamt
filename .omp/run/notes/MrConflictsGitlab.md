# MrConflictsGitlab

Agent output (`agent://MrConflictsGitlab`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-10-30T21-21-14-771Z_01a18eb0-3413-7251-ad3d-5e4e0123ce8e/MrConflictsGitlab.md), collected 2026-10-30T21:41:29.644Z.

{
  "summary": "Each merge-request row now carries `size`, `readiness` and `from_fork`. GitLab's 24 merge statuses fold into `Readiness` in page.rs, conflict first (#1998). New `resolve.rs` `prepare_resolve` asks GitLab for the branches and finds the project's remote. It shares open.rs's login-and-project steps (`project::logged_in_project`) and the `:` branch rule (`require_branch_name`), one copy each. Recorded answers gain the 5 fields; new `tests/glab/mr-conflicts/` scenario; TS fixture rows follow the readiness cycle.",
  "files_changed": [
    "crates/merge-requests/src/lib.rs",
    "crates/merge-requests/src/page.rs",
    "crates/merge-requests/src/page/tests.rs",
    "crates/merge-requests/src/query.rs",
    "crates/merge-requests/src/project.rs",
    "crates/merge-requests/src/open.rs",
    "crates/merge-requests/src/list.rs",
    "crates/merge-requests/src/resolve.rs",
    "crates/merge-requests/tests/resolve.rs",
    "crates/merge-requests/AGENTS.md",
    "tests/glab/merge-requests/graphql-page-1.json",
    "tests/glab/merge-requests/graphql-page-2.json",
    "tests/glab/merge-requests-timeout/graphql-page-1.json",
    "tests/glab/mr-conflicts/project.json",
    "tests/glab/mr-conflicts/graphql-page-1.json",
    "tests/glab/mr-conflicts/graphql-merge-request-21.json",
    "tests/glab/mr-conflicts/graphql-merge-request-22.json",
    "tests/glab/mr-conflicts/graphql-merge-request-23.json",
    "tests/glab/mr-conflicts/graphql-merge-request-29.json",
    "tests/glab/mr-conflicts/graphql-merge-request-30.json",
    "tests/glab/mr-conflicts/graphql-merge-request-33.json",
    "tests/glab/README.md",
    "frontend/src/ipc/fixtureMergeRequestData.ts",
    "frontend/src/ipc/fixtureMergeRequestData.test.ts",
    "frontend/src/ipc/mergeRequestDomain.test.ts",
    "frontend/src/ipc/tauriMergeRequests.test.ts"
  ],
  "tests_added": [
    {
      "name": "page::tests::every_gitlab_merge_status_folds_as_the_table_null_is_checking_and_an_unknown_one_blocks",
      "proves": "Checks all 24 GitLab values against a fixed-size table (`[_; 24]`), so a dropped mapping fails. Also: MERGE_TRAIN_STUCK becomes Blocked{Other}, and a null status in the JSON becomes Checking."
    },
    {
      "name": "page::tests::a_conflict_flag_or_status_comes_first_with_the_status_s_blocker_then_a_draft",
      "proves": "conflicts:true + DRAFT_STATUS on a draft → [Draft]; CI_MUST_PASS on a draft → [PipelineMustPass, Draft]; MERGEABLE/CHECKING/NEED_REBASE/null → []; an unknown status → [Other]; CONFLICT without the flag → Conflicts."
    },
    {
      "name": "page::tests::counts_saturate_a_null_summary_is_no_size_and_another_or_no_source_project_is_a_fork",
      "proves": "A count of -3 becomes 0 and 5e9 becomes u32::MAX; a null summary gives size None; source project 2 with target 1 is a fork, and so is a null source project."
    },
    {
      "name": "page::tests::the_mr_conflicts_scenario_s_page_folds_as_its_readme_says",
      "proves": "Every row of the new scenario has the expected iid, readiness and fork flag: !31 → Conflicts{[Draft]}, !32 → Conflicts{[PipelineMustPass, Draft]}, !22 is a fork, !27 has no size."
    },
    {
      "name": "query::tests::the_branches_query_is_one_line_with_balanced_braces_and_its_argv_is_exact",
      "proves": "The BRANCHES_QUERY text and the full argv of `branches_args` match exactly."
    },
    {
      "name": "query::tests::the_query_is_one_line_with_balanced_braces_the_failed_job_limit_and_the_merge_fields",
      "proves": "The list query asks for the five new node fields and stays one line with balanced braces."
    },
    {
      "name": "resolve::an_open_merge_request_names_its_branches_and_the_project_s_remote_and_changes_nothing",
      "proves": "!21 gives ResolveTarget{origin, feature/due-dates, main}; refs, status and HEAD stay the same; the logged call ends with `-f fullPath=taskboard/taskboard -f iid=21`."
    },
    {
      "name": "resolve::a_fork_s_merge_request_and_one_no_longer_open_are_refused",
      "proves": "!22 → FromFork, !30 → NotOpen."
    },
    {
      "name": "resolve::without_a_remote_of_the_project_there_is_nothing_to_resolve_in",
      "proves": "With origin pointing at another project the answer is NoRemote{project: taskboard/taskboard}."
    },
    {
      "name": "resolve::a_branch_name_naming_a_ref_to_write_is_refused",
      "proves": "!33's source branch `feature/x:refs/heads/main` → Failed with the same message open.rs uses."
    },
    {
      "name": "resolve::glab_missing_or_logged_out_is_answered_before_gitlab_is_asked",
      "proves": "No glab → GlabMissing; logged out → NotLoggedIn, and the only glab call made is `auth status`."
    },
    {
      "name": "fixtureMergeRequestData.test.ts (2 tests)",
      "proves": "Pins the fixture cycle: 640 conflicts, 639 conflicts from a fork, 636 conflicts also discussions with no size, 634 blocked draft, 620 conflicts also discussions+draft; the list of forks and of rows without a size."
    }
  ],
  "smoke_evidence": [
    {
      "command": "<hermetic_git> cargo nextest run -p yamt-merge-requests",
      "observed": "PASS resolve glab_missing_or_logged_out…, a_branch_name_naming_a_ref_to_write_is_refused, without_a_remote_of_the_project…, an_open_merge_request_names_its_branches…, a_fork_s_merge_request_and_one_no_longer_open_are_refused; Summary 58 tests run: 58 passed, 1 skipped"
    },
    {
      "command": "cargo clippy -p yamt-merge-requests --all-targets -- -D warnings",
      "observed": "Checking yamt-merge-requests v0.6.2 … Finished `dev` profile (no warnings)"
    },
    {
      "command": "cargo fmt --check",
      "observed": "exit 0 (printed fmt-ok)"
    },
    {
      "command": "<hermetic_git> cargo nextest run -p yamt-app merge_requests",
      "observed": "PASS a_repository_with_a_gitlab_remote_is_found_and_one_without_is_none, through_glab::every_page_then_one_end_reaches_the_window_s_channel, through_glab::only_a_page_a_list_sent_is_handed_to_the_browser; Summary 3 tests run: 3 passed, 153 skipped"
    },
    {
      "command": "just bindings (in workspace; bindings.ts then restored with git checkout, not in the patch)",
      "observed": "bindings.ts +77 lines: BlockedReason, ChangeSize, Readiness, `size: ChangeSize | null` on MergeRequestRow"
    },
    {
      "command": "pnpm -C frontend test src/ipc/fixtureMergeRequestData.test.ts src/ipc/mergeRequestDomain.test.ts src/ipc/tauriMergeRequests.test.ts src/ipc/fixtureMergeRequests.test.ts",
      "observed": "Test Files 4 passed (4); Tests 54 passed (54)"
    },
    {
      "command": "pnpm -C frontend typecheck",
      "observed": "$ vue-tsc -b — no errors, exit 0"
    },
    {
      "command": "just mutants HEAD",
      "observed": "Rust: 40 mutants tested in 60s: 26 caught, 14 unviable (missed.txt and timeout.txt empty). Stryker fixtureMergeRequestData.ts: 124 killed, 82 survived, 2 no coverage, all on module-level static lines ≤91"
    }
  ],
  "mutation": {
    "command": "just mutants HEAD → Rust 40 mutants: 26 caught, 14 unviable, 0 missed; Stryker fixtureMergeRequestData.ts 124 killed / 82 survived / 2 no-cov",
    "survivors": [
      "frontend/src/ipc/fixtureMergeRequestData.ts:77-85 READINESS literal mutants — equivalent: module-level static, not re-run under vitest (#732); 82:30 `also: []` survives a test asserting [discussions]. Lines 131-171 have none.",
      "frontend/src/ipc/fixtureMergeRequestData.ts:25-30 new tunable consts — equivalent: same module-level static case; their effects are killed via size()/fromFork in the functions"
    ]
  },
  "acceptance_not_run": [],
  "deviations_from_brief": [
    "list.rs also uses the shared `project::logged_in_project` (glab auth + project) and `From<NoProject> for ListEnd`, so the auth fold exists once for all three callers instead of open+resolve sharing it and list keeping a copy. `project()` was folded into `logged_in_project`.",
    "Added `tests/glab/mr-conflicts/graphql-merge-request-33.json` (opened, source `feature/x:refs/heads/main`) for the acceptance line 'a `:` branch → Failed'; the brief lists no iid for it. The README documents it.",
    "`ResolveTarget` derives Clone, Debug, PartialEq, Eq like `RangeToOpen` (add-only; the tests compare it).",
    "The recorded `queryComplexity.score` is 119 instead of 112 in the three edited merge-requests pages (the design's [INFERENCE] for the wider query); page test updated.",
    "`details_args` and `branches_args` share a private `merge_request_args(query, full_path, iid)`.",
    "docs/architecture.md §3.9 (needs edit, not owned): add `resolve.rs` `prepare_resolve` (glab → logged_in_project → branches query → NotOpen/FromFork/`:` → remote_for → NoRemote), the new IPC types ChangeSize/Readiness/BlockedReason/ResolveRefusal, the fold, and `tests/resolve.rs` on scenario `mr-conflicts/`.",
    "project-map tree.md line 64-68 crates/merge-requests (needs edit, not owned): add the row fields and `resolve` (`prepare_resolve`); tree.md:252 tests/glab: add `mr-conflicts`.",
    "risk-register RK40 (needs edit, not owned): add `prepare_resolve` (`require_branch_name`) to the owner and `a_branch_name_naming_a_ref_to_write_is_refused` to the tests."
  ],
  "open_risks": [
    {
      "location": "tests/glab/mr-conflicts/graphql-page-1.json",
      "risk": "Project ids are 1/1 and 2/1 as the brief says, while project.json has id 7. No code compares them, but a later build that checks the project id would disagree."
    },
    {
      "location": "crates/merge-requests/src/page.rs:96-99",
      "risk": "`conflicts: bool` and `target_project_id: i64` are required, matching GitLab's non-null types. An older GitLab without these fields fails the whole page with 'not what yamt expects' instead of degrading."
    },
    {
      "location": "crates/merge-requests/src/query.rs:15-18",
      "risk": "The ~119 complexity score is still an estimate; only the owner's real GitLab run measures it."
    }
  ]
}
