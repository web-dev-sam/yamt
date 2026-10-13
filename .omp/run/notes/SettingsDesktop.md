# SettingsDesktop — implementer report (fields read one by one)

```json
{
  "summary": "New crate `yamt-settings` (crates/settings): Theme, StoredSettings, KeysChange, SettingsRead, Places, theme_at_start/read/set_theme/set_keys/relocate and Error, matching the brief's Contract and file rules 1–9. It keeps unknown entries, reports JSON errors with line and column, never rewrites a file on read, re-reads the file before every change, writes through a temp file and a rename, follows symlinks, and records another location in `settings-location`.\nsrc-tauri: new `settings.rs` with `places` and four commands (load_settings, set_theme, set_keys, move_settings), each ≤ 15 lines and registered in collect_commands. IpcError gains SettingsBroken / NotAbsolute / NoConfigFolder, plus `From<yamt_settings::Error>`. The window reads the theme at start and gets a dark or light native background and an initialization script that sets `data-theme` on <html>. Every settings command recolours the native background (`show_theme`).\narch-check: yamt-settings must not depend on any yamt-* crate or tauri; yamt-app may depend on yamt-session and yamt-settings only. map-check now reads commands from every src-tauri/src/*.rs.",
  "files_changed": [
    "crates/settings/Cargo.toml",
    "crates/settings/AGENTS.md",
    "crates/settings/src/lib.rs",
    "crates/settings/src/places.rs",
    "crates/settings/src/file.rs",
    "crates/settings/tests/config/mod.rs",
    "crates/settings/tests/settings.rs",
    "crates/settings/tests/relocate.rs",
    "src-tauri/Cargo.toml",
    "src-tauri/src/settings.rs",
    "src-tauri/src/lib.rs",
    "src-tauri/src/commands.rs",
    "src-tauri/src/ipc_error.rs",
    "src-tauri/src/window.rs",
    "scripts/arch-check.sh",
    "scripts/map-check.sh",
    "Cargo.lock"
  ],
  "tests_added": [
    {
      "name": "settings::a_missing_folder_and_file_are_created_from_the_current_settings",
      "proves": "read on a fresh config creates <config>/yamt/settings.json from `current`, byte-exact: two-space pretty JSON with a final newline; path and default_path are the default file"
    },
    {
      "name": "settings::reading_an_existing_file_never_rewrites_it",
      "proves": "a compact, oddly spaced file keeps its bytes and its mtime (set to 1970+1e6 s) after read"
    },
    {
      "name": "settings::broken_json_reports_line_and_column_and_a_change_leaves_the_bytes_untouched",
      "proves": "a trailing comma gives Broken{path, '…line 3 column 1'}; set_theme and set_keys both return Broken and the bytes stay the same"
    },
    {
      "name": "settings::an_unknown_theme_or_a_wrong_keys_type_is_broken_and_names_the_entry",
      "proves": "theme \"blue\" gives a message starting '`theme`: ' and naming blue; a string where keys expects a list gives a message starting '`keys`: '"
    },
    {
      "name": "settings::unknown_entries_and_unknown_action_ids_survive_a_change",
      "proves": "a top-level `window` entry and the action id `future-action` survive set_theme and set_keys"
    },
    {
      "name": "settings::some_sets_and_none_removes_an_action_and_keys_disappears_when_empty",
      "proves": "Some sets an action's entry, None removes it (file and returned value agree), and `keys` leaves the file once it is empty"
    },
    {
      "name": "settings::a_change_rereads_the_file_so_an_outside_edit_to_another_entry_survives",
      "proves": "a theme edited by hand after the read survives a set_keys sent with the old theme"
    },
    {
      "name": "settings::a_change_to_a_missing_file_starts_from_the_current_settings",
      "proves": "set_theme on a missing file writes `current`'s keys plus the new theme"
    },
    {
      "name": "settings::a_write_leaves_no_temporary_file",
      "proves": "after read, set_theme and relocate the config folder holds only settings.json and settings-location"
    },
    {
      "name": "settings::a_failed_rename_leaves_no_temporary_file",
      "proves": "when the rename over settings-location fails (a non-empty directory sits there), the result is WriteFailed and no *.tmp is left"
    },
    {
      "name": "settings::a_settings_file_reached_through_a_symlink_stays_a_symlink",
      "proves": "set_theme through a dotfiles symlink writes the link's target and the link stays a symlink"
    },
    {
      "name": "settings::theme_at_start_is_dark_whenever_anything_is_missing_or_broken",
      "proves": "Dark for: no folder (and nothing gets created), a missing theme, broken JSON, a location file naming a missing file (still not created), a relative location, a location file that is a directory; Light for a light file"
    },
    {
      "name": "relocate::relocating_to_an_existing_file_uses_it_and_records_the_location",
      "proves": "the existing file's theme is used; settings-location holds '<path>\\n'; later read and theme_at_start follow it"
    },
    {
      "name": "relocate::relocating_to_a_missing_path_creates_it_from_the_current_settings",
      "proves": "the missing folder and file are created from `current` and the location is recorded"
    },
    {
      "name": "relocate::relocating_to_the_default_removes_the_location_file",
      "proves": "moving back to the default path deletes settings-location and creates the default file from `current`"
    },
    {
      "name": "relocate::a_relative_path_is_refused_and_a_home_prefix_is_expanded",
      "proves": "a relative path gives NotAbsolute{path} and no location file; '~/s.json' becomes <home>/s.json"
    },
    {
      "name": "relocate::relocating_to_a_broken_file_keeps_the_old_location",
      "proves": "a broken target gives Broken and no location file is written"
    },
    {
      "name": "relocate::relocating_into_an_unwritable_folder_keeps_the_old_location",
      "proves": "a 0555 folder gives WriteFailed; settings-location still names the old file; no temp file is left in the locked folder"
    },
    {
      "name": "relocate::an_unreadable_location_file_is_an_error",
      "proves": "a settings-location that is a directory gives ReadFailed{path: location file}; a relative path inside it gives Broken and nothing is written"
    },
    {
      "name": "ipc_error::settings_errors_serialise_with_their_kind_and_fields",
      "proves": "Broken→{kind:SettingsBroken,path,message}, NotAbsolute→{kind,path}, ReadFailed/WriteFailed reach the existing variants with display paths, NoConfigFolder→{kind:NoConfigFolder}"
    },
    {
      "name": "window::the_start_script_names_the_theme",
      "proves": "start_script(Light) contains `dataset.theme = \"light\"` and start_script(Dark) contains `\"dark\"`"
    }
  ],
  "smoke_evidence": [
    {
      "command": "cargo fmt --check; cargo clippy --workspace --all-targets -- -D warnings",
      "observed": "fmt exit 0\n    Finished `dev` profile [unoptimized + debuginfo] target(s) in 0.26s\nclippy exit 0"
    },
    {
      "command": "cargo nextest run -p yamt-settings -p yamt-app",
      "observed": "PASS … yamt-app ipc_error::tests::settings_errors_serialise_with_their_kind_and_fields\nPASS … yamt-settings::relocate (7 tests) … yamt-settings::settings (12 tests)\n     Summary [   0.255s] 68 tests run: 68 passed, 0 skipped"
    },
    {
      "command": "bash scripts/arch-check.sh",
      "observed": "arch-check: ok\narch exit 0"
    },
    {
      "command": "printf 'yamt-settings\\nyamt-session\\ntauri\\ntauri-utils\\nserde\\ntauri_x\\n' | grep -E '^(yamt-|tauri(-|$))' | grep -vx 'yamt-settings'; printf 'yamt-app\\nyamt-session\\nyamt-settings\\nyamt-gitio\\nserde\\n' | grep -E '^yamt-' | grep -vxE 'yamt-(app|session|settings)'",
      "observed": "yamt-session\ntauri\ntauri-utils\nyamt-gitio   (the new arch-check filters flag exactly the forbidden names)"
    },
    {
      "command": "bash scripts/map-check.sh",
      "observed": "map-check: missing:\n  command load_settings (not in docs/architecture.md)\n  command load_settings (not in .omp/skills/ipc-contract/SKILL.md)\n  command set_theme … set_keys … move_settings … (same two lines each)\nexit 1 — expected: the orchestrator adds the four commands to the docs"
    },
    {
      "command": "cargo run -q -p yamt-app --features bindings --bin export-bindings -- /tmp/settings-bindings.ts; diff frontend/src/ipc/bindings.ts /tmp/settings-bindings.ts",
      "observed": "loadSettings: (current: StoredSettings) => typedError<SettingsRead, IpcError>(__TAURI_INVOKE(\"load_settings\", { current })),\nsetTheme: (current: StoredSettings, theme: Theme) => typedError<SettingsRead, IpcError>(__TAURI_INVOKE(\"set_theme\", { current, theme })),\nsetKeys: (current: StoredSettings, changes: KeysChange[]) => typedError<SettingsRead, IpcError>(__TAURI_INVOKE(\"set_keys\", { current, changes })),\nmoveSettings: (current: StoredSettings, path: string) => typedError<SettingsRead, IpcError>(__TAURI_INVOKE(\"move_settings\", { current, path })),\nexport type IpcError = … | { kind: \"ReadFailed\"; path: string; message: string } | { kind: \"SettingsBroken\"; path: string; message: string } | { kind: \"NotAbsolute\"; path: string } | { kind: \"NoConfigFolder\" };\nexport type KeysChange = { action: string, keys: string[] | null, };\nexport type SettingsRead = { path: string, default_path: string, stored: StoredSettings, };\nexport type StoredSettings = { theme?: Theme, keys?: { [key in string]: string[] }, };\nexport type Theme = \"dark\" | \"light\";"
    },
    {
      "command": "Real app setup: scripts/conflict-repo.sh /tmp/yamt-test-settings/repo; Xvfb :97; env -u WAYLAND_DISPLAY DISPLAY=:97 GDK_BACKEND=x11 XDG_CONFIG_HOME=/tmp/yamt-test-settings/config HOME=/tmp/yamt-test-settings/home tauri-driver --port 4791 --native-port 4792; app = target/debug/yamt from `cargo tauri build --debug --no-bundle` of this tree, args --repo /tmp/yamt-test-settings/repo",
      "observed": "session created: browserName wry 0.57, linux. Before any command ran, `ls /tmp/yamt-test-settings/config` → 'No such file or directory' (theme_at_start creates nothing)"
    },
    {
      "command": "Step 1: invoke(\"load_settings\", { current: { theme: \"dark\", keys: {} } }); cat config/yamt/settings.json",
      "observed": "{\"ok\":{\"path\":\"/tmp/yamt-test-settings/config/yamt/settings.json\",\"stored\":{\"theme\":\"dark\",\"keys\":{}},\"default_path\":\"/tmp/yamt-test-settings/config/yamt/settings.json\"}}\n-rw-r--r-- 1 wds wds 22 settings.json\n{\n  \"theme\": \"dark\"\n}"
    },
    {
      "command": "Step 2: file edited by hand to {\"theme\":\"dark\",\"handEdited\":{\"note\":\"kept\"}}; invoke(\"set_theme\", {current:{theme:\"dark\",keys:{}}, theme:\"light\"}); then invoke(\"set_keys\", {current:{theme:\"light\",keys:{}}, changes:[{action:\"apply\",keys:[\"Mod-Enter\"]},{action:\"ignore\",keys:null}]})",
      "observed": "set_theme ok stored {theme:light,keys:{}}; file:\n{\n  \"handEdited\": {\n    \"note\": \"kept\"\n  },\n  \"theme\": \"light\"\n}\nset_keys ok stored {theme:light,keys:{apply:[Mod-Enter]}}; file:\n{\n  \"handEdited\": {\n    \"note\": \"kept\"\n  },\n  \"keys\": {\n    \"apply\": [\n      \"Mod-Enter\"\n    ]\n  },\n  \"theme\": \"light\"\n}\nfolder holds only settings.json (no temp file)"
    },
    {
      "command": "Step 3: restart with the light file while recording: ffmpeg -f x11grab -framerate 60 -video_size 1920x1200 -i :97 -t 6 -c:v ffv1 start.mkv; new session; execute/sync `return [document.documentElement.dataset.theme, document.readyState]`; per-frame pixel colours via crop=1:1 + xxd | uniq -c",
      "observed": "[\"light\",\"complete\"] on the first WebDriver call.\npixel 800:500: 41×000000 (no window yet), 8×e9eaee, 6×26282c, 305×191a1c\npixel 20:980: 41×000000, 8×e9eaee, 3×26282c, 308×191a1c\npixel 1500:30: 41×000000, 8×e9eaee, 311×26282c\nFirst painted frame (n=41), 1600×1000 window area: 1599824 px e9eaee, 116 px 000000, 60 px ffffff. The first 8 frames (~133 ms at 60 fps) are the light native background #e9eaee; after that comes the page's dark CSS (expected until the light-CSS build)"
    },
    {
      "command": "Step 4: break the file by hand ('{\\n  \"theme\": \"light\",\\n  \"keys\": {\"apply\": [\"Mod-Enter\"],}\\n}\\n'); sha256sum; invoke load_settings and set_theme(dark); sha256sum",
      "observed": "b4189348d402c0e2c5b1499498828b03d6255b4f4fb8d594ac87795242789d9a before\n{\"err\":{\"path\":\"/tmp/yamt-test-settings/config/yamt/settings.json\",\"kind\":\"SettingsBroken\",\"message\":\"trailing comma at line 3 column 35\"}}  (load_settings)\n{\"err\":{…\"kind\":\"SettingsBroken\",\"message\":\"trailing comma at line 3 column 35\"}}  (set_theme)\nb4189348d402c0e2c5b1499498828b03d6255b4f4fb8d594ac87795242789d9a after; folder holds only settings.json"
    },
    {
      "command": "Step 5: invoke(\"move_settings\", {current:{theme:\"light\",keys:{apply:[\"Mod-Enter\"]}}, path:\"/tmp/yamt-test-settings/elsewhere/s.json\"}); then move_settings back to the default path (first while the default file is still broken, then after fixing it by hand to {\"theme\":\"dark\"})",
      "observed": "ok path /tmp/yamt-test-settings/elsewhere/s.json, stored {theme:light,keys:{apply:[Mod-Enter]}}; s.json:\n{\n  \"keys\": {\n    \"apply\": [\n      \"Mod-Enter\"\n    ]\n  },\n  \"theme\": \"light\"\n}\nsettings-location: /tmp/yamt-test-settings/elsewhere/s.json\nBack to the default while broken: {\"err\":{…\"kind\":\"SettingsBroken\",\"message\":\"trailing comma at line 3 column 35\"}}, settings-location still there (rule 7)\nBack to the default after the fix: ok path …/config/yamt/settings.json stored {theme:dark,keys:{}}; folder: settings.json only (settings-location gone)"
    },
    {
      "command": "documentElement probe (temporary build, script `window.__yamtProbe = String(document.documentElement)` before the theme line; removed before steps 1–5)",
      "observed": "[\"[object HTMLHtmlElement]\",\"dark\",\"yamt\",\"tauri://localhost\"]: in WebKitGTK `document.documentElement` already exists when the init script runs"
    }
  ],
  "deviations_from_brief": [
    "New files (for the project map): crates/settings/{Cargo.toml,AGENTS.md,src/lib.rs,src/places.rs,src/file.rs,tests/settings.rs,tests/relocate.rs,tests/config/mod.rs}, src-tauri/src/settings.rs. Map line suggestion: `crates/settings (yamt-settings) the per-user settings file: lib (types crossing the IPC, Error, read/set_theme/set_keys/relocate/theme_at_start), places (default file, settings-location, ~/), file (kept entries, temp file + rename). NO tauri, NO yamt-* crate`; src-tauri gains `settings (places + the four settings commands)`.",
    "Cargo.lock was updated by cargo: a new yamt-settings package (serde, serde_json, specta, tempfile, thiserror 2.0.21) and yamt-settings added to yamt-app's dependencies.",
    "The map must name the four commands as `load_settings`, `set_theme`, `set_keys`, `move_settings` in docs/architecture.md and .omp/skills/ipc-contract/SKILL.md. Until then `just map-check` fails, by design. src-tauri/AGENTS.md (not owned) should also gain `settings.rs` in its module list.",
    "document.documentElement at script time: wry 0.57 injects initialization scripts with UserScriptInjectionTime::Start (webkitgtk/mod.rs:822) / WKUserScriptInjectionTime::AtDocumentStart (wkwebview/mod.rs:787). Apple documents that time as 'after the document element is created'. A probe build on WebKitGTK showed `[object HTMLHtmlElement]`. So start_script is the one line `document.documentElement.dataset.theme = \"<theme>\";`, with no MutationObserver. A CP1 comment names the source.",
    "The commands take `window: WebviewWindow<R>` (generic over Runtime, so the MockRuntime test app still builds) to reach both the PathResolver and set_background_color. They are registered for specta as `settings::<cmd>::<tauri::Wry>`: specta's collect_functions cannot use the builder's generic R. `places` takes `&PathResolver<R>` (called as `places(app.path())` at start and `places(window.path())` in the commands) instead of an `app`.",
    "No `pub type Result` alias in yamt-settings (RS7): the brief says 'exactly these public items' and the Contract signatures spell `Result<SettingsRead, Error>`.",
    "The 'dark'/'light' spelling lives in two private matches: yamt-settings file.rs `theme_name` (writing the entry without a fallible serde call) and src-tauri window.rs `start_script`. Both are exhaustive over Theme, next to serde's rename_all = lowercase.",
    "Decisions the brief left open: (a) the settings-location content is trimmed of trailing \\n/\\r. A path that is not absolute (empty included) gives Error::Broken with the location file's path. (b) `keys` errors name the entry `keys` as a whole, not the single action. (c) relocate compares `to` with the default file by Path equality, with no normalisation of `..`. (d) A new file gets the process umask's permissions, and a rewrite replaces the file's mode with the temp file's.",
    "Detector tests: the arch-check and map-check scripts have no committed test harness in the repo, and none was added. The new arch-check filters were exercised on sample input (see smoke_evidence).",
    "For the real-app smoke I ran `pnpm -C frontend install --frozen-lockfile --offline` in the worktree (gitignored frontend/node_modules) and `cargo tauri build --debug --no-bundle` (gitignored frontend dist/target). No tracked frontend file changed."
  ],
  "open_risks": [
    {
      "location": "crates/settings/src/file.rs:129 (write_text, fs::canonicalize fallback)",
      "risk": "A dangling symlink at the settings path cannot be canonicalised. Read treats it as missing and creates it, and the rename then replaces the link with a regular file instead of creating the link's target."
    },
    {
      "location": "crates/settings/src/file.rs:141-145",
      "risk": "Rename over an existing file does not keep that file's permission bits: the new file has default umask permissions."
    },
    {
      "location": "crates/settings/src/lib.rs:26-32 (StoredSettings #[serde(default)])",
      "risk": "specta exports StoredSettings as `{ theme?: Theme, keys?: {…} }` (optional fields) because of #[serde(default)]. The web builds must treat both as present in replies, or the contract could drop the defaults on the Rust → TS direction."
    },
    {
      "location": "src-tauri/src/settings.rs (all four commands)",
      "risk": "No MockRuntime command test for the four settings commands: PathResolver reads XDG_CONFIG_HOME/HOME, and setting env vars in tests is unsafe in edition 2024. They are covered by the real-app WebDriver steps 1–5 only, so `just mutants` may report survivors on their show_theme lines (wiring)."
    },
    {
      "location": "src-tauri/src/window.rs:62-66 (show_theme)",
      "risk": "The native background change on a settings command was not observed on screen: the page's dark CSS covers the whole window until the light-CSS build lands. Only the start background (#e9eaee) was measured."
    }
  ]
}
```
