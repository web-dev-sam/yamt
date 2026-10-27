# RVNoteEditsWebBoundary — review of f3eb9a4

Verbatim output:

```json
{
  "verdict": "fail",
  "findings": [
    {
      "severity": "block",
      "rule_id": "plan#123",
      "file": "frontend/src/ui/rangeDrafts.ts",
      "line": 94,
      "problem": "`isStored` keeps an `edit` draft for as long as its message exists. If Edit is open on a queued note and the user presses Send, the note becomes `pending`, but the edit box stays open (RangeMessage.vue:162 shows any non-null `editText` and ignores `changeable`). It stays next to \"Pending on GitLab\" with Save enabled, and Save then returns a `MessagePending` problem. This breaks Behaviour 1: a pending note shows neither Edit nor Delete.",
      "fix": "Keep an `edit` draft only while its message is still changeable: in `isStored`'s `\"edit\"` case, check `isChangeable` on the found message. Move `isChangeable` into rangeDrafts.ts so that rangeDrafts does not import rangeThreads, then add a rangeThreads.test case: an open edit on a queued note is dropped when a send reply makes the note pending."
    },
    {
      "severity": "block",
      "rule_id": "VU15",
      "file": "frontend/src/ui/RangeMessage.vue",
      "line": 162,
      "problem": "The edit box is a second, inline copy of the in-place message box that `RangePostEditor.vue` already is (textarea, `boxKeydown` submit/cancel, a submit that is off when the text is blank, Cancel, focus when it opens). The copy already differs from the original (`rows=3`/`bg-panel` against `rows=4`/`bg-panel-inline`, `@mousedown.prevent` on only one of them, focus through `focusLater` against `onMounted`). It also gives RangeMessage a second job: message display plus the editor's state, keys and focus. That is growth harm (a component taking a second job, a copied decision), and the file is now near 300 lines.",
      "fix": "Turn RangePostEditor into one in-place message editor used for both Post and Edit. It takes the draft kind (`post` | `edit`) and reads and writes that draft, supplies the field label and submit word, and takes the submit-off state and its title. It focuses on mount and emits submit/cancel. RangeMessage then only switches between it and the message text."
    },
    {
      "severity": "should",
      "rule_id": null,
      "file": "frontend/src/ui/RangeMessage.vue",
      "line": 52,
      "problem": "The rule that turns Edit and Delete off (a send running, then the AI running in the thread) is decided inside the component and has no node test. Post's matching rule lives in `rangeGitLab.postButton` and is tested. A second place that offers Edit/Delete (a key or a menu) would copy the rule.",
      "fix": "Move it into a pure `noteChangeBlock(sending, threadAi): NoteChangeBlock | null` next to `isChangeable`, add a node test for its order, and have RangeMessage call it."
    },
    {
      "severity": "should",
      "rule_id": null,
      "file": "frontend/src/ui/RangeMessage.vue",
      "line": 47,
      "problem": "`editing` means the Post editor is open, while `editText`/`startEdit`/`saveEdit`/`cancelEdit` refer to the new Edit box. `post.action === \"edit\"` (line 74) also opens the Post editor. A reader has to trace each name to tell the two boxes apart, and that gets worse with every feature added to either box.",
      "fix": "Rename `editing` to `postOpen`. Separately, ask the orchestrator to rename `PostAction` `\"edit\"` to `\"write\"` in rangeGitLab.ts, which is outside this slice's Owned set."
    }
  ],
  "checked": [
    "Contract: `ReviewSource.editNote(message, text)` / `deleteMessage(message)` match the brief (ReviewSource.ts:11-12); tauriReview.ts:27-32 calls `commands.editNote`/`deleteMessage` through the existing `converted(toResult(...), toThreadList)` path, and failures come back unchanged (tauriReview.test.ts:214-215).",
    "fixtureReview.ts `unsentNote` + `editNote` check in the same order as the Rust command: send guard first, then thread_store.rs `shown_message_mut` → `require_unsent_note` (NotANote, then MessagePending) → `require_text`. An edit of a queued/refused note becomes `queued` with the new text (fixtureReview.ts:162-164 matches thread_store.rs:162-166). A delete removes the note and any emptied thread; ids are not reused (`next` counters untouched).",
    "Question: `{ kind: \"deleteNote\" }` → \"Delete Comment / Delete this comment? / Delete / Cancel\"; `endsWithStop` is false and the switch stays exhaustive (question.ts:88, 152-159, 278).",
    "problemText: `NotANote` has a fixed reason, and `ThreadStep` gains edit/delete (problem.ts:29-30, granted mid-run). The `Record<ThreadStep,…>` type keeps it exhaustive.",
    "Edit/Post exclusivity has a single writer: rangeDrafts.ts `openMessageBox` (line 75) is the only place either draft is written open, and each write drops the other.",
    "Deviation accepted: the delete question is asked in `rangeStore.deleteNote`, through the store's `asking`, the same way `mayClose`/`aiMayClose` ask. rangeThreads only calls Rust, so the question is asked in one place.",
    "Deviation accepted: `setList` (rangeThreads.ts:94) prunes the open set and drafts (`keepStored`) on every reply. It is the single writer for both after a reply, so send replies also drop state for threads that are gone.",
    "Deviation accepted: edit drafts live in rangeDrafts beside the Post drafts, which is the existing pattern for surviving a collapse or eviction. Save is also off during a send or AI turn, which matches the Rust guard.",
    "Deviation noted: the conflict between plan #123 and the brief does not exist. #123 also says Edit opens \"in its place\", so following the brief is correct.",
    "Fences: the new ui code imports only `../ipc` (index) and sibling ui modules; no `@tauri-apps`, `@codemirror` or `editor/internal` (PM2/PM5); ipc stays framework-free (PM3).",
    "The AI-running block uses `threadAi.running !== null`. That matches the brief's fact, and rangeAi.ts:16 says `running` stays set until the answer is recorded.",
    "Ownership: every file in the implementer's files_changed list is in Owned or was granted (problem.ts/problem.test.ts); RangeThreadBox/rangeAi/reviewDomain/ipc index are unchanged. bindings.ts was not hand-edited.",
    "Docs: ui/AGENTS.md:9 and ipc/AGENTS.md:7 describe the rule; CHANGELOG.md:23 already has the entry. The architecture.md lines 555/560/564 and ipc-contract SKILL.md:81 lines listed in the deviations must be applied by the orchestrator before `just map-check` can pass.",
    "Open risk accepted: rangeThreads.ts and fixtureReview.ts are at 298/300 lines, which oxlint `max-lines` 300 (.oxlintrc.json:53) enforces, so the next addition must split. The first block's fix goes into rangeDrafts.ts, which has room.",
    "Open risk accepted: focus after a confirmed delete. QuestionDialog.vue sends focus back nowhere for any question (only `autofocus` on confirm), so this is the window-wide behaviour and outside this slice; Behaviour 2 sets a focus target only for Edit.",
    "Comments: the `///`/`/** */` one-liners on `isChangeable`, `openMessageBox`, `keepStored`, `editNote`, `deleteNote` and `NoteChangeBlock` state what each item is, with the plan row (CP2). No narration and no TODOs.",
    "I ran no gate or test (RV6)."
  ]
}
```