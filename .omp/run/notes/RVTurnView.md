I've built the turn view, the edit diff, the close question and the AI settings section, plus the fence for them. All six frontend recipes pass on the whole tree. Two small class changes were made after the last browser run and were not re-checked in the browser. Main granted me one change outside the brief: an `ai` problem action in `problem.ts`/`problemText.ts`.

**summary**
- `AiTurn.vue` shows one turn:
  - "Thinking and steps" is collapsed, can be opened while the turn runs (with a "working…" mark) and after it ends.
  - The answer goes through `useMarkdown`.
  - A stopped turn ends with "You stopped the AI."; a failed one with one sentence and a Retry button.
- `AiStep.vue` shows a step's title, status and outputs. `EditDiff.vue` shows an edit collapsed as "Edited/Created <path>". Opening it calls `client.editDiff` and builds unified rows with `editDiffLines.ts`: 3 context lines, gaps of 6 or fewer joined, both line numbers, at most 2,000 rows and then "n more lines not shown". A created file needs no call.
- `aiClose.ts` `aiMayClose`: a Missing or Clean checkout closes without asking. Changed or Unreadable asks `keepAiChanges { folder, files, headMoved, refs }` or `keepUnreadableCheckout { folder, message }`, with "Keep Changes" as the confirm button and "Discard Changes" as cancel. Discard removes the checkout, or shows the problem and stays open. Escape stays open.
- `AgentSettings.vue` with `agentSettingsFields.ts`: the "Agent command" field and the "First message" text area, each with Use and Default (a default value is stored as null), the yolo note, the five placeholders, and each unknown placeholder named. `aiText.ts` has one sentence per `AgentFailure` kind.
- Fence PM9: the four AI views can be imported only from range-window files or from each other.

**files_changed**
- New: `frontend/src/ui/{AiTurn,AiStep,EditDiff,AgentSettings}.vue`
- New: `frontend/src/ui/{editDiffLines,aiText,aiClose,agentSettingsFields}.ts`, each with its `.test.ts`
- Changed: `frontend/src/ui/{question,question.test,problem,problem.test,problemText,problemText.test}.ts`, `frontend/src/ui/AGENTS.md`, `frontend/scripts/{fences,fences.test}.ts`

**tests_added**
- `aiClose.test.ts`:
  - Missing and Clean close without asking or discarding.
  - Changed asks with files, folder, moved HEAD and refs; Keep closes and discards nothing.
  - Discard removes, then closes.
  - A failed discard, or one that throws, stays open and reports `{ action: "ai", step: "discard", cause }`.
  - Escape stays open.
  - Unreadable asks its own question.
  - A failed look closes.
- `editDiffLines.test.ts`:
  - A change in the middle keeps 3 lines on each side and skips the rest.
  - New line numbers shift after an insert.
  - Changes 6 lines apart join into one hunk; 7 apart split into two.
  - Changes at the first and last line, and a text without a final newline.
  - The 2,000-row cap with its "more" row; exactly 2,000 rows has no "more" row; created files.
- `aiText.test.ts`:
  - Every `AgentFailure` kind has its sentence, checked through a `Record<AgentFailure["kind"], …>` so a new kind fails to compile; the `app` kind goes through `problemText`.
  - A crash with and without an exit code or last line; `notFound` with no searched folders.
  - Edited/Created titles, step words, the refusal line, the row counts, diff failures and the fixed words.
- `agentSettingsFields.test.ts`:
  - The default shown; Use splits the words; Use of the default's words or text stores null; Use is off for the words in use and for no words; Default is off while the default is in use.
  - The first-message rules; unknown placeholders named once each; the five placeholders; the yolo note.
- `question.test.ts`:
  - The words of both new kinds, with Keep Changes as the confirm.
  - Notes for a moved HEAD, one or several branches, a stash, and combinations; work without changed files reads without "also".
  - Neither kind ends with a stop.
- `problemText.test.ts`: the three `ai` attempt words, and a `RemoveFailed` discard naming the folder.
- `problem.test.ts`: the `ai` failure logs its step and cause.
- `fences.test.ts`: the merge root, compare root, `SettingsView` and `store.ts` importing an AI view each violate PM9; range files and the AI views themselves violate nothing.

