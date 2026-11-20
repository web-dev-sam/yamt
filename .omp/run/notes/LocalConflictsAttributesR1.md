# LocalConflictsAttributesR1

Agent output (`agent://LocalConflictsAttributesR1`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-20T08-47-17-734Z_01a1f823-7ce6-7780-b335-95b51a2d3520/LocalConflictsAttributesR1.md), collected 2026-11-20T09:12:21.626Z.

{
  "summary": "merge_tree doc comment now says git before 2.43 ignores attr.tree (git 2.43.0 release notes) and cites gitattributes(5) for info/attributes and git(1) ENVIRONMENT for GIT_ATTR_NOSYSTEM. In local_check.rs the working-tree and committed-attributes tests return early on git < 2.43 via honours_attr_tree(repo.version()). The core.attributesFile test stays ungated. A predicate test pins 2.42 → skip and 2.43 → run.",
  "files_changed": [
    "crates/gitio/src/merge_tree.rs",
    "crates/gitio/tests/local_check.rs"
  ],
  "tests_added": [
    {
      "name": "local_check::attr_tree_is_honoured_from_git_2_43",
      "proves": "The gate predicate skips on git 2.42 and runs on 2.43, the first release that honours attr.tree."
    }
  ],
  "smoke_evidence": [
    {
      "command": "cargo test -p yamt-gitio --test local_check",
      "observed": "test attr_tree_is_honoured_from_git_2_43 ... ok; test an_untracked_gitattributes_in_the_working_tree_does_not_clean_a_conflict ... ok; test the_users_attributes_file_does_not_clean_a_conflict ... ok; test a_gitattributes_committed_in_the_first_commit_still_applies ... ok; test result: ok. 15 passed; 0 failed (git version 2.56.1)"
    },
    {
      "command": "cargo clippy -p yamt-gitio --all-targets",
      "observed": "Checking yamt-gitio v0.7.1 ... Finished `dev` profile — no warnings (an earlier doc_markdown warning on 'RelNotes' was fixed by rewording to 'git 2.43.0 release notes')"
    },
    {
      "command": "cargo fmt -p yamt-gitio --check",
      "observed": "no output (clean)"
    }
  ],
  "mutation": {
    "command": "just mutants HEAD → 'INFO No mutants to filter / mutants: no Rust changes since HEAD / no TypeScript changes since HEAD' (src change is doc-only; tests/ not mutated)",
    "survivors": []
  },
  "acceptance_not_run": [],
  "deviations_from_brief": [
    "Not owned, not edited: docs/slices/briefs/local-conflicts-attributes.md has the same wrong boundary. Its '2.38–2.41' wording should read 2.38–2.42, with attributes coming only from the target commit from git 2.43 (git 2.43.0 release notes).",
    "same_line_outcomes now takes &Repo instead of a root path, so each gated test opens the repo once and reads its version before merging.",
    "Citation is written 'git 2.43.0 release notes' rather than 'RelNotes 2.43.0', because clippy doc_markdown flags the bare identifier."
  ],
  "open_risks": [
    {
      "location": "crates/gitio/tests/local_check.rs:188-239",
      "risk": "The skip path on a real git below 2.43 was not observed (local git is 2.56.1); only the predicate test proves the boundary."
    }
  ]
}
