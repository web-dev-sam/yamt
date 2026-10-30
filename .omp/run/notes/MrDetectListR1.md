# MrDetectListR1

Agent output (`agent://MrDetectListR1`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-10-30T13-26-49-608Z_01a18cfd-dc08-7052-b10f-ed6a2bb5d1b5/MrDetectListR1.md), collected 2026-10-30T14:31:13.295Z.

{
  "summary": "gitio now has one reader of `git config -z --get-regexp`: `Repo::config_entries(regexp)` (pub(crate), in merge_config.rs). It holds the only NO_MATCH_STATUS / is_found_or_no_match rule (exit 1 means no match) and the only `<key> NL <value> NUL` parser. Both `merge_config` and `remote_urls` call it, and the copy in names.rs is deleted. The branch-name, remote_names and remote_urls integration tests moved from tests/glab.rs, now 338 lines, to the new tests/names.rs, which has no cfg(unix).",
  "files_changed": [
    "crates/gitio/src/merge_config.rs",
    "crates/gitio/src/names.rs",
    "crates/gitio/tests/glab.rs",
    "crates/gitio/tests/names.rs"
  ],
  "tests_added": [
    {
      "name": "crates/gitio/tests/names.rs (branch_names_…, remote_names_lists_every_remote, remote_urls_are_in_config_order_…)",
      "proves": "Moved unchanged from glab.rs, no cfg(unix), so they also run on the Windows CI. They check real-git behaviour of symbolic_full_name, remote_names and remote_urls, including no match → empty and a broken config → GitFailed."
    }
  ],
  "smoke_evidence": [
    {
      "command": "cargo test -p yamt-gitio -p yamt-review -p yamt-merge-requests",
      "observed": "All suites `test result: ok`, 0 failed. gitio unit tests: 43 passed; tests/names.rs: 3 passed; tests/glab.rs: 11 passed, 3 ignored; what_git_wrote: 10 passed (includes the merge_config test); merge-requests detect 3 passed, list 5 passed; review 35, 8, 15 and 20 passed."
    },
    {
      "command": "cargo fmt --check && cargo clippy --workspace --all-targets -- -D warnings",
      "observed": "fmt check clean; clippy `Finished dev profile` with no warnings."
    },
    {
      "command": "wc -l crates/gitio/tests/glab.rs",
      "observed": "338 crates/gitio/tests/glab.rs"
    },
    {
      "command": "grep NO_MATCH_STATUS crates/gitio/src",
      "observed": "One definition, merge_config.rs:13 `const NO_MATCH_STATUS: i32 = 1;`; its only other hit is its use at merge_config.rs:41."
    }
  ],
  "mutation": {
    "command": "just mutants HEAD → 28 mutants tested in 2m: 26 caught, 2 unviable",
    "survivors": []
  },
  "acceptance_not_run": [],
  "deviations_from_brief": [
    "The shared reader returns `Vec<(Vec<u8>, Vec<u8>)>` (key, value), as finding #1932 suggested. `parse_config_entries` is pub(crate) so that names.rs's unit test can still parse raw `-z` bytes. Both unit tests now build their old `parse_*` names in the test module from parser + `*_from(entries)`, so their assertions are unchanged.",
    "The reader lives in merge_config.rs, not in its own `config.rs`, because adding a module needs crates/gitio/src/lib.rs, which this slice does not own. merge_config.rs therefore also holds the general config reader.",
    "Not fixed, outside Owned: crates/gitio/src/checkout.rs:11-13,101-102 has a third copy of the same rule (`UNSET_STATUS = 1` for `--get`/`--get-regexp`, via `config_lines`). A later slice could switch its promisor lookup to `config_entries`."
  ],
  "open_risks": [
    {
      "location": "crates/gitio/src/checkout.rs:13",
      "risk": "The exit-1 rule still has a second copy (`UNSET_STATUS`, from before this slice). A reviewer may count it against 'lives once'; it is outside Owned."
    }
  ]
}
