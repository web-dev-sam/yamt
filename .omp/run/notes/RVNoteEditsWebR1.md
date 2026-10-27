# RVNoteEditsWebR1 — note edits window fix round 1 (web-impl, 6m25s)

Verbatim output:

All six blocks from round 1 are fixed and every listed frontend command passes. `RangePostEditor.vue` is now `RangeMessageEditor.vue` (old file deleted), so the project map needs updating.

```
summary
  RangeMessageEditor.vue is the one in-place editor for Post and Edit: props { message, box: "post"|"edit",
  offTitle: string|null }, emits submit/cancel. It sets the field label and button word for each box, keeps
  the button off when the text is blank or offTitle is set, and focuses its field on mount.
  noteChange.ts holds `isChangeable` (moved out of rangeThreads), `NoteChangeBlock` (moved out of rangeThreadText)
  and the new pure `noteChangeBlock(sending, aiTurn)`. rangeDrafts drops an `edit` draft once its note is no longer
  changeable. RangeMessage shows the Edit box only while the note is changeable. Renames: `editing` → `postOpen`,
  PostAction "edit" → "write".

files_changed
  frontend/src/ui/noteChange.ts (new)
  frontend/src/ui/noteChange.test.ts (new)
  frontend/src/ui/RangeMessageEditor.vue (new; replaces RangePostEditor.vue)
  frontend/src/ui/RangePostEditor.vue (deleted)
  frontend/src/ui/RangeMessage.vue
  frontend/src/ui/rangeDrafts.ts
  frontend/src/ui/rangeThreads.ts (298 → 292 lines)
  frontend/src/ui/rangeThreads.test.ts
  frontend/src/ui/rangeGitLab.ts
  frontend/src/ui/rangeGitLab.test.ts
  frontend/src/ui/rangeThreadText.ts
  frontend/src/ui/AGENTS.md

tests_added
  rangeThreads.test "an Edit box on a note a send made pending closes; one on a note still unsent stays" (#1645/#1647):
    `replace` with a list where thread 0's queued note is pending → its editDraft is null; thread 3's unsent note
    keeps "still mine".
  rangeThreads.test "each message keeps its own Edit text; a Post on one leaves the other's Edit alone" (#1648):
    writeEdit on thread 0's and thread 3's notes → each returns its own text; writePost on the first → the second
    stays "second". This targets the shared `editKey` survivor.
  rangeThreads.test "deleting a thread's last note…" extended (#1649): a Post draft on thread 3's AI answer and an Edit
    draft on thread 3's note (2 messages) both survive the delete. This targets the `some` → `every` survivor.
  rangeThreads.test "replace mirrors a send's list and drops the Post box of a message it no longer holds"
    (the reviewer's `case "post"` should-finding): postDraft is null after the replace.
  noteChange.test "a running send blocks Edit and Delete first, then the thread's AI turn" (#1650): all four
    combinations; with both a send and an AI turn the answer is "sending".
  rangeGitLab.test: two expectations changed for the rename "edit" → "write" (#1651).

smoke_evidence
  pnpm -C frontend typecheck → "$ vue-tsc -b", exit 0
  pnpm -C frontend lint → "$ oxlint --type-aware && eslint --max-warnings 0 "src/**/*.vue"", no findings
  pnpm -C frontend test → "Test Files  198 passed (198) / Tests  2711 passed (2711)"
  pnpm -C frontend fmt:check → "All matched files use the correct format."
  pnpm -C frontend unused → "$ knip --include exports,types", no findings
  just sfc-order → "$ tsx scripts/check-sfc-order.ts", exit 0
  (just map-check → "map-check: ok")
  WebKit MiniBrowser via `just app-session start-fixture --name r1 --range-case review --threads seeded --gitlab linedUp`
  (the documented `--gitlab` script name; the brief writes `linedUp`), src/board/board.ts, threads opened:
    Edit on the queued note "Why does the overdue check go?":
      focus → {"value":"TEXTAREA Comment text value=Why does the overdue check go?"}
      Ctrl+A Backspace → {"value":"Save disabled=true"}; Ctrl+Enter on blank → focus stays "Comment text"
      Escape → {"value":"BUTTON:Edit boxes=3"} (box closed, focus on Edit)
      screenshot /tmp/r1-edit.png: rows 4, bg-panel-inline field, Save + Cancel
    Post on the unqueued "This needs a test.":
      focus → {"value":"TEXTAREA Text to post value=This needs a test."}
      Ctrl+A Backspace → {"value":"Queue disabled=true"}; Escape → {"value":"BUTTON:Post"}
      Enter on Post → field focused; Ctrl+Enter → {"value":"BUTTON:Unqueue"}
      screenshot /tmp/r1-post.png: same box as Edit (Queue + Cancel)
    Edit open on the queued note (text "…go? Still?"), then "Send to GitLab (2)":
      textareas after → "Reply… | Reply… | Reply…" (no edit box); buttons "Post | Copy" ×3, no Edit/Delete
      screenshot /tmp/r1-sent.png: notice "2 sent, 0 refused"; the note reads "Pending on GitLab" with Post off,
      the link and Copy
  The screenshots are in /tmp (VF9 page shots), not in the repository. Session stopped.

deviations_from_brief
  - Renamed RangePostEditor.vue → RangeMessageEditor.vue and deleted the old file. Orchestrator: update
    .omp/skills/project-map/SKILL.md:207 "RangeMessage + RangePostEditor" → "RangeMessage + RangeMessageEditor (the
    in-place Post/Edit editor) + noteChange.ts (isChangeable, noteChangeBlock)". map-check passes without this.
  - noteChange.ts has no "range" prefix even though ui/AGENTS.md:5 says every range-only file carries one; the brief
    names the file, so I kept that name. Its imports are type-only (../agent TurnView, ../ipc). fences.ts treats it as
    a shared file, which raises no violation.
  - `noteChangeBlock(sending: SendProgress | null, aiTurn: TurnView | null)` takes the thread's running turn rather than
    ThreadAi, so noteChange.ts does not import rangeAi.ts (which imports rangeThreads → rangeDrafts → noteChange, a
    cycle).
  - `NoteChangeBlock` moved from rangeThreadText.ts to noteChange.ts, next to its rule; rangeThreadText imports the type.
  - The single editor keeps one look and behaviour: rows 4, bg-panel-inline, the submit button inside a title span
    with disabled:pointer-events-none, and `@mousedown.prevent` on submit (as the reply's Comment has). This changes
    the old Edit box's look (rows 3, bg-panel) and gives Post's Queue the mousedown and title span.
  - startEdit no longer focuses through `focusLater`; the editor focuses itself on mount, so both boxes focus the
    same way. saveEdit does not check the block again: the editor emits submit only when it is not off.
  - The isChangeable test stays in rangeThreads.test.ts (it uses the seeded fixture) and now imports from noteChange.
  - Rewrote the first part of ui/AGENTS.md:7 and :9 for the shared editor, `write`, noteChange.ts and the
    pending-drop rule.

open_risks
  - frontend/src/ui/RangeMessage.vue:128-143: the two RangeMessageEditor branches rely on Vue 3 giving v-if and
    v-else-if branches separate keys, so focus-on-mount runs again when one box opens after the other. A direct
    Post↔Edit switch is not possible today: both buttons are hidden while either box is open.
  - When a Send closes an open Edit box, focus inside that box goes to <body>; nothing is focused instead. The brief
    does not ask for it; the delete-focus finding from the earlier review is still open the same way.
  - Mutation run not done (`just mutants` is the orchestrator's). The new tests are written to kill the survivors at
    rangeDrafts.ts:60-61 (editKey), :95 (some → every), :93 (`case "post"`) and the new isChangeable check in the
    `edit` case.
```