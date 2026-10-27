```json
{
  "verdict": "fail",
  "findings": [
    {
      "severity": "block",
      "rule_id": "vision-2",
      "file": "frontend/src/agent/internal/failure.ts",
      "line": 29,
      "problem": "`sourceText` adds a second rule for turning an `IpcError` into words, next to `ui/problemText.ts`. Under the state table, failure words live only in `ui/problemText.ts`. This one checks for a `message` field instead of switching over every kind (TS3), and when there is no message it falls back to the kind's name. That name reaches the user as text: `editDiff` answers `{ failed, message: \"WorkerStopped\" }` (index.ts `editDiff`), and an app failure from `prepareCheckout`/`startAgent` becomes `checkoutFailed`/`spawnFailed` with message \"AiOff\" (index.ts `#prepare`, process.ts `#spawn`). problemText.ts already words both kinds (\"yamt's worker stopped; try again.\", \"the AI is off; …\").",
      "fix": "Carry the `SourceFailure` itself instead of a string. The seam allows additions, so add an `AgentFailure` variant `{ kind: \"app\"; failure: SourceFailure }` and an `EditDiff` variant `{ kind: \"appFailed\"; failure: SourceFailure }`, which C7 words through problemText's reasons. Then delete `sourceText`."
    },
    {
      "severity": "block",
      "rule_id": "vision-2",
      "file": "frontend/scripts/record-agent.ts",
      "line": 57,
      "problem": "The script keeps its own copy of the #109 permission table (`inside` + `permissionAnswer`, lines 57–72), and nothing checks it against `answers.ts`. The copy already disagrees with `inside.ts` in at least two ways. It is built on `path.relative` and checks `startsWith(\"..\")`, so a file named `..notes` inside the checkout counts as outside. It also does no drive-letter case folding. The committed fixtures record the script's answers, not yamt's, so a later change to the table silently records omp behaving under the old rule (deviation 6).",
      "fix": "Add a node test in `answers.test.ts`: for every recorded `session/request_permission` in `fixtures/agent/*.jsonl`, assert that `answerRequest` picks the same `optionId` the recorded yamt reply carries. Also make the script's `inside` resolve `..` and case the way `inside.ts` does, so the copy is checked and the same."
    },
    {
      "severity": "should",
      "rule_id": "TS11",
      "file": "frontend/src/ipc/AgentSource.ts",
      "line": 12,
      "problem": "AgentSource.ts holds the interface plus the domain shapes and their conversions (`AgentCommand`, `AgentStartReply`, `CheckoutReady`, `CheckoutChanges`, `to*`). The existing sources split these in two: `CompareSource.ts` + `compareDomain.ts`, and `ReviewSource.ts` + `reviewDomain.ts`. That makes a second convention. As the AI grows, the next reader finds agent shapes in a place no other source uses.",
      "fix": "Move the shapes and `toFolder`/`toAgentStartReply`/`toCheckoutReady`/`toCheckoutChanges` into a new `ipc/agentDomain.ts`, and leave `AgentSource.ts` with only the interface, as `CompareSource.ts` does."
    },
    {
      "severity": "should",
      "rule_id": "TS6",
      "file": "frontend/src/ipc/AgentSource.ts",
      "line": 32,
      "problem": "One file follows two field-naming rules. `AgentCommand` is a hand-written parallel type that renames `home_folders` → `homeFolders` (TS6: derive from the generated type), while `CheckoutChanges` passes `head_moved` through unchanged. C7's close question (`keepAiChanges { headMoved }`) will therefore meet both spellings across one source.",
      "fix": "Pick one rule. Either derive `AgentCommand` from `Generated.AgentCommand` (as `domain.ts` `ServerCommand` does, readonly arrays only) and keep `head_moved`, or convert both to camelCase in the conversions, as `compareDomain.ts` does for `column_limit`."
    },
    {
      "severity": "should",
      "rule_id": "promote",
      "file": "frontend/src/ipc/tauriAgent.ts",
      "line": 15,
      "problem": "`converted` is an exact copy of `tauriReview.ts:10`. A third Tauri source would copy it again.",
      "fix": "Export one `converted` from `ipc/tauri.ts` next to `toResult`, and import it in `tauriAgent.ts` and `tauriReview.ts`."
    },
    {
      "severity": "should",
      "rule_id": "vision-2",
      "file": "frontend/src/ipc/fixtureAgent.ts",
      "line": 74,
      "problem": "`COLUMN_LIMIT_BYTES = 8_388_608` is a second fixture copy of Rust's `MAX_COLUMN_BYTES` (`fixtureCompare.ts:53` holds the first). A change to the limit now has to find two fixture constants.",
      "fix": "Export the one constant from `fixtureCompare.ts`, or from `fixture.ts` next to `DIFFERENCE`, and import it in `fixtureAgent.ts`."
    },
    {
      "severity": "should",
      "file": "frontend/src/agent/internal/protocol.ts",
      "line": 36,
      "problem": "The list of updates yamt reads is written twice: `READ_KINDS` and the two `v.picklist`s inside `UPDATE` (around line 64). Reading a new update kind means editing both, and if only the schema is edited, malformed updates of that kind are silently ignored instead of logged.",
      "fix": "Build the picklists from one `as const` tuple per arm, and derive the membership check from those tuples (`Object.hasOwn` over a record built from them), so the list exists once."
    },
    {
      "severity": "should",
      "rule_id": "TS11",
      "file": "frontend/src/agent/internal/session.ts",
      "line": 52,
      "problem": "`session.ts` holds `TurnRun`, `TurnEnd`/`TurnEvents`/`Ending` and the stopReason table next to the `AgentSessionId` brand. Session routing itself is in `process.ts`. A reader looking for \"the running turn\" won't look in `session.ts`, and the file mixes two concepts.",
      "fix": "Move `TurnRun`, `TurnEnd`, `TurnEvents`, `Ending` and `stopEnding` to `internal/turnRun.ts`. Keep `AgentSessionId`/`agentSessionId` in `session.ts`, and update AGENTS.md."
    },
    {
      "severity": "should",
      "rule_id": "TS5",
      "file": "frontend/src/agent/internal/process.ts",
      "line": 53,
      "problem": "Session ids parsed from the agent stay plain `string`: `SessionUpdate.session` (protocol.ts:10), `Answered.refused.session` (answers.ts:9), and `#listeners: Map<string, Listener>`. The brand is applied only where the client creates a session, so a routing key could mix with any other string.",
      "fix": "Brand the id once in `parseUpdate`/`answerRequest` through `agentSessionId` (an empty id becomes a parse failure), and type `#listeners` as `Map<AgentSessionId, Listener>`."
    },
    {
      "severity": "should",
      "file": "frontend/src/agent/index.ts",
      "line": 69,
      "problem": "`AgentClient` (289 of 300 lines) does two jobs. It owns the lifecycle of the checkout and the process (`#ready`, `#folder`, `#prepare`, `#start`, failure caching). It also owns running turns (`#turn`, `#session`, `#promptEnding`, `#forget`). The next addition C8 needs will hit the line cap or grow the facade further.",
      "fix": "Extract the checkout and process start-up and caching (`#checkout`, `#agent`, `#ready`, `#folder`, `#prepare`, `#start`) into `internal/starter.ts` with one `ready(): Promise<Outcome<AgentProcess>>`. `AgentClient` keeps the turns and the seam methods."
    }
  ],
  "checked": [
    "Fences: `src/agent/**` imports only `../ipc` / `../../ipc` and `../jsonrpc` / `../../jsonrpc` indexes, plus its own `./internal`. `fences.ts` `AGENT_IMPORTS` returns PM2 for anything else. `fences.test.ts` covers PM3 (vue, @vueuse, @tauri-apps, `~icons`), PM2 (editor, ui/store, lsp, ipc/log, jsonrpc/internal, a sibling-prefix `agentx`, main) and the allowed set (indexes, valibot, fixtures).",
    "Framework-free: `.oxlintrc.json:138` includes `src/agent/**` in the PM3/PM5 override with updated messages (c93cae2). `vite.config.ts:41` runs `src/agent/**/*.test.ts` in the node project (bc5fc7a).",
    "\"Built only in main.ts\" fence: deferred to C8 by its brief (`3.RV-ai-threads.md:71-72`) and stated in `agent/AGENTS.md` line 1. Accepted; `main.ts` wiring is this brief's non-goal.",
    "The seam matches the design word for word: `AgentSessionId` + `agentSessionId(text): AgentSessionId | null`, `TurnView`/`TurnEntry`/`Step`/`StepKind`/`StepStatus`/`StepOutput`/`FileEdit` shapes, `AgentFailure` (the nine variants of the §3 table), `TurnEnd`, `AskRequest`, `TurnEvents`, `RunningTurn { ended, stop }`, `ConversationLoad`, `EditDiff`, `AgentSetup { source, command, timers? }`, `AgentClient { ask, loadConversation, editDiff, isRunning, destroy }`, the `firstMessage`/`unknownPlaceholders`/`PLACEHOLDERS`/`DEFAULT_FIRST_MESSAGE`/`Placeholder` exports, and `DEFAULT_AGENT_COMMAND = [\"omp\",\"acp\"]`.",
    "`AgentSource` interface: the seven methods have the design §9 names and signatures; `sendToAgent` is fire-and-forget and its failures are logged (`tauriAgent.ts` `logged`).",
    "Error-text matching appears only in `failure.ts` (`SESSION_NOT_FOUND`, `DETAILS` from `data.details`). A grep of `agent/` and the `ipc/*Agent*` files finds no other text match on errors.",
    "There is one permission table inside `src/`, `answers.ts`. It and `protocol.ts` (paths of edit diffs) share `inside.ts` `relativeInside`. `*_always` is never picked (`chosen` looks up only `allow_once`/`reject_once`), per #109.",
    "Shared code with lsp/: `Connection`, `parseWith`, `METHOD_NOT_FOUND`, `INVALID_PARAMS`, `Timers`/`SYSTEM_TIMERS` come from `jsonrpc/index.ts`. No lsp/internal code is copied. `AgentProcess.#onEvent` parallels lsp `Attempt.#onEvent` (a ~15-line `HostEvent` switch), which is acceptable under \"three similar statements\".",
    "#113: `DEFAULT_FIRST_MESSAGE` matches design §6 line for line, `PLACEHOLDER` is the design's regex, and an unknown placeholder is kept as typed.",
    "#109: nothing is appended to the command (`command.ts`); `HOME_FOLDERS` exists once in src (a grep for `.bun/bin` finds only tests besides it); `initialize` sends `protocolVersion: 1` and the capabilities set to false; any other version is `refused` and the process is stopped.",
    "The stopReason table (`session.ts` `stopEnding`) matches §3: end_turn → finished, cancelled → stopped, anything else → failed `ended`.",
    "The session is reported at once: `#session` calls `run.session(created)` before the prompt (#121: a crash mid-turn keeps the id).",
    "IPC3: the `AgentRun` and `CheckoutFolder` brands are applied only in `domain.ts` through type guards (`isAgentRun`, `isCheckoutFolder`), with no `as`. `AgentSessionId` is not an IPC type; the seam places it in agent/.",
    "Only `tauriAgent.ts` imports `@tauri-apps` for the agent (a `Channel` per start, as `createTauriServerHost` does); no file outside ipc/ imports bindings.",
    "`CheckoutLook` passes through as the brief requires (`{ ...dto, folder }`), so the coming `refs` field reaches `CheckoutChanges` unchanged.",
    "TS3: the exhaustive `never` defaults are present in `failure.ts` `startFailure`/`requestFailure`, `process.ts` `#onEvent`, `turn.ts` `foldUpdate` and `AgentSource.ts` `toCheckoutChanges`.",
    "TS17: `UNFINISHED` is a `Readonly<Record<StepStatus, boolean>>`; `STEP_KINDS`/`STEP_STATUSES` are keyed by wire strings, so `Record<string, …>` is correct.",
    "Comments: `failure.ts` `loadFailure` cites acp-agent.ts:1625; `command.ts` HOME_FOLDERS states an external fact; the `record-agent.ts` header follows CP4; no narration and no TODOs.",
    "Deviations: 1 accepted (the orchestrator applied it); 2 accepted (justfile lines reported, as the brief asks); 3 accepted (blank lines removed between one-line aliases, no behaviour change, domain.ts at 298 lines); 4 and 5 accepted as choices the brief left open; 6 became finding 2; 7 accepted (the map and architecture are the orchestrator's, and the map does not yet name the sibling `jsonrpc/` or `reviewDomain` either).",
    "The `ipc/index.ts` review exports (lines 72–85) were added at the orchestrator's request; they are outside this lens."
  ]
}
```