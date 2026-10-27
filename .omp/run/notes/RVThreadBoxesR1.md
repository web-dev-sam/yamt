All nine items are fixed, each with tests. The six frontend commands pass on the whole tree. Main allowed the one extra `keyList,` line in `ipc/index.ts`; `ui/AGENTS.md` is not mine, so its corrected sentences are under deviations for you to apply.

**summary**
- A half-typed Post text is now kept in the store as a `post` draft, keyed by the message. It is still there after the thread is collapsed and reopened, and after the file's view is evicted. A queue that GitLab accepts closes the editor. After that queue, and after Escape, focus goes to the message's Post/Unqueue button. The reply's Comment keeps focus in the reply field.
- Every word is now in `rangeThreadText.ts`, including `threadCountText(n)` and `sendNoticeRow(result)`; "Copy" and "Copied" come from `serverText.ts`.
- The box keys are now `Mod-Enter` and `Escape` built with the new `keyList` in `ipc/keys.ts` and matched by `pressesKey`. `typesIntoField` is gone, and `RangeApp` calls `fileListKey` directly, as the other two windows do.
- `postButton` now also returns what a press does (`"edit" | "unqueue" | null`), and `pressPost` switches on it. `RangeMessage` and `ServerMenu` share one `copyOrSelect`, and both now show "Copied" after a successful copy.
- `--glab` now refuses an unknown scenario at start (the check moved into `glabScenario`, with the folder lookup as a parameter). A test now refuses `lined-up/../moved`, which pins the `$` anchor.

**files_changed**
- `frontend/src/ipc/keys.ts`, `keys.test.ts`, `index.ts` (one line)
- `frontend/src/ui/rangeKeys.ts`, `rangeKeys.test.ts`, `rangeDrafts.ts`, `rangeThreads.ts`, `rangeThreads.test.ts`, `rangeGitLab.ts`, `rangeGitLab.test.ts`, `rangeThreadText.ts`, `rangeThreadText.test.ts`
- `frontend/src/ui/copyOrSelect.ts`, `copyOrSelect.test.ts` (new)
- `frontend/src/ui/RangeApp.vue`, `RangeFileRow.vue`, `RangeMessage.vue`, `RangePostEditor.vue`, `RangeThreadBox.vue`, `RangeSendButton.vue`, `ServerMenu.vue`
- `frontend/scripts/app-session/startArgs.ts`, `start.ts`, `args.test.ts`, `startArgs.test.ts` (new)

**tests_added**
- `keys.test.ts` "keyList parses each text in order and refuses one that does not parse".
- `rangeKeys.test.ts`: the earlier submit, cancel, modifier, platform and composing assertions pass unchanged, now through `pressesKey`. The test helper only gained `code: ""`. The `typesIntoField` test is removed.
- `rangeThreads.test.ts`:
  - "a half-edited Post text outlives a collapse and a reopen of its thread"
  - "an emptied Post text keeps its editor open; Cancel drops it"
  - "a queued Post closes its editor; a refused or blank Queue keeps the text"
  - "a Post text outlives its file's view: 16 other files evict file 0 and the text is still there" (builds a store with 17 files)
- `rangeGitLab.test.ts`: the Post button expectations now check `action` (`null`, `"edit"`, `"unqueue"`).
- `rangeThreadText.test.ts`: "the result notice is one closable row with its words"; "a file row's thread count says thread for one and threads otherwise".
- `copyOrSelect.test.ts`, four tests:
  - a successful write copies, selects nothing and answers true;
  - a refused write selects the element;
  - a clipboard that throws at once, or is missing, also selects;
  - no element means it only answers false.
- `args.test.ts`: `lined-up/../moved` refused (kills the anchor mutant); `nosuch` refused with "no scenario folder …tests/glab/nosuch".
- `startArgs.test.ts`: the folder rule; a known scenario asks the lookup about exactly its folder; an unknown one is refused, both by the name check and by the lookup.

**smoke_evidence** (MiniBrowser through `just app-session start-fixture --range-case review [--threads seeded]`; user agent "AppleWebKit/605.1.15 … Version/60.5 Safari")
- **Step 3** (draft box from a gutter press):
  - after the press: `focus=TEXTAREA:Write a comment… | boxes=4`
  - after ArrowDown, ArrowLeft, Ctrl+A, Ctrl+C: `focus=TEXTAREA:Write a comment… | panels=0`
  - after Escape: `focus=BODY | boxes=3`
  - Ctrl+F then Ctrl+B in a box: `focus=TEXTAREA | panels=0 | … optionsVisible=0`; Ctrl+B again: `optionsVisible=13 focus=TEXTAREA`
- **Step 7, keyboard only** (no seeded threads):
  - Ctrl+Enter on the draft: `focus=TEXTAREA:Reply… | send=Send to GitLab (0)`
  - Shift+Tab, Enter, Ctrl+Enter: `focus=BUTTON:Unqueue | msg=Why here?UnqueueQueued for GitLab | send=Send to GitLab (1)`
  - Enter: `focus=BUTTON:Post | send=Send to GitLab (0) title=Nothing queued`
- **Collapse and reopen with a half-edited Post** (seeded, thread at line 20, after Unqueue gave `send=Send to GitLab (1)`):
  - Shift+Tab, Enter: `TEXTAREA:Text to post:"Why does the overdue check go?"`
  - type " Still?", collapse: `boxes=src/board/board.ts:6,src/board/board.ts:21`
  - reopen by its mark: `boxes=…:6,…:20,…:21 | editor="Why does the overdue check go? Still?" | focus=TEXTAREA:Text to post`
  - Ctrl+Enter: `focus=BUTTON:Unqueue in src/board/board.ts:20 | … | send=Send to GitLab (2)`
  - Enter: `focus=BUTTON:Post | … send=Send to GitLab (1)`
