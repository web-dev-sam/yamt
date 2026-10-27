I've built the thread and GitLab state for the range window, but `typecheck`, `lint` and `unused` fail for one reason: `ipc/index.ts` doesn't export the review types yet. As you arranged, the agent-client build adds those three export lines; I couldn't put them in, even in a scratch copy, so they're missing in my worktree. Every reported error is either a missing export or a knock-on of one. They can also hide real type errors in my files, so your whole-tree run after both patches land is the first full type check. `test`, `fmt:check` and `sfc-order` pass.

**summary**
- `ui/rangeThreads.ts` (`createRangeThreads`) holds the thread list (a copy of the last reply), which threads are open, and the drafts. It also gives counts per file, the queued count and `shownFor(file)`, plus the actions: start, toggle, add, note, queue, unqueue, replace and load.
- `ui/rangeGitLab.ts` (`createGitLabCheck`) runs one check at a time and re-checks on focus only 30 s after the last one ended. It holds the send progress and the send result, and works out what the Send and Post buttons show (label, hover, disabled).
- `ui/rangeThreadText.ts` holds every sentence: each `NotLinedUp` case (one exhaustive `switch`, plus the two-dots hint), the posting labels, the Send label and progress, the hovers, the result notice and `threadPlaceText`.
- `rangeStore` now has `threads` and `gitlab`. After the file list shows, start-up loads the threads and checks GitLab. `useRangeController` passes `shownFor(file)` into `showThreads`, wires `startThread`/`toggleThreads`, and returns `threadHosts`. `RangeApp.vue` calls `checkOnFocus` when the window gains focus.
- `RangeController`'s `events` parameter is now required and `NO_EVENTS` is gone; `range.browser.test.ts` passes its own events. The `threadAnchors` line in `editor/AGENTS.md` is updated.

**files_changed**
- New: `frontend/src/ui/{rangeThreads,rangeThreads.test,rangeGitLab,rangeGitLab.test,rangeThreadText,rangeThreadText.test}.ts`
- Changed:
  - `frontend/src/ui/{rangeStore,rangeStore.test,useRangeController,useRangeController.test}.ts`, `frontend/src/ui/RangeApp.vue`
  - `frontend/src/ui/{problem,problem.test,problemText,problemText.test}.ts`, `frontend/src/ipc/reviewDomain.ts` (both granted mid-run)
  - `frontend/src/editor/{range,range.browser.test}.ts`, `frontend/src/editor/AGENTS.md`

**tests_added**
- `rangeThreads.test.ts`:
  - A draft's Comment adds the thread; its key becomes the stored id with the text kept.
  - A refused Comment keeps the draft text and reports `add`; a second Comment in flight sends nothing more.
  - A second press on a line with an open draft only focuses it (`focus` 0 → 1); other lines and files get new drafts.
  - Dropping a draft removes it; open and collapse per thread and per line; stored threads start collapsed.
  - Counts per file ignore drafts; blank text is never sent.
  - A note is added or kept with its problem; queue/unqueue change the posting and the queued count, and a pending message reports.
  - A failed list reports; a reply after the view unmounted still lands in the store; `replace` mirrors a send's list.
- `rangeGitLab.test.ts`:
  - One check keeps its answer; focus within 30 s does not re-check, at exactly 30 s it does; no overlapping checks.
  - Both buttons read "Checking GitLab…" until the first answer; the last answer stays during a re-check.
  - A not-lined-up answer disables both with its sentence while Unqueue stays enabled; pending and AI-answer messages can't be posted; "Nothing queued".
  - Send's `notLinedUp` replaces the check; the progress label goes "Sending 1 of 2…" → "Sending 2 of 2…" with one send at a time.
  - Result notices for `refusal` (1 sent, 1 refused, list replaced) and `stopped` (keeps "glab timed out"); failed check and send report their step.
- `rangeThreadText.test.ts`: every `NotLinedUp` sentence (both looked-up forms), the two-dots hint and its absence with three dots, the posting labels, the Send label and progress, both hovers, the result notice, and `threadPlaceText` for all four `ThreadLine` kinds plus the old path of a renamed file.
- `rangeStore.test.ts`: the list shows first, then the threads load and GitLab is checked once; a failed `openRange` checks nothing; a failed thread list becomes the window's problem with its log line.
- `useRangeController.test.ts`: the threads are shown at build and on each change; nothing reaches the controller after unmount; the line events are forwarded and `hosts` reach `threadHosts`.
- `problem.test.ts` and `problemText.test.ts`: the `threads_failed` log line, and the words for each of the seven steps.

