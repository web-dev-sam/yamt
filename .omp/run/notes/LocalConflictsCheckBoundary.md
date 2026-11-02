# LocalConflictsCheckBoundary

Agent output (`agent://LocalConflictsCheckBoundary`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-02T17-45-19-979Z_01a19d5d-9b6b-71a4-8899-91c0c235c4e6/LocalConflictsCheckBoundary.md), collected 2026-11-02T18:34:43.463Z.

{
  "verdict": "fail",
  "checked": [
    "Ownership/PM1: every changed file is in Owned (bindings.ts is the orchestrator's). No new yamt-* edge; src-tauri reaches the check only through yamt_merge_requests re-exports.",
    "Contract: MergesCleanly, CheckedRow, Listed, ConflictCheck, MergedPairs, CheckSummary match the brief. Constants beside their only user (check.rs:16-19). Accepted: Pair key, finishing order.",
    "One fold (vision 2): readiness.rs alone folds; page.rs derives row readiness and RowToCheck from one GitLabMerge::read. MergesCleanly only from readiness_after(Clean), per design §2.1.",
    "State: merged's one writer is check_conflicts under MergeRequestState.merged, never locked with pages (merge_requests.rs:125-129). Doc lines for the docs keeper are in deviations; AGENTS.md amended.",
    "list(): End sent as before, then Checked under the lock, send failures unlogged (rule 8). Open risks 1-3 are the correctness lens's; risk 4 (answer after check) is option A's intent, accepted.",
    "Comments (CP1/CP2) fine in check.rs, readiness.rs, list.rs and the script header. RS6: check.rs 376 lines, clippy clean per notes. RS4 holds. Recorded pages gain only targetBranch."
  ],
  "findings": [
    {
      "file": "crates/merge-requests/src/check.rs",
      "line": 180,
      "severity": "block",
      "rule_id": "growth: copied decision (plan §2 #132)",
      "problem": "#132's refs `refs/heads/<t>` and `refs/merge-requests/<iid>/head` are now built in two places: open.rs:133-134 inline, after require_branch_name, and check.rs:180-186. In check.rs the ':' guard sits in remote_ref_patterns, away from refspecs_for, which only stays safe because ls-remote never advertises a ':' name. A third fetch path will copy whichever version it finds.",
      "fix": "Make one pub(crate) `branch_ref(branch) -> Result<String, String>` that refuses ':' (folding in require_branch_name), plus `head_ref(iid)`, next to require_branch_name in open.rs. Call them from open.rs's fetch_unless_local and from check.rs. prepare_open's behaviour stays the same."
    },
    {
      "file": "scripts/local-conflicts-repo.sh",
      "line": 41,
      "severity": "should",
      "rule_id": "promote",
      "problem": "The fixed author/committer env, which keeps commit ids stable for the recorded JSON, is now spelled out a fourth time (mr-conflict-repo.sh and range-repo.sh `commit_at`, range-repo.sh:117, here). Each new fixture script copies it again, and an identity change has to be made in every copy.",
      "fix": "Shared edit (git-sandbox.sh is outside Owned): move `commit_at <date> <message>` into scripts/git-sandbox.sh, drop the two local copies, and have this script call `commit_at 2026-10-08T10:00:00+02:00 \"Card colours\"`."
    },
    {
      "file": "crates/merge-requests/src/check.rs",
      "line": 342,
      "severity": "should",
      "rule_id": "RS16",
      "problem": "`merged_in_finishing_order` returns how many merges started, not merges, and `decided_rows` (l.121) returns a count. A reader expects the data the names promise and has to read the doc lines. Nothing structural gets harder.",
      "fix": "Rename them for what they return, e.g. `started_merges` and `decided_count` (also `merge_and_send` → `decided_by_merges`)."
    },
    {
      "file": "src-tauri/src/merge_requests.rs",
      "line": 70,
      "severity": "should",
      "rule_id": "RS5",
      "problem": "RS5 still names src-tauri's 'two Mutexes' (Merge, Host), and the patch adds `merged` beside `pages` with its own 'never locked together' rule. The deviation list asks no amendment, so the rule reviewers check by hand keeps drifting from the code.",
      "fix": "Add to deviations_from_brief for the docs keeper an RS5 amendment naming MergeRequestState's `pages` and `merged` (plan #133, #149) and their never-held-together rule."
    }
  ]
}
