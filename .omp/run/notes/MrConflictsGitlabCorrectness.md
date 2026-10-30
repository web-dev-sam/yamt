# MrConflictsGitlabCorrectness

Agent output (`agent://MrConflictsGitlabCorrectness`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-10-30T21-21-14-771Z_01a18eb0-3413-7251-ad3d-5e4e0123ce8e/MrConflictsGitlabCorrectness.md), collected 2026-10-30T21:44:37.011Z.

{
  "verdict": "fail",
  "checked": [
    "24-value fold matches the brief's table; the [_;24] table test, null → Checking and MERGE_TRAIN_STUCK → Other (page/tests.rs) fail on any wrong mapping",
    "Conflicts first (#1998): flag or CONFLICT status; also = Blocked reason then Draft (no dup); Ready/NeedsRebase/Checking add nothing; all acceptance cases pinned",
    "Saturation: saturated() -3→0, 5e9→u32::MAX (tested); open_discussions unchanged; null summary → None (tested). Fork: is_from_fork(None,t)=true, tested on the row path, shared by resolve",
    "prepare_resolve order matches the brief (glab, auth+project, branches, NotOpen, FromFork, `:`, NoRemote). Logged out calls only `auth status`. RK40: refs/status/HEAD unchanged on !21; open.rs keeps its `:` test",
    "RK41 untouched. All four recorded list pages carry the 5 required fields; open_risks accepted (GitLab types them non-null)",
    "Survivors: the asserted READINESS entries (82:30) and the FORK_AT/size consts are #732 false survivors (justfile:153), wrongly labelled equivalent; see the should finding. No targeted test was run."
  ],
  "findings": [
    {
      "file": "crates/merge-requests/src/resolve.rs",
      "line": 54,
      "severity": "block",
      "rule_id": "RK40",
      "problem": "Only the source-branch `:` refusal is tested (!33). Deleting the target-branch check on line 54 leaves every test green, yet `yamt_gitio::fetch_branches` (fetch.rs:38) relies on this caller to refuse a `:` name. Without the check, a target like `main:refs/heads/x` reaches a fetch refspec and writes a ref.",
      "fix": "Add a scenario `graphql-merge-request-<n>.json` whose targetBranch is `main:refs/heads/x` and a tests/resolve.rs case asserting `Failed { message: \"GitLab sent \\\"main:refs/heads/x\\\" as a branch name\" }`."
    },
    {
      "file": "frontend/src/ipc/fixtureMergeRequestData.ts",
      "line": 80,
      "severity": "should",
      "rule_id": "VF7",
      "problem": "The kept survivors on lines 77-85 are labelled (a) 'equivalent', which they are not: a changed entry changes the rows. The asserted entries are #732 tool artifacts, but READINESS[2,3,5,6] (ready, needsRebase, checking, a non-draft pipelineMustPass) are asserted by no test and are real gaps. As the cycle grows, MrConflictsPage's fixture script can drift without a failing test.",
      "fix": "Assert all eight cycle positions (e.g. iids 638, 637, 635 and 626 for 2/3/5/6) in fixtureMergeRequestData.test.ts, and relabel the asserted-entry survivors as #732 false survivors, not equivalent."
    }
  ]
}
