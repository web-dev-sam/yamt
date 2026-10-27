```json
{
  "verdict": "fail",
  "findings": [
    {
      "severity": "block",
      "file": "frontend/src/ui/rangeAi.ts",
      "line": 145,
      "rule_id": "plan#121",
      "problem": "The window works out turn positions itself instead of reading the store's numbers. `replayHolds` counts the session's answers again with `answersIn` (lines 109, 145), which repeats Rust's `answers_in` rule, and `ended` (lines 181–186) puts the new turn at `loaded.turns.length`. The store numbers the answer `turn = k` (the number of that session's answers already stored), but `load` (lines 239–254) keeps the whole replay. Sometimes omp holds a prompt that the thread never recorded: the page reloads mid-turn (the shell's page-load stop), the window closes mid-turn, or `ai.replay_failed`. Then the replay has k+1 turns, so the next finished answer (stored as turn k) shows that unrecorded turn's text, and Post queues that text for GitLab. The mismatch lasts across reloads. Plan #121 rejects exactly this: 'numbering in the window (two writers)'.",
      "fix": "In `load`: when the replay has more turns than the thread has recorded answers for that session, record the missing turns through `threads.addAiAnswer` before showing anything, as `replayHolds` already does when a turn ends. In `ended`: put `end.turn` at the `turn` of the answer that the returned list added, not at `loaded.turns.length`. Add a `rangeAiView.test.ts`/`rangeAi.test.ts` case where the replay has one more turn than the stored answers."
    },
    {
      "severity": "should",
      "file": "frontend/src/ipc/ReviewSource.ts",
      "line": 11,
      "rule_id": "principles §1",
      "problem": "The fixed contract was `setThreadSession`/`addAiAnswer(thread, session: AgentSessionId)`. The patch widens it to `string`, also in `rangeThreads.ts:51-52`. Main did not grant this; it is only listed under 'Contract widened'. The session brand is now made in `ui/` (`rangeAi.ts:95` `storedSession`), not where the IPC data is converted, so an empty stored session silently reads as 'no session'. Every later user of the stored session has to parse it again.",
      "fix": "Move the `AgentSessionId` brand and its guard into `ipc/domain.ts`, where the other brands live (agent/ re-exports it; this needs the agent slice's owner). Then type `ReviewSource`, `RangeThreads` and `reviewDomain`'s `Thread.session`/`aiAnswer.session` with it, and delete `storedSession`. Or have the orchestrator record the widening as granted."
    },
    {
      "severity": "should",
      "file": "frontend/src/ui/RangeMessage.vue",
      "line": 39,
      "rule_id": "TS11",
      "problem": "`unshownText` maps `AnswerView` to words a second time, next to `rangeAiView.ts:51` `answerBody`: loading → `ANSWER_LOADING_TEXT`, gone → `ANSWER_GONE_TEXT`. It also has an unreachable `case \"turn\"` → `AI_ANSWER_TEXT`. Any new answer state needs both switches changed, and the component holds a rule.",
      "fix": "Add one `answerText(view, platform)` in `rangeAiView.ts` for an answer that is not shown (failed → `failureText`), used by the component. Derive `answerBody`'s `why` next to it, so the component only renders."
    },
    {
      "severity": "should",
      "file": "frontend/src/ui/RangeThreadBox.vue",
      "line": 54,
      "rule_id": "VU9",
      "problem": "Both components repeat `ai.byThread.value.get(id) ?? IDLE` (here and at `RangeMessage.vue:30`), which copies `rangeAi.ts`'s `aiOf`. The box also decides by itself that a turn 'still runs' (`running !== null && end === null`, line 57) to choose Stop over Ask AI. A third view of a thread's AI state would copy both.",
      "fix": "Expose `of(thread): ThreadAi` on `RangeAi`, and add `answering(ai)` in `rangeAiView.ts` next to `liveTurn`. Both components call these; `IDLE` stops being imported by components."
    },
    {
      "severity": "should",
      "file": "frontend/src/main.ts",
      "line": 66,
      "rule_id": "plan#113",
      "problem": "The 'setting in use' rule (`stored ?? default`) for `agent.command` and `agent.firstMessage` is written again here and at `rangeStore.ts:106`. It is already written in `agentSettingsFields.ts:21,32`. If the default rule changes (#57's rule), the client, the First message and the settings field can disagree.",
      "fix": "Export `commandInUse(agent)` and `firstMessageInUse(agent)` from `agentSettingsFields.ts` and call them from `main.ts`, `rangeStore.ts` and the field functions."
    },
    {
      "severity": "should",
      "file": "frontend/src/ui/rangeAi.ts",
      "line": 23,
      "rule_id": "CP reviewer test",
      "problem": "`ThreadAi.session` means 'the conversation `loaded` belongs to', while `Thread.session` means 'the conversation the next ask continues'. The two same-named fields are told apart only by the doc comment on line 18, so a reader can confuse them; nothing else gets harder.",
      "fix": "Rename the field to `loadedSession` and drop that clause from the comment."
    },
    {
      "severity": "nit",
      "file": "frontend/src/ui/rangeAi.ts",
      "line": 55,
      "rule_id": "CP1",
      "problem": "The external fact 'a stop or crash right after sending it may leave none' cites only '(measured)', with no source; nothing gets harder if it stays.",
      "fix": "Cite plan row 121 (where the orchestrator records the measured replay table) instead of '(measured)'."
    },
    {
      "severity": "nit",
      "file": "frontend/src/ui/rangeGitLab.ts",
      "line": 44,
      "rule_id": "TS9",
      "problem": "`PostBody` is defined in `rangeGitLab.ts`, which only uses it, while the function that builds it (`postBody`) is in `rangeAiView.ts`; nothing gets harder if it stays.",
      "fix": "Move `PostBody` into `rangeAiView.ts` beside `postBody`, and import its type in `rangeGitLab.ts`."
    }
  ],
  "checked": [
    "Ownership: every changed file is in Owned or among Main's grants (problem.ts/problemText(+test) steps `session`/`answer`, rangeAiView(+test), ipc/fixtureThreads.ts). ui/AGENTS.md, fences.ts and docs are untouched; the AGENTS sentences are reported in deviations.",
    "Fence: main.ts alone builds `createTauriAgentSource`/`createFixtureAgentSource` and `new AgentClient`, only when `data-ai=\"on\"` (app) or `?ai` (fixture), matching plan #108. rangeStore imports only agent types and `DEFAULT_FIRST_MESSAGE`.",
    "AI views only in the range root: AiTurn/AgentSettings are imported only by RangeApp.vue, RangeThreadBox.vue and RangeMessage.vue. These match fences.ts `WINDOW_FILE` (range root) and `AI_FILES`→PM9. The `new AgentClient` fence itself is not yet in fences.ts; it belongs to the turn-view fix round, not this patch.",
    "One owner of the AI state: `byThread` shallowRef, `turns` and `asked` all live in `createRangeAi`; components only read `byThread` and call ask/stop/retry/load/canAsk. No component holds AI state (the computeds only derive from it).",
    "The window only asks for numbers: `setThreadSession`/`addAiAnswer` send no turn. Rust's `ThreadStore::add_ai_answer` (crates/review/src/thread_store.rs:114-133) numbers by `answers_in`. The fixture's copy (fixtureReview.ts `addAiAnswer`) imitates Rust in fixture mode, as fixtureCompare does for yamt-compare, so it is accepted.",
    "`events.session` fires only for a new session (agent/index.ts:192-196), so `run`'s `loaded: []` reset never wipes a loaded conversation.",
    "Words: the new strings are only in rangeThreadText.ts (ASK_AI_*, STOP_AI_*, ANSWER_*) and problemText.ts (`session`, `answer`). Components hold no literals; the failure sentence comes from aiText `failureText`, called with `navigator.platform` as the other components do.",
    "The close guard in RangeApp follows CompareApp's `onWindowClose` + `log.error` pattern and is installed only when `ai !== null` (plan #111). `<AgentSettings>` goes into SettingsView's default slot only with AI on (#113).",
    "The load trigger is the box's `thread` computed, which is non-null only when the thread is open, watched on id+session: 'loads when shown open' (#115, #120).",
    "`branded` replaces every hand-written brand-or-throw check in domain.ts (`nextColumnVersion`, `toRange` start, `toChunk` id, disk version, run) and rangeDomain.ts (file id). `invalid` is still used for `len`. ipc/words.ts is left as it was (not owned, reported).",
    "reviewDomain `toBody` refuses a bad `aiAnswer.turn` and names the field; the Tauri wrappers convert through `toThreadList` like the other thread commands.",
    "The prompt rule matches C2/#115: notes after the session's last answer, joined by a blank line; wrapped through `firstMessage` when the session has no answer; after `sessionGone`, session null wraps every note; `askContext` fills the four values from `threadPlaceText`, `start.range` and the short ids.",
    "Accepted deviations: no `report` parameter (failures go through `RangeThreads.changed` with the new steps); the added `retry` and `ThreadAi.session`; the replay-checked bookkeeping for stopped/crashed/refused (Main accepted it; the facts belong in plan #121); `postButton(message, body)`.",
    "No dependency was added; no import cycle: ipc does not import agent, which is the reason given for the `string` session.",
    "Map/architecture: no range-window file (rangeStore, rangeThreads, …) is in the project map yet, so the missing lines for rangeAi.ts, rangeAiView.ts and fixtureThreads.ts are part of the feature's documentation step, not this patch.",
    "Acceptance evidence for the WebKit Stop/crash/close/settings steps and the real-app steps is being produced by the continuation build running now (3.RV-ai-threads-smoke). Fixture mode's `onWindowClose` is a no-op, so the `?ai-changes` close step can only be observed in the app. That is noted, not graded here."
  ]
}
```