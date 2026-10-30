# MrRustTidyBoundary

Agent output (`agent://MrRustTidyBoundary`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-10-30T13-26-49-608Z_01a18cfd-dc08-7052-b10f-ed6a2bb5d1b5/MrRustTidyBoundary.md), collected 2026-10-30T15:32:07.601Z.

{
  "verdict": "fail",
  "checked": [
    "Constant: args.rs:31 `pub(crate) START_FOLDER` is the one \".\" definition (args.rs:109,113; lib.rs:39,59,105); compare.rs:12 no longer clashes; behaviour unchanged; only Owned files edited.",
    "src-tauri notes match code: merge_requests manage/NO_PROJECT/open_job_page, range_window start/detach/reap, appimage running_appimage, lib.rs from_start_dir, range.rs:61, ipc_error.rs:75 blocking_reply.",
    "gitio notes match code: fetch.rs argv/env/FETCH_TIMEOUT/Err, names.rs remote_urls, merge_config.rs config_entries (Read, GIT_TIMEOUT, exit 1 empty), glab.rs get/auth_status/first_line/last_line/TIMED_OUT.",
    "Deviations accepted: appimage now every window (lib.rs:59); merge-requests dep (src-tauri/Cargo.toml:34); range_folder shared (merge_requests.rs:13); job_pages dropped before send (merge_requests.rs:59).",
    "START_FOLDER `///` names both users and cites plan §2 #94/#128–#135, so it passes the CP2 reviewer test. No new import edge; PM1 unaffected.",
    "Implementer evidence accepted: acceptance grep, mutants (1 caught, 1 unviable). The prepare_open open_risk is not accepted; it is finding 1."
  ],
  "findings": [
    {
      "file": "src-tauri/AGENTS.md",
      "line": 1,
      "severity": "block",
      "rule_id": "DR1",
      "problem": "The merge_requests.rs entry says `prepare_open` 'runs glab and the fetch', and the `run_compare` entry says the window does too. The code fetches only when a commit is missing (merge-requests/src/open.rs:116-122), and plan §2 #132 says 'no fetch when both commits are local'. The notes now hold a second, contradicting copy of #132.",
      "fix": "Reword merge_requests.rs: '`prepare_open` checks glab login, asks glab for the MR's commits, fetches only when one is missing, tries the pair's lock, then `range_window::start`'; window.rs: 'runs glab, and a fetch if needed'."
    },
    {
      "file": "docs/architecture.md",
      "line": 467,
      "severity": "should",
      "problem": "architecture.md:467 and .omp/skills/project-map/tree.md:83 still name `lib.rs` `COMPARE_FOLDER`, which this patch removed. A grep for it lands on compare.rs:12's \"compare\", the clash the slice fixed. The rename was not in open_risks. As it grows: every map lookup for the start folder misleads.",
      "fix": "Docs keeper (files outside Owned) replaces `lib.rs` `COMPARE_FOLDER` in both places with `args.rs` `START_FOLDER`."
    },
    {
      "file": "src-tauri/AGENTS.md",
      "line": 1,
      "severity": "should",
      "problem": "The window.rs entry the patch edited still says `open_and_wait` is '`pub(crate)` with `context()` … for `range.rs`'. Both are private (window.rs:81,132); range.rs:15 imports `open_with_data_folder` and `window_title`. As it grows: the next window builder may be wired through the wrong entry point.",
      "fix": "Change the parenthesis to '(private; `open_with_data_folder` and `window_title` are `pub(crate)` for `range.rs`)'."
    }
  ]
}
