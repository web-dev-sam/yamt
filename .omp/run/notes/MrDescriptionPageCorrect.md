# MrDescriptionPageCorrect

Agent output (`agent://MrDescriptionPageCorrect`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-03T21-08-17-015Z_01a1a33d-c5f7-7658-b66f-85ea275269a1/MrDescriptionPageCorrect.md), collected 2026-11-04T01:02:38.434Z.

{
  "verdict": "fail",
  "checked": [
    "Close rules: close button and Escape find the opener, close, then returnFocus. onClickOutside ignores openers, so the toggle closes or replaces. No scroll handler; the view keys the panel by iid.",
    "Rule 4: links are `a role=link tabindex=0` without href (SSR test). A page link calls openPage(\"link\", WebPage) on click or Enter; a refused one has no page by type. toDescriptionReply brands http/https at every depth.",
    "Rules 5–6: upload→uploadedImage, web→its own https address, refused→caption. @error shows the caption, reset on a new address. no-referrer, interpolation only; planted test: no <script/<img/<iframe.",
    "SSR tests would fail without the feature (escaped planted text, src values, tooltips, each state's sentence and Retry). Close and focus rules: no unit test; the brief asks only for the smoke, reported in the notes.",
    "Accepted: survivor mergeRequestDescriptionText.ts:24 (VF7 a); RK67 (stale reply dropped by entry identity; onUnmounted closes); deviations IMAGE_STAND_IN, data-refreshes-list, key by iid. Not accepted: capture Escape.",
    "VueUse onClickOutside treats keyboard clicks (detail 0) as presses (@vueuse/core dist index.js:259). Read only; no test file run."
  ],
  "findings": [
    {
      "file": "frontend/src/ui/MergeRequestDescription.vue",
      "line": 36,
      "severity": "block",
      "rule_id": "R-escape-order",
      "problem": "The capture-phase Escape runs before the focused control. In the search field (reached by Shift+Tab), Escape closes the panel, moves focus to the opener and clears the search (MergeRequestSearch.vue:20 ignores defaultPrevented). A job log opened by a Shift tap over a CI box (the panel stays open) also closes (CiStatusJobLog.vue:225).",
      "fix": "Listen in the bubble phase like every other Escape handler, and have MergeRequestsView.escapePressed return while `description !== null`. The focused field or box then handles Escape first, and the panel closes only on an Escape nothing inside took."
    },
    {
      "file": "frontend/src/ipc/tauriMergeRequests.ts",
      "line": 22,
      "severity": "should",
      "rule_id": "VF7",
      "problem": "Kept survivors carry the reason \"not on my changed lines\", which is not VF7 (a), (b) or (c). One is a real gap: PICTURE_SCHEME (line 22) must equal Rust's, yet the test builds its expectation from the same constant, so any scheme passes. Each later patch touching this file meets the same unexplained survivors.",
      "fix": "Re-label each survivor by VF7: mergeRequestDomain.ts:131 as (a), the IN_APP lines in index.ts and the fixture constants by their reason. For PICTURE_SCHEME, assert the literal `yamt-picture://localhost/…` or file it against its owning slice."
    },
    {
      "file": "frontend/src/ipc/descriptionDomain.ts",
      "line": 57,
      "severity": "should",
      "rule_id": "one-source-of-truth",
      "problem": "The WebPage brand now has two makers with different rules: domain.ts isWebPage (https only, and the ipc docs say a WebPage is an https page) and isLinkedPage here (http or https). A reader looking at the brand in domain.ts would not learn that description links may be http.",
      "fix": "Put isLinkedPage next to isWebPage in domain.ts (it is at max-lines 300, so move something out to make room), or document both makers on the WebPage brand. Also have the docs keeper fix ipc/AGENTS.md:9 and :23."
    },
    {
      "file": "frontend/src/ui/MergeRequestsView.vue",
      "line": 153,
      "severity": "should",
      "rule_id": "RK67",
      "problem": "RK67 says a refresh never closes the panel, but in the UI this now holds only because the view marks its two refresh buttons `data-refreshes-list` and the panel ignores that selector. RK67's owner column does not name this and no test covers it, so a new refresh control would quietly close the panel.",
      "fix": "Have the docs keeper add `MergeRequestsView.vue` (`data-refreshes-list`, ignored by the panel's onClickOutside) to RK67's owner column, and add a line on it to ui/AGENTS.md."
    }
  ]
}
