# SettingsDesktopR1 — implementer report (fields read one by one)

```json
{
  "summary": "All six findings from rework 1 are fixed. `StoredSettings` no longer has `#[serde(default)]`, so the generated TS fields are required. The file parser still fills in a missing `theme`/`keys` itself.\n`Theme::name()` is now the one place \"dark\"/\"light\" is spelled. `file.rs` and `start_script` use it, and a unit test checks it against serde's output.\n`Loaded` is now `{ others, stored }` with one `entries(self)` that builds the map to write. The setters change only `stored`, and `put_keys`/`theme_name` are gone.\n`write_text` follows a symlink with `read_link`, joining a relative target onto the link's folder. A dangling dotfiles link now gets its target created and stays a link.\n`start_theme` takes `&PathResolver<tauri::Wry>`, and the `start_script` test compares the whole script with `assert_eq!`.",
  "files_changed": [
    "crates/settings/src/lib.rs",
    "crates/settings/src/file.rs",
    "crates/settings/tests/settings.rs",
    "src-tauri/src/window.rs"
  ],
  "tests_added": [
    {
      "name": "a_dangling_settings_symlink_creates_its_target_and_stays_a_link (crates/settings/tests/settings.rs)",
      "proves": "The settings path is a relative symlink to a file that does not exist yet (and whose folder does not exist either). `read` creates that target from the current settings, `set_theme` writes through the link, the link is still a symlink, and its target text is unchanged."
    },
    {
      "name": "tests::a_theme_name_is_its_serde_spelling (crates/settings/src/lib.rs)",
      "proves": "`Theme::name()` equals `serde_json::to_value(theme)` for Dark and Light, so the file, the page script and the IPC all spell the theme the same way."
    },
    {
      "name": "tests::the_start_script_names_the_theme (src-tauri/src/window.rs, changed)",
      "proves": "Now compares the whole script with `assert_eq!` for Light and Dark instead of using `contains`."
    }
  ],
  "smoke_evidence": [
    {
      "command": "cargo nextest run -p yamt-settings dangling (new test written first, against round 1's write_text, before any src change)",
      "observed": "FAIL a_dangling_settings_symlink_creates_its_target_and_stays_a_link — panicked at crates/settings/tests/config/mod.rs:46:52: called `Result::unwrap()` on an `Err` value: Os { code: 2, kind: NotFound, ... }. In round 1, `canonicalize` failed on the dangling link and the code fell back to the link path, so the dotfile target was never created. Summary: 1 test run: 0 passed, 1 failed"
    },
    {
      "command": "cargo nextest run -p yamt-settings -p yamt-app",
      "observed": "PASS ... (70/70) yamt-app outcome::tests::closing_reports_the_unresolved_files_until_all_are_finished\n────────────\n     Summary [   0.262s] 70 tests run: 70 passed, 0 skipped"
    },
    {
      "command": "cargo clippy --workspace --all-targets -- -D warnings",
      "observed": "Checking tauri-specta v2.0.0-rc.25\n    Finished `dev` profile [unoptimized + debuginfo] target(s) in 30.68s (no warnings)"
    },
    {
      "command": "cargo fmt --check",
      "observed": "fmt exit 0 (no output)"
    },
    {
      "command": "bash scripts/arch-check.sh",
      "observed": "arch-check: ok\narch exit 0"
    },
    {
      "command": "cargo run -q -p yamt-app --features bindings --bin export-bindings -- /tmp/settings-bindings.ts; rg StoredSettings/Theme",
      "observed": "export type StoredSettings = {\n\ttheme: Theme,\n\tkeys: { [key in string]: string[] },\n};\n\nexport type Theme = \"dark\" | \"light\";"
    }
  ],
  "deviations_from_brief": [
    "Finding #670: the setters are closures over `&mut StoredSettings` passed to `change` in lib.rs (`|stored| stored.theme = theme`; the `KeysChange` loop is inline in `set_keys`). They are no longer `Loaded` methods, so `Loaded` holds only `others` (private) and `stored`.",
    "`entries(self)` consumes the `Loaded`, as the brief wrote. So `change` clones `stored` once before `write_entries(&path, loaded)` to return it. `write_entries` now takes a `Loaded` instead of a `Map`. `read_or_create` returns `current.clone()` for a file it creates.",
    "The symlink is resolved one hop only, as the brief says: `symlink_metadata` reports a symlink → `read_link`, with a relative target joined onto `path.parent()`. A chain of links is not followed further (see open_risks).",
    "No real-app run: `window.rs` changed only in `start_theme`'s signature and `start_script`'s spelling. The script text is byte-identical to round 1, as the `assert_eq!` test shows.",
    "No `Cargo.toml` or `Cargo.lock` change; `scripts/arch-check.sh` and `scripts/map-check.sh` are untouched. No new files, so the project map needs no new entries. The orchestrator should run `just bindings`: the generated `StoredSettings` now has required `theme`/`keys`."
  ],
  "open_risks": [
    {
      "location": "crates/settings/src/file.rs link_target",
      "risk": "Only one symlink hop is resolved. If the settings link points to another link, the rename replaces that intermediate link with a regular file. Round 1's `canonicalize` handled chains, but only when the final target existed."
    },
    {
      "location": "crates/settings/src/lib.rs StoredSettings",
      "risk": "With the defaults gone, an IPC `current` that leaves out `theme` or `keys` is now a deserialisation error from Tauri, not a silent default. The web build has to always send both fields, which the generated TS now enforces."
    }
  ]
}
```
