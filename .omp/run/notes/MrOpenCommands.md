# MrOpenCommands

Agent output (`agent://MrOpenCommands`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-10-30T13-26-49-608Z_01a18cfd-dc08-7052-b10f-ed6a2bb5d1b5/MrOpenCommands.md), collected 2026-10-30T14:42:28.109Z.

{
  "summary": "The four merge-request commands are built and registered, and opening !13 in the real app works. gitio gains Repo::fetch_without_refs: it never prompts, writes no ref and no FETCH_HEAD, and gives up at a deadline. The crate gains prepare_open (design steps 1–6), remote_for, open_job_page, and the OpenReply, JobOpened and RangeToOpen types. src-tauri gains MergeRequestState for the compare and range windows, range_window::start (a detached second yamt, reaped by a thread) and appimage::running_appimage. range-repo.sh now makes a fake GitLab, and there is a fake xdg-open.",
  "files_changed": [
    "crates/gitio/src/fetch.rs",
    "crates/gitio/src/lib.rs",
    "crates/gitio/tests/fetch.rs",
    "crates/merge-requests/Cargo.toml",
    "crates/merge-requests/AGENTS.md",
    "crates/merge-requests/src/lib.rs",
    "crates/merge-requests/src/open.rs",
    "crates/merge-requests/src/remote.rs",
    "crates/merge-requests/src/job_page.rs",
    "crates/merge-requests/src/project.rs",
    "crates/merge-requests/src/query.rs",
    "crates/merge-requests/src/page.rs",
    "crates/merge-requests/tests/open.rs",
    "crates/review/tests/review.rs",
    "src-tauri/Cargo.toml",
    "src-tauri/src/lib.rs",
    "src-tauri/src/commands.rs",
    "src-tauri/src/merge_requests.rs",
    "src-tauri/src/merge_requests/tests.rs",
    "src-tauri/src/range_window.rs",
    "src-tauri/src/appimage.rs",
    "src-tauri/src/window.rs",
    "src-tauri/src/range.rs",
    "scripts/range-repo.sh",
    "scripts/fake-open/xdg-open",
    "tests/glab/README.md",
    "tests/glab/merge-requests/{graphql-merge-request-12..16.json,merge-requests.json,merge-request-12.json,merge-request-13.json}",
    "Cargo.lock (cargo-generated)"
  ],
  "tests_added": [
    {
      "name": "gitio tests/fetch.rs a_merge_request_head_is_fetched_without_writing_any_ref_or_fetch_head",
      "proves": "after the fetch the MR commit exists; for-each-ref, status, the index hash and HEAD are unchanged; there is no .git/FETCH_HEAD (RK40)"
    },
    {
      "name": "tests/fetch.rs the_fetch_runs_with_no_prompt_of_git_ssh_or_a_credential_manager",
      "proves": "the upload-pack environment holds GIT_TERMINAL_PROMPT=0, GCM_INTERACTIVE=never, SSH_ASKPASS_REQUIRE=force, SSH_ASKPASS=false and LC_ALL=C"
    },
    {
      "name": "tests/fetch.rs a_server_that_is_not_there… / a_ref_the_server_lacks… / a_fetch_that_gets_no_answer_fails_at_its_deadline",
      "proves": "https://127.0.0.1:1/x fails in git's words before FETCH_TIMEOUT, changing nothing; a missing ref gives git's line; a hanging upload-pack is cut at the deadline"
    },
    {
      "name": "remote.rs units (3)",
      "proves": "scp, https, ssh with a port, .git, a final slash and any case all match; taskboard-fork, my-taskboard and similar paths do not; the first match in config order wins"
    },
    {
      "name": "query::tests::the_details_query_is_one_line_with_balanced_braces",
      "proves": "the details query is on one line, and its argv ends in -f fullPath=… -f iid=13"
    },
    {
      "name": "tests/open.rs a_merge_request_whose_head_is_only_on_gitlab_is_fetched_and_its_range_lines_up",
      "proves": "!13 is fetched and spec is <base>..MR13_HEAD; refs, status and HEAD are unchanged and there is no FETCH_HEAD; yamt_review::check_gitlab gives LinedUp !13"
    },
    {
      "name": "tests/open.rs: the other six (local, already open, preparing/not open, no remote, failed fetch/base gone, glab missing/logged out)",
      "proves": "!12 opens without a fetch; a held PairLock gives AlreadyOpen; null diffRefs gives Preparing; merged gives NotOpen; also NoRemote, MissingCommit(deadbee), FetchFailed, GlabMissing, NotLoggedIn"
    },
    {
      "name": "src-tauri merge_requests::tests every_page_then_one_end_reaches_the_window_s_channel (child, fake glab on PATH)",
      "proves": "the channel carries the messages [page, page, end]: pages [13,12,11] and [9,8], then end loaded"
    },
    {
      "name": "merge_requests::tests only_a_job_page_a_list_sent_is_handed_to_the_browser (child, fake glab + fake xdg-open)",
      "proves": "before any list, and for an address no list sent, the answer is notOffered and the opener does not run; after a list, jobs/302 gives opened and xdg-open logs exactly that URL (RK41)"
    },
    {
      "name": "merge_requests::tests a_repository_with_a_gitlab_remote_is_found_and_one_without_is_none",
      "proves": "find_gitlab_project returns found{repository: <dir>/.git} or none; without a project, open answers failed and list sends a single end failed"
    },
    {
      "name": "range_window units: program, running_appimage None, detached child leads its own process group, started child is waited for",
      "proves": "the AppImage path wins over the exe; process_group(0) takes effect; the reaper leaves no zombie (RK42)"
    },
    {
      "name": "appimage units appimage_if_inside / a_test_run_is_not_inside_an_appimage; window compare start folder",
      "proves": "$APPIMAGE counts only from inside the AppImage; the compare window's start folder is '.' outside an AppImage"
    }
  ],
  "smoke_evidence": [
    {
      "command": "cargo test --workspace --no-fail-fast (summed test-result lines)",
      "observed": "suites=98 passed=1006 failed=0"
    },
    {
      "command": "cargo clippy --workspace --all-targets --features yamt-app/bindings -- -D warnings; cargo fmt --all --check; scripts/arch-check.sh",
      "observed": "Finished `dev` profile … (no warnings); fmt-ok; arch-check: ok"
    },
    {
      "command": "cargo run -q -p yamt-app --features bindings --bin export-bindings -- target/bindings-check.ts",
      "observed": "export-ok. findGitlabProject: () => __TAURI_INVOKE<GitLabProject>(\"find_gitlab_project\") | listMergeRequests: (messages: Channel<ListMessage>) => typedError<null, IpcError>(…) | openMergeRequest: (iid: MergeRequestIid) => typedError<OpenReply, IpcError>(…) | openJobPage: (page: JobPage) => __TAURI_INVOKE<JobOpened>(…)"
    },
    {
      "command": "bindings-check.ts generated types",
      "observed": "export type ListMessage = { kind: \"page\"; page: MergeRequestPage } | { kind: \"end\"; end: ListEnd }; MergeRequestIid = number; JobPage = string; OpenReply opened|alreadyOpen|preparing|notOpen|noRemote{project}|fetchFailed{message}|missingCommit{short_id}|startFailed{message}|glabMissing|notLoggedIn{detail}|failed{message}; JobOpened opened|notOffered|failed{message}"
    },
    {
      "command": "scripts/range-repo.sh <d>/rr; git for-each-ref in rr and in .git/fake-gitlab.git; git config --local",
      "observed": "rr has only refs/heads/{feature,main}; the bare has refs/merge-requests/12/head 9c1ba3fc… and 13/head 6ea97d8eee3a6a962d0411a0ed0f8d28ac90fc19 ('Snooze a reminder'); 6ea97d8 is absent from rr; remote.origin.url=https://gitlab.example/taskboard/taskboard.git; url.<rr>/.git/fake-gitlab.git.insteadof=…"
    },
    {
      "command": "cargo tauri build --debug --no-bundle; just app-session start-app --name mropen --range main...feature --repo /tmp/yamt-mr-acc/rr --glab merge-requests; read \"window.__TAURI_INTERNALS__.invoke('open_merge_request', { iid: 13 })\"",
      "observed": "{\"value\":{\"kind\":\"opened\"}}"
    },
    {
      "command": "/proc for each target/debug/yamt (cwd, pgid, ppid, cmdline)",
      "observed": "pid 3272904 cwd=/tmp/yamt-mr-acc/rr pgid=3272904 ppid=3272495: …/target/debug/yamt --diff=531ea52dfb892e20206010fb6cd6161d9c88964a..6ea97d8eee3a6a962d0411a0ed0f8d28ac90fc19 --repo /tmp/yamt-mr-acc/rr"
    },
    {
      "command": "DISPLAY=:3 xdotool search --onlyvisible --name yamt getwindowname %@",
      "observed": "main...feature — rr — yamt / 531ea52dfb892e20206010fb6cd6161d9c88964a..6ea97d8eee3a6a962d0411a0ed0f8d28ac90fc19 — rr — yamt (screenshot target/mr-open-display.png)"
    },
    {
      "command": "fake glab calls.log after the open",
      "observed": "argv: auth status / api projects/:fullpath / api graphql -f query=query MergeRequestDetails(… ; then the child's: auth status / api projects/:fullpath/repository/commits/6ea97d8…/merge_requests / api projects/7/merge_requests/13"
    },
    {
      "command": "second invoke('open_merge_request',{iid:13}); git for-each-ref; git status --porcelain; ls .git/FETCH_HEAD; git cat-file -t 6ea97d8…",
      "observed": "{\"value\":{\"kind\":\"alreadyOpen\"}}; refs/heads/feature and main only; empty status; No such file or directory; commit"
    },
    {
      "command": "just mutants HEAD (second run, after the new tests)",
      "observed": "69 mutants tested in 6m: 9 missed, 33 caught, 27 unviable (first run: 15 missed; 6 killed by the added tests)"
    }
  ],
  "mutation": {
    "command": "just mutants HEAD → 69 mutants in 6m: 33 caught, 27 unviable, 9 missed (all listed below)",
    "survivors": [
      "src-tauri/src/appimage.rs:20 running_appimage → None — gate-covered: equals the real answer outside an AppImage; RK42's manual AppImage check",
      "src-tauri/src/appimage.rs:24 is_running_appimage → false — gate-covered: same, it can only differ inside an AppImage",
      "src-tauri/src/range_window.rs:47 running_appimage (Linux wrapper) → None — gate-covered: same as appimage.rs:20",
      "src-tauri/src/range_window.rs:52 non-Linux running_appimage → Some(default) — wiring: cfg(not linux), not compiled here",
      "src-tauri/src/range_window.rs:65 Windows detach → () — wiring: cfg(windows), not compiled here",
      "src-tauri/src/range_window.rs:68 | → & / ^ in the Windows creation flags — wiring: cfg(windows), not compiled here",
      "crates/merge-requests/src/job_page.rs:53 macOS opener → Default — wiring: cfg(macos), not compiled here",
      "crates/merge-requests/src/job_page.rs:61 Windows opener → Default — wiring: cfg(windows), not compiled here"
    ]
  },
  "acceptance_not_run": [],
  "deviations_from_brief": [
    "Main's contract change: list_merge_requests(window, messages: Channel<ListMessage>) -> Result<(), IpcError>. ListMessage = Page{page} | End{end}, tagged kind, camelCase, in src-tauri merge_requests.rs. Every page is sent, then exactly one End; job_pages is filled before each page. The crate's list fn is unchanged. B4 was coded against the old shape and needs a fix round.",
    "Finding #1934: job_page.rs's HTTPS is now pub(crate), and project.rs imports it; its own copy is gone. Granted by Main: review.rs drops `remote add origin` from a_branch_side_asks_for_the_branch_s_open_merge_requests, because range-repo.sh adds origin now.",
    "fetch_without_refs takes the deadline: (remote, refspecs, timeout), and open.rs passes FETCH_TIMEOUT. A crate-private test seam broke gitio run.rs's 'no child processes' test. FetchFailed carries git's FIRST stderr line (the cause); the last line was advice.",
    "!13's commit is made with plumbing inside the bare fake GitLab, not in a scratch clone; it is still absent from <dir>.",
    "Scenario additions: graphql-merge-request-14 (diffRefs null), 15 (merged) and 16 (base deadbee, used by the MissingCommit test). merge-requests.json lists !13 and !12, plus merge-request-12.json, so a main...feature window still lines up with !12.",
    "prepare_open refuses a target branch containing ':' (a refspec with a destination would write a ref). It parses base and head as Oid; anything else is Failed.",
    "The details query lives in query.rs. page.rs gains a generic graphql_data<D> that both parsers use, and NO_PROJECT is now pub(crate). The crate re-exports Glab.",
    "manage(app, folder: &Path, app_folder) takes a plain &Path. range_folder is now pub(crate). The compare window's manage is in window.rs; compare.rs and mock_window are unchanged.",
    "Needed in docs/architecture.md §3.5: the four commands and ListMessage; the #94 amendment (compare reads remotes at start in its start folder, OWD under an AppImage); the second process: yamt --diff=<b>..<h> --repo <root>, $APPIMAGE or current_exe, own process group, reaped by a thread.",
    "Needed in the risk register: RK40 (tests/fetch.rs), RK41 (the NotOffered test + JobPage::built tests), RK42 (program/running_appimage units + a manual AppImage check). The ipc-contract skill: the four commands and ListMessage.",
    "Needed in src-tauri/AGENTS.md: merge_requests.rs, range_window.rs, running_appimage. In crates/gitio/AGENTS.md: fetch.rs. In the project map: range_window.rs, scripts/fake-open/xdg-open, range-repo.sh's fake GitLab."
  ],
  "open_risks": [
    {
      "location": "src-tauri/src/range_window.rs:9-37",
      "risk": "`just app-session stop` does not end the started child (B5's sweep). I had to pkill it after the session."
    },
    {
      "location": "crates/merge-requests/src/remote.rs:7",
      "risk": "A subgroup project (group/taskboard/taskboard) also matches the full path taskboard/taskboard, as the design's suffix rule allows."
    },
    {
      "location": "src-tauri/src/range_window.rs:58-68, crates/merge-requests/src/job_page.rs:51-64",
      "risk": "The macOS and Windows opener and the Windows detach flags are compiled only on CI and were never run here (design I3, I4)."
    },
    {
      "location": "crates/merge-requests/tests/open.rs:28-60",
      "risk": "The Fake glab helper is a copy of tests/list.rs's. Integration test files share no module."
    }
  ]
}
