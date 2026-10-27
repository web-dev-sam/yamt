The `agent` entry and the `set_agent` command are in place, and fmt, clippy and the tests for both packages pass. Two things differ from the brief: I left `default` out of the struct's serde attribute, and there is no src-tauri round-trip test.

## summary
- `yamt_settings::AgentSettings { command, first_message }` now exists, and `StoredSettings` has an `agent` field. A file without the entry reads as the defaults. Each field is written only when it is set, and the entry is left out when neither is. An entry of the wrong shape is reported as `Broken` with a message starting "`agent`: ", and nothing is written. Unknown entries are kept.
- An empty `command` list counts as "use the default", whether `set_agent` is given one or the file contains one by hand.
- The `set_agent(places, current, agent)` function works like the other setters. The Tauri command `settings::set_agent` is registered in `specta_builder`.
- I exported the bindings into `target/`. The generated TS matches the brief: `AgentSettings = { command: string[] | null, firstMessage: string | null }`, `StoredSettings.agent`, and `setAgent(current, agent)`.

## files_changed
- `crates/settings/src/lib.rs`
- `crates/settings/src/file.rs`
- `crates/settings/tests/agent.rs` (new)
- `crates/settings/tests/config/mod.rs`, `crates/settings/tests/settings.rs`, `crates/settings/tests/antialiasing.rs` (their `StoredSettings` literals gain `agent`)
- `src-tauri/src/settings.rs`
- `src-tauri/src/commands.rs`

## tests_added
- `set_agent_writes_only_the_fields_given_and_keeps_unknown_entries`: only the given field is written, `window` and `theme` stay, and setting the defaults removes the `agent` entry. Catches a writer that writes `null`s or always writes the entry.
- `a_file_without_agent_reads_as_defaults`: a file with no entry, `{}`, or explicit `null`s reads as the defaults and is not rewritten.
- `a_set_field_reads_back_and_the_other_stays_the_default`: a stored command with a space in its path reads back as a list.
- `an_agent_entry_of_the_wrong_shape_is_reported_broken`: a string command, a list for the message, and a list for the whole entry are all `Broken` ("`agent`: …"), and neither `set_theme` nor `set_agent` rewrites the file.
- `an_empty_command_list_is_written_as_the_default`: an empty command is stored as `None`, never written as `[]`.
- `a_hand_written_empty_command_list_reads_as_the_default`: covers the reading side of the same rule.
- `lib.rs::tests::the_agent_entry_crosses_the_ipc_with_both_fields_and_reads_with_none`: the IPC spelling `{command, firstMessage: null}` round-trips, and `{}` deserializes to the defaults.

## smoke_evidence
- `cargo fmt --check`: passed (exit 0, no output).
- `cargo clippy --workspace --all-targets -- -D warnings`: `Finished \`dev\` profile … in 34.73s`, with no warnings or errors.
- `cargo test -p yamt-settings -p yamt-app`: every suite `ok`. That includes `116 passed` for yamt-app, `6 passed` for the agent tests and `4 passed` for the settings lib tests, with 0 failures.
- `cargo run -p yamt-app --features bindings --bin export-bindings -- target/bindings-agent.ts` then `diff -u frontend/src/ipc/bindings.ts target/bindings-agent.ts` adds exactly:
  `setAgent: (current: StoredSettings, agent: AgentSettings) => …("set_agent", { current, agent })`, `export type AgentSettings = { command: string[] | null, firstMessage: string | null }`, and `agent: AgentSettings` in `StoredSettings`.
- The brief's "round trip as the siblings": no test written in src-tauri; see deviations.

## deviations_from_brief
- **`AgentSettings` uses `#[serde(rename_all = "camelCase")]` without `default`.** The two parts of the Contract conflict. With the container-level `default`, the specta tooling (specta-serde 0.0.12, lib.rs:850) exports both fields as optional (`command?: string[] | null`, which I saw in the first export). That breaks the generated TS the web half builds on. Without it, serde still reads a missing `Option` field as `None`, which the unit test checks with `{}`. A code comment at the attribute records the reason.
- **No src-tauri round-trip test.** None of the existing settings commands has one, because their `Places` come from the real config directory. A bare `cargo test` would therefore write the user's own settings file; only `just` isolates it with `XDG_CONFIG_HOME=/nonexistent`. I took the siblings' actual round-trip test, the IPC-spelling test in `lib.rs`, as the model and added the agent version there.
- **Files I could not change** (owned by others): `src-tauri/AGENTS.md` says "the eight settings commands" and is now nine. `docs/architecture.md` §3.6/§4 and `.omp/skills/ipc-contract/SKILL.md` need the `set_agent` line and the `agent` entry. `frontend/src/ipc/bindings.ts` needs regenerating (`just bindings`).
- **Extra decision:** a hand-written `"command": []` in the file also reads as the default, so the window never gets an empty command.

## open_risks
- `crates/settings/src/lib.rs:79`: `StoredSettings.agent` is a required field over the IPC. Until the web half sends `current.agent`, every settings command from the current window fails to deserialize, and `vue-tsc` fails on the regenerated bindings. Both halves need to land together.
- `crates/settings/src/file.rs:66-75`: unknown keys inside the `agent` object are dropped on the next write, unlike unknown top-level entries, which are kept.