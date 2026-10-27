```json
{
  "verdict": "fail",
  "findings": [
    {
      "severity": "block",
      "rule_id": "seam: RunningTurn.stop",
      "file": "frontend/src/agent/index.ts",
      "line": 105,
      "problem": "When Stop is pressed before the prompt goes out, `stop()` only sets `asking.stopped`. `#turn` checks that flag at line 163, after `#ready()` and `#session()`, and neither of those has a deadline. So Stop pressed while the checkout is being made (the design gives seconds to a minute) or while omp loads a long conversation leaves the turn running all that time, and forever if omp never answers `initialize`. Even then it still spawns omp, sends `session/new` and reports a session id to B for an ask the user stopped. The test 'Stop before the prompt…' cannot see this, because FakeAgent answers in microtasks.",
      "fix": "In `stop()`, when `asking.prompted === null`, call `run.end({ kind: \"stopped\" })` at once. In `#turn`, return as soon as `asking.stopped` is set after `#ready()`, before `#session()`, so TurnRun's `#done` guard makes the late end a no-op. Test it with a `prepareCheckout` that never resolves: Stop ends the turn stopped, and later resolving prepare sends no `session/new` and reports no session."
    },
    {
      "severity": "block",
      "rule_id": "R-open (implementer open_risks #2)",
      "file": "frontend/src/agent/internal/process.ts",
      "line": 141,
      "problem": "`replay` sends its own `session/load` without recording it in `#loads`, and `loadConversation` does not mark the session busy. The design opens a thread's conversation when the thread opens (plan #120), so an Ask AI pressed during that load makes `ask` → `load()` send a second `session/load` for the same session in the same process. Until the ask's own `listen`, both replays go to the replay collector, so the thread shows its old turns twice, or omp cancels the first load ('ACP session load was cancelled') and the thread reads as refused. The listener-identity guard that limits the damage (lines 104–106) is untested: all six of its mutants survive.",
      "fix": "In `replay`, put the in-flight load into `#loads` before awaiting, as a promise of `AgentFailure | null`, so a concurrent `load(session)` joins it instead of sending another. Add an index.test.ts case: `loadConversation(s)` and `ask(s)` started together give exactly one `session/load`, then the prompt, the replay turns once, and the ask's answer without replayed text."
    },
    {
      "severity": "block",
      "rule_id": "seam: isRunning / busy",
      "file": "frontend/src/agent/index.ts",
      "line": 101,
      "problem": "`#forget(run)` runs in `.finally` on `#turn`'s promise, but `run.end()` settles `ended` inside `#turn`, so every `ended.then`/`await turn.ended` continuation runs before the forget. I checked this order with node. In that continuation `isRunning()` is still true, and an `ask` on the same session ends `failed { busy }`. Code like C8's close path (stop, await ended, then check `isRunning()`) or an immediate re-ask therefore gets a wrong answer. Every test flushes 100 ms before looking, so none can see it.",
      "fix": "Forget the run before it settles. Give `TurnRun` an `onEnd` callback that `end()` calls before `#settle`, or call `this.#forget(run)` immediately before each `run.end(...)` in `#turn`. Add a test whose `ended.then` handler asserts `isRunning() === false` and that `ask` on the same session does not end busy."
    },
    {
      "severity": "should",
      "file": "frontend/src/agent/index.ts",
      "line": 146,
      "problem": "`destroy()` stops only a process `#agent` already holds. A turn that is still in `prepareCheckout` when `destroy` is called goes on to start omp and run `session/new`, and `loadConversation` has no `#destroyed` check at all, so it starts a process after destroy. Nobody stops either process. Rust's stop at page load or close covers this today; any other destroy caller would leak a running omp.",
      "fix": "In `#ready`, after `await this.#folder()`, return a failure when `#destroyed` (`#failed` already maps it to stopped). Return the same early in `loadConversation`, and stop a start that resolves after destroy. Test: destroy while prepare is pending → `startAgent` is never called."
    },
    {
      "severity": "should",
      "file": "frontend/src/agent/index.ts",
      "line": 106,
      "problem": "A `RunningTurn.stop()` called after its turn ended still sends `session/cancel` through `asking.prompted`, so a stale handle cancels a later turn on the same thread. As C8 keeps handles per thread, any slip there turns into a cancelled answer.",
      "fix": "Clear `asking.prompted` when the prompt reply arrives (or have stop do nothing once `run` has ended). Test: finish a turn, ask again on its session, call the first handle's `stop()` → no second `session/cancel`."
    },
    {
      "severity": "should",
      "rule_id": "dead weight",
      "file": "frontend/src/agent/index.ts",
      "line": 207,
      "problem": "`reply.kind === \"closed\" && agent.isStopping → stopped` duplicates `#failed`'s `#destroyed → stopped` rule. Only `destroy` and the refused `initialize` (which has no prompt) stop a process. So the destroy test passes through either rule: all five mutants at line 207 and `#stopping = false` (process.ts:151) survive, and line 214 is never covered. Two rules for one fact make the next change edit both.",
      "fix": "Delete the `isStopping` branch and the `isStopping` getter (keep `#stopping` for the exit log), so destroy goes through `#failed`. The existing destroy test then covers line 214."
    },
    {
      "severity": "should",
      "rule_id": "VF7",
      "file": "frontend/src/agent/index.test.ts",
      "line": 452,
      "problem": "Several client branches C8 relies on have no test, as the surviving or uncovered mutants show. These are the lines and tests to add:\n- index.ts:194 `agent.created`: ask(null), finish, ask(s1) should give `[initialize, session/new, prompt, prompt]` with no load.\n- index.ts:195 `#bySession.set`: ask(s1) while the new-session turn runs should be busy.\n- index.ts:220 `#forget` identity: with two threads, ending one should leave the other busy.\n- index.ts:210: a `session/prompt` error reply should give `refused { method: \"session/prompt\", message from details }`.\n- index.ts:116: `loadConversation` when prepare fails should give `failed checkoutFailed`.\n- index.ts:190–192: `session/new` answering `{ sessionId: \"\" }` should be refused.\n- index.ts:148: `destroy()` on a client that never asked should not throw; with the mutant it does.\n- process.ts:169–170: a `startAgent` that throws should give `spawnFailed` and a retry.",
      "fix": "Add those eight cases to index.test.ts; each one kills the named mutants."
    },
    {
      "severity": "should",
      "rule_id": "VF7",
      "file": "frontend/src/agent/internal/protocol.ts",
      "line": 103,
      "problem": "The guards that keep the update stream alive are untested. With these mutants a malformed or unexpected message throws a TypeError inside `Connection.receive` instead of being dropped:\n- protocol.ts:103/104: a content item of another type (ACP `terminal`).\n- protocol.ts:109: a non-text content block.\n- protocol.ts:126: `content: null`.\n- protocol.ts:137: an envelope without `sessionId`.\n- process.ts:205: a refusal for an unlistened session.\n- process.ts:215: a malformed read-kind update.\n- process.ts:180: an `initialize` cut off by Exited reports a parse 'refused' instead of `crashed` with the stderr line.\n- protocol.ts:123: `kind: null` resets a step's kind to `other`.\n- protocol.ts:146: the log-or-ignore split.",
      "fix": "Add protocol tests: a `terminal` item plus a text item keeps only the text; an image block gives no output; `content: null` and `kind: null` keep the step; no `sessionId` gives a parse failure; a `tool_call` without `toolCallId` is not ok. Add client tests: a malformed update followed by a valid one still folds; an Exited with a Log before the initialize reply gives `crashed { code, lastLog }`."
    },
    {
      "severity": "should",
      "rule_id": "VF7",
      "file": "frontend/src/agent/internal/turn.ts",
      "line": 117,
      "problem": "The refusal-title rule has no test that can fail. All six `known` mutants survive: the only known-step case refuses with the step's own title, and the only unknown-step case starts from an empty turn. The `?? []` at line 73 also survives, because no new step arrives with content. A refusal could rename an existing step, or a new step could carry stray outputs, without any test noticing.",
      "fix": "Add turn tests: refuse a known step with a different title → the step keeps its title; refuse an unknown step in a non-empty turn → the step is titled by the refusal; a first `tool_call` with content → exactly that content."
    },
    {
      "severity": "should",
      "rule_id": "VF7",
      "file": "frontend/src/ipc/fixtureAgent.ts",
      "line": 206,
      "problem": "Four fixture rules are untested or broken:\n- The 'differences only when both texts match' rule (as in fixtureCompare) survives `left === old && true` and `||`.\n- stopAgent's old-run guard (288) survives `if (true)`.\n- discardCheckout's clean exit (234) survives `endRunning(state, true)`, which would report a crash.\n- `?ai=load` is accepted (and listed as known) but its recording has no `session/new`/`session/prompt`, so a prompt hangs forever.",
      "fix": "Add fixture tests: same old text with a different new text is a miss; stopAgent(1) after run 2 started leaves run 2 playing; discard during playback gives `Exited { code: null }`. Leave `load` out of the playable case names, as `SCRIPTED` does for the scripted ones."
    }
  ],
  "survivors": [
    { "group": "failure.ts:30 sourceText (3 survived, 3 NoCoverage)", "verdict": "follows the boundary block: delete `sourceText`. If it stays, kill with an IpcError that carries a message." },
    { "group": "never arms: failure.ts:43,59; turn.ts:108; process.ts:237; AgentSource.ts:83", "verdict": "drop: unreachable `never` arm" },
    { "group": "failure.ts:57-58 timedOut", "verdict": "drop (a): unreachable. Every agent request is `requestUntilAnswered` (process.ts:94), so no `timedOut` reply exists." },
    { "group": "failure.ts:56 exit?.", "verdict": "drop (a): the connection closes only on Exited, after `#exit` is set (process.ts:231-234)." },
    { "group": "failure.ts:70 kind===error→true", "verdict": "drop (a): a non-error reply has no details or message; the regex tests \"undefined\" and falls through to `requestFailure`." },
    { "group": "firstMessage.ts:41; inside.ts:24", "verdict": "drop (a): the capture group is mandatory; only a root folder lacks a first segment, and the replacement text is not a drive." },
    { "group": "process.ts:68,229,233 log literals and arrow", "verdict": "drop (c): log calls with no decision of their own" },
    { "group": "process.ts:71 cancelNotification {}", "verdict": "drop (a): only read on a timeout, and none happens." },
    { "group": "process.ts:104-106 listen identity (6)", "verdict": "kill with finding 2's load/ask race test" },
    { "group": "process.ts:125; 136; 142; index.ts:164,171", "verdict": "drop (a): replayTurns drops everything before the first user message; a stale listener is replaced by the next `listen` or ignored by TurnRun's `#done`. Line 125 becomes killable after finding 2's shared `#loads`." },
    { "group": "process.ts:151; index.ts:207 (5); index.ts:214 NoCoverage", "verdict": "finding 6: delete the duplicate branch" },
    { "group": "process.ts:152 run/exit guard (4)", "verdict": "drop (a): Rust `Workspace::stop` ignores a gone run (crates/agent/src/workspace.rs:84-87)" },
    { "group": "process.ts:169-170, 180-181; index.ts:116-117, 148, 190-195, 210, 220", "verdict": "kill: findings 7 and 8" },
    { "group": "process.ts:197", "verdict": "drop (a): nothing is sent before `#run` is set; `initialize` follows the spawn." },
    { "group": "process.ts:205, 211, 215-216; protocol.ts:98,103,104,109,123,126,137,146", "verdict": "kill: finding 8" },
    { "group": "protocol.ts:124 status (4)", "verdict": "drop (a): `STEP_STATUSES[undefined|null]` is undefined, so the result is null either way. The condition could become `STEP_STATUSES[status ?? \"\"] ?? null`." },
    { "group": "session.ts:86, 91", "verdict": "drop (a): `clearTimeout(null)` is harmless; finished/stopped carry no other field." },
    { "group": "session.ts:82,85,95 #done", "verdict": "unreachable today, since each `#turn` path ends once after unlistening. Finding 1's fix makes it the live guard; kill then with 'Stop before prompt, late ending changes nothing'." },
    { "group": "turn.ts:73, 117 (7)", "verdict": "kill: finding 9" },
    { "group": "index.ts:88, 96, 98", "verdict": "drop (a): a Map has no null key; `{}` leaves a falsy `stopped` and an optional-chained `prompted`; a null key is removed by `#forget`." },
    { "group": "index.ts:234, 247, 282 identity checks", "verdict": "drop (a): they differ only if a new start begins between continuations of one failing promise (consecutive microtasks), or, for 282, after a refused `initialize`, where every start is refused anyway." },
    { "group": "AgentSource.ts:76,77,79 case labels", "verdict": "drop (a): the `never` default returns the value unchanged and brands are type-only. Only a relative folder in `Changed` goes unrefused; a cheap kill is a relative-folder `Changed` in tauriAgent.test.ts." },
    { "group": "domain.ts:151 ABSOLUTE_PATH (3); fixtureAgent.ts:69,75,77-83", "verdict": "drop: module-level constant class #732. The domain regex is exercised by tauriAgent.test.ts:92-108 (`C:\\\\data\\\\checkout` accepted, `data/checkout` refused)." },
    { "group": "fixtureAgent.ts:96,112,124,129,132,137,139,140,165,175,181,184,189,243,247,248,253,254,256,274", "verdict": "drop (a) with the committed recordings:\n- 124: within a segment the only agent reply is the one to the segment's request.\n- 112, 181, 184, 253: every method the client sends is recorded.\n- 248: `?raw` is always a string.\n- 247: the glob keys are fixed.\n- 274: no process is running at a start.\n- 137-140 (play timing) and 254/256 (error text) are seen only in WebKit fixture mode or by a developer." },
    { "group": "fixtureAgent.ts:206, 208, 234, 288", "verdict": "kill: finding 10" }
  ],
  "checked": [
    "Fold over the recordings (turn.test.ts): thinking joined equals the concatenated chunks; steps read/edit/execute all done; the execute step goes pending→running→done; the edit path is `README.md` with whole before/after; answer = all message chunks after the last step; the cancelled recording gives `execute noResult`; permission-outside gives `[refused, text]` with status failed and the tool_call's title. I traced it against the jq dump of the four jsonl files, where request_permission always arrives before its `tool_call`, and `refuseStep` creates the step for that.",
    "stopReason table (session.ts `stopEnding`) matches design §3. All six rows are tested.",
    "Crash: Exited sets `#exit` and then `connection.close()`, so every pending request settles `closed` once and maps to `crashed { code, lastLog }`; `exited()` drops `#agent`. TurnRun ends once by construction, and the second Exited is a no-op (Connection already closed). index.test.ts 'a crash…' checks one `changed` per turn and both turns crashed.",
    "Load vs prompt after a restart: a new AgentProcess has empty `#loads`, so `load()` sends `session/load`, and `listen` happens only after it resolves, so the replay is dropped. The test asserts `[initialize, session/load, session/prompt]`, the load params with the checkout cwd, and the answer \"new\" (a routed replay would make it 'the replayed answernew').",
    "Two sessions are routed apart: `#listeners` is keyed by sessionId, and refusals are routed by the request's sessionId. The test interleaves s2/s1 chunks and checks both answers.",
    "Permission table (answers.ts): execute → allow_once whatever the paths; non-execute with every path inside → allow_once; an outside path, or missing/empty/null locations → reject_once with only the outside paths; a missing allow_once/reject_once → cancelled (logged), with the refusal still shown; `*_always` never picked, also when listed first; fs/terminal/other → −32601; malformed → −32602. Every row is in answers.test.ts.",
    "inside.ts: lexical `.`/`..`, both separators; a sibling prefix (`checkout2`) is outside; `..` out and back in; case is folded only for a drive-letter folder; another drive is outside; the checkout itself is not inside; a relative path is resolved against the checkout. Symlinks are not followed, which design §3 accepts as out of scope; it is stated in the inside.ts doc comment and in open_risks (accepted). The conservative direction holds for UNC/verbatim paths (refused).",
    "A failed prepare is not cached: `#folder` drops a failed promise only if it is still the current one; `NoCheckout` at start resets `#checkout`. Tested for Failed, AiOff, a throw, and NoCheckout re-prepare.",
    "The command is read per process start: `#start` calls `this.#command()`; the test changes the words between processes and sees the second `AgentCommand` with empty words dropped. `noCommand` starts nothing.",
    "editDiff limit parity: fixture `>` 8_388_608 on UTF-8 bytes matches Rust `require_within_limit` (`bytes > MAX_COLUMN_BYTES`, crates/compare/src/files.rs:72) over `str::len`.",
    "Fixture source: the cancelled recording's prompt segment ends at yamt's recorded `session/cancel`, so playback holds until Stop and the fixture answers `cancelled` with the live prompt id (deviation 5 accepted). `?ai=crash` plays half, then Log + Exited(1) once, and the next process plays whole. Replies get live ids only for the segment's request; the agent's permission request keeps id 0 and is answered by the client's own table.",
    "Rust start/stop facts used above: `Workspace::start` returns NoCheckout without a checkout and stops the previous agent (workspace.rs:61-64); `stop(run)` ignores an unknown run (84-87).",
    "Microtask order of `ended` vs `#forget` (finding 3) checked with a node one-liner of the same pattern: inside a then-handler and an await continuation, running.size is 1; after a tick it is 0.",
    "firstMessage: a function replacer (so `$&` stays literal), the regex from design §6, unknown kept as typed, `unknownPlaceholders` deduplicated in order; all tested.",
    "Do the tests catch real bugs? The pure parts (fold, permission table, inside, firstMessage, replay split) would catch a plausible bug; their mutants are killed except the gaps in findings 8–9. The client lifecycle tests use a FakeAgent that answers in microtasks and flush 100 ms between steps, so they cannot see Stop during a slow prepare or load, the order of `ended` vs forget, the load/ask race, or destroy during prepare (findings 1–4).",
    "No test file was run; no block depends on a run. Each block was traced by hand through index.ts/process.ts/connection.ts."
  ]
}
```