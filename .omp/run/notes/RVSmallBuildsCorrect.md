I reviewed all three builds through the correctness lens, read-only. All three pass: build 1 has one `should`, and builds 2 and 3 have no findings. I ran no tests; each judgement below comes from reading the code. None of the three mutation runs left a survivor on a line these builds changed, so I had nothing to triage.

```json
[
  {
    "build": "2a7eadb 3.RV-agent-settings-rust",
    "verdict": "pass",
    "findings": [
      {
        "severity": "should",
        "rule_id": "vision-4 (contract: never an empty list on disk)",
        "file": "crates/settings/src/file.rs",
        "line": 30,
        "problem": "The rule that an empty command becomes `None` runs when the file is read (file.rs:108) and in `set_agent` (lib.rs:272). It does not run when the file is created from `current`. With no file present, `read`, `relocate` or `set_theme` called with `current.agent.command = Some([])` writes `\"command\": []`, and `read`/`relocate` also send `[]` back (`read_or_create` returns `current.clone()`). The window cannot trigger this today, because its `current.agent` comes only from Rust replies or the all-null start. But the brief's \"never an empty list on disk\" holds at only two of the three places that write the file, so the next writer has to remember the rule.",
        "fix": "In `Loaded::from_settings`, build `stored` with `agent: settings.agent.clone().without_empty_command()`, make `read_or_create` return that `stored` instead of `current.clone()`, and add one case to `an_empty_command_list_is_written_as_the_default` where `set_theme` runs with no file and a `current` holding `Some([])`."
      }
    ],
    "checked": [
      "Kept entries: `set_agent_writes_only_the_fields_given_and_keeps_unknown_entries` compares the whole file for each of its three steps. It would catch a writer that drops `window`, writes `null` fields, or always writes `agent` (the defaults step expects no `agent` key)",
      "A missing entry, `{}` and explicit nulls all read as the defaults (`a_file_without_agent_reads_as_defaults`). Dropping container-level `serde(default)` is accepted: serde derive reads a missing `Option` field as `None`, and the lib.rs unit test proves this with `{}`",
      "Wrong shape: a string command, a list for the message, and a list for the whole entry are each `Broken` with a message starting \"`agent`: \" (the shared `entry` reader, file.rs:122). Both `set_theme` and `set_agent` leave the file's bytes unchanged afterwards (`an_agent_entry_of_the_wrong_shape_is_reported_broken`). By reading, `\"agent\": null` is Broken too, the same as `languageServers: null`",
      "Empty command: `set_agent` with `Some([])` stores and answers `None`, and the entry disappears when the message is `None` too (`an_empty_command_list_is_written_as_the_default`, run with no file, which goes through `Loaded::from_settings` then the edit). A hand-written `[]` reads as `None` (`a_hand_written_empty_command_list_reads_as_the_default`). Removing either `without_empty_command` call would fail one of these tests",
      "The defaults are written as nothing: `agent_entry` returns `None` when both fields are `None` (file.rs:66-75), tested by the defaults step. Rust holds no \"omp\"/\"acp\" default",
      "`change`'s missing-file path applies the edit after `from_settings(current)`, so `set_agent` without a file writes only the entry it was given (lib.rs:289-298)",
      "IPC spelling: `{command, firstMessage: null}` serialises and reads back, and `{}` reads as the defaults (lib.rs `the_agent_entry_crosses_the_ipc_with_both_fields_and_reads_with_none`). Removing `rename_all` would fail this test",
      "No src-tauri round-trip test is accepted. None of the eight sibling setters in src-tauri/src/settings.rs has one, because their `Places` is the real config directory. The command passes straight through, the same shape as `set_added_servers`, and is registered at commands.rs:35",
      "`stored_at_start` with a broken `agent` entry falls back to all defaults, as for every other broken entry; this is the existing rule, not a new path",
      "Open risk accepted: unknown keys inside `agent` are dropped on the next write, consistent with `languageServers`",
      "Mutation: RVAgentSettingsRust.survivors.txt shows 6 caught, 7 unviable and no survivors"
    ]
  },
  {
    "build": "baa63f0 3.RV-agent-settings-web",
    "verdict": "pass",
    "findings": [],
    "checked": [
      "`commandWords`: splits at runs of spaces with the ends trimmed; an empty or all-space command gives []; a tab and a quote stay inside a word (commandWords.test.ts). This follows the contract's \"runs of spaces\" and the old `parseAddedServer` behaviour. The brief's \"tabs?\" is decided and pinned by a test",
      "`parseAddedServer` behaves as before: serverSetup.test.ts:966-997 covers double spaces, ends, empty and all-space commands, and the fields round trip. `[...words]` copies the readonly result, so `AddedServer.command` stays a fresh array",
      "Setter: `setAgent` sends `storedSettings(inUse)` with `agent` included, plus the entry exactly as given, nulls too, and adopts the reply (settings.test.ts `setAgent sends…`: sent[1], sent[2] (agent carried into a later setTheme), sent[3] (NO_AGENT passed through)). A mutant that drops `agent` from `storedSettings` or swaps the argument would fail",
      "A failed setAgent becomes a settings problem and keeps the same `SettingsInUse` object (`toBe`). The stale-reply ticket in `send` is shared with the siblings",
      "Adopting a reply: `sameAgent` compares in order (`sameTexts`) and treats null as null only. The six adopted cases (null↔list, a changed word, a longer command, a message given or changed) would catch an always-true `sameAgent` or one left out of `sameStored`. The two keep cases with `structuredClone` would catch a reference `===` on arrays and a flipped null comparison",
      "Nulls are passed through: `startSettings` holds `{command: null, firstMessage: null}`, sent so by the first load (`before any read…`). No default command or message lives in ui/settings.ts",
      "Fixture round trip: setAgent → load → back to NO_AGENT gives IN_USE again; the copy test pushes into both the sent and the replied arrays, so a `copiedAgent` that shares the reference would fail",
      "tauri.ts: `setAgent(current, agent)` reaches `commands.setAgent` with both arguments, and the ok and error replies both map (tauri.test.ts)",
      "Fixture `copiedAgent` keeps [] while Rust turns it into null. Accepted: the only producer, agentSettingsFields `commandField`, never sends no words (`usable = words.length > 0`)",
      "Mutation: RVAgentSettingsWeb.survivors.txt (orchestrator run b26b374) has no survivor on a line baa63f0 changed; the implementer's all-timeout run is superseded"
    ]
  },
  {
    "build": "9fc1dca 3.RV-ai-threads-rust",
    "verdict": "pass",
    "findings": [],
    "checked": [
      "Turns are numbered per session: `answers_in` counts only `AiAnswer`s whose session equals the one given (thread_store.rs:198). `answers_number_0_1_2_within_a_session_and_a_new_session_starts_again_at_0` (0,1,2 then omp-2 turn 0, with a note in between that is not counted) would catch a count of every AiAnswer, a count of every message, or an off-by-one start",
      "A session change: `an_answer_counts_only_its_own_session_s_answers_and_keeps_the_older_ones` (omp-1, omp-2, then omp-1 again → turn 1) proves the older answers keep their turns and a returning session goes on counting. It would catch a rule that resets on change or counts only after the last change",
      "Session stored before any answer, replaced, kept after a reopen: `a_session_is_stored_survives_a_reopen_and_a_second_one_replaces_it` checks memory, disk (`threads[0].session`) and a reopened store. `add_ai_answer` also sets the session (asserted after answers only), so deleting that assignment would fail",
      "Format 1 writes `{\"kind\":\"aiAnswer\",\"session\",\"turn\"}` and `nextMessage` moves on (`format_1_writes_an_ai_answer_with_its_session_and_turn`). EVERY_KIND's answer carries a session different from its thread's, so it would catch a body that read the thread's session",
      "Unknown and unlisted threads: both methods answer `UnknownThread` for an unknown id and for a thread on a file outside the range, and the file's bytes and the list stay the same (`an_unknown_or_unlisted_thread_gets_no_session_or_answer_and_nothing_is_written`). The message id taken before the check changes only the discarded clone",
      "A failed write changes nothing: `a_failed_write_changes_nothing_in_memory` now includes `set_session` (None→omp-1, so a write is attempted) and `add_ai_answer`. The list and bytes are unchanged, so a retry gets the same turn",
      "A new answer starts `NotQueued`, carries a non-zero timestamp and the next message id (asserted on messages[5])",
      "Shell: `set_thread_session_and_add_ai_answer_reach_the_thread_store` goes through the invoke handler. It checks the session replaced by add_ai_answer, the answer body, `list_threads` equal to the reply, and `{kind: UnknownThread, thread}` from both commands",
      "`waiting.rs` moved unchanged: `git diff -M` shows `QueuedMessage`, `queued`, `waiting_text`, `pending_draft_notes`, `record_if_waiting`, `waiting_text_of` and their six unit tests identical, apart from imports (`file_at` via `super`, `THREADS_FILE`, `Path`). send.rs changes only its import path",
      "Deviation accepted: always writing the session equals \"sets it when it differs\", because `commit` skips an unchanged file",
      "Format change accepted: format 1 is unreleased and nothing wrote `aiAnswer` before this build (plan #121 amends #117)",
      "Mutation: RVAiThreadsRust.survivors.txt shows 19 caught, 15 unviable and no survivors"
    ]
  }
]
```