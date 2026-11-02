# LocalConflictsCheck

Agent output (`agent://LocalConflictsCheck`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-02T17-45-19-979Z_01a19d5d-9b6b-71a4-8899-91c0c235c4e6/LocalConflictsCheck.md), collected 2026-11-02T18:29:46.930Z.

{
  "summary": "The merge-request list now checks conflicts by merging GitLab's two commits locally. The query asks `targetBranch diffHeadSha`. The fold moved to `readiness.rs`, which adds `readiness_after`. New `check.rs`: `check_conflicts`, `MergedPairs`, `CheckSummary`, `ConflictCheck`, a two-at-a-time merge scheduler. `list_merge_requests` returns `Listed`. src-tauri sends `ListMessage::Checked` after `End`, holding the `merged` lock. New: `MergesCleanly`, `CheckedRow`, the `local-conflicts` scenario and its script.",
  "files_changed": [
    "crates/merge-requests/src/lib.rs",
    "crates/merge-requests/src/readiness.rs",
    "crates/merge-requests/src/check.rs",
    "crates/merge-requests/src/check/tests.rs",
    "crates/merge-requests/src/page.rs",
    "crates/merge-requests/src/page/tests.rs",
    "crates/merge-requests/src/query.rs",
    "crates/merge-requests/src/list.rs",
    "crates/merge-requests/tests/list.rs",
    "crates/merge-requests/tests/local_conflicts.rs",
    "crates/merge-requests/AGENTS.md",
    "src-tauri/src/merge_requests.rs",
    "src-tauri/src/merge_requests/tests.rs",
    "scripts/local-conflicts-repo.sh",
    "tests/glab/local-conflicts/project.json",
    "tests/glab/local-conflicts/graphql-page-1.json",
    "tests/glab/merge-requests/graphql-page-1.json",
    "tests/glab/merge-requests/graphql-page-2.json",
    "tests/glab/mr-conflicts/graphql-page-1.json",
    "tests/glab/merge-requests-timeout/graphql-page-1.json",
    "tests/glab/README.md"
  ],
  "tests_added": [
    {
      "name": "local_conflicts::the_local_merge_decides_conflicts_and_gitlab_the_rest",
      "proves": "The rows sent are exactly the table's: 41, 43, 45 and 48 mergesCleanly; 42 conflicts []; 47 conflicts [discussions, draft]. Summary is {9,5,1,0,1,1,None}. The check makes no glab call."
    },
    {
      "name": "local_conflicts::a_head_ref_ahead_of_gitlabs_head_keeps_gitlabs_answer",
      "proves": "Nothing is sent for 44 and moving is 1. After the bare's ref is pointed back at diffHeadSha: moving 0, remembered 8."
    },
    {
      "name": "local_conflicts::a_second_load_with_the_same_pairs_merges_and_fetches_nothing",
      "proves": "The same rows are sent again: merges 0, fetched_refs 0, remembered 7, moving 1, kept 1."
    },
    {
      "name": "local_conflicts::the_check_leaves_refs_status_head_and_fetch_head_byte_identical",
      "proves": "for-each-ref, status --porcelain, the bytes of .git/HEAD and the absence of FETCH_HEAD are the same before the first load and after the second."
    },
    {
      "name": "local_conflicts::an_unreachable_remote_keeps_every_gitlab_answer",
      "proves": "With the bare moved away after the list: nothing sent, merges 0, kept 9, problem = \"ls-remote: fatal: '<bare>' does not appear to be a git repository\"."
    },
    {
      "name": "readiness::tests (3 tests)",
      "proves": "readiness_after over design §2.1's table: every MergeStatus × Clean/Conflicts × both conflicts flags, drafts (Draft added once). Also covers a missing status and an unknown one."
    },
    {
      "name": "check::tests scheduler (two_at_a_time, finishing_order, limit, failed_merge)",
      "proves": "At most MERGES_AT_ONCE merges at once; results come back in finishing order; none starts after the limit (2 with a short limit, 0 with ZERO); an error is passed through."
    },
    {
      "name": "check::tests::each_target_is_asked_once_a_target_holding_a_colon…",
      "proves": "A ':' target and a row without a head get no ls-remote pattern; each target is asked once; the head-ref glob comes last."
    },
    {
      "name": "check::tests pairing / refspecs / failed-fetch filter / send_if_changed",
      "proves": "Rows are paired and moving is counted. Each missing commit is fetched once, by its ref. A failed fetch drops only the rows that needed it. A row is sent only when its readiness changes."
    },
    {
      "name": "check::tests::a_summary_reads_as_its_counts_and_then_its_problem",
      "proves": "Display with and without a problem."
    },
    {
      "name": "page::tests::each_row_s_check_input_holds_its_target_its_head_and_gitlab_s_answer_and_an_odd_head_is_none",
      "proves": "RowToCheck holds iid, targetBranch, diffHeadSha as an Oid (none when short or null) and GitLabMerge."
    },
    {
      "name": "list::only_a_load_that_reached_the_project_hands_rows_to_the_check",
      "proves": "to_check is Some for a loaded list. It is None without glab, when logged out, or when no project is found."
    },
    {
      "name": "src-tauri through_glab::a_load_sends_its_pages_then_its_end_then_the_checked_rows",
      "proves": "The channel gets page, end, then 6 checked messages; the checked iids are 41, 42, 43, 45, 47 and 48 with their readiness JSON."
    },
    {
      "name": "src-tauri through_glab::a_second_load_sends_the_same_checked_rows",
      "proves": "A second load on the same window sends page, end and the same 6 checked rows."
    }
  ],
  "smoke_evidence": [
    {
      "command": "env -u GIT_CONFIG_PARAMETERS -u GIT_CONFIG_COUNT GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_NOSYSTEM=1 XDG_CONFIG_HOME=/nonexistent cargo nextest run -p yamt-merge-requests -p yamt-app",
      "observed": "Summary [   6.728s] 254 tests run: 254 passed, 10 skipped. After the last check.rs refactor, the crate alone: 82 tests run: 82 passed, 1 skipped."
    },
    {
      "command": "cargo nextest run -p yamt-merge-requests -E 'binary(local_conflicts)' (hermetic prefix)",
      "observed": "PASS an_unreachable_remote_keeps_every_gitlab_answer, the_local_merge_decides_conflicts_and_gitlab_the_rest, a_second_load_with_the_same_pairs_merges_and_fetches_nothing, a_head_ref_ahead_of_gitlabs_head_keeps_gitlabs_answer, the_check_leaves_refs_status_head_and_fetch_head_byte_identical — 5 passed"
    },
    {
      "command": "cargo nextest run -p yamt-app merge_requests (hermetic prefix)",
      "observed": "PASS through_glab::a_load_sends_its_pages_then_its_end_then_the_checked_rows; PASS through_glab::a_second_load_sends_the_same_checked_rows; 9 tests run: 9 passed"
    },
    {
      "command": "cargo clippy -p yamt-merge-requests -p yamt-app --all-targets -- -D warnings",
      "observed": "Finished `dev` profile [unoptimized + debuginfo] target(s) in 30.70s (no warnings)"
    },
    {
      "command": "cargo fmt --check",
      "observed": "exit 0"
    },
    {
      "command": "just bindings-check",
      "observed": "Exit 1 with the expected diff only: a new `export type CheckedRow = { iid: MergeRequestIid, readiness: Readiness }`. `ListMessage` gains `| { kind: \"checked\"; row: CheckedRow }` and a new doc line. `Readiness` gains `| { kind: \"mergesCleanly\" }` and a new doc line. Nothing else changed."
    },
    {
      "command": "just arch-check",
      "observed": "arch-check: ok"
    },
    {
      "command": "scripts/local-conflicts-repo.sh <tmp>/r (run twice)",
      "observed": "The bare has refs/merge-requests/41..48/head; 45 is c595b71028b328604101e0925b39d1a5eafc7bc9 both times. In the checkout, `cat-file` of c595b71 fails (the commit is not there). merge-tree against main: clean 0, due-dates 1, merged 0; against develop: clean 0."
    },
    {
      "command": "just map-check",
      "observed": "map-check: ok"
    },
    {
      "command": "just mutants HEAD",
      "observed": "Found 84 mutants to test … 64 caught, 17 unviable, 1 missed (check.rs:355 `<`→`<=`), 2 timeouts (check.rs:368 `-=`→`+=`/`/=`, the scheduler loop hangs); no TypeScript changes since HEAD"
    }
  ],
  "mutation": {
    "command": "just mutants HEAD → 84 mutants: 64 caught, 17 unviable, 1 missed, 2 timeout (a timeout means the mutant hangs, so the tests catch it)",
    "survivors": [
      "crates/merge-requests/src/check.rs:355 replace < with <= in merged_in_finishing_order (`phase_start.elapsed() < limit`) — equivalent: they differ only when elapsed equals the limit to the nanosecond; no test can hit that instant."
    ]
  },
  "acceptance_not_run": [],
  "deviations_from_brief": [
    "The order of the checked rows is not fixed: merges finish in any order, two at a time. The src-tauri test asserts the message order page, end, then 6 checked, and compares the checked rows sorted by iid (41, 42, 43, 45, 47, 48). tests/local_conflicts.rs also sorts the rows it gets by iid.",
    "`problem` text: a stop is git's own words (version error, \"git X.Y cannot merge without a checkout (needs 2.38)\", \"no remote of the repository names the project <path>\"). ls-remote and fetch errors get a prefix: \"ls-remote: <git's first line>\" and \"fetch: <…>\". A failed merge gives gitio's error text.",
    "`MergedPairs` is keyed by a private `Pair { target, source }` struct rather than a `(Oid, Oid)` tuple. The brief marks the field private, so this is only a naming choice.",
    "`page::count` is now pub(crate), so check.rs reuses it instead of a second copy. `Node.iid` parsing moved into `merge_request_iid` to keep `row` within 40 lines.",
    "Extra checks beyond the acceptance lines: tests/list.rs gains `only_a_load_that_reached_the_project_hands_rows_to_the_check`; the moving-row test also points 44's ref back and expects moving 0, remembered 8; the first scenario test asserts the check makes no glab call.",
    "scripts/local-conflicts-repo.sh sets the fixed author and committer env inline. mr-conflict-repo.sh's `commit_at` is local to that script and git-sandbox.sh is outside Owned. Moving `commit_at` into git-sandbox.sh would remove the copy.",
    "open.rs still builds `refs/heads/<t>` and `refs/merge-requests/<iid>/head` inline. check.rs has `branch_ref`/`head_ref` for the same two refs. prepare_open was left alone (non-goal); a later patch could share the two helpers.",
    "Docs keeper, architecture §3.5 l.492-496, 507-518: `MergeRequestState` gains `merged: Mutex<MergedPairs>`. `list_merge_requests` sends pages, `End`, then runs `check_conflicts` under `merged` and sends each row as `Checked` (send failures unlogged); it answers after the check. The compare window runs version, ls-remote, cat-file, maybe a fetch, and merge-tree on each load.",
    "Docs keeper, architecture §3.9: \"no Mutex, nothing cached\" becomes \"no `Mutex`; the one memory across loads is the run's `MergedPairs`, held by the shell and lent to `check_conflicts` (plan #149)\". Also list: the query fields, `readiness.rs`, `check.rs` and its four constants, `Listed`, `CheckedRow`, `mergesCleanly`, the `local-conflicts` scenario.",
    "Docs keeper, architecture §4 l.852-856 and 980: `ListMessage` = page | end | checked { row: CheckedRow }; Readiness gains `mergesCleanly`. §5.1 l.1074-1075: the rows' readiness gets a second writer, the `checked` messages; `merged` is owned by src-tauri `MergeRequestState`.",
    "Docs keeper, project-map: tree.md gets `scripts/local-conflicts-repo.sh` (map-check passes without it today), plus `crates/merge-requests/src/{check.rs,readiness.rs}` if crate files are listed. state.md gets a row: `MergedPairs`, owner src-tauri `MergeRequestState.merged`, only writer `yamt_merge_requests::check_conflicts`. Rows: a second writer, the `checked` messages.",
    "Docs keeper: risk register RK52 proving tests are `crates/merge-requests/tests/local_conflicts.rs` (byte-identical refs, status, HEAD, FETCH_HEAD; the moving row) and `check/tests.rs`. README.md:83 needs the new state. docs/plan.md rows 149–150. The orchestrator runs `just bindings` before LocalConflictsPage."
  ],
  "open_risks": [
    {
      "location": "crates/merge-requests/src/check.rs:357-372 (merged_in_finishing_order)",
      "risk": "If a merge thread panicked, `finished.recv()` would block forever: the loop's own `sender` stays alive. merge_tree never panics (panics are denied outside tests), so this is theoretical."
    },
    {
      "location": "crates/merge-requests/src/check/tests.rs (scheduler tests)",
      "risk": "The scheduler tests rely on timing (10 ms vs 150 ms sleeps, a 10 ms limit). The margins are wide, but a heavily loaded CI machine could still make them flaky."
    },
    {
      "location": "crates/merge-requests/src/check.rs:261-265 (failed fetch path)",
      "risk": "No integration test makes the fetch fail after ls-remote has succeeded. The row filter is unit-tested (with_local_commits); the wiring to it is not."
    },
    {
      "location": "src-tauri/src/merge_requests.rs:108-129 (list)",
      "risk": "The command now answers only after the check: up to 20 s ls-remote, 120 s fetch and 60 s of merges. A Refresh during a check waits on `merged` before its own check, as design option A intends."
    }
  ]
}
