The range window's threads now have "Ask AI" behind `--ai`: Stop, the live turn, answers shown as `AiTurn`, Retry, Post on a loaded answer, the close guard and the AI settings section. All six `pnpm -C frontend` recipes pass. Not everything in Acceptance was observed: the real-app `omp acp` steps were not run, and the WebKit fixture run only covered Ask AI → answer → Post → Queue. I hit the request budget before Stop, `?ai=crash`, close with `?ai-changes`, and the settings check.

## summary
- `ui/rangeAi.ts` is the one owner of the threads' AI state. It holds per thread the running turn, its end, the loaded conversation and that conversation's session. It provides ask, retry, stop, load and canAsk.
- What it does: applies the prompt rule, stores the session the moment omp names it, and records answers. After omp loses a session (`sessionGone`) the next ask starts a new conversation with every note wrapped in First message.
- The view rules are in `ui/rangeAiView.ts`: `answerView`, `liveTurn`, `postBody`.
- `ReviewSource` gains `setThreadSession` and `addAiAnswer` (app and fixture; the fixture numbers turns as Rust does). The boxes show Ask AI / Stop and the live turn. `RangeApp` has the close guard and `<AgentSettings>` in the settings slot, both only with AI on. `main.ts` builds the agent source and client only under `data-ai="on"` or `?ai`.
- `domain.ts`/`rangeDomain.ts` now create brands through `branded`. `reviewDomain` refuses a bad `aiAnswer.turn`.

## Measurement: is a crashed turn's prompt in the replay? (real omp 18.12.6, throwaway scripts in `/tmp/acp-measure/`)

| What happened mid-turn | Prompt in the replay? |
|---|---|
| omp killed after the first answer chunk | yes (`user_message_chunk`), no agent text |
| omp killed 300 ms after `session/prompt` | yes |
| omp killed 30 ms after `session/prompt` | no |
| `session/cancel` 4 s after the prompt (reply `cancelled`) | yes |
| `session/cancel` 5 ms after the prompt (reply `cancelled`) | **no** |

A `session/load` in the same live process works and replays the session.

So the bookkeeping follows the replay, and not only for crashes:
- `finished` and `ended` (max_tokens etc.) are recorded at once.
- `stopped`, `crashed` and `refused` are recorded only if `loadConversation` shows one more turn than the thread has answers for that session.
- Every other failure records nothing.

This deviates from the brief's "a finished or stopped end → addAiAnswer": an early stop leaves no prompt in omp, and recording it anyway would shift every later answer by one turn. Main accepted this.

## files_changed
- `frontend/src/main.ts`
- `frontend/src/ipc/{ReviewSource,tauriReview,tauriReview.test,fixtureReview,fixtureReview.test,reviewDomain,reviewDomain.test,domain,rangeDomain}.ts`
- `frontend/src/ipc/domain.test.ts` (new), `frontend/src/ipc/fixtureThreads.ts` (new)
- `frontend/src/ui/{rangeAi,rangeAi.test,rangeAiView,rangeAiView.test}.ts` (new)
- `frontend/src/ui/{rangeStore,rangeStore.test,rangeThreads,rangeThreads.test,rangeGitLab,rangeGitLab.test,rangeThreadText,problem,problemText,problemText.test}.ts`
- `frontend/src/ui/{RangeApp,RangeThreadBox,RangeMessage}.vue`

## tests_added
- **`rangeAi.test.ts`** (19 tests, fake client), proving:
  - the first turn sends every note, joined by a blank line and wrapped;
  - the session is stored on the event, before the turn ends;
  - a finished turn adds one answer, and the next ask sends only the notes since it, unwrapped;
  - Ask does nothing while running or with nothing new; Stop stops only that thread's turn;
  - stopped before omp held the prompt → no answer; stopped after → one answer;
  - a failure before the prompt (checkout, missing program, app) adds nothing and asks no replay;
  - `ended` counts without a replay;
  - a crash omp held → answer added, and Retry re-sends the same prompt; a crash it did not hold, or a failed replay → nothing;
  - load once per session, Ask waits for it, a failed load is tried again;
  - `sessionGone` at load and at ask → a new session with every note wrapped;
  - two threads run at once;
  - failed session/answer writes are reported with steps `session`/`answer`;
  - no First message context → nothing to ask.
- **`rangeAiView.test.ts`**: every `answerView` case, `liveTurn`, `postBody`.
- **`domain.test.ts`**: each brand check names its field, including the start checked before the length.
- **`reviewDomain`**: a bad `aiAnswer` turn is refused, naming the field.
- **`tauriReview`**: both methods pass their arguments; their failures come back unchanged.
- **`fixtureReview`**: `setThreadSession`, and `addAiAnswer` numbering like Rust, with unknown threads refused.
- **`rangeGitLab`**: `postButton` with a body (none → the reason as title; text → edit).
- **`rangeStore`**: `askContext` values; without AI, no `ai` and the window closes without asking.
- **`problemText`**: the two new steps' words.

