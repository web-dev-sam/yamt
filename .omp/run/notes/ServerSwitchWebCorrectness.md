```json
{
  "verdict": "pass",
  "findings": [
    {
      "severity": "should",
      "rule_id": "VF7",
      "file": "frontend/src/ui/serverPins.test.ts",
      "line": 103,
      "problem": "Five of the six `serverPins.ts:19` shape-check mutants survive. The test named \"…a toggle starts afresh\" checks only what reads back as pinned, never what gets stored. If the check broke, stored text like `[\"oxlint (frontend)\"]` or `\"oxlint\"` would be spread into numbered entries (`\"0\"`, `\"1\"`, …) and kept in `yamt.servers.pinned` for good as \"other roots\". The user sees nothing, and no other code depends on this, so nothing gets harder as the app grows; the test just claims more than it checks.",
      "fix": "After the toggle, add `expect(stored(storage)).toEqual({ [ROOT]: [OXLINT] })`. Correct code meets it for all six rows (a malformed root entry is overwritten), and it kills those five mutants."
    }
  ],
  "checked": [
    "Behaviour 1, suffix: detect.test.ts \"the key stays when a second project brings the suffix\" fails if the key is built from the shown name (alone it would be \"oxlint\", not \"oxlint (frontend)\").",
    "Behaviour 1, command change: \"TypeScript's key stays whichever program runs it, installed or not\" covers tsc, tsgo, typescript-language-server not installed and installed. It fails if the key holds the command or leaves out the project.",
    "Behaviour 1, Vue: \"keys are unique; Vue's is not TypeScript's\" fails if the key were set in specsOf, because vue.ts's spread would copy \"TypeScript (web)\". The key is built once, in detect's last step (detect.ts:246-249), from the name before the suffix.",
    "Behaviour 1, added servers: added.test.ts \"an added server's key is its command, not its numbered name\" fails if \" (2)\" ends up in the key. Found and added keys cannot clash because of the \"added: \" prefix. Two hand-added servers with the same command share a key; the design lists this as an accepted risk, so it is not a finding.",
    "The implementer's deviation on Phpactor/Intelephense keys is accepted: the brief defines the key as the tool name plus project, and they are two tools with two shown names. pyright and basedpyright are separate presets, so their keys stay distinct (presets.ts:203,212).",
    "server.ts:50 `runsAs` compares the whole spec, `key` included (only help and notes are left out), so a key can never stay on a kept run that belongs to another spec.",
    "Behaviour 2, one place: `apply` (serverSetup.ts:116-119) is the only caller of setSpecs. startUp → setUp, refocus, answer and every applyAfter all reach it, and `shownFound` filters there.",
    "Behaviour 2, tests: \"off stops a running server at once…\" checks the state right after the await, the host stop, the cleared problems (`shown` → [\"oxlint\",0]) and the \"Exited with code 0\" log line; all of these fail if apply is skipped or the filter is removed. \"never asked about nor started…\" checks the question lists only shown servers and `host.started()` is [oxfmt, oxfmt] across Start, refocus and a second startUp. \"with every found server off… no question\" would hang or fail if the guard in setUp used `found`.",
    "Behaviour 2, per root: \"another repository's switches do not count\" fails if offServers merged all roots.",
    "Behaviour 3: switchServer = applyAfter(setServerSwitch). settings.ts `send` reports a failure and keeps the settings in use, so apply runs with an unchanged off set. \"a failed write changes nothing\" checks `off`, the states and that nothing was stopped, also after a refocus. Showing the problem goes through the shared `send` (wiring; the brief does not ask for a test).",
    "Behaviour 3, adoption: settings.test.ts \"setServerSwitch sends the settings in use, the key and on, and adopts the reply\" covers both directions. Adopting a load that differs only in `off` was already covered (settings.test.ts:217-223).",
    "Switching on again: \"on again starts the server only under Start\" stays stopped with Don't start and starts oxlint with Start, which matches request rule 1.",
    "Behaviour 4 (read in LanguageServerSettings.vue:75-99): the found list is unfiltered and gated only on serverRoot, so the switches show whatever the answer is. Each row has a `<label>` around `input[type=checkbox][role=switch]` and the name, `:checked=\"!off.has(spec.key)\"`, `text-fg-muted` when off and `:key=\"spec.key\"`. The checked state having two writers in `flip` is #1277 and is not raised again.",
    "Behaviour 5: serverPins.test.ts covers none at first and toggling, per root with other roots kept as written (including a malformed one), an emptied root removed, a null root with no pins and a toggle that does nothing (the stored-object check kills the `at === null` guard), and six malformed stored values reading as none. pinnedServers never reads `off`.",
    "#1268: toSettingsRead (domain.ts:218-225) is the only conversion from Generated.SettingsRead (tauri.ts:44). tauri.test.ts \"a read without off has nothing switched off; one with off keeps it\" covers both. fixtureSettings `copied` and `sameServers` drop their defaults safely now that `off` is required.",
    "Risk register: no RK row is owned by lsp/, serverSetup or serverPins, so none applies. Architecture §3.1 (merge-core) and CM1–CM9 (editor/) are not touched by this patch.",
    "Survivor spec.ts:52 (error message emptied), dropped VF7(a): the throw cannot be reached from detect (\"<name> (<label>)\") or addedSpecs (\"added: …\"), and the test checks the RangeError type, so nothing a user sees changes.",
    "Survivor serverPins.ts:19:42 (`stored !== null` → true), dropped VF7(a): `{ ...null }` is `{}`, the same as the fallback.",
    "Survivor serverPins.ts:48 (null-root branch → false), dropped VF7(b): `pinsOf(byRoot.value, root.value)` would pass `string | null` to a `string` parameter, which `pnpm typecheck` (vue-tsc -b) rejects. At runtime it is also equivalent unless storage holds a \"null\" root.",
    "Survivor serverSetup.ts:77 (null-root branch → false), dropped VF7(b): `settings.off[root]` with `root: string | null` is TS2538 (null used as an index), which `pnpm typecheck` rejects.",
    "Survivor serverPins.ts:44 (log event name), dropped VF7(c): it is only the warn event name passed to storedValue's onError, with no decision of its own.",
    "Survivor serverPins.ts:14 (STORAGE_KEY → \"\"): the tests do catch this, so it is not a real gap. They read the fixed key `yamt.servers.pinned` (serverPins.test.ts:8,35-38), and \"pins are per repository\" (:56-66) pre-fills that key and expects [OXLINT] once the root moves to it, which fails with \"\". It is a module-level constant, the static-mutant class #732 says the vitest runner never re-evaluates, so it got past --ignoreStatic. [INFERENCE] about why the runner missed it: not run.",
    "Survivors serverPins.ts:19:12 ×5: a real gap, reported as the one `should` finding above.",
    "No test was run; no block depended on one."
  ]
}
```