# RVNoteEditsWebCorrect — review of f3eb9a4

Verbatim output:

```json
{
  "verdict": "fail",
  "findings": [
    {
      "severity": "block",
      "rule_id": "plan#123",
      "file": "frontend/src/ui/RangeMessage.vue",
      "line": 162,
      "problem": "If a user opens Edit on a queued note and then presses Send (the Send button does not check for open edit boxes), the reply turns the note `pending`. `keepStored` keeps the edit draft because the message is still in the list, so the edit box stays on a sent note. Its Save button turns back on (`block` is null again), and pressing it can only fail with \"Could not edit the comment: that message is already pending on GitLab\". Plan #123 says a `Pending` note shows neither Edit nor its box.",
      "fix": "Show the edit box only while `changeable` is true (`v-else-if=\"changeable && editText !== null\"`). Have `isStored` in rangeDrafts.ts also drop an `edit` draft whose message is no longer a non-pending note. Add a rangeThreads.test.ts case: open an edit on a queued note, `replace` with a list where that note is pending, expect `editDraft` to be null."
    },
    {
      "severity": "block",
      "rule_id": "SP5",
      "file": "frontend/src/ui/rangeDrafts.ts",
      "line": 60,
      "problem": "Two survivors, :60 BlockStatement and :61 `return ``` (editKey), mean no test notices if every message shares one edit-draft key. Then a second Edit box would overwrite the first. Because `editDraft` checks only `kind`, the first box would show the second message's text, and its Save would store that text into the wrong note (and on to GitLab if the note is queued). A `writePost` on any message would also close every edit box. The brief's acceptance line asks the tests to kill the mutants on the patch's own lines.",
      "fix": "In rangeThreads.test.ts, call `writeEdit` on two messages (thread 0 and thread 3), expect each `editDraft` to return its own text, then call `writePost` on one and expect the other's `editDraft` to be unchanged."
    },
    {
      "severity": "block",
      "rule_id": "SP5",
      "file": "frontend/src/ui/rangeDrafts.ts",
      "line": 95,
      "problem": "The surviving `messages.some` → `messages.every` mutant keeps a Post or Edit draft only when its thread holds that one message. The test's kept `post-${other.id}` sits in thread 1, which has a single message, so the test cannot tell the two apart. Under that bug, any list reply (queue or unqueue elsewhere, a saved edit, an AI answer recorded, a send) silently closes an open Post box on an AI answer, or an Edit box on a note in a thread with replies, and the typed text is lost. AI answers always live in threads with at least two messages, so the Post-box case is common.",
      "fix": "In the 'deleting a thread's last note…' test (or a new one), also write a Post draft on thread 3's AI answer and an edit draft on thread 3's note before the delete, and expect both keys to remain after it."
    },
    {
      "severity": "should",
      "rule_id": "SP5",
      "file": "frontend/src/ui/rangeDrafts.ts",
      "line": 93,
      "problem": "The surviving `case \"post\"` → `case \"\"` mutant sends post drafts to the `never` arm, which returns the draft object (truthy), so a removed message's Post draft is never pruned. No test checks that pruning. No user can see this today: Delete is hidden while a message's Post box is open, and ids are never reused, so the only effect is a leaked map entry. Nothing gets harder as the app grows, unless a future path removes messages some other way.",
      "fix": "Add a `writePost` draft on a message that a test then deletes (open the box, drop it, then reopen it on another message of a deleted thread), or call `replace` with a list that lacks a post-drafted message, and expect `postDraft` to be null."
    },
    {
      "severity": "should",
      "rule_id": "plan#123",
      "file": "frontend/src/ui/RangeMessage.vue",
      "line": 150,
      "problem": "This is the implementer's open risk. After Delete is confirmed, QuestionDialog is unmounted by `v-if` with nothing to return focus to, and the pressed Delete button no longer exists. Focus falls to `<body>`, and a keyboard user loses their place in the thread. Cancel or Escape probably does the same, since the dialog never calls `close()`. Nothing gets harder as the app grows: the plan does not specify focus here, and it stays local.",
      "fix": "After `deleteNote` resolves with a delete, focus the next remaining message's Edit or Post button, or the thread box's writing area. If the thread is gone, focus the column's editor. After Cancel or Escape, focus the Delete button again."
    }
  ],
  "checked": [
    "Survivor triage: rangeDrafts.ts:89 `case \"thread\"` → `case \"\"` is dropped as VF7 (a) equivalent. The thread draft falls to the `never` default, which returns the draft object (truthy at runtime), so `filter` keeps it exactly as `return true` does.",
    "Survivors :60-61 and :95 are graded block (each hides a user-visible bug, listed above). :93 is graded should (it hides only an unreachable leak).",
    "Orchestrator drops accepted: question.ts:148-154 (module constant, words asserted in question.test.ts); rangeDrafts.ts:96 (`never` arm); rangeDrafts.ts:106 and rangeThreads.ts:97 `<` guards (both only skip writing a map or set with the same contents).",
    "`isChangeable` (`body.kind === \"note\" && posting.kind !== \"pending\"`) matches Rust's `require_unsent_note` (thread_store.rs:251). rangeThreads.test.ts covers all five seeded messages, including the pending note and the AI answer, so both conjuncts are pinned.",
    "Fixture check order matches Rust: `SendRunning` (send guard in review.rs:98/109, taken before the store), then UnknownMessage (`shown_message`), NotANote, MessagePending, then EmptyMessage for an edit (thread_store.rs:151-167). fixtureReview.test.ts:372-383 passes blank text with each earlier refusal, so a reordering would fail; :418-429 checks SendRunning before an unknown id and an AI answer.",
    "An edit of a queued or refused note becomes `Queued { text }` with the reason dropped, in both fixture and Rust (fixtureReview.test.ts:342). An edited queued note is sent with the new text (fixtureReview.test.ts:361), and the real-app glab log in the report shows the same.",
    "A delete removes the note and an emptied thread in both fixture and Rust. Ids are not reused (fixtureReview.test.ts:398).",
    "rangeThreads: `setList` is the only writer of `list` (grep: the only other caller is `rangeGitLab.ts:170` through `replace`). It drops open ids and drafts the list no longer holds. 'deleting a thread's last note…' checks open state, `shownFor`, counts, `boxOf` null and the draft keys.",
    "Refusals: `changed` reports `{ action: \"threads\", step: \"edit\"|\"delete\", cause }` and leaves `list` as the same object (rangeThreads.test.ts 'a refused edit or delete…'). The edit draft is kept. The step words are in problemText.ts:59-60, and NotANote has its own reason at :48.",
    "A blank edit makes no call and keeps the box (rangeThreads.test.ts). Save is off when blank, during a send and during the thread's AI turn (RangeMessage.vue `saveOff`). Ctrl/Cmd+Enter goes through `saveEdit`, so it obeys the same rule.",
    "Box keys: the edit textarea uses `boxKeydown` (rangeKeys.ts: Mod-Enter saves, Escape cancels, both preventDefault and stopPropagation), the same as the existing thread and Post boxes (RK35). Focus goes to the textarea on open and to Edit after a save or cancel, through `focusLater`. RangeMessage is keyed by `message.id` (RangeThreadBox.vue:189), so the ref survives `replace`.",
    "Edit and Post are never open at once: `openMessageBox` deletes the other key (rangeThreads.test.ts 'a message's Edit and Post boxes…'), and the template hides Post, Edit and Delete while either box is open.",
    "The delete question is asked once through `asking` (rangeStore.ts `deleteNote`): a second ask while one is waiting answers dismissed. rangeStore.test.ts covers Cancel, Escape (dismiss) and Delete, plus the emptied thread's count. QuestionDialog autofocuses Delete as plan #123 asks.",
    "Both buttons are off with a reason while `gitlab.sending !== null` or the thread's `ai.running !== null`; the titles are in rangeThreadText.ts:47-64 and tested in rangeThreadText.test.ts.",
    "The AI's prompt rule (rangeAi.ts:110, the notes after the session's last answer) is positional, so editing or deleting an earlier note does not resend it, as plan #123 says ('the AI's conversation is not changed').",
    "tauriReview: editNote and deleteMessage pass their arguments and camelCase the list (tauriReview.test.ts:150-164); NotANote and SendRunning failures come back unchanged (:214-215).",
    "Docs: architecture.md:537,557,567, ipc-contract SKILL.md:82 and CHANGELOG.md:23 name the commands and the rule.",
    "No tests were run; every finding comes from reading the code and the survivors file."
  ]
}
```