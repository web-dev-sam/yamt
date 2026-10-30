# MrOpenCommandsCorrectness

Agent output (`agent://MrOpenCommandsCorrectness`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-10-30T13-26-49-608Z_01a18cfd-dc08-7052-b10f-ed6a2bb5d1b5/MrOpenCommandsCorrectness.md), collected 2026-10-30T14:50:03.716Z.

{
  "verdict": "fail",
  "checked": [
    "RK40: fetch.rs flags/env per §2.2; tests/fetch.rs fails if --refmap=, --no-write-fetch-head or the SSH/GCM env are removed (origin's +refs/heads/* map would write refs/remotes; open.rs untouched() too). Prune/autotag need a dst refspec",
    "RK41 holds: JobPage deserialises any string but open_job_page opens only members of job_pages, filled in forward_page before send; job_pages_on_path_s_opener fails if extend is dropped and logs the exact URL",
    "RK42/I4: process_group(0) proven (pgid==pid unit), reaper proven (/proc zombie unit), cwd/--repo absolute root; real-app /proc evidence of child cmdline and pgid; alreadyOpen on second call. Lock TOCTOU is design step 5",
    "open.rs steps 1-6 traced: has_commit && guard (killed by !13 test), MissingCommit deadbee, NoRemote, Preparing/NotOpen, GlabMissing/NotLoggedIn before any GitLab call; check_gitlab LinedUp !13; range-repo.sh hermetic",
    "Survivor range_window.rs:52 accepted: its None-check test is not cfg-gated, so CI's macOS and Windows test runs kill it. Open risks accepted: the app-session sweep is B5's; the Fake copy is a nit",
    "remote.rs:7 subgroup risk accepted beyond finding 1: the spec uses GitLab's SHAs, so a wrong remote only causes FetchFailed or MissingCommit, never a wrong diff. No tests run"
  ],
  "findings": [
    {
      "file": "crates/merge-requests/src/remote.rs",
      "line": 7,
      "severity": "block",
      "problem": "remote_for checks every remote, whatever its host. With a GitHub (or other) mirror at the same `group/project` path listed first in config (a clone from GitHub, then `gitlab` added), it picks the mirror. Opening an MR then fails with \"couldn't find remote ref refs/merge-requests/N/head\", even though the GitLab remote is configured.",
      "fix": "Only consider remotes that detect.rs counts as GitLab's (remote_host + is_gitlab_host, as detection does), and add a remote.rs unit test with a github.com mirror first in config order."
    },
    {
      "file": "src-tauri/src/appimage.rs",
      "line": 20,
      "severity": "block",
      "rule_id": "VF7",
      "problem": "Survivors appimage.rs:20, :24 and range_window.rs:47 are kept as 'gate-covered' by a manual AppImage check. That check is not a `just check` recipe and was never run. With running_appimage → None every test passes, including the acceptance's 'running_appimage unit', so RK42 (child started from a mount that disappears) is unproven.",
      "fix": "Add a run_ignored_in_child test (as merge_requests/tests.rs uses) with APPIMAGE=<fake path> and APPDIR=<current_exe's folder>, asserting running_appimage() and range_window's choice give $APPIMAGE."
    },
    {
      "file": "crates/merge-requests/src/job_page.rs",
      "line": 53,
      "severity": "should",
      "rule_id": "VF7",
      "problem": "Survivors job_page.rs:53/:61 and range_window.rs:65/:68 are labelled 'wiring', but each is a platform decision (opener program and args, detach flags), not a registration seen in the smoke. CI runs tests on macos-14 and windows-2025, so they can be killed. If they stay, a wrong opener or a zero flag on mac/Windows ships unnoticed.",
      "fix": "Add cfg(macos)/cfg(windows) unit tests on opener(url).get_program()/get_args(), and a named const for the detach flags with a cfg(windows) test, or list the flags as an explicit open risk instead of wiring."
    },
    {
      "file": "crates/merge-requests/src/open.rs",
      "line": 129,
      "severity": "should",
      "rule_id": "RK40",
      "problem": "The guard that refuses a target branch containing ':' (which would make the refspec write a ref) is not covered by any test. Deleting it passes every test, so a later edit can silently reopen a ref-writing fetch.",
      "fix": "Add scenario graphql-merge-request-17.json with targetBranch \"main:refs/heads/x\", and an open.rs test asserting Failed and unchanged for-each-ref."
    },
    {
      "file": "crates/merge-requests/src/job_page.rs",
      "line": 36,
      "severity": "should",
      "problem": "[INFERENCE, not run] The opener is not detached. On a desktop where xdg-open starts the browser itself (no browser running, generic xdg-open path), the browser joins yamt's terminal process group. Ctrl-C or closing the terminal then ends the browser too, which is the I4 reason the range child is detached. Nothing else builds on this.",
      "fix": "Give the opener its own process group on unix (command.process_group(0)), as range_window::detach does, and pin it with the same pgid==pid unit test."
    },
    {
      "file": "crates/merge-requests/tests/open.rs",
      "line": 31,
      "severity": "nit",
      "problem": "Fake (scenario symlink, glab.env, log reading) is a copy of tests/list.rs:36. The open_risk's premise is wrong: integration tests can share tests/common/mod.rs. Each new scenario rule must otherwise be edited twice.",
      "fix": "Move Fake to crates/merge-requests/tests/common/mod.rs and `mod common;` from list.rs and open.rs."
    }
  ]
}
