# CiJobLogRustBoundary

Agent output (`agent://CiJobLogRustBoundary`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-03T09-27-39-945Z_01a1a0bc-56a9-713f-aaa0-50b9506e4465/CiJobLogRustBoundary.md), collected 2026-11-03T10:33:12.191Z.

{
  "verdict": "fail",
  "checked": [
    "Ownership: all 22 changed files are in Owned (crates/merge-requests/**, src-tauri merge_requests*, commands.rs list line, fake glab, tests/glab/ci-job-log/**, README, playground); no Cargo.toml, frontend or docs edits",
    "Contract: JobLog/JobLogReply derives, serde tags, MAX_LOG_BYTES, lib.rs re-export, read_job_log/tail/trace_route signatures, JobLogs/job_log_reply/command shape and registration beside rerequest_review match the brief",
    "One split of /-/jobs/<n>: split_job_path is shared by WebPage::job and job_parts (web_page.rs:23-26,59-63); From<NoProject>, outcome() and the info log follow rerequest.rs; PM1 deps unchanged",
    "State: job_logs has one writer (job_log_reply), never held while glab runs or with pages; pages check mirrors open_page as briefed; merge_requests.rs 378 lines, job_log.rs 353 (RS6)",
    "Deviations accepted: Range measured, unused (design §1.3 records it); other-origin page → NotOffered; extra tests; state.md row 64, architecture, ipc-contract, map-check names, RK57 left to docs keeper",
    "Comments: NOT_FOUND cites tests/glab/README.md (CP1), //! line updated (CP3), docs as neighbours (CP2); fake-glab trace route precedes the default and no earlier pattern catches it"
  ],
  "findings": [
    {
      "file": "scripts/gitlab-playground.sh",
      "line": 44,
      "severity": "block",
      "rule_id": "RK19",
      "problem": "seed_git plus the GIT_AUTHOR_*/GIT_COMMITTER_* block (:44-77) copy git-sandbox.sh's repo_git/commit_at, but only part of them: no isolate_git_config, no attributes/excludes files. The user's global/system git config therefore reaches the commit, so the 'fixed commit ids' the header promises can differ per machine, and a second copy of the sandbox rule now exists.",
      "fix": "Build the commit in a subshell that sources scripts/git-sandbox.sh, calls isolate_git_config, sets dir=\"$seed/repo\" and uses repo_git/commit_at; the orchestrator widens Owned to add gitlab-playground.sh to git-sandbox.sh's 'Sourced by' line."
    },
    {
      "file": "scripts/fake-glab/glab",
      "line": 160,
      "severity": "should",
      "problem": "trace() repeats picture()'s body line for line (.sleep wait, 'answered:' log, cat with exit 0, 404 answer); only the file path differs, so the next byte-for-byte route would copy it a third time and the two could drift apart.",
      "fix": "Extract one function, e.g. serve_file \"$file\" (sleep, log answered, cat or 404), and have picture() and trace() each compute their file and call it."
    },
    {
      "file": "src-tauri/src/merge_requests/tests/job_log.rs",
      "line": 24,
      "severity": "should",
      "problem": "glab_log copies picture_scheme.rs:26-30's YAMT_FAKE_GLAB_LOG reader and adds a prefix filter; every later through-glab test will copy it again.",
      "fix": "Move a glab_log(prefix: &str) into the shared through_glab test module beside run_with_fakes, and use it from both picture_scheme.rs and job_log.rs."
    },
    {
      "file": "crates/merge-requests/src/job_log.rs",
      "line": 63,
      "severity": "nit",
      "problem": "The binding `Ok(trace)` shadows the function `trace` (:78) it was read from, so the reader holds two meanings of one name. Nothing gets harder as the app grows.",
      "fix": "Rename the binding to `bytes`, or rename the function to `read_trace`."
    }
  ]
}
