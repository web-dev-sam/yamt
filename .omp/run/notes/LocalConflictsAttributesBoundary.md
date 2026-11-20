# LocalConflictsAttributesBoundary

Agent output (`agent://LocalConflictsAttributesBoundary`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-20T08-47-17-734Z_01a1f823-7ce6-7780-b335-95b51a2d3520/LocalConflictsAttributesBoundary.md), collected 2026-11-20T09:00:14.558Z.

{
  "verdict": "pass",
  "checked": [
    "Only the two Owned files change. Reuses `self.command` (no second builder); `-c core.attributesFile=` follows the builder's `-c core.quotepath=false`. No new crate edge, dependency or state (PM1).",
    "Signature unchanged; the one caller (check.rs:309) passes the target tip as `first`. `MergedPairs` lives in memory for one run, keyed by (target, source): key still correct. No contradiction with plan §2 #149.",
    "Open risk 1 accepted: CI's unpinned git already passes ungated tests needing newer git (local_check.rs:410, 2.45+; start_from_disk.rs:376, 2.44, all 3 runners), so it is above 2.43. No minimum git is stated: brief non-goal.",
    "Open risk 2 and deviations accepted: empty supported_runs matches existing tests; repo-config core.attributesFile is the brief's fallback (RK19); GIT_ATTR_NOSYSTEM untestable (system file).",
    "Tests: `same_line_outcomes` reuses supported_runs, commit, diverged_repo, SAME_LINE; nothing copied; each Acceptance line has its own test.",
    "Comments: the new doc lines state external git facts at the item (CP1/CP2); no narration, no TODO."
  ],
  "findings": [
    {
      "file": "crates/gitio/src/merge_tree.rs",
      "line": 57,
      "severity": "should",
      "rule_id": "CP1",
      "problem": "The doc comment says git 'before 2.42' ignores attr.tree, but git first honours attr.tree in 2.43.0 (RelNotes 2.43.0; 2.41 added only --attr-source). It also cites no source for this or the info/attributes and GIT_ATTR_NOSYSTEM facts. A future git minimum or version gate would rely on a fact that is one release off.",
      "fix": "Write 'git before 2.43 (RelNotes 2.43.0)' and cite gitattributes(5) and git(1) ENVIRONMENT, as `refuse_lazy_fetch` does. The brief's '2.38–2.41' wording has the same error."
    }
  ]
}