## smoke_evidence
- `pnpm -C frontend test` → `Test Files 197 passed (197)`, `Tests 2640 passed (2640)`
- `pnpm -C frontend typecheck`, `lint`, `unused`, `sfc-order` → exit 0 each
- `pnpm -C frontend fmt:check` → "All matched files use the correct format."
- WebKit (MiniBrowser through `just app-session start-fixture --range-case review --threads seeded`, then `location.search='?range=review&threads=seeded&ai'`):
  - After Ask AI, the box read "Stop … Thinking and steps working…".
  - It ended as an answer message ("I added `hello` as the last line of README.md …"). Ask AI was then disabled, titled "Nothing to ask yet: …".
  - The answer's Post was enabled ("Queue this message as its own comment on !12") and filled the editor with the answer text. Queue → "Queued for GitLab", Send to GitLab (3).
  - Screenshots are in `/tmp/aith/`.
- **Not observed:**
  - WebKit: Stop → stopped line (the fixture's second turn finished before the Stop click), `?ai=crash` with Retry, close with `?ai-changes`, and settings with and without `ai`. Two more notes on these:
    - In fixture mode `onWindowClose` does not guard the close, so the close question can only be seen in the app.
    - `start-fixture` has no `--ai` flag; I switched the URL by hand.
  - The whole real-app list: one real turn, Stop a second turn, Keep/Discard at close, reload → agent pid gone, reopen → conversation loads.
  - All of these are unproven until they are run.

## deviations_from_brief
- **Granted by Main:**
  - `ui/problem.ts`/`problemText.ts`(+test): ThreadStep `session` ("Could not store the AI's conversation") and `answer` ("Could not store the AI's answer").
  - New `ui/rangeAiView.ts`(+test): `rangeAi.ts` was over 300 lines.
  - New `ipc/fixtureThreads.ts`: the `?threads=seeded` seed, moved out of `fixtureReview.ts` to stay under 300 lines. Map line for the ipc row: "fixtureThreads.ts (`?threads=seeded`: the seeded threads fixture mode starts with)".
  - The replay check for stopped and crashed ends; the measured facts above are for plan #121.
- **Contract widened or added to:**
  - `ReviewSource`'s `session` parameter is `string`: ipc importing `agent/` would be a cycle, and `AgentSessionId` is assignable to it.
  - `createRangeAi` takes `Pick<AgentClient, "ask" | "loadConversation">` and a `threads` Pick, with no `report`: failures are reported through `RangeThreads.setSession`/`addAiAnswer`.
  - `ThreadAi` adds `session` (the conversation `loaded` belongs to). `RangeAi` adds `retry`.
  - `createRangeStore(source, theme, agent: RangeAgent | null)`. The store gains `ai` (RangeAi plus `client`, for `AiTurn`), `mayClose`, and an exported `askContext`.
  - `postButton(message, body: PostBody)`.
- **Decisions the brief left open:**
  - Retry after a failed turn whose answer is recorded re-sends that turn's prompt text; otherwise it asks again.
  - The "first turn" is wrapped whenever the session has no answers in the thread.
  - `sessionGone` at ask time re-asks at once with a new session.
  - A loaded answer shows as `finished` unless this window saw it end.
  - Ask is disabled while a stored session's conversation loads.
  - The close guard is installed only with AI on.
- **Not changed:** `ipc/words.ts` still has hand-written brand-or-throw checks (not owned). `SettingsView.vue` needed no change.
- **Sentences for `ui/AGENTS.md`:**
  - "`rangeAi.ts` (held by `rangeStore` as `ai`, null without `--ai`) owns each thread's AI state: ask by the prompt rule, Stop, Retry, a load once per session when the box shows the thread, the session stored on omp's event, and an answer recorded when omp holds the prompt (finished/ended at once, stopped/crashed/refused after a replay check)."
  - "`rangeAiView.ts` maps an answer to its loaded turn or to loading / 'omp no longer has this answer', and gives the turn under the messages and what Post offers."
  - "`main.ts` alone builds the agent source and client (`data-ai` / `?ai`)."

## open_risks
- `frontend/src/ui/rangeAi.ts` `replayHolds`: if the check-up load fails, a prompt omp held goes unrecorded and later answers shift by one turn (logged as `ai.replay_failed`). A stop or crash within ~30 ms of the prompt is decided by the replay, which is correct but costs one `session/load`.
- `rangeAi.ts` `ended`: a turn stopped while the checkout was still being made, on a stored session, triggers a `loadConversation`, which may start the checkout and the process.
- `rangeAiView.ts` `answerView`: a stopped answer shows its stopped line only until another turn ends in this window or the page reloads; the stored answer does not say it was stopped.
- WebKit steps for Stop, crash/Retry, the close question and settings, and every real-app step, were not observed.