- **Reply's Comment, clicked**: `focus=TEXTAREA:Reply… in src/board/board.ts:20 value="" | msgs=Why does the overdue check go? / And the test?`
- **Escape in the Post editor**: `focus=BUTTON:Post editors=0`
- **Commands**:
  - `pnpm -C frontend typecheck`: `$ vue-tsc -b`, no output.
  - `lint`: `$ oxlint --type-aware && eslint --max-warnings 0 "src/**/*.vue"`, EXIT=0.
  - `test`: `Test Files  189 passed (189)` / `Tests  2530 passed (2530)`.
  - `fmt:check`: "All matched files use the correct format." (550 files).
  - `sfc-order` and `unused` (knip): no findings.

**deviations_from_brief**
1. `frontend/src/ipc/index.ts`: one added line, `keyList,` (Main allowed it). `defaultKeys` in `keys.ts` is renamed to the exported `keyList`, and its error now reads "key X does not parse".
2. "Copy" and "Copied" are imported from `serverText.ts` (`COPY`, `COPIED`) rather than copied into `rangeThreadText.ts`. The review's complaint was a second copy of `COPY`, so one source fixes it. Only the link's Copy title moved to `rangeThreadText.ts` (`COPY_LINK_TITLE`).
3. Closing the editor after a successful queue is a store rule: `rangeThreads.queue` calls `dropPost`, replacing the old `watch(queued)` in `RangeMessage`.
4. Escape/Cancel in the Post editor also moves focus to the Post button, not only a Queue. Without it, focus fell to `<body>`, the same loss as after a Queue.
5. The `@mousedown.prevent` is on the box's one Comment button, so a draft's Comment has it too. Harmless: the draft's own focus watch already moves focus to the reply field.
6. I also took the boundary review's two remaining `should`s and its nit:
   - `noteText` in `RangeMessage` is renamed `bodyText`.
   - `RangeSendButton` and the Post button keep their title on the wrapper only and add `disabled:pointer-events-none`, as `OperationButtons` does.
7. The Post button's view no longer has a `disabled` field: `action === null` is the one fact for "disabled", which is why the `postButton` test expectations changed. `sendButton` keeps its `ButtonView`.
8. `startArgs.ts` now imports `existsSync` and `session.ts`'s `fromRoot`. `start.ts` uses the new `glabFolder(scenario)` instead of building the path itself.
9. No `rangeDrafts.test.ts`: the post-draft tests are in `rangeThreads.test.ts`, which is the surface the components use.
10. The eviction test sits in `rangeThreads.test.ts` and uses `createRangeStore`, because `rangeStore.test.ts` is not owned. Its 17-file fixture repeats `rangeStore.test.ts`'s `rangeCase` builder.
11. `isTypingTarget` (a contract item) now has no caller outside its test. A typing guard for every window would belong in `fileListKey.ts` behind a plan row; that is for you to decide.
12. Corrected sentences for `ui/AGENTS.md` line 7:
    - Replace "every lines-up sentence is in `rangeThreadText.ts`" with "every thread word is in `rangeThreadText.ts` (labels, prompts, `threadCountText`, `sendNoticeRow`; Copy/Copied are `serverText.ts`'s)".
    - Replace "Post opens `RangePostEditor.vue` in the message's place (Queue/Cancel), Unqueue is the same button while queued or refused." with "`postButton` returns the label, the title and the press action (`edit` | `unqueue` | null); `edit` opens `RangePostEditor.vue` in the message's place by writing a `post` draft (`rangeDrafts.ts`, keyed by `MessageId`: `postDraft`/`writePost`/`dropPost`), so a half-edited Post text survives a collapse and the 16-view eviction; a queue that lands drops it, and focus moves to the message's Post/Unqueue button after a queue or a Cancel. A failed clipboard write selects the link (`copyOrSelect.ts`, shared with `ServerMenu`)."
    - Replace "Keys in every box field go through `rangeKeys.ts` `boxKeydown`: Ctrl/Cmd+Enter submits, Escape cancels" with "Keys in every box field go through `rangeKeys.ts` `boxKeydown`: `Mod-Enter` submits and `Escape` cancels (built with `keys.ts` `keyList`, matched by `pressesKey`; only the composing check is its own)".
    - Replace "`RangeApp`'s window keydown skips presses that type into a field (`typesIntoField`: …), so Ctrl/Cmd+B still toggles the list from a box or a find field." with "`RangeApp` calls `fileListKey(event, navigator.platform)` as the other roots do; the reply's Comment keeps focus in the reply field (`@mousedown.prevent`)."
    - Replace "(`sendResultText`) as a closable `NoticeBar` row" with "(`sendNoticeRow`) as a closable `NoticeBar` row".
13. The project map and `docs/architecture.md` still need `copyOrSelect.ts`, `keyList` and a state-table row for the Post draft (PM6). They are outside Owned.

**open_risks**
- `frontend/src/ui/RangeMessage.vue` (`editing` computed): if a list reply makes a message pending while its editor is open (a Send), the editor stays open with Post disabled until Cancel. The old `watch(queued)` behaved the same.
- `frontend/src/ui/RangeMessage.vue` (`copied`): "Copied" stays until the message unmounts, as `ServerMenu`'s does until its menu closes. The Copy button was not exercised in MiniBrowser; only the unit tests cover it.
- `frontend/src/ui/RangePostEditor.vue` (`onMounted`): reopening a thread with several open Post editors focuses each in turn, so the last one wins.
- `frontend/src/ui/rangeThreads.test.ts` (eviction test): its 17-file fixture duplicates `rangeStore.test.ts`'s builder, so the two can drift apart.
- I did not run Stryker mutants on these changes.