# MrMentionsListCorrectness

Agent output (`agent://MrMentionsListCorrectness`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-05T08-35-13-651Z_01a1aad9-0c73-75a9-824a-3dd31533fb39/MrMentionsListCorrectness.md), collected 2026-11-05T10:04:56.427Z.

{
  "verdict": "fail",
  "checked": [
    "mentionPlace hand-traced: fit, flip, larger side, tie and left clamp match brief step 4; tests pin each boundary (840/839, 220, 160/160). mentionKey tests cover every modifier, isComposing and the note-only list.",
    "mirrorStyle test kills a dropped padding or copied property. caretBox/visibleRoom no-cov accepted under the brief's DOM-only allowance (smoke step 3). wrappedIndex changes no behaviour; stepMenuItem tests untouched.",
    "Deviations accepted: insertText path (orchestrator), first-client-rect caret with half-leading, split outer/inner panel, compositionstart read, setTimeout focus read. The close() dismissal deviation is rejected (finding 2).",
    "RK73/RK35: a taken key is prevented and stopped before boxKeydown. Mod-Enter, Shift+Enter and Shift+Tab stay the field's (tested). The Escape keyup keeps the dismissal, so the second Escape closes the panel.",
    "RK53: pictures are the Person objects from rows, threads and search. Survivors 152/157/163/167/171/174/150/229/236 are listener registrations: valid VF7 (c). mr-threads graphql-people-an.json has the mr-people shape.",
    "SSR test the_reply_field_offers_mentions fails without the feature. No test run; the findings rest on reading mergeRequestPeople.ts:119-136 and mergeRequestThread.ts:188-189."
  ],
  "findings": [
    {
      "file": "frontend/src/ui/mergeRequestMentions.ts",
      "line": 98,
      "severity": "block",
      "rule_id": "RK54",
      "problem": "read() calls mentionSearch.search(typed) on every click/keyup/focus, and createPeopleSearch re-asks the same text after `refused`/`failed`. So after a failed search, each arrow or caret key starts a new glab call and blanks the note for 250 ms or more (the list closes when only the note shows). This breaks 'exactly one line per pause'.",
      "fix": "Call search only when the open word's start or typed differs from the previous state.word (or it was null), and test that a second read of the same word after `failed` asks nothing."
    },
    {
      "file": "frontend/src/ui/mergeRequestMentions.ts",
      "line": 147,
      "severity": "block",
      "problem": "close() on a send dismisses the word under the caret, and a successful send clears the text through v-model, which fires no read. Example: send `@an` with Ctrl+Enter, then type `@`. The new word starts at the dismissed offset 0, so it stays closed until a space or click. The same likely holds for another thread's text in the same field [INFERENCE].",
      "fix": "Drop `dismissed` when the field's text changes without a field event: e.g. useMentions takes the text getter, and a watch clears it when the text differs from the last read's. Pin this with a test."
    },
    {
      "file": ".omp/run/mutants/MrMentionsList.survivors.txt",
      "line": 9,
      "severity": "block",
      "rule_id": "VF7",
      "problem": "Some survivors kept as 'wiring' are branches or constants, which VF7 counts as real gaps: :187 open===null, :216 composing init, :197 the highlight-reset watch, and the blanket no-cov over read/close/shut/keydown guards. The dismissal and search-call rules that mr-mentions-post reuses are untested, and both blocks above live there.",
      "fix": "Move read/close's decision into a pure step in mergeRequestMentionLines.ts ((prev word, dismissed, read) → word, dismissed, search/end) with node tests. Keep only listener registrations as VF7 (c) survivors."
    }
  ]
}
