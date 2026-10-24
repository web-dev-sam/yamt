Fix round 1 passes: all six items are fixed and nothing broke. The one new mutation survivor is real but the behaviour it guards is older than this round, so I've reported it as a `should`, not a `block`.

```json
{
  "verdict": "pass",
  "findings": [
    {
      "severity": "should",
      "file": "crates/gitio/src/repo.rs",
      "line": 202,
      "rule_id": "VF7",
      "problem": "Survivor repo.rs:202:15 changes the guard `stderr.is_empty()` to always true. It is not equivalent: I ran a probe in /tmp, and `git tag treetag 'HEAD^{tree}'` then `git rev-parse --verify --quiet 'treetag^{commit}'` exits 1 and prints `error: treetag^{commit}: expected commit type, but the object dereferences to tree type`. Under the mutant, `commit_named(\"treetag\")` returns Ok(None) instead of GitFailed, so `yamt --range treetag..HEAD` would say `UnknownName` instead of showing git's reason. The guard dates from `is_unresolved_name`. Until now it sat inside a `matches!` macro, which cargo-mutants did not mutate, so the gap was there before and is only now visible. It is not a regression, which keeps it below the RV8 block bar. If it stays, every caller that reads None as \"no such name\" (yamt-range `open.rs`, `operation.rs`, `sequence.rs`) can lose git's error with no test noticing.",
      "fix": "Add one integration test to crates/gitio/tests/diff.rs next to the merge_base test. It tags `HEAD^{tree}` as `treetag` and asserts that `repo.commit_named(\"treetag\")` is `Err(Error::GitFailed { status: Some(1), stderr, .. })` with `stderr` containing `expected commit type`."
    }
  ],
  "survivors": [
    {
      "mutant": "crates/gitio/src/repo.rs:202:15 replace match guard stderr.is_empty() with true in oid_unless_silent",
      "triage": "Real gap, not (a), (b) or (c). Exit 1 with a message can be reached with a real git, as the tag-on-a-tree probe above shows. The guard dates from is_unresolved_name/is_silent_failure, so the gap is old. The status half of the old guard, the earlier survivor repo.rs:188:27, is killed now: the helper's `status: Some(1)` pattern sees the 128 exit in merge_base_is_the_fork_point_and_none_for_unrelated_histories and commit_named_without_a_repository_is_a_git_failure_not_a_missing_head. That is finding 1."
    }
  ],
  "checked": [
    "Item 1, histogram: I ran `git diff --no-index --numstat` myself on `x x x x U` → `U x x x x`. It gives histogram 4/4, myers 1/1 and minimal 1/1. The test sets diff.algorithm=minimal and expects lines(4, 4) (tests/diff.rs:300-305), so removing `--diff-algorithm=histogram` gives 1/1 and the test fails. The implementer's hand-removal run reports the same failure.",
    "Item 1, `--ignore-submodules=none`: I ran a probe repo in /tmp with a gitlink, a `.gitmodules` with `ignore = all`, `submodule.lib.ignore=all` and `diff.ignoreSubmodules=all`. `git diff-tree -r --raw` lists `.gitmodules A` plus `vendor/lib M` with the flag, and only `.gitmodules A` without it. So the expected list fails when the flag is removed, which matches the implementer's hand-removal output.",
    "Item 1, expected list: the gitlink entry is still expected, and `.gitmodules` is added as Added REGULAR with lines(3, 0); the file has 3 lines. The config loop sets `submodule.lib.ignore=all`. The other tests in tests/diff.rs are unchanged, since the patch touches only this test.",
    "Item 2: `oid_unless_silent(command: Command, name: &'static str) -> Result<Option<Oid>>` (repo.rs:195) holds the match plus the `without_final_newline` and `Oid::parse` tail. commit_named, merge_base and submodule_head each call it with REV_PARSE or MERGE_BASE. A grep finds no `is_silent_failure` anywhere in crates/. Behaviour is kept: the same status 1 and empty-stderr test and the same tail. Deviation accepted: the check is a match-arm pattern inside the helper, which meets \"lives only inside it\". The git-source comment moved with it.",
    "Item 3: `pub(crate) fn mode_from_git` is at entry.rs:106. parse_record (entry.rs:91) and diff.rs `mode_of` (diff.rs:191) both use it. A grep for `OCTAL` and `from_str_radix` finds only entry.rs:69 and 107, so diff.rs no longer has its own copy.",
    "Item 4: `BlobReader::read` compares against `BLOB` (blob.rs:79). No `\"blob\"` literal is left except the constant at blob.rs:9.",
    "Item 5: blob.rs `an_answer_naming_another_id_is_unexpected_output` asks about id `a` and feeds answers naming `b`: `<b> blob 3` and `<b> missing`. If either `*named == oid.as_str()` guard (blob.rs:40-41) is set to true, that answer gives Ok(Some(3)) or Ok(None), unwrap_err panics, and the test fails. So it kills both old survivors. The name deviation is accepted because the brief left the name open.",
    "Item 6: `a_record_with_an_empty_path_is_unexpected_output` (diff.rs:392) feeds `:… M\\0\\0`. Without the `!path.is_empty()` guard I traced: header taken, empty path accepted, the numstat loop does not take the final empty field, and `(Some([]), None)` is accepted. So the parse would return Ok and unwrap_err would panic, which means the test kills diff.rs:198:23.",
    "No public signature changed: lib.rs is not in the patch, and changed_files, blob_sizes, commit_named, merge_base and submodule_head keep their signatures, so yamt-range is unaffected.",
    "Implementer's open risk accepted: `.gitmodules` sorts first in diff-tree's order, and my probe output lists it first.",
    "Out-of-Owned file in the commit: .omp/run/mutants/RVCrate.survivors.txt is an orchestration artifact, not source. No boundary or growth effect.",
    "Bash used only for read-only git probes in /tmp, both removed afterwards. No source was edited and no test was run."
  ]
}
```