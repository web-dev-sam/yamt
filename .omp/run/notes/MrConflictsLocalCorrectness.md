# MrConflictsLocalCorrectness

Agent output (`agent://MrConflictsLocalCorrectness`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-10-30T21-21-14-771Z_01a18eb0-3413-7251-ad3d-5e4e0123ce8e/MrConflictsLocalCorrectness.md), collected 2026-10-30T21:56:11.320Z.

{
  "verdict": "fail",
  "checked": [
    "Rule 4/RK43: every refusal asserts HEAD, refs/heads, status and no record before = after (refusals.rs). branch_before runs before any write; checkout -B only goes to a commit containing the local tip.",
    "Rule 7/RK44: abort tests (restart via fresh find_live, moved back, reset --keep, detached, BranchKept, NotReturned) run git's real merge --abort, then restore. Branch config gone, record removed.",
    "Locks RK46/47: start lock held via `_lock`; another handle gives AlreadyMerging{None}, a live record Some(21). Claim retry killed by a_claim_waits_…. Deviations (test layout, LockFailed, GitRefused io, rename_all) accepted.",
    "RK45: PushOffer is built only by committed(); push tests pin the bare repo's only changed ref and the [rejected] case. RK15/19/40 hold: hermetic fixture, no refs on a failed fetch; ':' names are prepare_resolve's.",
    "Survivors record.rs:133 x3 only change whether remove() logs: VF7 (a) accepted. start.rs:209 reason measured wrong (finding 2) by one throwaway git command in /var/tmp with core.warnAmbiguousRefs=false.",
    "Step 13 merging `<remote>/<target>` (MERGE_MSG 'origin/main') accepted; the ambiguity test kills always-short under default config. arch-check: local-merge allows gitio only; app list gains it."
  ],
  "findings": [
    {
      "file": "crates/local-merge/src/start.rs",
      "line": 192,
      "severity": "block",
      "rule_id": "RK44",
      "problem": "MERGE_HEAD for another commit than record.merging (a concurrent fetch moving origin/main between steps 7 and 13) makes is_live false. restore then runs without a merge abort: an unrecorded merge stays on the created branch, or [INFERENCE] checkout drops MERGE_HEAD and carries the staged merge onto develop.",
      "fix": "In `merged`, when the stop has an operation but is not live, call `repo.abort(&operation)` before Err. Test with a post-checkout hook that moves refs/remotes/origin/main; assert checkout() before = after."
    },
    {
      "file": "crates/local-merge/src/start.rs",
      "line": 209,
      "severity": "block",
      "rule_id": "VF7",
      "problem": "The kept survivor's reason is wrong. Measured: with `core.warnAmbiguousRefs=false` (user config, not isolated by gitio) and a local `origin/main`, `rev-parse --verify --symbolic-full-name origin/main` prints `refs/heads/origin/main`. The guard picks the merged commit and the mutant merges the wrong one undetected.",
      "fix": "Add a variant of a_local_branch_named_like_the_remote_target_… that runs `git config core.warnAmbiguousRefs false` in the checkout first and asserts MERGE_HEAD is GitLab's main."
    },
    {
      "file": "crates/local-merge/src/restore.rs",
      "line": 77,
      "severity": "block",
      "rule_id": "RK44",
      "problem": "A created branch at record.head that stays checked out because git refused the return is reported as BranchKept. §4.5 words that as 'feature/x changed after the merge started', which is false here (the implementer's own open risk).",
      "fix": "Orchestrator amends §4.6/§4.5: a separate Leftover for 'kept, still checked out', or no BranchKept when the tip is still record.head after a refused return. Pin the choice in a_refused_return_is_listed_…."
    }
  ]
}
