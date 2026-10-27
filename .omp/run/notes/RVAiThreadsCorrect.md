```json
{
  "verdict": "fail",
  "findings": [
    {
      "severity": "block",
      "file": "frontend/src/ui/rangeAi.ts",
      "line": 182,
      "rule_id": "plan#121",
      "problem": "If a thread's conversation load fails (anything but `sessionGone`) or comes back `stopped`, Ask is still allowed: `loading` is false because `loaded` is not null. When that turn finishes and is recorded, `appended` is skipped because `loaded.kind !== \"loaded\"`, so `loaded` keeps the old failure. From then on every answer message in the thread, including the one just recorded, shows the old load failure (or 'loading' for a `stopped` load), and its Post stays disabled. The new answer appears only as the live turn below. Nothing reloads it until the box is collapsed and reopened. The surviving mutant `loaded?.kind === \"loaded\"` → `true` at this line shows no test reaches this path.",
      "fix": "In `ended`, when the answer is recorded and `loaded` is not a loaded conversation of this session, call `load(state, thread)` after clearing `running`, so the replay brings the turns back. Add a `rangeAi.test.ts` case: the seeded load fails `crashed` → add a note → Ask → `finished` → a second load is asked, and after it answers, `answerView` of turn 1 is the turn and `postBody` is text."
    },
    {
      "severity": "block",
      "file": "frontend/src/ui/rangeAi.ts",
      "line": 156,
      "rule_id": "plan#121",
      "problem": "The rule that decides whether to record an answer is only tested on a session's first turn after the session event. Every failure case uses `fresh`, which has no session, so `session !== null` short-circuits before the `HELD_AFTER` table is read. Every replay case has 0 recorded answers. These mutants survive: `answersIn` → 0 (110 ×3); the non-replay arm → recorded (156); the `session !== null` guard dropped (176); `replayHolds` not storing the replay (147). Real bugs the suite would miss: (i) in a session with one answer, a second turn stopped about 5 ms after its prompt gets recorded, because a replay of 1 turn is more than 0. Every later answer then shows the previous turn's text and Post queues that text. (ii) After a reopen, a `checkoutFailed`/`notFound`/`spawnFailed` on the stored session gets recorded as an answer. (iii) Stop pressed while the checkout or process is still starting, before `session/new` (the usual Stop on a first ask), calls `loadConversation(null)`.",
      "fix": "Add `rangeAi.test.ts` cases on `seeded` (session `fixture-session`, turn 0 recorded). Stopped with replay `[t0]` → no answer. Stopped with replay `[t0, t1]` → one answer with turn 1, and `loaded` = `[t0, end.turn]`. A `checkoutFailed` end on the stored session → no answer and no load. A stop or crash on `fresh` before the session event → no load. A crash after a failed seeded load → `loaded` replaced by the replay. The boundary block's fix (record the turns missing at load) must be tested at k > 0 in the same way."
    },
    {
      "severity": "should",
      "file": "frontend/src/ui/rangeAi.ts",
      "line": 130,
      "rule_id": "VF7",
      "problem": "The test called 'Ask waits for it' would still pass with the wait removed. Its only `canAsk(seeded) === false` check runs while there is nothing new to ask, so `loading = false` and its three siblings survive. `isGone`'s `ai.loaded?.kind` → `ai.loaded.kind` (line 90) also survives, although the box's `askable` evaluates `canAsk` during every load and would throw. Nothing else depends on this rule beyond keeping Ask off during a load.",
      "fix": "In that test, add a note before answering the load. Assert `canAsk(seeded) === false` and that `ask` sends nothing while the load is pending, then `true` after it answers."
    },
    {
      "severity": "should",
      "file": "frontend/src/ui/rangeAi.ts",
      "line": 243,
      "rule_id": "VF7",
      "problem": "The `ai.running !== null` early return in `load` is untested (5 survivors). Without it, reopening the box during a turn that followed a failed load would reload the session the client holds. That load comes back `busy` and overwrites `loaded`, so the turn's answers show a failure. Nothing else depends on this rule.",
      "fix": "Add a case: the seeded load fails `crashed` → note → Ask → `load(seeded)` while the turn runs → no second `loadConversation`."
    },
    {
      "severity": "should",
      "file": "frontend/src/ui/rangeStore.ts",
      "line": 129,
      "rule_id": "VF7",
      "problem": "With AI on, `mayClose` is untested: the mutant `true` (close without asking) survives and line 131 has no coverage. Fixture mode's `onWindowClose` does not guard the close, so the Acceptance line 'close → Keep the AI's changes?' rests only on the real-app step the continuation build is running now. If that step does not observe the question, this becomes a block.",
      "fix": "Add a `rangeStore.test.ts` case with `createFixtureAgentSource(log, \"?ai-changes\")`. Check that `mayClose()` raises the `keepAiChanges` question; that `answer(true)` → true; that `answer(false)` → discard is called → true; and that dismiss → false."
    },
    {
      "severity": "should",
      "file": "frontend/src/ui/rangeAi.ts",
      "line": 231,
      "rule_id": "VF7",
      "problem": "`recorded = true` and `text !== undefined || recorded` survive. Retry after a failure omp never held is meant to apply the prompt rule again through `ask`, but the tests only check cases where a re-send gives the same text. A Retry that silently drops notes added after the failure would pass. Nothing else depends on this rule.",
      "fix": "Add a case: a crash that was not held → `addNote(fresh, \"Also X\")` → Retry → the request text ends with `\\n\\nAlso X`."
    },
    {
      "severity": "should",
      "file": "frontend/src/ui/rangeAiView.ts",
      "line": 45,
      "rule_id": "VF7",
      "problem": "`liveTurn` is never called with a running turn and a loaded conversation (end null), which is the box's state for every turn after omp names the session. The mutant `true && …` throws there (`end.turn` on null) and survives. Nothing else depends on this case.",
      "fix": "Add `expect(liveTurn({ ...LOADED, running: FIRST })).toEqual({ turn: FIRST, end: null })` to the live-turn test."
    }
  ],
  "survivors": [
    {
      "verdict": "real gap → finding 2 (block)",
      "mutants": ["rangeAi.ts:110 LogicalOperator", "rangeAi.ts:110 ArrowFunction", "rangeAi.ts:147 ObjectLiteral", "rangeAi.ts:156 ConditionalExpression", "rangeAi.ts:176 ConditionalExpression"]
    },
    {
      "verdict": "real gap → finding 1 (block)",
      "mutants": ["rangeAi.ts:182 ConditionalExpression (loaded?.kind → true)", "rangeAi.ts:182 OptionalChaining"]
    },
    {
      "verdict": "real gap → finding 3 (should)",
      "mutants": ["rangeAi.ts:130 ×4", "rangeAi.ts:90 OptionalChaining"]
    },
    {
      "verdict": "real gap → finding 4 (should)",
      "mutants": ["rangeAi.ts:243 ×5 (the running half; the `session === null` half is (a), see below)"]
    },
    {
      "verdict": "real gap → finding 6 (should)",
      "mutants": ["rangeAi.ts:231 recorded = true", "rangeAi.ts:232 LogicalOperator ||", "rangeAi.ts:232 `true && recorded`"]
    },
    {
      "verdict": "real gap → finding 5 (should)",
      "mutants": ["rangeStore.ts:129 ConditionalExpression", "rangeStore.ts:131 NoCoverage ×2"]
    },
    {
      "verdict": "real gap → finding 7 (should)",
      "mutants": ["rangeAiView.ts:45 ConditionalExpression"]
    },
    {
      "verdict": "(a) equivalent: a note body has no `session`, so `undefined === session` is already false",
      "mutants": ["fixtureReview.ts:111", "rangeAi.ts:106"]
    },
    {
      "verdict": "(a) equivalent: `agentSessionId(null)` returns null (`null !== \"\"`), `isGone` with session null needs a failed load on a null session, which cannot exist, and `askContext` without a start already returns null through `entry === undefined`",
      "mutants": ["rangeAi.ts:96", "rangeAi.ts:102", "rangeStore.ts:102"]
    },
    {
      "verdict": "(a) equivalent: TurnRun calls `changed` synchronously before it settles and never after it is done (turnRun.ts:72-92), so `end` is still null whenever `changed` fires",
      "mutants": ["rangeAi.ts:203"]
    },
    {
      "verdict": "(a) equivalent: `stop()` on a turn that already ended does nothing in the client (`asking.now` is `answered`/`stopped`); a sessionGone end always has the session it asked with",
      "mutants": ["rangeAi.ts:164", "rangeAi.ts:165"]
    },
    {
      "verdict": "(a) equivalent: `text` is null only when `canAsk` is false (the same `promptText`); a thread id that is not in the list never reaches these (callers pass a shown thread); the load's session cannot change while it runs (Ask is off while loading, and load is skipped while running); `ai.session` cannot differ from the turn's session at `ended` (load is skipped while running)",
      "mutants": ["rangeAi.ts:219", "rangeAi.ts:214", "rangeAi.ts:286", "rangeAi.ts:241", "rangeAi.ts:243 (session === null half)", "rangeAi.ts:252", "rangeAi.ts:182 (ai.session === session → true)", "rangeAi.ts:110 OptionalChaining"]
    },
    {
      "verdict": "(a) equivalent: AiTurn shows Retry only for a `failed` end (AiTurn.vue:56-66). While the replay is in flight (`running` set, end failed), `recorded` is false, so `ask` is reached and refuses through `canAsk`",
      "mutants": ["rangeAi.ts:228 ×6 incl. NoCoverage BlockStatement"]
    },
    {
      "verdict": "(a)/(b): unreachable `never` arms; vue-tsc in `just check` enforces exhaustiveness",
      "mutants": ["rangeAiView.ts:62 ×2", "rangeAiView.ts:76 ×2"]
    },
    {
      "verdict": "(b) gate-covered: fixtureReview.test.ts '?threads=seeded puts one thread of each line kind…' (lines 119-151) asserts the seeded file (`file: 7` from SEEDED_PATH), `session: \"fixture-session\"` and the `notQueued` postings, so `pnpm test` fails on each. They survived probably because Stryker handles module-level constants in the moved file as static mutants [INFERENCE]",
      "mutants": ["fixtureThreads.ts:11", "fixtureThreads.ts:13", "fixtureThreads.ts:14 ×2"]
    },
    {
      "verdict": "(c) wiring observed in the WebKit smoke (RVAiThreads.md smoke_evidence: Ask AI → 'Thinking and steps working…' → the answer through AiTurn with the store's client, Post enabled). That run needs `ai` to be non-null, `place` to give a context and `client` to be passed through",
      "mutants": ["rangeStore.ts:118", "rangeStore.ts:121 NoCoverage", "rangeStore.ts:124 NoCoverage"]
    },
    {
      "verdict": "log call, no decision of its own; not observed in a smoke, so not dropped under (c). It is no guard, constant or branch, so no finding",
      "mutants": ["rangeAi.ts:141 ×2"]
    }
  ],
  "checked": [
    "Prompt rule: `promptText` takes the notes after the session's last `aiAnswer` and joins them with \"\\n\\n\". It wraps them through `firstMessage` when that session has no answer. With session null (after sessionGone), `isAnswerIn` matches nothing, so every note is wrapped. Tests: rangeAi.test.ts 'first turn … wrapped', 'finished turn … only the notes since it, unwrapped', and both sessionGone cases (at load and at ask).",
    "First message values: `askContext` uses `threadPlaceText` (the old path and left line for a removed line on a renamed file, rangeThreadText.ts:138-147), `start.range` and both short ids; the template is `agent.firstMessage ?? DEFAULT_FIRST_MESSAGE`. rangeStore.test.ts 'First message's values' covers it, including both null cases.",
    "Session stored at the event: `run`'s `session` callback writes `setThreadSession` before the turn ends. The test asserts `thread.session === \"s1\"` before `end`, so dropping the call fails it (`addAiAnswer` alone would set it only after the end).",
    "Recorded once: `ended` runs once per turn (`turn.ended`); `addAiAnswer` is called at most once in it. 'finished turn adds one answer' compares `bodies.slice(1)` exactly; `ended` (max_tokens) is recorded without a replay (`loads` empty).",
    "Recorded only when omp holds the prompt: the stopped/crashed replay cases with 0 versus 1 replay turns, and the checkout/notFound/app failures adding nothing, are correct as far as they go. Their reach is finding 2.",
    "Rust versus fixture numbering: thread_store.rs:115-133 `add_ai_answer` sets the session and uses `answers_in` (same session, any position). fixtureReview.ts `addAiAnswer` does the same; fixtureReview.test.ts checks ('fixture-session' → 1, 'other' → 0).",
    "Stop: `stop` reaches only that thread's `RunningTurn` (test: stops 1 on thread A, unchanged after `stop(seeded)`). The box shows Stop only while `running !== null && end === null`; during the replay check it shows the stopped or failed end, Ask is disabled and Stop is hidden.",
    "Retry: a recorded crash re-sends `asked` in `ai.session`, which keeps the store's turns lined up with omp's replay (crashed turn k, retried k+1). An unrecorded failure goes back through `ask`.",
    "Two threads: separate `turns`/`asked`/`byThread` entries; 'two threads run at once' asks twice and ends one while the other still runs. A single shared running flag would fail it.",
    "Load once per session: the box's watch on `[id, session]` with `immediate`. A second `load` while one is in flight, or after one succeeded, is skipped; a failed load is tried again; a sessionGone load is kept and the next Ask starts a new session. The tests cover each.",
    "`events.session` fires only for a new session (agent/index.ts:193-195), so `run`'s `loaded: []` never wipes a conversation already loaded.",
    "Close guard: RangeApp installs `onWindowClose(mayClose)` only when `ai !== null`. Without AI, rangeStore.test.ts asserts `ai === null` and that `mayClose()` gives true with no question. With AI → finding 5.",
    "AI settings only with AI: RangeApp.vue:120 `<AgentSettings v-if=\"ai !== null\" />` inside SettingsView's slot.",
    "main.ts: `rangeAgent` builds `createTauriAgentSource`/`createFixtureAgentSource` and `new AgentClient` only when `data-ai === \"on\"` (app) or `?ai` (fixture), and only from `startRange`. `agentCommand` reads the settings store when it is called, after `createRangeStore` has registered it.",
    "Answer display: `answerView` matches `ai.end` to a turn by object identity. `replayHolds`'s slice and `ended`'s append put `end.turn` itself into `loaded.turns`, so the stopped or failed line stays on its own message.",
    "domain.ts/rangeDomain.ts `branded` change: same checks and field names, and `toRange` still checks `start` before `len`. reviewDomain `toBody` refuses a negative or fractional `aiAnswer.turn` with `<field>.body.turn`.",
    "Boundary review's block (the window numbering turns itself) confirmed by reading, not repeated as a finding. Two more paths to the same shift that its fix must cover: a failed `addAiAnswer` write after a turn omp held (the test 'a failed write … reported' leaves `loaded: []` while omp holds turn 0), and a page reload in the middle of a turn (the shell's page-load stop).",
    "Measured replay table (RVAiThreads.md) against `HELD_AT_END`/`HELD_AFTER`: a stop or crash within about 30 ms leaves no prompt in omp, so recording them only after a replay check is the right reading. The deviation from the brief's 'a stopped end → addAiAnswer' was granted by Main.",
    "No test file was run; every grade above comes from reading the code and the survivors."
  ]
}
```