I finished fix round 1 (B1–B5, C1–C7). The three blocking items (B1, C1, C2) each have a test that fails when I undo the fix by hand. All six `pnpm -C frontend` recipes pass. In the real app I reloaded the page mid-turn and then asked twice more; `threads.json` holds turns 0, 1, 2 and each message shows its own answer.

**summary**
- **B1, one place that numbers turns:** `RangeThreads.addAiAnswer` now returns the turn number of the answer the store just added (`number | null`). `rangeAi.ts` `showAnswer` puts the finished turn at that position in `loaded`, never at `loaded.turns.length`. The window still counts a session's answers only to decide whether omp's replay holds one more turn than the thread has recorded (at load, and in the replay check).
- **C1:** if an answer is recorded while `loaded` is not a loaded conversation of that session, the conversation loads again after `running` is cleared.
- **B2:** `AgentSessionId`, `isAgentSessionId` and `agentSessionId` now live in `ipc/domain.ts`, and `agent/internal/session.ts` re-exports them. `ReviewSource`, `RangeThreads` and `reviewDomain` (`Thread.session`, `aiAnswer.session`) use the brand. An empty session id coming from the app is refused with the field named, and `storedSession` is gone.
- **B3–B5:** `answerText(view, platform)` and `answering(ai)` are in `rangeAiView.ts`, and `RangeAi.of(thread)` is new; neither component imports `IDLE` any more. `commandInUse` and `firstMessageInUse` are used by `main.ts`, `rangeStore.ts` and the two field functions.
- I also renamed `ThreadAi.session` to `loadedSession`, and the comment on the held-prompt table now cites plan row 121 instead of "(measured)".

**files_changed**
- `frontend/src/ipc/`: `domain.ts`, `index.ts`, `ReviewSource.ts`, `reviewDomain.ts`, `reviewDomain.test.ts`, `fixtureReview.test.ts`, `tauriReview.test.ts`
- `frontend/src/agent/internal/session.ts`
- `frontend/src/ui/`: `rangeAi.ts`, `rangeAi.test.ts`, `rangeAiView.ts`, `rangeAiView.test.ts`, `rangeThreads.ts`, `rangeStore.ts`, `rangeStore.test.ts`, `agentSettingsFields.ts`, `agentSettingsFields.test.ts`, `RangeMessage.vue`, `RangeThreadBox.vue`
- `frontend/src/main.ts`

**tests_added**
- `rangeAi.test.ts`:
  - **B1** "an answer shows as the turn the store numbered, not after a replayed turn no answer records": the first write fails at load, so the replay has more turns than the thread records. The next finished answer is turn 1 and `loaded` is `[Yes, Now]`.
  - **C1** "an answer recorded after a failed load loads the conversation again and shows as its turn": a second load is asked; `answerView` of turn 1 is that turn and `postBody` is its text.
  - **C2**, all on the seeded thread:
    - a stop where the replay holds 1 turn adds no answer.
    - a stop where it holds 2 turns adds answer turn 1, with `loaded = [t0, end.turn]`, the end's own object.
    - a `checkoutFailed` end adds no answer and asks for no replay.
    - a stop or crash on a new thread before omp names the session asks for no replay.
    - a crash after a failed load replaces the failed load with the replay.
  - **C3** "a stored session is loaded once when shown, and Ask waits for it" now adds a note while the load is pending: `canAsk` is false and nothing is sent until the load answers.
  - **C4** "showing the box again while a turn runs after a failed load loads nothing".
  - **C6** "Retry after a crash omp never held asks again with the notes added since": the text ends with `\n\nAlso X`.
- `rangeAiView.test.ts`: **C7** `liveTurn({ ...LOADED, running: FIRST })` gives `{ turn: FIRST, end: null }`. New tests cover `answering` and `answerText` (no AI, loading, gone, failed).
- `rangeStore.test.ts`, **C5** "with --ai a changed checkout asks first: Keep closes, Discard discards then closes, dismiss stays", using `createFixtureAgentSource(log, "?ai-changes")`.
- `reviewDomain.test.ts`: an empty session is refused, naming `threads[0].session` and `threads[0].messages[0].body.session`.
- `agentSettingsFields.test.ts`: the setting in use is the stored value, or the default when nothing is stored.

**smoke_evidence**