**smoke_evidence**
- `pnpm -C frontend typecheck` → `$ vue-tsc -b`, exit=0
- `pnpm -C frontend lint` → `$ oxlint --type-aware && eslint --max-warnings 0 "src/**/*.vue"`, exit=0
- `pnpm -C frontend test` → `Test Files  191 passed (191)`, `Tests  2574 passed (2574)`, exit=0
- `pnpm -C frontend fmt:check` → `All matched files use the correct format.`, exit=0
- `pnpm -C frontend sfc-order` → exit=0
- `pnpm -C frontend unused` → exit=0
- MiniBrowser run: a throwaway Vite harness and WebDriver script in `/tmp/aiturn/` (not committed), on a private Xvfb. It mounts `AiTurn` over real `AgentClient`s using `createFixtureAgentSource` with `?ai=edit-and-command` (once live, once stopped after 400 ms) and `?ai=crash`, plus one hand-made Markdown turn. Observed:
  - `live, collapsed: "Thinking and steps working… expanded=false" entries 0`
  - `live, opened: "Thinking and steps working… expanded=true" entries 4 → 5`
  - Stopped card: `["You stopped the AI."]`. Crashed card: `"The AI stopped unexpectedly (exit code 1): fixture agent: crashed mid-turn"` with a `Retry` button.
  - Edit diff opened: `["⋯ 20 unchanged lines","2121 ```","2222","2323 Keyboard shortcuts are listed in …","24+hello"]`, `addedRows: 1`
  - Markdown card: `codeColours: 5` (the ts block is coloured), `links: 0`, `address: "https://example.com/docs/board"` (the link shows as text).
  - `retry clicked: true` → `after retry: {"endLine":[], "answerStart":"I added hello as the last line of README.md …"}`
  - Screenshots: `/tmp/aiturn/dark-{ended,opened,bottom,retried}.png`, `/tmp/aiturn/light-{collapsed,opened,bottom}.png`.
  - AI settings section: `start: Use (off), Default (off) … hints ["{{ FOO }} is not a placeholder; it is sent as typed."]` → typed ` --debug` → `Use (on)` → after Use: `Use (off), Default (on)`, field shows `omp acp --debug`. Screenshot `/tmp/aiturn/settings-dark.png`.

**deviations_from_brief**
- Granted by Main mid-slice: `ui/problem.ts` gains `AiAttempt = "ask" | "diff" | "discard"` and `{ action: "ai"; step; cause }` with its log arm. `ui/problemText.ts` gains the words "The AI could not answer" / "Could not show the diff" / "The AI's checkout could not be removed", with tests in both test files.
- To keep `logProblem` and `questionText` under the 40-line limit I extracted `stoppedFields` (problem.ts) and `exitText` (question.ts). Their output is unchanged.
- `aiMayClose`'s target is `{ source: Pick<AgentSource, "checkoutChanges" | "discardCheckout">; asking: Pick<Asking, "ask">; report: (problem: Problem) => void }`. This is wider than the contract's `AgentSource`/`Asking`, so any full one still fits. C8 passes `(p) => report(store, p)`.
- Decisions the brief left open:
  - A failed checkout look closes the window and logs `ai.close_look_failed`. This is safe because the shell removes only a clean checkout at exit.
  - Retry is offered only on failures, not on a stopped turn.
  - Refs are named as "the branch(es) X" and "a stash".
  - With no changed files the message reads "The AI left work in its checkout at …".
  - The `busy` and `sessionGone` sentences use "omp", as in the design table.
  - I added `createdFileLines`, `DiffRow` and `MAX_DIFF_ROWS` to `editDiffLines.ts`, and the words `diffFailureText`, `editTitle`, `refusedText`, `moreLinesText` and `skippedLinesText` to `aiText.ts`.
- There are no `plan §2 #111`-style references in the sources: the palette check reads `#111` as a hex colour.
- Map line for the orchestrator to add to the project map (I don't own it): ui gains `AiTurn`/`AiStep`/`EditDiff`/`AgentSettings`, `editDiffLines.ts`, `aiText.ts`, `aiClose.ts`, `agentSettingsFields.ts`; PM9 also covers the AI views.
- I ran `pnpm -C frontend install --offline --frozen-lockfile` because the worktree had no `node_modules`.

**open_risks**
- `EditDiff.vue` colours removed lines with `bg-chunk-deleted`, which is grey in the yamt themes, not red: the brief asks for the panes' own colours.
- `AiTurn.vue:58` (`empty:hidden` on the answer box) and the `whitespace-nowrap` on the placeholder names in `AgentSettings.vue` were added after the last browser run and were not re-checked there.
- `AiTurn.vue` shows `said` entries as plain text, not Markdown, because `useMarkdown` takes one host per component.
- `aiClose.test.ts:9` gets the look's type as `Awaited<ReturnType<AgentSource["checkoutChanges"]>>` because `ipc/index.ts` does not export `CheckoutChanges`.