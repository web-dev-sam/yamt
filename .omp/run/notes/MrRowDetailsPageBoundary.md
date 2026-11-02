# MrRowDetailsPageBoundary

Agent output (`agent://MrRowDetailsPageBoundary`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-02T19-44-30-486Z_01a19dca-b716-72dc-ab4f-c92917fdd42d/MrRowDetailsPageBoundary.md), collected 2026-11-02T21:21:48.274Z.

{
  "verdict": "fail",
  "checked": [
    "Fences PM2/PM3/PM5/PM10: the new MergeRequest*.vue files import only ../ipc, the ../mergeRequests index, ./tooltip, ./useHoverBox, ./useMenuPlacement and ./mergeRequests types. No window root, lsp/, internal/ or @tauri.",
    "Ownership and contract: all 14 touched files are Owned. The props and emits of Picture, People, Labels, DueDate, Row and Filter match the brief. The exposed `narrowBox` is add-only (accepted). VU15 reasons given.",
    "Handed to the docs keeper (accepted): tree.md rows for the 4 new files and state.md row 68 (`toggle`→`click`). The AGENTS.md `click` claim matches mergeRequestFilters.ts.",
    "Grep `\\s:?title=` over ui/MergeRequest*.vue and CiStatus*.vue finds 0. mergeRequestTitles.test.ts globs the files from disk and has a failing path. CiStatusBox's hand-rolled show/hide/scroll code is deleted (now useHoverBox).",
    "No copied words or rules: rerequestReplyText reuses the list's sentences through the extracted helpers. Core supplies displayName/initials/pictureHue/approversText/labelsShown. No comments were added.",
    "Open risks accepted: blur saving a typed date (request rule 6 has no cancel rule; Escape cancels); focus back to the opener only from body; hue-rotate contrast (left to the verifier's shots)."
  ],
  "findings": [
    {
      "file": "frontend/src/ui/MergeRequestPeople.vue",
      "line": 61,
      "severity": "block",
      "rule_id": "PM-vision-2",
      "problem": "Deviation not accepted. The UI re-keys people by username after core `peopleStack` narrows them to the core Person. This copies the stack's identity rule (core's `assigned` set), and `?? []` silently drops anyone the two disagree on. Every later caller that needs a domain field (picture) must repeat the join.",
      "fix": "In a core follow-up, make `peopleStack<P extends Person>(assignees: readonly P[], reviewers: readonly { readonly person: P }[])`, as `labelsShown<L>` already is. Then use `stack.shown` directly and delete the Map and the flatMap."
    },
    {
      "file": "frontend/src/ui/MergeRequestDueDate.vue",
      "line": 27,
      "severity": "block",
      "problem": "The date box is `position: fixed` at coordinates taken once at open, and nothing closes it on scroll. Scrolling the list leaves the box floating over another row. The page's other boxes (CI, people, labels via useHoverBox) close on any scroll outside them.",
      "fix": "Close the box on a scroll outside it. Share useHoverBox's capture-phase scroll rule (extract it, now with two users) rather than adding a third hand-rolled copy."
    },
    {
      "file": "frontend/src/ui/MergeRequestLabels.vue",
      "line": 55,
      "severity": "nit",
      "problem": "MergeRequestLabels, MergeRequestPeople (112) and CiStatusBox (65) each repeat five `@pointerenter=\"on.pointerenter\"`… bindings. Each new hover box adds five more lines to keep in sync if `HoverBox.on` gains an event; nothing else gets harder.",
      "fix": "Bind the whole object with `v-on=\"on\"` on each area span."
    }
  ]
}
