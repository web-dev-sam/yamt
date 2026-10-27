The rule is now in `ui/rangeAi.ts`: the thread window keeps omp's replay only when its length equals the number of answers the store holds for that session. All three blocks from the re-check are fixed. Each block's test fails with its fix reverted by hand, and `typecheck`, `lint`, `test` and `fmt:check` all pass. Stryker leaves four mutants alive on lines I changed. I believe they can't happen in practice, but no test proves it (details below).

**summary**
- **Keeping the replay:** after every load and every replay check, `keep` first records each turn the replay holds beyond the stored answers. If a write fails, the replay is shown but marked stale (it is longer than the store), so Ask stays off and the next show loads again.
- **Ask:** `canAsk` is false while a load runs, and while the loaded replay is longer than the stored answers.
- **Fast path:** a finished or `ended` turn is recorded at once. It is appended directly only when the store's returned turn equals `loaded.turns.length`. Every other case reloads.
- **No answer twice:** a new per-thread map, `answered`, holds the ended turn omp holds; it is cleared at the next ask. Every kept replay shows that turn object as its last turn, so `liveTurn` is null and no second Retry shows.
- **Failed replay check:** it now leaves the failed load in place instead of the earlier conversation, so the next recorded answer reloads.

**files_changed**
- `frontend/src/ui/rangeAi.ts` (296 lines)
- `frontend/src/ui/rangeAi.test.ts`

**tests_added**
- **Block 1:** "an answer finished / ended at max tokens after a failed load loads the conversation again and shows once, as its turn". After the reload, answer 1 shows the ended turn object itself, `liveTurn` is null, and Post offers the text.
- **Block 2a:** "a failed replay check leaves the conversation unloaded; the next finished turn reloads it". The crash is logged as `ai.replay_failed`, a second load runs, answers 0 and 1 show omp's turns 0 and 1, and `liveTurn` is null.
- **Block 2b:** "a stop after a failed load records every turn the replay holds past the answers, each shown as omp's". A replay of `[Yes, Held, Part]` records answers 1 and 2; answer 1 shows `Held`, answer 2 shows the stopped turn with its end.
- **Block 3 (rewrite of the old B1 test):** "a failed record of a replayed turn keeps Ask off until a load records it; answer i stays omp's turn i". Ask is off and nothing is sent; the next show reloads and records turn 1; the next answer is turn 2 and the loaded turns are `[Yes, Half, Now]`.
- **Block 3, end of a turn:** "a finished turn whose record failed keeps Ask off and shows once after a load records it". While the store is behind, Ask is off and the turn shows only under the messages; after the next show it is answer 0 with its own object, and `liveTurn` is null.
- "a turn of a new session omp never held shows no answer of the lost session" checks that `answered` is cleared at the next ask.
- Existing test "a failed write of the session or the answer is reported as such" now expects the reload (`loaded: null`, one load of `s1`). It also checks that showing the box again starts no second load.

**smoke_evidence**
- **Hand reverts** (`vitest run --project node src/ui/rangeAi.test.ts`):
  - Block 1, placement reverted (`shown = turns`): 8 failed, including both block-1 cases, 2a, 2b and the end-of-turn write test.
  - Block 2a, return before `keep` on a failed replay: 1 failed, the 2a test.
  - Block 2b, only one missing turn recorded: 2 failed, the 2b test and the existing reload-mid-turn test.
  - Block 3, Ask rule reverted (`unrecorded = false`): 2 failed, both block-3 tests.
  - Block 3, keep rule reverted (`exact = loaded is "loaded"`): the same 2 failed.
  - Each revert was restored; the file's hash matched the pre-revert version.
- **Recipes:**
  - `pnpm -C frontend typecheck` → `vue-tsc -b`, no errors
  - `pnpm -C frontend lint` → `oxlint --type-aware && eslint --max-warnings 0 "src/**/*.vue"`, no findings
  - `pnpm -C frontend test` → `Test Files 197 passed (197)`, `Tests 2675 passed (2675)`
  - `pnpm -C frontend fmt:check` → `All matched files use the correct format.`
- **Stryker** (`stryker run … --mutate src/ui/rangeAi.ts … --ignoreStatic`):
  ```
  rangeAi.ts |  93.23 |   93.52 |      301 |         2 |         21 |        1 |        0 |
  ```
  Survivors on lines I changed:
  - `127:40`: `loadedSession !== session` → `false` in `canAsk`. With a non-null `loaded`, the two sessions differ only when the store missed a session write during a restart after a lost session.
  - `167:9`: `loadedSession === session` → `true` in the fast path. Ask's rules keep `asked.session` equal to `loadedSession`, so this condition never decides anything.
  - `167:38`: `loaded?.kind` → `loaded.kind`. `loaded` is never null when a turn ends; the `?.` is there for the type checker.
  - `257:16`: `thread === undefined` → `false` in `load`. An undefined thread already means `session === null`; the check is there for type narrowing.
  
  The other 17 survivors and the one with no coverage are on lines this round didn't touch (`isGone`, `askedSession`, `isAnswerIn`, `answersIn`'s body, `ended`'s first two lines, `run`, `ask`, `retry`, `load`'s first line, `createRangeAi`).

**deviations_from_brief**
- The answered turn takes the replay's last position, not literally index = store turn. When both sides agree these are the same index. When omp holds a turn the store never recorded, the store's index would show another turn's text, so I used the replay's last.
- "Marked stale" is computed, not stored: a kept replay longer than the stored answers is stale. A failed write keeps the whole replay visible, so stored answer i still shows omp's turn i and the unrecorded turn shows under the messages.
- New state `State.answered` (`Map<ThreadId, TurnEnd>`) lets a later reload still place the ended turn after a failed write.
- I removed `load`'s check, after the await, that the loaded session had not changed (now in `reload`). While a load runs, Ask is off and every other load is skipped, so nothing can change the session; Stryker showed it as a survivor.
- `answersIn` now takes `AgentSessionId | null`, so `canAsk` can count without a separate branch.
- To stay under the 300-line cap: `Readonly<{…}>` types (as in `folderIcon.ts`), the session-gone object built as a named local in `ended`, and the old `Answered`, `replayHolds`, `recordedTurn` and `showAnswer` removed.
- I updated the existing "failed write of the session or the answer" test for the new reload.

**open_risks**
- `frontend/src/ui/rangeAi.ts:148-149`: placement assumes omp's last replayed turn is the answered one. That is true when no turn ran after it in this window, but it breaks if another client added a turn to the same session.
- `frontend/src/ui/rangeAi.ts:142`: a note written while a load records missing turns still lands before those answers (already accepted after round 1).
- `frontend/src/ui/rangeAi.ts:126-127`: after a failed load (not a lost session), Ask stays on, as the brief and the C4 test require. If omp held unrecorded turns, the next answer records at once and the reload fixes the display. Until that reload answers, the answer shows under the messages.