I reviewed the three builds through the boundary lens, read-only. All three pass: none has a block, and each has one or two non-blocking findings.

`just map-check` will fail until the docs pass is done. `docs/architecture.md` and the ipc-contract skill do not yet name `set_agent`, `setAgent`, `set_thread_session` or `add_ai_answer`, and the project map does not name `commandWords`. These files were outside each build's Owned list, and the implementers reported them.

```json
[
  {
    "build": "2a7eadb 3.RV-agent-settings-rust",
    "verdict": "pass",
    "findings": [
      {
        "severity": "should",
        "rule_id": "vision-2 / RV-growth: copied decision",
        "file": "crates/settings/src/file.rs",
        "line": 66,
        "problem": "`agent` is read through serde's derive (`rename_all = \"camelCase\"`) but written by hand with the copied spellings `AGENT_COMMAND`/`AGENT_FIRST_MESSAGE` (lines 16–17) and field-by-field access. The file's field names now live in two places, and a field added to `AgentSettings` later would compile and read but never be written. The sibling struct entry, `languageServers`, uses serde both ways. Today the round-trip test hides this; it gets harder the first time the entry grows.",
        "fix": "Write the entry through serde as `languageServers` does: `serde_json::to_value(agent)`, keep the object only after `retain(|_, value| !value.is_null())` leaves it non-empty, and delete the two field-name constants."
      }
    ],
    "checked": [
      "Ownership: crates/settings/src/{lib,file}.rs, crates/settings/tests/** (agent.rs new; antialiasing.rs, settings.rs and config/mod.rs only for the `agent` literal), src-tauri/src/settings.rs and commands.rs are all in Owned. The other file in the commit, .omp/run/notes/RVGitlabBoundary.md, is another slice's review note: an orchestration artefact, not source",
      "PM1: yamt-settings gains no yamt-* or tauri dependency; AgentSettings uses only serde and specta derives (RS3)",
      "Plan #113/#57: Rust holds no default. No \"omp\"/\"acp\" literal outside tests; `None` means the window's default (lib.rs:83 doc); a field is written only when Some and the entry only when non-empty (file.rs:66–75); set_agent with the defaults removes the entry (agent.rs test)",
      "One empty-command rule: `AgentSettings::without_empty_command` (lib.rs:93) is used on read (file.rs:108) and by `set_agent` (lib.rs:272); there is no second copy",
      "Contract drift: dropping `serde(default)` is accepted. The generated TS equals the brief's `{ command: string[] | null; firstMessage: string | null }` (bindings.ts:90–93); a missing field still reads as None (lib.rs test with `{}`). The comment at lib.rs:84–85 is an external fact with its source (CP1)",
      "set_agent signature and the Tauri command match the contract (settings.rs:168–183) and follow the siblings' shape (places, show_theme, needless_pass_by_value expect with reason); registered at commands.rs:35",
      "No src-tauri round-trip test is accepted: no sibling setter has one in src-tauri/src/settings.rs (its Places are the real config dir), and the siblings' IPC-spelling test model is followed (lib.rs `the_agent_entry_crosses_the_ipc_with_both_fields_and_reads_with_none`)",
      "A wrong-shape entry goes through the shared `entry` reader, so the broken message starts \"`agent`: \" like the other entries; unknown inner keys are dropped as for `languageServers` (open risk accepted as consistent)",
      "Mutation: .omp/run/mutants/RVAgentSettingsRust.survivors.txt shows no survivors (6 caught, 7 unviable)",
      "Docs pass outstanding, not this build's: src-tauri/AGENTS.md still says \"the eight settings commands\"; docs/architecture.md §3.6/:476 and .omp/skills/ipc-contract/SKILL.md do not name set_agent (map-check's command rule)"
    ]
  },
  {
    "build": "baa63f0 3.RV-agent-settings-web (+ 6919af1's AgentSettings export)",
    "verdict": "pass",
    "findings": [
      {
        "severity": "should",
        "rule_id": "vision-2",
        "file": "frontend/src/ui/settings.test.ts",
        "line": 27,
        "problem": "The private `type AgentSettings = StoredSettings[\"agent\"]` is still here after 6919af1 exported `AgentSettings` from `../ipc` and removed the same alias from settings.ts. The ui layer now spells one generated type two ways. Nothing breaks, but the next test author copies whichever spelling they open first.",
        "fix": "Import `type AgentSettings` from \"../ipc\" in the existing type import and delete line 27."
      },
      {
        "severity": "nit",
        "rule_id": "RS16-analogue (naming)",
        "file": "frontend/src/ui/store.test.ts",
        "line": 61,
        "problem": "`DEFAULT_AGENT` names `{ command: null, firstMessage: null }`, which means \"no override\". The real defaults are `agent/`'s `DEFAULT_AGENT_COMMAND`/`DEFAULT_FIRST_MESSAGE`, so a grep for DEFAULT_AGENT lands here with the wrong meaning. Nothing gets harder as the app grows.",
        "fix": "Rename it to `NO_AGENT`, as settings.test.ts and fixtureSettings.test.ts already do."
      }
    ],
    "checked": [
      "Ownership: every changed file is in Owned or the mid-build grant (listing/saving/stops/settingsStore .test.ts: one `setAgent` line each)",
      "PM2/PM7: ui/commandWords.ts imports nothing; ui reaches only ../ipc; no @tauri-apps or @codemirror import added; the compare and range roots get setAgent through the shared `settingsActions`/`SettingsStore` seam, not through store.ts",
      "Defaults owned by the window, in one place: settings.ts `startSettings` holds `{ command: null, firstMessage: null }` (no value); `DEFAULT_AGENT_COMMAND` lives only in agent/internal/command.ts:3 and `DEFAULT_FIRST_MESSAGE` only in agent/internal/firstMessage.ts:11; ui/settings.ts passes nulls through (settings.test.ts:283–298)",
      "One command-split rule: `commandWords` (ui/commandWords.ts:1) is used by serverSetup.ts:58 `parseAddedServer` and agentSettingsFields.ts:28; no other `.split(\" \")` remains for a command; the `[...words]` copy at serverSetup.ts follows from the contract's readonly return",
      "Contract: `SettingsSource.setAgent(current, agent)` is in ChunkSource.ts:60 and the Pick (:73); tauri.ts `createTauriSettings` carries it, so tauriCompare.ts:35 and tauriRange.ts:16 get it by spread; fixture.ts, fixtureCompare.ts and fixtureRange.ts spread createFixtureSettings",
      "domain.ts `AgentSettings = Generated.AgentSettings` follows the `AddedServer` alias pattern; since 6919af1 it is exported from ipc/index.ts and imported by settings.ts",
      "State ownership: `settings.agent` is written only by `adopt` through settings replies; `sameAgent` follows the siblings' exhaustive `rest satisfies Record<string, never>` pattern and reuses `sameTexts`",
      "sameAgent treating null and [] as different is accepted: Rust normalises [] to None on read and on set_agent (crates/settings lib.rs:93), so a reply never carries []; the fixture's `copiedAgent` keeps [] as sent, but agentSettingsFields never sends no words",
      "Mutation: .omp/run/mutants/RVAgentSettingsWeb.survivors.txt shows no survivor on a line baa63f0 changed; the implementer's timeouts were superseded by that run",
      "Docs pass outstanding, not this build's: `commandWords` is not in the project map (PM6) and `setAgent` is not in docs/architecture.md (map-check's source-method rule)"
    ]
  },
  {
    "build": "9fc1dca 3.RV-ai-threads-rust",
    "verdict": "pass",
    "findings": [
      {
        "severity": "should",
        "rule_id": "RS6",
        "file": "src-tauri/src/review.rs",
        "line": 239,
        "problem": "The new shell test pushes review.rs from 397 to 448 lines, over the 400-line rule, with commands and their window tests in one file. The next command added to the range window lands in an already-overlong file, and each later split gets bigger.",
        "fix": "Move `mod tests` to src-tauri/src/review/tests.rs behind `#[cfg(test)] mod tests;`, as merge.rs and merge/tests.rs do; the orchestrator grants the new path."
      }
    ],
    "checked": [
      "Ownership: crates/review/** (thread_store.rs, the new thread_store/waiting.rs, thread_types.rs, send.rs import path only, tests/threads.rs, AGENTS.md), src-tauri/src/review.rs and src-tauri/AGENTS.md are in Owned; commands.rs changes only the two granted registration lines (:57–58)",
      "Contract: `MessageBody::AiAnswer { session: String, turn: u32 }` (thread_types.rs:54–59); `set_session`/`add_ai_answer` signatures and docs as given (thread_store.rs:100–131); commands `set_thread_session(thread, session)` and `add_ai_answer(thread, session)` return `Result<ThreadList, IpcError>` (review.rs:88–108); generated bindings.ts:49–50 match",
      "One turn-numbering rule (plan #121): only `answers_in` (thread_store.rs:198) numbers turns, counting that session's AiAnswers in the thread; the window never renumbers (RangeMessage.vue, rangeGitLab.ts, reviewDomain.ts only read `turn`; the fixture seeds a literal turn 0)",
      "Plan #121/#115: the session is stored by `set_session` before any answer and replaced on change; an answer always carries its session; an older session's answers keep their turns (tests/threads.rs `an_answer_counts_only_its_own_session_s_answers_and_keeps_the_older_ones`)",
      "Single writer: `Thread.session` and the messages are written only by ThreadStore through `commit`; the shell commands lock `threads`, call one method and let go, like their siblings",
      "UnknownThread and the unlisted-file refusal share one lookup, `shown_thread_mut` (thread_store.rs:187), now also used by add_note; the message id taken before that check only touches the clone, so nothing changes on refusal (a_failed_write_changes_nothing_in_memory extended)",
      "waiting.rs split (notes deviation accepted): the sender's reads (QueuedMessage, queued, waiting_text, pending_draft_notes, record_if_waiting, waiting_text_of) and their unit tests moved unchanged; it is one module per file with tests at the bottom (RS10/RS11), named for what it owns (RS12); thread_store.rs is now 240 lines",
      "`new_message(id, body)` plus `note(text)`: two callers of each, no speculative generality",
      "PM1: no new dependency edge; `just arch-check` ok in the notes",
      "Comments: the doc lines on public items state what they are; no narration or TODO",
      "Mutation: .omp/run/mutants/RVAiThreadsRust.survivors.txt shows no survivors (19 caught, 15 unviable)",
      "Docs pass outstanding, not this build's: crates/review/AGENTS.md and src-tauri/AGENTS.md were updated in Owned; docs/architecture.md and .omp/skills/ipc-contract/SKILL.md do not name set_thread_session/add_ai_answer (nor the earlier range commands such as list_threads), so map-check's command rule stays open"
    ]
  }
]
```