Undoing each block's fix by hand (`pnpm vitest run --project node src/ui/rangeAi.test.ts`), then restoring it:
- **B1** (`[...loaded.turns, end.turn]`): `× an answer shows as the turn the store numbered, not after a replayed turn no answer records` (`Tests 1 failed | 30 passed (31)`)
- **C1** (no reload, `return`): `× an answer recorded after a failed load loads the conversation again and shows as its turn` (`1 failed | 30 passed`)
- **C2**, four mutants:
  - `known = 0` → `× …replay of one turn) adds no answer`, `× …stopped after omp held it is answer 1…`, `× a crash after a failed load replaces…` (3 failed)
  - non-replay branch counted as held → `× a checkout failure on the stored session adds no answer…`
  - `session !== null` guard dropped → `× a new thread's turn stopped…` and `× …crashed before omp named the session asks for no replay`
  - the replay not stored → `× a crash after a failed load replaces the failed load with the replay`
- **C3, C4, C6** together (`loading = false`, `recorded = true`, the `running` guard dropped): `× a stored session is loaded once when shown, and Ask waits for it`, `× turns omp holds without an answer…`, `× showing the box again while a turn runs after a failed load loads nothing`, `× Retry after a crash omp never held asks again with the notes added since` (4 failed)

Recipes:
- `pnpm -C frontend typecheck` → `$ vue-tsc -b`, no errors
- `pnpm -C frontend lint` → exit=0
- `pnpm -C frontend test` → `Test Files 197 passed (197)` / `Tests 2670 passed (2670)`
- `pnpm -C frontend fmt:check` → `All matched files use the correct format.`
- `pnpm -C frontend sfc-order` → exit=0
- `pnpm -C frontend unused` → exit=0

Real app, smoke step 9. I built with `cargo tauri build --debug --no-bundle` in this worktree, created the repo with `scripts/range-repo.sh /tmp/yamt-test-range-ai-r1`, and ran `just app-session start-app --name air1 --range main...feature … --ai --home /tmp/yamt-ai-home-r1 --settings '{"agent":{"command":["env","PI_CODING_AGENT_DIR=/home/wds/.omp/agent","omp","acp"]}}'`, against the real `omp acp`.
1. I started a thread on `docs/current.md:1` and pressed Ask AI. The button read `Stop` and `pgrep` showed `194413 bun …/omp acp`.
2. `location.reload()`: afterwards no `omp acp` process was running. `threads.json` held the session and only the note.
3. Reopening the thread loaded the conversation. The held turn was recorded as `turn 0` and showed its answer (`/tmp/air1-04-reopened.png`).
4. I asked twice more ("which file still links…" → "`README.md` still links … line 23"; "Reply with just the word: done" → "done"). Screenshots: `/tmp/air1-05-second.png`, `/tmp/air1-06-third.png`.
5. `jq` on `threads.json`:
   `{"session":"01a17e98-…8e3b","messages":[{"kind":"note",…},{"kind":"aiAnswer","session":"01a17e98-…8e3b","turn":0},{"kind":"note","text":"In one sentence: which file still links "},{"kind":"aiAnswer",…,"turn":1},{"kind":"note","text":"Reply with just the word: done"},{"kind":"aiAnswer",…,"turn":2}]}`

**deviations_from_brief**
- **`PostBody` stays in `rangeGitLab.ts`.** That was the boundary review's optional nit: `rangeGitLab.test.ts` (not owned) imports it from there, so moving it would break that test.
- **`rangeThreads.ts` `changed` now returns the list or `null` instead of a boolean**, so `addAiAnswer` can read the turn from the list it just received. `addNote`, `queue` and `setSession` were updated to match.
- **Turn past the end of `loaded`:** if the store's turn is beyond `loaded.turns.length` (omp lost turns the thread recorded), `showAnswer` places nothing and the ended turn stays shown as the live turn. The brief left this open; this was my choice.
- **`byThread` is no longer part of the public `RangeAi` type** (`of` replaces it); `IDLE` is still exported for the tests.
- **Docs I can't edit:** `frontend/src/agent/AGENTS.md` line 5 and the project map's agent line still say `internal/session.ts` *is* the `AgentSessionId` brand. They should say it re-exports the brand from `ipc/domain.ts`. The map's ipc line could also name `AgentSessionId` among the brands in `domain.ts`.
- **Build output:** the smoke build left `target/` in this worktree; it is gitignored.

**open_risks**
- `frontend/src/ui/rangeAi.ts` `retry`: after a `max_tokens` end (`failed`/`ended`) recorded while the load had failed, the conversation reloads and `loaded` no longer holds `end.turn` by identity. Retry then goes through `ask`, which has nothing new to send, so it does nothing. I did not observe this; it comes from reading the code.
- `frontend/src/ui/rangeAi.ts` `load` loop: a note written while the conversation is still loading still lands before the answers recorded at load. This is the smoke's open risk and is unchanged.
- `frontend/src/ui/rangeAi.ts` is 298 lines against the 300-line cap; the next change to it will need a split, and a new file needs a project-map line.