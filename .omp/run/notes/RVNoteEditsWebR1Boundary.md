# RVNoteEditsWebR1Boundary — re-check of 663e99d

Verbatim output:

```json
{
  "verdict": "pass",
  "items": [
    {
      "id": "#1645 Edit box on a sent note",
      "status": "fixed",
      "evidence": "rangeDrafts.ts:101-104: `isStored`'s `edit` case keeps a draft only when `isChangeable(message)` is true, so `keepStored` drops the Edit draft once a reply makes the note pending. RangeMessage.vue:44: `editOpen = changeable && editDraft !== null`, so the box shows only while the note is changeable. In the template, the Edit/Delete buttons are inside `v-if=\"changeable\"` (RangeMessage.vue:168). Test: rangeThreads.test.ts:621-643 calls `replace` with thread 0's note pending, which gives editDraft null, while the unsent note on thread 3 keeps \"still mine\"."
    },
    {
      "id": "#1646 one in-place editor for Post and Edit",
      "status": "fixed",
      "evidence": "RangeMessageEditor.vue is the only editor. Props are `{ message, box: \"post\"|\"edit\", offTitle }` (:18). It reads and writes the draft its `box` names (:29-33, :43-52), takes words from the `WORDS` table (:21-24), keeps submit off when the text is blank or `offTitle` is set (:34), focuses on mount (:37-39), and emits submit/cancel. RangeMessage.vue:128-143 only switches between the two editor branches and the message text. A grep for `RangePostEditor` across frontend/, docs/ and .omp/skills finds no hits outside .omp/run history. project-map SKILL.md:207 and ui/AGENTS.md:7 name RangeMessageEditor."
    },
    {
      "id": "#1650 pure noteChangeBlock",
      "status": "fixed",
      "evidence": "noteChange.ts:12-20 defines `noteChangeBlock(sending, aiTurn)`, which checks sending first and then aiTurn, next to `isChangeable` (:8-10). noteChange.test.ts:8-13 covers all four combinations, including sending+AI giving \"sending\". RangeMessage.vue:45-47 calls it for Edit, Delete (:173, :183 `block !== null`) and Save (`saveOffTitle` :50 → editor `offTitle` :140). The rule has one copy."
    },
    {
      "id": "#1651 renames",
      "status": "fixed",
      "evidence": "RangeMessage.vue:40 `postOpen` (no `editing` left). rangeGitLab.ts:35 `PostAction = \"write\" | \"unqueue\"` and :117 `action: \"write\"`. RangeMessage.vue:61 `case \"write\"`. rangeGitLab.test.ts:191 and :250 were updated, and ui/AGENTS.md:7 says `write`."
    }
  ],
  "findings": [],
  "checked": [
    "#1648/#1649 tests exist: rangeThreads.test.ts:608-619 gives each message its own Edit text, and a writePost on one message leaves the other's Edit draft alone. The delete test at :658 was extended so Post and Edit drafts on a thread with several messages survive (from the implementer's report; the test is in the file).",
    "No second Edit/Post rule: `isChangeable` was moved, not copied. rangeThreads.ts no longer defines it, and rangeThreads.test.ts:15 imports it from noteChange. `NoteChangeBlock` is defined only in noteChange.ts:5, and rangeThreadText.ts:11 imports it as a type only, with no re-export.",
    "Import edges: noteChange.ts imports only types from `../agent` (TurnView) and `../ipc`. rangeDrafts.ts:12 → noteChange removes the rangeDrafts → rangeThreads edge. noteChangeBlock taking `TurnView | null` instead of ThreadAi avoids the rangeAi → rangeThreads → rangeDrafts → noteChange cycle. Deviation accepted.",
    "Deviation accepted, though it leaves a gap: the brief named `noteChange.ts`, so it has no `range` prefix. That puts it outside fences.ts:62 `WINDOW_FILE`, so PM9 does not check it. No edge it has today breaks PM9 (type-only ../agent and ../ipc, no root file), which is below the RV8 block bar. Renaming it `rangeNoteChange.ts` would bring it under the fence if the orchestrator wants that.",
    "Growth: RangeMessageEditor has one job (one draft's text box). RangeMessage lost the inline editor state, keys and focus-on-open, and now holds display, buttons and the focus after Save/Cancel/Queue. Draft state still has one owner, rangeDrafts (`openMessageBox` :78 remains the single writer that keeps Post and Edit exclusive).",
    "Behaviour change to Post's Queue, accepted: it gains a title span and `@mousedown.prevent`, and its `offTitle` is null. The old RangePostEditor (RVThreadBoxesR1.patch) had no send-time off state either, so Post's off rule is unchanged (blank only).",
    "VU2 section order in RangeMessageEditor.vue: imports, a local type, props/emits, a constant, template ref, store, computed, onMounted, functions. `just sfc-order` passed in the implementer's run; I did not re-run it.",
    "Comments: the `/** */` lines on `NoteChangeBlock`, `isChangeable` and `keepStored` say what each item is (CP2). No narration and no TODOs.",
    "rangeThreads.ts stays under the 300-line cap (292, per the implementer, from the shrink after `isChangeable` moved out).",
    "I ran no gate or test (RV6)."
  ]
}
```