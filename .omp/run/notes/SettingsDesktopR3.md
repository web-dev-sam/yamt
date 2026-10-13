# SettingsDesktopR3 — implementer report (fields read one by one)

```json
{
  "summary": "All six items from rework 3 are fixed in crates/settings. There are new integration tests for an unreadable settings file, for relocating to the default with no location file, and for a location file that cannot be removed (items 1 and 2). A JSON error at the end of the file now reads \"... at line 3\" without \"column 0\" (`file.rs` `syntax_message`, item 3). A chain of exactly 40 symlinks is now written through (`0..=MAX_LINK_HOPS`, item 4). The symlink-cycle test moved from a unit test in file.rs to tests/relocate.rs, as a `settings-location` link cycle reached through `relocate` (item 5). AGENTS.md now names the one unit test still in src (item 6). cargo-mutants on the crate's diff since d370796: 27 caught, 11 unviable, 0 missed.",
  "files_changed": [
    "crates/settings/src/file.rs",
    "crates/settings/tests/settings.rs",
    "crates/settings/tests/relocate.rs",
    "crates/settings/tests/config/mod.rs",
    "crates/settings/AGENTS.md"
  ],
  "tests_added": [
    {
      "name": "settings::an_unreadable_settings_file_is_a_read_error_and_stays_untouched",
      "proves": "A mode-000 settings file gives ReadFailed on that path from both `read` and `set_theme`. The file's mode stays 000 and its bytes stay the same. Kills the three file.rs:49 mutants."
    },
    {
      "name": "relocate::relocating_to_the_default_without_a_location_file_is_ok",
      "proves": "Relocating to the default when no `settings-location` exists returns Ok with the default path and creates no location file. Kills places.rs:81 guard→false and `==`→`!=`."
    },
    {
      "name": "relocate::a_location_file_that_cannot_be_removed_is_a_write_error_and_stays_in_force",
      "proves": "When `settings-location` cannot be removed (its folder is mode 555, so removal fails with permission denied), relocating to the default gives WriteFailed on the location file. Afterwards `read` still uses the old location. Kills places.rs:81 guard→true."
    },
    {
      "name": "settings::broken_json_at_the_end_of_the_file_reports_the_line_without_a_column",
      "proves": "A JSON error at the end of the file is reported as \"... at line 3\", without \"column 0\"."
    },
    {
      "name": "settings::a_chain_of_forty_settings_symlinks_is_written_through_as_linux_reads_it",
      "proves": "A chain of 40 links (the settings path plus 39 more) is first read by the OS. `set_theme` then writes the last target, and all 40 entries are still symlinks."
    },
    {
      "name": "relocate::a_settings_location_link_cycle_is_a_write_error_on_the_location_file_and_writes_nothing",
      "proves": "(Moved from file.rs.) Relocating to an absolute path while `settings-location` and `partner` link to each other gives WriteFailed { path: location file }. Both entries are still symlinks, and the config folder holds only [partner, settings-location], so no temp file was left."
    }
  ],
  "smoke_evidence": [
    {
      "command": "cargo nextest run -p yamt-settings --no-fail-fast (new tests written, before the file.rs fixes)",
      "observed": "FAIL a_chain_of_forty_settings_symlinks_is_written_through_as_linux_reads_it: called `Result::unwrap()` on an `Err` value: WriteFailed { path: \".../config/yamt/settings.json\", message: \"more than 40 symlinks in a row\" }\nFAIL broken_json_at_the_end_of_the_file_reports_the_line_without_a_column: EOF while parsing a value at line 3 column 0\nSummary 29 tests run: 27 passed, 2 failed"
    },
    {
      "command": "file.rs:49 and places.rs:81 guards temporarily set to `if true`, then cargo nextest run -p yamt-settings -E 'test(an_unreadable_settings_file) | test(cannot_be_removed) | test(without_a_location_file)'",
      "observed": "FAIL an_unreadable_settings_file_is_a_read_error_and_stays_untouched: called `Result::unwrap_err()` on an `Ok` value: SettingsRead { ... theme: Dark ... }\nFAIL a_location_file_that_cannot_be_removed_is_a_write_error_and_stays_in_force\nSummary 3 tests run: 1 passed, 2 failed"
    },
    {
      "command": "places.rs:81 guard temporarily set to `if false`, then the same two relocate tests",
      "observed": "FAIL relocating_to_the_default_without_a_location_file_is_ok: called `Result::unwrap()` on an `Err` value: WriteFailed { path: \".../settings-location\", message: \"No such file or directory (os error 2)\" }\nSummary 2 tests run: 1 passed, 1 failed (guards restored afterwards; `git diff --stat` does not list places.rs)"
    },
    {
      "command": "cargo nextest run -p yamt-settings -p yamt-app",
      "observed": "Summary [   0.254s] 77 tests run: 77 passed, 0 skipped"
    },
    {
      "command": "cargo clippy --workspace --all-targets -- -D warnings",
      "observed": "Finished `dev` profile [unoptimized + debuginfo] target(s) in 0.87s"
    },
    {
      "command": "cargo fmt --check",
      "observed": "exit 0 (FMT_OK)"
    },
    {
      "command": "git diff ... d370796 -- 'crates/settings/*.rs' | <just mutants env: hermetic git, TMPDIR=/var/tmp/yamt-mutants, 4G runner> cargo mutants --in-diff /dev/stdin --test-workspace=false --output /var/tmp/yamt-mutants/settings-r3",
      "observed": "Found 38 mutants to test\n38 mutants tested in 24s: 27 caught, 11 unviable\ncaught.txt has file.rs:49:23 guard→true, file.rs:49:23 guard→false, file.rs:49:36 == with !=, places.rs:81:27 guard→true, places.rs:81:27 guard→false, places.rs:81:40 == with !=, and file.rs:81:5 syntax_message → String::new()/\"xyzzy\". missed.txt: 0 lines; timeout.txt: 0 lines."
    }
  ],
  "deviations_from_brief": [
    "Tests run as uid 1000, not root, so the mode-000 test has no root skip. This matches the existing `relocating_into_an_unwritable_folder_keeps_the_old_location`, which has none either.",
    "Item 2: the brief suggested making `settings-location` a non-empty directory. I used a read-only (555) config folder instead. The location file then stays readable, so the test can check that the old location is still in force (`read` returns the old path). With a directory, there is no readable location to compare against.",
    "Moved `names_in` from tests/settings.rs into tests/config/mod.rs, because the moved cycle test in relocate.rs uses it too.",
    "cargo-mutants read the diff from stdin and wrote its output to /var/tmp/yamt-mutants/settings-r3. The ownership hook blocks writing under target/, so `just mutants` itself was not run. Same environment and flags as the recipe's Rust half, limited to crates/settings."
  ],
  "open_risks": [
    {
      "location": "crates/settings/src/file.rs:80-86",
      "risk": "`syntax_message` removes a trailing \" column 0\" from serde_json's Display text. This relies on serde_json's \"{msg} at line {l} column {c}\" format. If serde_json changes that wording, the column 0 appears again, but nothing breaks."
    },
    {
      "location": "crates/settings/tests/settings.rs:93 and tests/relocate.rs:73",
      "risk": "The permission-bit tests fail if run as root, because root ignores the mode bits. This is the same condition as the existing 555-folder test."
    }
  ]
}
```
