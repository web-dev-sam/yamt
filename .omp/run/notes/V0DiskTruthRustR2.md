# V0DiskTruthRustR2 — rework 2 report (commit 45107bd, base a6fb613)

## Summary

All 9 findings (#536–#544) are fixed and every acceptance check passed. Session's `Error::NotAFile` now crosses the IPC as its own variant, `IpcError::NotAFile { path }`. The `NOT_A_FILE` sentence is gone, so the only copy of the wording is session's `#[error]`.
Tests changed:
- the two gitio tests (`merge_file_returns_the_merge_with_one_or_two_conflicts`, the `merge_config` test) no longer depend on the conflict style or on the user's global config;
- the driver test now tells a configured driver (Custom) apart from a text merge (Text);
- the repeated-line test now fails an identity ours→local mapping.
Renames: `previous_base_end` (its doc comment deleted) and `Settlement::LeaveWithMarkers`. The `MergeDriver` docs are reworded, and `src-tauri/AGENTS.md` now names `ipc_error.rs`.

## tests_added

- {"name": "gitio what_git_wrote::merge_file_returns_the_merge_with_one_or_two_conflicts (changed)", "proves": "The two-block input is now base a,b,c,d,e,f with the first and last lines changed on each side. The four alphanumeric lines between the two hunks keep them apart in every conflict style. How it fails on the old code: with the isolated environment (GIT_CONFIG_GLOBAL=/dev/null …) git's `merge` style joins the old input A b c d E / X b c d Y into one block, so the count is 1 and the `count == 2` assert fails (left: 1, right: 2; output pasted in smoke_evidence)."}
- {"name": "gitio what_git_wrote::merge_config_reads_the_default_driver_and_the_names_of_configured_drivers (changed)", "proves": "It asserts only what the repository's own config adds: the default becomes `binary`, and `mergiraf` is appended to whatever drivers were there before. How it fails on the old code: with a global config holding `merge.globaltool.driver`, the old `no_config == MergeConfig::default()` assert failed with drivers [globaltool] vs []. The new test passes under a global config with both `merge.default=binary` and that driver."}
- {"name": "session start_from_disk::a_configured_merge_driver_with_markers_opens_from_disk_at_the_first_list (changed)", "proves": "The driver is now `git merge-file -L ours -L base -L theirs %A %O %B; exit 1`, so it writes git's own text merge. A configured name therefore gives Custom: the file is Changed, the result is MarkersLeft and the middle pane shows the disk. Without the lookup it would be Text: Untouched, no change reported. How the old test passed anyway: with the `config.drivers.contains(name)` lookup disabled (temporary `&& false`), the old driver still produced a different file, so it still passed. The new test fails against that mutant: left [] vs right [(f.txt, MarkersLeft{2})]."}
- {"name": "session seed::tests::a_section_line_repeated_elsewhere_still_applies_the_exact_text (changed)", "proves": "Remote is now DUP,new,mid,other,end and the settled `new` line is in the disk text. The block's ours line therefore sits at view line 3 but at local line 2, and the expected ranges become [(3,1),(2,1),(3,1)]. How it fails: with an identity ours→local mapping (temporary mutant `local: local_lines(ours.clone())` in locate.rs:80) the test panics at seed.rs:308 (middle \"DUP\\nnew\\nmid\\nbase\\nend\\nend\\n\" vs \"DUP\\nnew\\nmid\\nbase\\nend\\n\"). The old test passed under that mutant by the reviewer's analysis; I did not run that combination."}
- {"name": "src-tauri ipc_error::tests::every_other_session_error_serialises_with_its_kind_and_fields (changed)", "proves": "Session NotAFile now serialises as {\"kind\":\"NotAFile\",\"path\":\"a.ts\"}. The old code produced kind WriteFailed with a message, which fails the new json! assert."}

## smoke_evidence

- {"command": "cargo fmt --check && cargo clippy --workspace --all-targets -- -D warnings", "observed": "Finished `dev` profile [unoptimized + debuginfo] target(s) in 34.04s (no warnings, fmt silent)"}
- {"command": "GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_NOSYSTEM=1 XDG_CONFIG_HOME=/nonexistent cargo test --workspace | grep -E '^test result|FAILED|panicked|^error'", "observed": "every line `test result: ok.` (e.g. 42 passed; 27 passed; 17 passed; 38 passed …), no FAILED/panicked/error lines"}
- {"command": "cargo test --workspace (plain; `git config --global merge.conflictstyle` → zdiff3)", "observed": "every line `test result: ok.`, no FAILED/panicked/error lines; last command printed `zdiff3`"}
- {"command": "just fixtures-check", "observed": "diff -ru frontend/fixtures/golden target/fixtures-check/golden\ndiff -ru frontend/fixtures/showcase target/fixtures-check/showcase  (no differences, exit 0)"}
- {"command": "just arch-check", "observed": "scripts/arch-check.sh\narch-check: ok"}
- {"command": "old merge_file test: GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_NOSYSTEM=1 XDG_CONFIG_HOME=/nonexistent cargo test -p yamt-gitio --test what_git_wrote merge_file_returns", "observed": "assertion `left == right` failed: <<<<<<< ours\\nA\\nb\\nc\\nd\\nE\\n=======\\nX … left: 1 right: 2; FAILED"}
- {"command": "old merge_config test with GIT_CONFIG_GLOBAL=<file with merge.globaltool.driver>", "observed": "panicked at what_git_wrote.rs:292:5 left: MergeConfig { default: None, drivers: [globaltool bytes] } right: MergeConfig { default: None, drivers: [] }"}
- {"command": "new gitio merge_* tests with GIT_CONFIG_GLOBAL=<file with merge.default=binary + merge.globaltool.driver>", "observed": "test result: ok. 6 passed; 0 failed"}
- {"command": "driver test against mutant (drivers lookup `&& false`)", "observed": "panicked at start_from_disk.rs:290:5 left: [] right: [(\"f.txt\", MarkersLeft { conflicts: 2 })]"}
- {"command": "seed repeated-line test against identity-mapping mutant", "observed": "panicked at seed.rs:308:9 left: \"DUP\\nnew\\nmid\\nbase\\nend\\nend\\n\" right: \"DUP\\nnew\\nmid\\nbase\\nend\\n\""}
- {"command": "just bindings-check | grep NotAFile", "observed": "+export type IpcError = { kind: \"Git\"; message: string } | { kind: \"UnknownPath\"; path: string } | { kind: \"Unsupported\"; path: string; reason: UnsupportedReason } | { kind: \"WriteFailed\"; path: string; message: string } | { kind: \"NotAFile\"; path: string } | { kind: \"ReadFailed\"; path: string; message: string };  (bindings-check fails: bindings.ts is read-only for this slice and was already behind, e.g. WriteReply)"}

## deviations_from_brief

- New IPC variant (exact): `IpcError::NotAFile { path: String }`, serialised `{ kind: "NotAFile"; path: string }`, declared between WriteFailed and ReadFailed. `frontend/src/ipc/bindings.ts` is not regenerated (read-only here): `just bindings` and the problemText.ts wording for NotAFile remain for the frontend half.
- #543: the driver now writes git's own text merge of the sample, which has two conflict blocks. The structure of the assertions is unchanged, but the expected count is `MarkersLeft { conflicts: 2 }` instead of 1. The driver comment is shortened to the gitattributes(5) reference; the old `driver_output` exact-content assert became `contains("\n<<<<<<< ours\n")`.
- #537: besides the two rewordings the reviewer gave, the `Binary` doc now also names `merge.default=binary`, which the finding says Binary comes from.
- Mutant evidence was produced with temporary edits to crates/session/src/start.rs:127 and crates/session/src/locate.rs:80, both reverted. A throwaway global config file, crates/r2-global.gitconfig, was created for the evidence runs and then deleted, because target/ is outside the owned globs.

## open_risks

- {"location": "frontend/src/ui/problemText.ts", "risk": "After `just bindings`, any exhaustive switch on IpcError.kind needs a NotAFile case, or the typecheck fails. That code is outside this slice."}
- {"location": "crates/session/tests/start_from_disk.rs:280", "risk": "The driver runs `git merge-file` without --diff-algorithm=histogram, while yamt's comparison uses histogram. It passes on this sample: Custom is reported as Changed whatever the driver writes. Under the mutant the comparison counted the file as Untouched, so the two diff algorithms agree here."}