**smoke_evidence**
- `pnpm -C frontend test` → `Test Files 175 passed (175)`, `Tests 2333 passed (2333)`
- `pnpm -C frontend fmt:check` → `All matched files use the correct format.`
- `pnpm -C frontend sfc-order` → exits clean.
- `pnpm -C frontend typecheck` fails, all on the missing exports:
  - TS2305 "Module '"../ipc"' has no exported member" for `GitLabCheck`, `Message`, `MergeRequestRef`, `ReviewSource`, `SendProgress`, `SendReply`, `NotLinedUp`, `Posting`, `Thread`, `MessageId`, `ThreadId`, and TS2724 for `ThreadList`.
  - Knock-on errors: TS7006/TS7031 implicit any, TS18046 `reply` unknown, TS2339 on `unknown`, and TS2322 at the two `_exhaustive: never` lines (`rangeThreadText.ts:61,78`), all in my files.
- `pnpm -C frontend lint` fails, also from those types: 7 × `no-redundant-type-constituents` ("'GitLabCheck'/'SendProgress' is an 'error' type that acts as 'any'") and 1 × `strict-boolean-expressions` at `rangeThreads.ts:143`.
- `pnpm -C frontend unused` → "Unused exported types (4)": `Posting`, `Message`, `MergeRequestRef`, `NotLinedUp` in `src/ipc/reviewDomain.ts`. They get an importer once `ipc/index.ts` re-exports them.
- Not run: Stryker (`just mutants`) and `pnpm test:browser`. Stryker is the brief's mutant-killing acceptance, so it is still unverified; the browser test file (`range.browser.test.ts`) changed only to pass its own events.

**deviations_from_brief**
- `Problem` gains `{ action: "threads"; step: "list" | "add" | "note" | "queue" | "unqueue" | "check" | "send"; cause }` (`ThreadStep` exported from `problem.ts`). It is logged as `store.threads_failed {step, …}`, with words like "Could not add the thread" in `problemText.ts`. Main granted those files mid-run.
- `ipc/reviewDomain.ts` now exports `Posting`, `Message`, `MergeRequestRef` and `NotLinedUp` (granted). `ipc/index.ts` still needs the three export lines; the agent-client build adds them.
- `createGitLabCheck` takes a fourth parameter, `start: Readonly<ShallowRef<RangeStart | null>>`, because the sentences need both short ids and the two-dots hint needs the left side's label.
- Added to `GitLabState`:
  - `result`, a `SendResult` that holds the "5 sent, 1 refused" notice (the range window has no notice bar yet), and `dismissResult()`;
  - `sendButton` (computed) and `postButton(message)`, each `{ label, title, disabled }`, so row 21 renders them without logic.
- Added to `RangeThreads`: `queued` (computed), `load()`, `boxOf(key)`, `writeDraft`, `dropDraft`, `noteText`, `writeNote`. A draft is either a new-thread draft (with a `focus` counter a second press bumps) or reply text.
- After its Comment succeeds, a new thread keeps its draft key (`draft-N`) as its key. "The draft's key becomes the stored id" is implemented this way so its host and box are not remounted.
- `rangeThreads.ts` imports the `ShownThread` type from `../editor`; ui otherwise reaches the editor only through the `use*Controller` files. Re-exporting it from `useRangeController` would make an import cycle (useRangeController → rangeStore → rangeThreads).
- `RangeApp.vue` destructures `gitlab` from the store as well as calling `checkOnFocus`.

**open_risks**
- The whole-tree type check and lint can only be confirmed once the index exports land. The `never` checks in `rangeThreadText.ts` and the narrowing in `rangeThreads.ts`/`rangeGitLab.ts` haven't been seen type-correct.
- `rangeGitLab.ts` `checkNow`: if the check call itself fails (an IPC failure such as `WorkerStopped`, not a glab answer) before any answer, `check` stays `null` and the buttons keep "Checking GitLab…". The next focus 30 s later retries.
- `rangeThreads.ts`: a second press counts as the same line when it is in the same column at the same line number (`shownLine`). That relies on `anchorAt` giving one anchor per column line.
- `rangeThreadText.ts` `sendLabel` shows `done + 1` (the message being sent), capped at `of`.