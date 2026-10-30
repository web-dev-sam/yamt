# MrDetectList

Agent output (`agent://MrDetectList`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-10-30T13-26-49-608Z_01a18cfd-dc08-7052-b10f-ed6a2bb5d1b5/MrDetectList.md), collected 2026-10-30T13:56:46.597Z.

{
  "summary": "New crate yamt-merge-requests: offline GitLab detection, the §2.1 IPC types, the one-line GraphQL list query, page parsing and list_merge_requests (≤5 pages, Cut at 500, sent pages stay). gitio gains Glab::get, Glab::auth_status/AuthStatus, public first_line/last_line/TIMED_OUT and Repo::remote_urls/RemoteUrl, which review now calls (clean cutover). The fake glab gains fields, POST-on-fields, projects/:fullpath and GraphQL routes, plus two scenarios; arch-check has the crate's rule.",
  "files_changed": [
    "crates/merge-requests/Cargo.toml",
    "crates/merge-requests/AGENTS.md",
    "crates/merge-requests/src/lib.rs",
    "crates/merge-requests/src/detect.rs",
    "crates/merge-requests/src/project.rs",
    "crates/merge-requests/src/query.rs",
    "crates/merge-requests/src/page.rs",
    "crates/merge-requests/src/page/tests.rs",
    "crates/merge-requests/src/list.rs",
    "crates/merge-requests/src/job_page.rs",
    "crates/merge-requests/tests/list.rs",
    "crates/merge-requests/tests/detect.rs",
    "crates/gitio/src/glab.rs",
    "crates/gitio/src/names.rs",
    "crates/gitio/src/lib.rs",
    "crates/gitio/tests/glab.rs",
    "crates/review/src/glab_answer.rs",
    "crates/review/src/send.rs",
    "scripts/arch-check.sh",
    "scripts/fake-glab/glab",
    "tests/glab/README.md",
    "tests/glab/merge-requests/{project.json,graphql-page-1.json,graphql-page-2.json}",
    "tests/glab/merge-requests-timeout/{project.json,graphql-page-1.json,graphql-page-1.sleep}",
    "Cargo.lock (cargo-generated)"
  ],
  "tests_added": [
    {
      "name": "detect.rs units: remote_host for scp/ssh/https, local path/file/drive; is_gitlab_host",
      "proves": "the host comes from scp, ssh with a port and https with credentials; file://, local paths and C:\\ have none; github.com and my-gitlab.com are not GitLab; GITLAB_HOST's host is"
    },
    {
      "name": "tests/detect.rs a_repository_with_any_remote_on_gitlab_is_found_from_a_subfolder / no_repository_no_remote_or_no_gitlab_remote_is_no_project",
      "proves": "Found{repository = absolute common git dir} and root on a real repo; None for no repository, no remotes, or only GitHub/local/unknown-host remotes"
    },
    {
      "name": "tests/detect.rs gitlab_host_and_gl_host_name_glab_s_server",
      "proves": "in a child process, GITLAB_HOST (a URL) and GL_HOST (a mixed-case host) make a remote on git.corp.example count as GitLab"
    },
    {
      "name": "page/tests.rs (8 tests over recorded and inline JSON)",
      "proves": "rows, me, cursor and complexity; null counts give 0, negatives 0, overflow saturates; every status maps, an unknown one is Pending; GraphQL errors give the first message; no data, project or cursor, or a bad iid, is Err"
    },
    {
      "name": "job_page::tests (2)",
      "proves": "refuses http://, //evil, .., ?query, #fragment, foreign paths, credentials in the origin and empty segments"
    },
    {
      "name": "list::tests (3, injected fetcher)",
      "proves": "each cursor is passed on; 5 pages with more to come give Cut{500} and no 6th call (exactly 5 gives Loaded); a failing page gives Failed and the pages already sent stay"
    },
    {
      "name": "tests/list.rs the_list_comes_page_by_page_from_glab_graphql_after_each_cursor",
      "proves": "fake-glab argv: auth status, api projects/:fullpath, graphql ending '-f fullPath=taskboard/taskboard -F first=100', then the same plus '-f after=page-2'; pages [13,12,11],[9,8]; job page https"
    },
    {
      "name": "tests/list.rs: working folder and env; glab missing / logged out; timeout; project 404 (4 tests)",
      "proves": "cwd = repo root and env on every call; GlabMissing; NotLoggedIn{gitlab.com} after only auth status; Failed('glab timed out') under 25 s; a 404 project gives Failed in glab's words"
    },
    {
      "name": "gitio tests/glab.rs: get, auth_status, remote_urls (+ unit tests of line helpers, exit words, parse_remote_urls)",
      "proves": "the moved behaviour is the same in gitio; no remotes (exit 1) gives an empty list, a broken config gives GitFailed"
    },
    {
      "name": "query::tests::the_query_is_one_line_with_balanced_braces_and_the_failed_job_limit",
      "proves": "the query has no newline (one log line per call), balanced braces, and jobs first: 50"
    },
    {
      "name": "project::tests (2)",
      "proves": "full_path and an https origin with its port come from the project; an http GitLab has no origin; an error body is Err"
    }
  ],
  "smoke_evidence": [
    {
      "command": "cargo test --workspace (count of test-result lines)",
      "observed": "suites=96 passed=980 failed=0; yamt_merge_requests unit 19 passed; tests/detect.rs 3 passed 1 ignored; tests/list.rs 5 passed; yamt_review unit 35 passed; tests/review.rs 15 passed; gitio tests/glab.rs 14 passed 3 ignored"
    },
    {
      "command": "cargo test -p yamt-gitio -p yamt-review -p yamt-merge-requests (after the last edit)",
      "observed": "passed=264 failed=0"
    },
    {
      "command": "cargo clippy --workspace --all-targets --features yamt-app/bindings -- -D warnings (after cargo clean -p of the 3 crates)",
      "observed": "Checking yamt-gitio / yamt-merge-requests / yamt-review … Finished `dev` profile; no warning or error"
    },
    {
      "command": "cargo fmt --all --check",
      "observed": "fmt-ok (exit 0)"
    },
    {
      "command": "scripts/arch-check.sh",
      "observed": "arch-check: ok"
    },
    {
      "command": "scripts/arch-check.sh with yamt-review temporarily added to crates/merge-requests/Cargo.toml (then removed)",
      "observed": "arch-check: yamt-merge-requests depends on yamt-range, yamt-gitio and yamt-merge-core only among yamt crates, and never on tauri, not: yamt-review; exit=1. After the revert: arch-check: ok, exit=0"
    },
    {
      "command": "YAMT_FAKE_GLAB=tests/glab/merge-requests scripts/fake-glab/glab api graphql -f 'query=q { a }' -f fullPath=taskboard/taskboard -F first=100 -f after=page-2; … api projects/:fullpath",
      "observed": "page-2 JSON, exit 0; project.json, exit 0; log 'argv: api graphql -f query=q { a } -f fullPath=taskboard/taskboard -F first=100 -f after=page-2'"
    }
  ],
  "mutation": {
    "command": "just mutants HEAD → 110 mutants tested in 3m: 89 caught, 21 unviable (first run: 1 missed, names.rs is_found_or_no_match → true, killed by the broken-config assert)",
    "survivors": []
  },
  "acceptance_not_run": [],
  "deviations_from_brief": [
    "No yamt-range dependency yet: B1 uses nothing from it, so it would be an unused dep. The arch-check rule still allows it; B3 adds it with open.rs.",
    "query.rs has no DETAILS_QUERY/details_args: B1 has no caller, so they would be dead code. B3's Owned lacks query.rs, so B3 needs it added, or puts the details query in open.rs.",
    "The GITLAB_HOST/GL_HOST read carries no #[expect]: clippy.toml has no disallowed_methods, so an expect would be unfulfilled. It is tested through a child process (tests/detect.rs).",
    "names.rs repeats merge_config.rs's private is_found_or_no_match + NO_MATCH_STATUS (not Owned). Fix: make merge_config's pub(crate) and import it.",
    "review test no_http_answer_a_timeout_or_glab_gone_stops_in_glab_s_words lost its two exit_words asserts (exit_words moved); they now live in gitio glab.rs's unit test.",
    "crates/gitio/tests/glab.rs is now 414 lines (> RS6's 400): its names tests (branch names, remote_names, remote_urls) belong in a new crates/gitio/tests/names.rs, which is outside Owned.",
    "Cargo.lock changed (cargo-generated for the new member). page tests sit in src/page/tests.rs, following src-tauri's `mod tests;` pattern, to keep page.rs under 400 lines. tests/detect.rs is added beyond §7's list.",
    "JobPage::built also rejects empty path segments (//evil), which the §2.1 regex alone would accept; MAX_FAILED_JOBS is put into the query with format!.",
    "Fake glab: field values are kept for routing (iid, after) but not logged separately; the one-line query keeps each call on one argv log line.",
    "Needed in docs/architecture.md (§3.9, §7 crate list) and the project map: 'crates/merge-requests (yamt-merge-requests): offline GitLab detection and the open-MR list through glab GraphQL; depends on yamt-gitio (may: yamt-range, yamt-merge-core), never tauri; arch-check rule' and the gitio additions Glab::get/auth_status, Repo::remote_urls."
  ],
  "open_risks": [
    {
      "location": "crates/merge-requests/src/page.rs:58-120",
      "risk": "GraphQL list items (nodes) are taken as non-null. A null node from GitLab fails the whole page with serde's message instead of being skipped."
    },
    {
      "location": "crates/merge-requests/src/detect.rs:29",
      "risk": "Repo::discover (per the design) honours an inherited GIT_DIR. If the compare window starts with GIT_DIR set, detection follows that repository, not the start folder."
    },
    {
      "location": "crates/merge-requests/src/query.rs:6",
      "risk": "Field availability and the ~112 complexity score on the owner's GitLab are not checked (design I1). The first page's queryComplexity is logged at info for that measurement."
    },
    {
      "location": "crates/merge-requests/src/lib.rs:136-161",
      "risk": "Tagged enums keep multi-word payload fields in snake_case (serde renames only variants). This matters for B3's OpenReply (short_id); B4 was told so."
    }
  ]
}
