# LocalConflictsGitio

Agent output (`agent://LocalConflictsGitio`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-02T17-45-19-979Z_01a19d5d-9b6b-71a4-8899-91c0c235c4e6/LocalConflictsGitio.md), collected 2026-11-02T17:52:27.000Z.

{
  "summary": "gitio now has the local conflict check's three git runs. `Repo::merge_tree` runs `merge-tree --write-tree [--quiet]` and answers `MergeOutcome`. `MergeTreeRun::for_version` picks the form from 2.38 and 2.50, the only place those versions live. `Repo::remote_refs` runs `ls-remote --refs` through `run_without_prompts` and returns `RemoteRef`s. `Repo::missing_commits` runs one `cat-file --batch-check` and names missing ids and ids that are not commits. `Oid` derives `Hash`. New tests: 7 integration tests and 11 unit tests (2 parsers, `for_version`).",
  "files_changed": [
    "crates/gitio/src/merge_tree.rs",
    "crates/gitio/src/ls_remote.rs",
    "crates/gitio/src/objects.rs",
    "crates/gitio/src/entry.rs",
    "crates/gitio/src/lib.rs",
    "crates/gitio/tests/local_check.rs",
    "crates/gitio/AGENTS.md"
  ],
  "tests_added": [
    {
      "name": "local_check::merge_tree_is_clean_for_disjoint_changes_and_conflicts_for_the_same_line",
      "proves": "Each run form the installed git supports (Quiet and Writing on 2.56) gives Clean for disjoint changes and Conflicts for the same line."
    },
    {
      "name": "local_check::a_quiet_merge_writes_no_object_and_leaves_refs_index_and_worktree_alone",
      "proves": "Quiet leaves `count-objects -v` unchanged and Writing changes it. For both forms, refs, `status --porcelain`, the index hash and HEAD stay the same."
    },
    {
      "name": "local_check::a_merge_of_a_missing_commit_or_unrelated_histories_is_an_error_not_a_conflict",
      "proves": "An unknown id (git exits 1 and writes to stderr) and an unrelated root commit (exit 128) both give GitFailed, never Conflicts, in both forms."
    },
    {
      "name": "local_check::a_merge_past_its_deadline_is_a_timeout",
      "proves": "A Duration::ZERO deadline gives Error::Timeout in both forms."
    },
    {
      "name": "local_check::remote_refs_lists_the_branch_and_merge_request_heads_of_a_bare_remote_and_writes_nothing",
      "proves": "main, 7/head and 8/head (an annotated tag, so no `^{}` line) come back in git's order with their ids. Refs, status, index, HEAD and object count are unchanged; there is no FETCH_HEAD."
    },
    {
      "name": "local_check::remote_refs_of_an_unreachable_remote_gives_gits_first_line",
      "proves": "A remote whose path does not exist gives Err(\"fatal: '<path>' does not appear to be a git repository\"), only the first of git's stderr lines."
    },
    {
      "name": "local_check::missing_commits_names_unknown_ids_and_non_commits_in_order",
      "proves": "For [commit, unknown, commit, tree] the answer is [unknown, tree]."
    },
    {
      "name": "merge_tree::tests (3 tests: before 2.38, 2.38 to 2.49, 2.50 and later)",
      "proves": "for_version gives None for 2.37 and 1.99, Writing for 2.38 and 2.49, Quiet for 2.50 and 3.0."
    },
    {
      "name": "ls_remote::tests (5 parser tests)",
      "proves": "Parser: tab-separated lines kept in order, an empty answer gives an empty list, names keep non-UTF-8 bytes, and a line with no tab, a bad id or no name gives Err(\"git ls-remote printed …\")."
    },
    {
      "name": "objects::tests (3 parser tests)",
      "proves": "Parser: `missing` and non-commit types are named in input order. Lines out of order, too few lines, or an id run into its type give UnexpectedOutput."
    }
  ],
  "smoke_evidence": [
    {
      "command": "env -u GIT_CONFIG_PARAMETERS -u GIT_CONFIG_COUNT GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_NOSYSTEM=1 XDG_CONFIG_HOME=/nonexistent cargo nextest run -p yamt-gitio",
      "observed": "All 7 `yamt-gitio::local_check` tests PASS, and so do the merge_tree/ls_remote/objects unit tests. `Summary [   1.644s] 209 tests run: 209 passed, 13 skipped`"
    },
    {
      "command": "cargo clippy -p yamt-gitio --all-targets -- -D warnings",
      "observed": "Checking yamt-gitio v0.6.5 … Finished `dev` profile [unoptimized + debuginfo] target(s) in 1.69s (no warnings)"
    },
    {
      "command": "cargo fmt --check",
      "observed": "exit 0 (fmt-ok)"
    },
    {
      "command": "git -C /tmp/mtx merge-tree --write-tree [--quiet] HEAD <unknown id | unrelated root>",
      "observed": "For the unknown id: `merge-tree: 0123…4567 - not something we can merge`, exit 1, both forms. For the unrelated root: `fatal: refusing to merge unrelated histories`, exit 128, both forms."
    },
    {
      "command": "just mutants HEAD",
      "observed": "Found 26 mutants to test … 26 mutants tested in 74s: 18 caught, 8 unviable; mutants: no TypeScript changes since HEAD"
    }
  ],
  "mutation": {
    "command": "just mutants HEAD → 26 mutants: 18 caught, 8 unviable, 0 missed",
    "survivors": []
  },
  "acceptance_not_run": [],
  "deviations_from_brief": [
    "merge_tree contract doc: git 2.56 also exits 1 for a commit it cannot find (\"… - not something we can merge\" on stderr, measured, both forms). So exit 1 is `Conflicts` only when stderr is empty, else `GitFailed`; the missing-commit acceptance test needs this. The doc line now says so; the signature is unchanged.",
    "The `merge_tree` parameter is named `run_kind`, not `run`: a parameter named `run` would hide the `run` helper the brief requires. The types and positions are as in the contract.",
    "The `remote_refs` integration test also points an annotated tag at `refs/merge-requests/8/head`. Without `--refs` that ref would also print a `^{}` line, so the test checks the flag against real git.",
    "architecture §3.2, add to `impl Repo`: `pub fn merge_tree(&self, first: &Oid, second: &Oid, run_kind: MergeTreeRun, timeout: Duration) -> Result<MergeOutcome>; // merge-tree --write-tree [--quiet]: exit 0 Clean, exit 1 + empty stderr Conflicts, else GitFailed; Quiet Read/no object, Writing Write/unreferenced objects; timeout → Timeout`",
    "architecture §3.2: `pub fn remote_refs(&self, remote: &str, patterns: &[&str], timeout: Duration) -> Result<Vec<RemoteRef>, String>; // ls-remote --refs --end-of-options via run_without_prompts; RemoteRef { name: Vec<u8>, id: Oid }, git's order, nothing written; Err = first stderr line, exit words, or \"git ls-remote printed …\"`",
    "architecture §3.2: `pub fn missing_commits(&self, ids: &[Oid]) -> Result<Vec<Oid>>; // one cat-file --batch-check='%(objectname) %(objecttype)': ids missing or not a commit, input order`",
    "architecture §3.2, below the block: `impl MergeTreeRun { pub fn for_version(GitVersion) -> Option<MergeTreeRun>; } // Quiet ≥ 2.50, Writing 2.38–2.49, None before (FIRST_WITH_QUIET / FIRST_WITH_WRITE_TREE)`; also note that `Oid` derives Hash.",
    "Project map tree.md (docs keeper): add crates/gitio/src/merge_tree.rs, ls_remote.rs and objects.rs if gitio files are listed there. The RK52 row already names `merge_tree`/`remote_refs`; the proving tests are in crates/gitio/tests/local_check.rs."
  ],
  "open_risks": [
    {
      "location": "crates/gitio/src/merge_tree.rs:70-76",
      "risk": "Telling Conflicts from errors relies on an empty stderr for exit 1. That was seen on git 2.56 only. A git 2.38–2.49 that writes a warning to stderr on a conflict would report GitFailed instead (a false error, never a false Clean)."
    },
    {
      "location": "crates/gitio/src/objects.rs:13 and merge_tree.rs:53",
      "risk": "[INFERENCE] In a partial (promisor) clone, cat-file and merge-tree may fetch missing objects over the network on their own, without the no-prompt environment. GIT_NO_LAZY_FETCH is not set; this is outside the brief."
    },
    {
      "location": "crates/gitio/tests/local_check.rs:140",
      "risk": "The Duration::ZERO timeout test depends on git not having exited within microseconds of spawn. This is practically certain, but it is a race in principle."
    }
  ]
}
