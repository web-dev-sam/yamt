# MrLinksPageBoundary

Agent output (`agent://MrLinksPageBoundary`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-03T21-08-17-015Z_01a1a33d-c5f7-7658-b66f-85ea275269a1/MrLinksPageBoundary.md), collected 2026-11-04T02:24:38.155Z.

{
  "verdict": "pass",
  "checked": [
    "Only the 5 Owned files change. State is reached only via useMergeRequests() and ./mergeRequestLinks (PM10). No window root, lsp/, @tauri-apps or ipc internal import; no title/href/v-html.",
    "Contract matches the brief: exact constants and types, linkBox, parentTooltip, and linksFailedText from glab.ts atoms plus problemText step links. The row's w-7 span sits after info, before CI, always rendered.",
    "Box follows MergeRequestDiscussions.vue:96-167: same useHoverBox wiring, data-row-control, @click.stop, classes and status styling. Ternaries one level deep (VU6), VU2 order ok, VU15 reason given.",
    "Growth check: words and rules only in mergeRequestLinkLines.ts, layout and hover in the .vue; no new state or writer. The retry() comment cites the HTML focus-fixup rule (CP1 ok).",
    "Accepted: Escape is handled by useHoverBox's preventDefault; TIMED_OUT wording; Light set via Settings; tree.md/state.md left to the docs keeper; focus kept after a click (discussions rule).",
    "Plan #176/#177 are still proposals, so the orchestrator records them. No §2 row contradicted: #174 puts info between approvals and CI, and links come after info."
  ],
  "findings": [
    {
      "file": "frontend/src/ui/mergeRequestLinkLines.ts",
      "line": 107,
      "severity": "should",
      "rule_id": "promote",
      "problem": "linksFailedText's glabMissing and notLoggedIn sentences repeat descriptionRefusalText (mergeRequestDescriptionText.ts:19-21) word for word; the log and list texts are variants of the same pattern. The design (§4 item 12) calls them 'the glab words the other boxes use'. Changing that advice means editing every copy, and the next Retry box will copy it again. Accepting the open risk as this finding.",
      "fix": "Follow-up outside this slice's Owned files: add `glabRetryText(reply)` to ui/glab.ts for the two Retry sentences, called by both descriptionRefusalText and linksFailedText; each keeps its own 'Could not read the …' case."
    },
    {
      "file": "frontend/src/ui/MergeRequestLinks.vue",
      "line": 49,
      "severity": "should",
      "rule_id": "promote",
      "problem": "This is the second hover box with its own fix for a focused control vanishing without focusout (MergeRequestPeople.vue:181-189 keepFocusInBox is the first). The 'move focus to the box first' rule lives in each component, not in useHoverBox, so the next box with a vanishing button will leave itself held open until someone rediscovers it.",
      "fix": "Follow-up: give useHoverBox one exported way to keep focus inside before a control is removed (e.g. `keepFocus()` returning `box.focus()`), used by MergeRequestPeople and MergeRequestLinks."
    },
    {
      "file": "frontend/src/ui/AGENTS.md",
      "line": 71,
      "severity": "should",
      "problem": "The description paragraph in this Owned file still puts the info column 'between the approvals and the CI box'. Line 73 says the links column now sits between the info column and the CI box, so the two paragraphs contradict each other. Left as is, a reader of the module guide cannot tell where the columns go.",
      "fix": "In line 71, change 'between the approvals and the CI box' to 'between the approvals and the links column'."
    },
    {
      "file": "frontend/src/ui/MergeRequestLinks.vue",
      "line": 110,
      "severity": "should",
      "problem": "A line button's accessible name runs its spans together ('#12Snooze a reminder', 'Old boardClosed', per the implementer's WebDriver open risk), so a screen reader reads glued words. The discussions lines have the same shape, so fixing it only here splits the convention; nothing else gets harder as the app grows.",
      "fix": "Put a `{{ \" \" }}` text node between the reference, title and Closed/Not-found spans (gap-2 keeps the visual spacing), and do the same in the discussions box in a follow-up."
    },
    {
      "file": "frontend/src/ui/MergeRequestLinks.vue",
      "line": 56,
      "severity": "nit",
      "problem": "openLink is a pass-through to openPage(\"link\", page) with no rule of its own (the discussions wrapper exists only for its null page). Nothing gets harder if it stays.",
      "fix": "Call `openPage('link', line.page)` / `openPage('link', line.parent.page)` directly in the two @click handlers and delete openLink and the WebPage import."
    }
  ]
}
