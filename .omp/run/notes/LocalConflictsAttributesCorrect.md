# LocalConflictsAttributesCorrect

Agent output (`agent://LocalConflictsAttributesCorrect`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-20T08-47-17-734Z_01a1f823-7ce6-7780-b335-95b51a2d3520/LocalConflictsAttributesCorrect.md), collected 2026-11-20T09:02:03.568Z.

{
  "verdict": "pass",
  "checked": [
    "Contract met: `-c attr.tree=<first> -c core.attributesFile=` sit before merge-tree via the existing self.command; GIT_ATTR_NOSYSTEM=1 is set. The caller (check.rs:309) passes target as first.",
    "Tests fail without the fix: HEAD is local (lib.rs:171-175). Test 3 catches no attr.tree and attr.tree=<second>; test 2 catches a dropped core.attributesFile=; the note shows all 3 fail when reverted.",
    "Mutation: 1 mutant that could not compile, 0 missed, none kept, so no VF7 reasons to check. Accepted: config set at repo level (hermetic_git, justfile:4) and no NOSYSTEM test.",
    "Open risk: CI installs no git; runner images ship git 2.56.x on ubuntu-22.04, macos-15 (Homebrew) and windows-2025 (runner-images readmes), so CI can't hit pre-attr.tree git.",
    "[INFERENCE, from git source; bash blocked] An empty core.attributesFile also replaces the XDG default. Windows handling of \"\" is unmeasured, but windows CI runs the 3 new tests.",
    "No line-space conversions or CM rules in this patch. RK52: Access, GIT_NO_LAZY_FETCH and the ref/index/worktree guarantees are unchanged."
  ],
  "findings": [
    {
      "file": "crates/gitio/src/merge_tree.rs",
      "line": 57,
      "severity": "should",
      "rule_id": "RK52",
      "problem": "The doc comment says only git before 2.42 ignores attr.tree. Git 2.43.0 release notes (line 104) show attr.tree first shipped in 2.43, so on 2.42 the user's working-tree attributes still decide the check. A maintainer relying on this comment would get version support wrong.",
      "fix": "Change the comment to \"git before 2.43, which ignores `attr.tree`\"."
    },
    {
      "file": "crates/gitio/tests/local_check.rs",
      "line": 154,
      "severity": "should",
      "rule_id": "RK19",
      "problem": "`same_line_outcomes` runs on any git from 2.38, but the tests at lines 167 and 201 need attr.tree (2.43+). On a supported git such as Apple Git 2.39.5 (parsed in version.rs) or Debian 12's 2.39, `just test` fails while CI stays green: tests pass or fail per machine.",
      "fix": "Gate the two attr.tree tests on git ≥ 2.43, the same way supported_runs gates on --write-tree; leave the core.attributesFile test ungated."
    }
  ]
}
