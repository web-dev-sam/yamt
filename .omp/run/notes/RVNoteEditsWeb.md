# RVNoteEditsWeb — note edits, window (web-impl, 16m13s)

Verbatim output:

Edit and Delete now work on your own unsent notes in the range window, through both the Tauri and the fixture review source. All four frontend commands pass, and the fixture-page and real-app checks were run. `just map-check` still fails: `docs/architecture.md` and the ipc-contract skill don't name the two new commands yet, and those files are yours to change (exact lines below).

```
summary
  ReviewSource gains editNote/deleteMessage (tauriReview through commands.editNote/deleteMessage; fixtureReview follows
  Rust's rules and order, including SendRunning while its send runs). rangeThreads gains editNote/deleteMessage, the
  isChangeable rule and one setList that drops the open state and drafts of threads and messages a reply no longer
  holds; rangeDrafts gains an `edit` draft that can never be open together with the message's `post` draft.
  rangeStore.deleteNote asks the new `deleteNote` question first. RangeMessage shows Edit/Delete on a note that is not
  pending, edits in place (Ctrl/Cmd+Enter saves, Escape cancels, focus back to Edit), and turns both off with a hover
  text while a send runs or the AI works in that thread. problemText gives a reason for NotANote; ThreadStep gains
  edit/delete.

files_changed
  frontend/src/ipc/ReviewSource.ts
  frontend/src/ipc/tauriReview.ts
  frontend/src/ipc/tauriReview.test.ts
  frontend/src/ipc/fixtureReview.ts
  frontend/src/ipc/fixtureReview.test.ts
  frontend/src/ipc/AGENTS.md
  frontend/src/ui/problem.ts            (granted by Main mid-run)
  frontend/src/ui/problemText.ts
  frontend/src/ui/problemText.test.ts
  frontend/src/ui/question.ts
  frontend/src/ui/question.test.ts
  frontend/src/ui/rangeDrafts.ts
  frontend/src/ui/rangeThreads.ts
  frontend/src/ui/rangeThreads.test.ts
  frontend/src/ui/rangeThreadText.ts
  frontend/src/ui/rangeThreadText.test.ts
  frontend/src/ui/rangeStore.ts
  frontend/src/ui/rangeStore.test.ts
  frontend/src/ui/RangeMessage.vue
  frontend/src/ui/AGENTS.md

tests_added
  fixtureReview.test.ts:
    "editNote replaces a note's text and leaves a note that waits for nothing unqueued"
    "editNote keeps a queued or refused note waiting with the new text, the refusal's reason dropped"
    "an edited queued note is sent with its new text"
    "editNote refuses {an AI answer|a pending note|an unknown message|a blank text} in Rust's order and changes nothing"
    "deleteMessage removes a note and keeps its thread while a message is left"
    "deleting a thread's only note removes the thread, and ids are not reused"
    "deleteMessage refuses {an AI answer|a pending note|an unknown message} and changes nothing"
    "editNote and deleteMessage answer SendRunning while a send runs, before any other check"
  tauriReview.test.ts: editNote/deleteMessage pass their arguments and camelCase the list (in "each thread command…");
    a NotANote / SendRunning failure comes back unchanged (in the test.each of failures)
  rangeThreads.test.ts:
    "your notes not yet on GitLab can change; a pending note and an AI answer cannot"
    "an edit stores the new text, closes its box and keeps a queued note queued with that text"
    "a blank edit makes no call and keeps its box open"
    "a refused edit or delete is reported, changes nothing and keeps the edit box"
    "a message's Edit and Post boxes are never open at once"
    "deleting a note keeps a thread that still has a message"
    "deleting a thread's last note removes the thread, its line, its count, its open state and its drafts"
  rangeStore.test.ts: "deleteNote asks first: Cancel and Escape keep the note, Delete removes it and its emptied thread"
  question.test.ts: "deleting a note asks GitLab's question, Delete or Cancel, and never ends with a stop"
  problemText.test.ts: NotANote's fixed reason; the edit/delete step words
  rangeThreadText.test.ts: noteChangeTitle for edit/delete × on/sending/aiWorking

smoke_evidence
  pnpm -C frontend typecheck → "$ vue-tsc -b", exit 0
  pnpm -C frontend lint      → "$ oxlint --type-aware && eslint --max-warnings 0 "src/**/*.vue"", no findings
  pnpm -C frontend fmt:check → "All matched files use the correct format."
  pnpm -C frontend test      → "Test Files  197 passed (197)  Tests  2708 passed (2708)"
  (also: pnpm -C frontend unused → no findings; just sfc-order → no findings)

  WebKit fixture page (MiniBrowser, `just app-session start-fixture --range-case review --threads seeded --gitlab … --ai`)
  dark (the default theme):
    - Opened threads, buttons per box: ":6: Post(off),Copy | :20: Unqueue,Edit,Delete | :21: Unqueue,Edit,Delete";
      AI thread :102: "Post,Edit,Delete ## Thinking and steps,Post". The pending note and the AI answer have no Edit/Delete.
    - Edit on the queued :20 → focus in "Comment text" with value "Why does the overdue check go?"; typed, Ctrl+Enter →
      focus "Edit", box reads "Why is the overdue check gone? / Unqueue / Edit / Delete / Queued for GitLab".
    - Edit on the refused :21, emptied → Save disabled:true; Ctrl+Enter does nothing (value "" stays); Escape → focus
      "Edit", text unchanged. (An earlier pass that saved "This needs a test" showed the refused note become
      "Queued for GitLab" with its reason gone.)
    - During Send: Edit and Delete disabled, titles "Comments cannot be edited/deleted while a send to GitLab runs";
      after it, every box shows "Post / Pending on GitLab", with no Edit/Delete.
    - During an AI turn in :102: "Edit(off: Comments cannot be edited while the AI works in this thread),Delete(off: …)";
      after the turn: "Edit,Delete" are on again.
    - Delete on the reply "And now?" → dialog "Delete Comment / Delete this comment? / Delete / Cancel", focus "Delete";
      Cancel keeps it; Escape keeps it; Delete (Enter) removes it, and the AI answers stay.
  light (Settings → Light, data-theme="light"):
    - Edit on :20 via the Save button → "Light: why is the check gone? … Queued for GitLab", focus "Edit".
    - Delete on :21 (the thread's only note): Cancel keeps it (marks ["61","201","211"], row "src/board/board.ts 4");
      Delete → sections [":6", ":20"], marks ["61","201"], row "M src/board/board.ts 3 +44 −21", "Send to GitLab (1)".
    - During Send: both off with the sending title; afterwards :20 reads "Light: why is the check gone? / Post /
      Pending on GitLab".
    - During an AI turn in :102: "Stop,Edit(off: …while the AI works in this thread),Delete(off: …)" on both notes.
  The fixture page does not show a posted text, so "the sent text is the new one" is checked by the node test
  "an edited queued note is sent with its new text" and in the real app below.
  Screenshots: /tmp/rvweb/02-dark-threads.png, 03-dark-editing.png, 04-dark-sending.png, 06-dark-ai-turn.png,
  07-dark-delete-question.png, 10-light-editing.png, 11-light-delete-question.png, 12-light-thread-gone.png,
  13-light-sending.png, 14-light-ai-turn.png

  Real app (`cargo tauri build --debug --no-bundle`; `just app-session start-app --range main...feature
  --repo /tmp/yamt-test-rv-range --glab lined-up --home /tmp/yamt-test-rv-home`):
    - Added two threads; threads.json held id 1 "First draft text" and id 2 "Second thread, to delete".
    - Edit thread 1 → "Edited in the real app". Delete thread 2 → dialog "Delete Comment / Delete this comment? /
      Delete / Cancel", Enter → sections ["src/board/board.ts:8: Edited in the real app"], row "src/board/board.ts 1".
    - threads.json afterwards: one thread, id 1, body "Edited in the real app", "nextThread": 3, "nextMessage": 3.
    - Post → Queue, then Edit to "Queued, then edited", then Send → fake glab calls.log:
      stdin: {"note":"Queued, then edited","position":{…"new_line":8,"new_path":"src/board/board.ts"…}}
    - Reopened with the same home: row "M src/board/board.ts 1 +44 −21"; the thread reads "Queued, then edited /
      Post / Pending on GitLab / <link> / Copy" (no Edit/Delete); threads.json keeps the one thread, posting
      "pending" with the text "Queued, then edited".
  Screenshots: /tmp/rvweb/21-app-delete-question.png, 22-app-after.png, 23-app-reopened.png

deviations_from_brief
  - Main gave me ui/problem.ts and problem.test.ts mid-run: ThreadStep gains "edit" | "delete" ("Could not edit the
    comment" / "Could not delete the comment").
  - Design choices the brief left open:
    - The delete question is asked in rangeStore.deleteNote; rangeThreads.deleteMessage only calls Rust.
    - Pruning on every list reply (setList) instead of only after a delete.
    - Edit drafts live in rangeDrafts like Post drafts, so a half-done edit survives a collapse.
    - Save is also off while a send or AI turn runs.
    - The edit box is written inline in RangeMessage.vue (no new component, VU15).
  - Plan #123 says Edit opens "the thread's writing box"; the brief says "turns the message into a writing box". I
    followed the brief: the box opens in the message's place.
  - Not changed (no change needed): RangeThreadBox.vue, rangeAi.ts, reviewDomain.ts, ipc/index.ts.
  - Docs that are not mine — `just map-check` fails today with:
      command edit_note / delete_message (not in docs/architecture.md, not in .omp/skills/ipc-contract/SKILL.md)
      ReviewSource.editNote / ReviewSource.deleteMessage (not in docs/architecture.md)
    Lines needed:
      docs/architecture.md:555  "`queue_message`, `unqueue_message`, `edit_note`, `delete_message` (both take the send
                                 guard, #123), `set_thread_session`, …"
      docs/architecture.md:560  IpcError list gains `NotANote`
      docs/architecture.md:564  "`queueMessage(message, text)`, `unqueueMessage(message)`, `editNote(message, text)`,
                                 `deleteMessage(message)`, `setThreadSession(thread, session)`, …"
      .omp/skills/ipc-contract/SKILL.md:81  "… / unqueue_message(message) / edit_note(message, text) /
                                 delete_message(message) -> ThreadList"
      CHANGELOG.md (not in my Owned set): "Range window: your own comments can be edited or deleted until they are
                                 sent to GitLab (#123)."
  - The first fixture run passed `--gitlab lined-up`; the fixture's script name is `linedUp`, so it fell back to the
    default `linedUp`. The light run used `--gitlab linedUp`.

open_risks
  - frontend/src/ui/rangeThreads.ts and frontend/src/ipc/fixtureReview.ts are 298 lines each, 2 under the 300 cap; the
    next addition to either needs a split.
  - frontend/src/ui/RangeMessage.vue: after Delete is confirmed, focus goes wherever QuestionDialog returns it; the
    deleted message's buttons are gone, and nothing sets a target.
  - Stryker (`just mutants`) was not run (VF7: the orchestrator runs it after the commit). Mutants on these lines are
    untested: fixtureReview.ts unsentNote's check order, rangeDrafts.ts keepStored's `kept.length <` guard,
    rangeThreads.ts setList's `open.length <` guard.
```