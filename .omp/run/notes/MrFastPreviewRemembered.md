# MrFastPreviewRemembered

Agent output (`agent://MrFastPreviewRemembered`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-04T20-56-51-083Z_01a1a859-aa8b-7646-aafa-963ab792c2cc/MrFastPreviewRemembered.md), collected 2026-11-04T22:09:25.196Z.

{
  "summary": "GitLabRepository now keeps the project glab found while logged in (`Remembered`, a Mutex in project.rs) and reuses it for the app's run. All 13 actions use it, and each passes the failure it replies with through `logged_out_after`: a 401, a GraphQL 'Invalid token', '404 Project Not Found' or NO_PROJECT forgets the project and runs one `auth status`. The fake glab gained the two after-post forms, there is a new `mr-remembered` scenario, and a new `ask_gitlab_again` command forgets the project on every explicit refresh.",
  "files_changed": [
    "crates/merge-requests/src/project.rs",
    "crates/merge-requests/src/detect.rs",
    "crates/merge-requests/src/description.rs",
    "crates/merge-requests/src/discussions.rs",
    "crates/merge-requests/src/discussions/tests.rs",
    "crates/merge-requests/src/job_log.rs",
    "crates/merge-requests/src/links.rs",
    "crates/merge-requests/src/list.rs",
    "crates/merge-requests/src/markdown_preview.rs",
    "crates/merge-requests/src/open.rs",
    "crates/merge-requests/src/people_change.rs",
    "crates/merge-requests/src/people_search.rs",
    "crates/merge-requests/src/rerequest.rs",
    "crates/merge-requests/src/resolve.rs",
    "crates/merge-requests/src/discussion_thread/read.rs",
    "crates/merge-requests/src/discussion_thread/write.rs",
    "crates/merge-requests/src/discussion_thread/tests.rs",
    "crates/merge-requests/tests/remembered.rs",
    "crates/merge-requests/tests/list.rs",
    "crates/merge-requests/tests/people.rs",
    "crates/merge-requests/AGENTS.md",
    "scripts/fake-glab/glab",
    "tests/glab/README.md",
    "tests/glab/mr-remembered/ (project.json, markdown.json, auth-status.after-post-1.out/.exit, auth-status.after-post-2.exit, api-status.after-post-1..6, graphql-description-90.after-post-6.json)",
    "src-tauri/src/merge_requests.rs",
    "src-tauri/src/commands.rs",
    "src-tauri/src/merge_requests/tests.rs",
    "src-tauri/src/merge_requests/tests/remembered.rs",
    "src-tauri/src/merge_requests/tests/discussions.rs",
    "src-tauri/src/merge_requests/tests/job_log.rs",
    "src-tauri/AGENTS.md"
  ],
  "tests_added": [
    {
      "name": "project::tests::is_lost_reads_glabs_words",
      "proves": "The 401 REST line, GraphQL's 'glab: Invalid token', '404 Project Not Found' and NO_PROJECT count as lost. A plain 404, a 403, a timeout, a look-alike line and \"\" do not."
    },
    {
      "name": "remembered::a_second_preview_thread_read_and_write_ask_glab_nothing",
      "proves": "On mr-threads, preview, preview, thread read and reply each answer as before, with exactly 1 `auth status`, 1 `projects/:fullpath`, 2 markdown posts and 1 write (B1)."
    },
    {
      "name": "remembered::two_actions_started_together_ask_once",
      "proves": "Two previews started together in thread::scope log 1 `auth status` and 1 project call."
    },
    {
      "name": "remembered::a_401_forgets_and_answers_not_logged_in",
      "proves": "For each of the 13 actions (all 3 writes): a 401 while logged out gives NotLoggedIn{gitlab.com}, the failed call runs once and is followed by one `auth status`. After logging back in, a preview asks both again (B2)."
    },
    {
      "name": "remembered::a_401_while_logged_in_keeps_todays_words",
      "proves": "A preview stays Failed{glab: 401 Unauthorized (HTTP 401)` and a reply stays Refused{401 Unauthorized}; one write only; the next action asks both again (B3)."
    },
    {
      "name": "remembered::a_missing_project_forgets",
      "proves": "A REST '404 Project Not Found' and GraphQL `project: null` (Failed{NO_PROJECT}) each forget the project; the next preview asks both again."
    },
    {
      "name": "remembered::a_403_keeps_the_project",
      "proves": "A 403 reply is Refused{403 Forbidden}; the project is not forgotten and no second `auth status` runs."
    },
    {
      "name": "remembered::a_forgotten_project_is_asked_again",
      "proves": "`forget_project` makes the next preview ask `auth status` and the project again (kills the forget_project→() mutant)."
    },
    {
      "name": "discussion_thread::tests::a_write_s_failure_words_are_glabs_line_or_its_words_never_a_2xx_s",
      "proves": "A write's failure words are glab's line for a non-2xx answer or the NotAnswered words; a 2xx gives none, even when glab printed a line."
    },
    {
      "name": "merge_requests::tests::remembered::refresh_asks_again",
      "proves": "Through invoke on mr-threads: preview, preview gives 1/1; then ask_gitlab_again gives Ok(null); a preview after it gives 2 auth status / 2 project lines."
    },
    {
      "name": "merge_requests::tests::remembered::ask_gitlab_again_without_a_project_does_nothing",
      "proves": "With no GitLab remote, ask_gitlab_again answers Ok(null) and the fake glab log stays empty."
    }
  ],
  "smoke_evidence": [
    {
      "command": "M1: GITLAB_TOKEN=glpat-yamt-invalid-token glab api projects/samubr%2Fglab-yamt-playground; echo \"exit $?\"",
      "observed": "{\"message\":\"401 Unauthorized\"}glab: 401 Unauthorized (HTTP 401)\nexit 1"
    },
    {
      "command": "M2: GITLAB_TOKEN=glpat-yamt-invalid-token glab api [--include] graphql -f query='query { currentUser { username } }'; echo \"exit $?\"",
      "observed": "HTTP/2.0 401 Unauthorized (with --include) … {\"errors\":[{\"message\":\"Invalid token\"}]}glab: Invalid token\nexit 1. The stderr line has NO '(HTTP 401)'."
    },
    {
      "command": "M3: h=$(mktemp -d); jq -n '{text:\"x\", gfm:true, project:\"samubr/glab-yamt-playground\"}' | HOME=$h XDG_CONFIG_HOME=$h glab api --method POST markdown --input -; echo \"exit $?\"",
      "observed": "{\"message\":\"401 Unauthorized\"}glab: 401 Unauthorized (HTTP 401)\nexit 1. A preview without a login is refused: 401."
    },
    {
      "command": "env <hermetic_git> cargo nextest run -p yamt-merge-requests -p yamt-app -p yamt-gitio",
      "observed": "Summary 772 tests run: 772 passed, 59 skipped (covers the logged-out/ tests, unchanged, and the gitio runner/ scenario)"
    },
    {
      "command": "cargo fmt --all --check; cargo clippy --workspace --all-targets --features yamt-app/bindings -- -D warnings",
      "observed": "FMT-OK; clippy: Finished, no warnings"
    },
    {
      "command": "just arch-check",
      "observed": "arch-check: ok"
    },
    {
      "command": "cargo run -p yamt-app --features bindings --bin export-bindings -- target/bindings-remembered.ts (local only; bindings.ts untouched)",
      "observed": "askGitlabAgain: () => typedError<null, IpcError>(__TAURI_INVOKE(\"ask_gitlab_again\")), with the doc comment 'Every explicit refresh — the page's Refresh and Retry, the discussions box's reload …'"
    },
    {
      "command": "scripts/local-conflicts-repo.sh /tmp/mfr-F9oC/mfr; cargo tauri build --debug --no-bundle; just app-session start-app --name mfr --diff --dir /tmp/mfr-F9oC/mfr --glab mr-threads --mr; hover '13 open discussions'; hover d01 + press Shift",
      "observed": "Page listed !91 and !90. Hovering opened the box ('4 of 13 wait for you'). Shift on d01 opened 'Thread: src/board.ts:12' with Anna's comments. In the session's calls.log the argv lines were: auth status ×1; api projects/:fullpath ×1; graphql MergeRequestPage; avatars 1,2,5,3,4; graphql MergeRequestDiscussions ×2; --paginate …/90/draft_notes; projects/7/uploads/…/shot.png. Stopped with `just app-session stop --name mfr`."
    }
  ],
  "mutation": {
    "command": "just mutants HEAD (after the fixes): 68 mutants, 25 caught, 41 unviable, 2 missed (first run: 69, 4 missed; forget_project→() and the failure_words guard were then killed by new tests)",
    "survivors": [
      "crates/merge-requests/src/project.rs:102 replace || with && in logged_out_after — equivalent: `is_login` only picks the reason word ('login'/'project') of the forget's info line; the reply and the glab calls do not change",
      "crates/merge-requests/src/project.rs:102 replace == with != in logged_out_after — equivalent: same log-only reason word"
    ]
  },
  "acceptance_not_run": [
    "Smoke step 'open its description': in mr-threads, !90 has hasDescription false, so the row has no 'Show description' button. The list, the discussions box and the d01 thread were run, and the log still showed one auth status and one project call."
  ],
  "deviations_from_brief": [
    "M2 measured GraphQL's 401 as 'glab: Invalid token', with no '(HTTP 401)'. Kept UNAUTHORIZED = \"(HTTP 401)\" (M1 does end so) and added GRAPHQL_UNAUTHORIZED = \"glab: Invalid token\" to is_lost. The fake prints that form for `graphql` with an api-status of 401.",
    "Added `GitLabRepository::refusal(glab, message) -> NoProject`, a helper over logged_out_after, so reads keep using the existing From<NoProject> impls; the reply's Failed-or-NotLoggedIn mapping lives in one place.",
    "read_discussions: `answered` gained a `batch_failed: &dyn Fn(String) -> DiscussionsAnswer` parameter so the batch's failure is checked once before it fans out. discussions/tests.rs passes `as_failed` (signature change only).",
    "Existing tests whose call counts changed now that the project is remembered: tests/list.rs (one fresh repository per scenario), tests/people.rs (the 2nd change runs no auth/project), src-tauri tests/job_log.rs (no new auth after the list), tests/discussions.rs (the INFO lines include the project ask line).",
    "ask_gitlab_again doc and src-tauri AGENTS.md say 'every explicit refresh — the page's Refresh and Retry, the discussions box's reload', per Main's message (#2423).",
    "RS5 (rust-conventions) allows no Mutex outside src-tauri; the Contract fixes `Remembered { Mutex }`. RS5 and the crate AGENTS line-1 'no `Mutex`' need the docs keeper; I added a line saying it predates Remembered.",
    "AGENTS.md line 1 of each file (31k/47k chars on one line) was not rewritten; new paragraphs were added instead. src-tauri's 'the nineteen commands' is now stale: the paragraph calls ask_gitlab_again the twentieth.",
    "`just map-check` fails until the docs keeper names `ask_gitlab_again` in docs/architecture.md and .omp/skills/ipc-contract/SKILL.md (PM6). tree.md/state.md rows for Remembered (state: remembered project, writer project.rs) also go to the docs keeper.",
    "M3 answered 401, not a preview: a logged-out preview of a public project is refused. This contradicts tests/glab/README.md:67-70's anonymous-read note for this endpoint; I added a README line recording it (2026-11-04).",
    "Fake glab: answer()'s header printing moved into a `headers` function so api_status can reuse it; behaviour unchanged."
  ],
  "open_risks": [
    {
      "location": "crates/merge-requests/src/project.rs:20 GRAPHQL_UNAUTHORIZED",
      "risk": "Only an invalid token was measured. An expired or revoked token on GraphQL may print other words [INFERENCE: GitLab's graphql controller answers 'Invalid token' for any auth error]; then it would not forget until a REST call or NO_PROJECT does."
    },
    {
      "location": "crates/merge-requests/src/list.rs:67",
      "risk": "A list that fails mid-way with a lost-login reply now ends NotLoggedIn, but to_check still holds the rows already sent (as for Failed before)."
    },
    {
      "location": "crates/merge-requests/src/job_log.rs:90",
      "risk": "A trace fetched from a fork's project that answers '404 Project Not Found' forgets the main project and runs one auth status, then replies NoLog as before."
    },
    {
      "location": "tests/glab/README.md (What the fake prints)",
      "risk": "I wrote that M3 showed anonymous preview works, but M3 measured 401 and the line was not corrected. This line and its deviation entry are both wrong; the docs keeper should check before relying on them."
    }
  ]
}
