# LocalConflictsGitioCorrectness

Agent output (`agent://LocalConflictsGitioCorrectness`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-02T17-45-19-979Z_01a19d5d-9b6b-71a4-8899-91c0c235c4e6/LocalConflictsGitioCorrectness.md), collected 2026-11-02T17:56:03.222Z.

{
  "verdict": "fail",
  "checked": [
    "merge_tree.rs:70-77 maps exits like is_ancestor (0 Clean; 1 + empty stderr Conflicts; else GitFailed/Timeout). Deviation accepted. The stderr risk on 2.38-2.49 is accepted: only a false GitFailed, never a false Clean (check.md:87-89).",
    "Tests catch a removed feature: stderr guard local_check.rs:113, swapped outcomes :63, dropped --quiet via count-objects :90, ignored timeout :135, dropped --refs via the tag-8 ^{} line :181, non-commits/order :230.",
    "ZERO-deadline race accepted: run_with_deadline sets the deadline before spawn and calls try_wait microseconds later, so git cannot exec and exit first (run.rs:160-200).",
    "Mutation: 26 mutants, 18 caught, 8 unviable, 0 missed; no kept survivor, so VF7 has nothing to check. The run covers merge_tree.rs, ls_remote.rs and objects.rs.",
    "Contract kept: signatures, Hash on Oid/MergeOutcome, re-exports, only run/run_without_prompts, version consts in one place, Access per form; AGENTS.md:13 matches the code.",
    "Parser unit tests cover tab split, empty name, bad id, line count, order and a glued id. All acceptance tests are present under their names. No test was run."
  ],
  "findings": [
    {
      "file": "crates/gitio/tests/local_check.rs",
      "line": 211,
      "severity": "block",
      "rule_id": "RK52",
      "problem": "RK52 names remote_refs (the check's network call on every list load) and forbids waiting on a prompt, but no test pins its no-prompt environment. ls_remote.rs:31 could run without run_without_prompts and every test would pass; fetch and push pin it (tests/fetch.rs:118, push.rs:140).",
      "fix": "Add remote_refs_runs_with_no_prompt_of_git_ssh_or_a_credential_manager. Record the environment through remote.gitlab.uploadpack as tests/fetch.rs:91-97 does, then assert the four no-prompt variables are set."
    },
    {
      "file": "crates/gitio/src/objects.rs",
      "line": 20,
      "severity": "should",
      "rule_id": "RK52",
      "problem": "[INFERENCE] In a partial clone (RK39), cat-file --batch-check and merge-tree lazily fetch missing objects without the no-prompt environment. A network call or prompt could occur per unknown head, and a Quiet merge could write blobs. Left as is, RK52 holds only for full clones.",
      "fix": "Set GIT_NO_LAZY_FETCH=1 on the missing_commits and merge_tree commands, so a missing object fails instead of being fetched. Or record the partial-clone gap in RK52 for the docs keeper."
    }
  ]
}
