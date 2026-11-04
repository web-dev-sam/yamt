# MrDescriptionPageBoundary

Agent output (`agent://MrDescriptionPageBoundary`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-03T21-08-17-015Z_01a1a33d-c5f7-7658-b66f-85ea275269a1/MrDescriptionPageBoundary.md), collected 2026-11-04T01:01:17.375Z.

{
  "verdict": "fail",
  "checked": [
    "#2289/#2291 fixed: toLink brands link.page as WebPage at every depth, http kept. The tauri source and the fixture convert through toDescriptionReply via `converted`; ui never brands (Inlines passes link.page to openPage).",
    "PM2/PM3/PM10: new MergeRequestDescription*.vue import only ../ipc, ui helpers, useMergeRequests(), ~icons, @vueuse. No window root or lsp. Interpolation only: no href, v-html, innerHTML or title.",
    "State: `description` keeps one writer (mergeRequestDescriptions.ts); row, panel and view call its actions. The view's onUnmounted close follows CiStatusBox's jobLog. The row reading the store matches its sibling columns.",
    "VU2/VU4/VU5/VU15 hold, each component's reason given. Deviations accepted: markdown-align-* (theme.css:458-475), IMAGE_STAND_IN, iid key, !636's 'glab timed out', docs handed to the keeper (tree.md, ipc/AGENTS.md:23).",
    "index.ts and MergeRequestSource.ts take the description types from descriptionDomain.ts; mergeRequestDomain.ts keeps no copy. The newly private types (HeadingLevel, TaskBox, CellAlign, ListNumbering) are unused in ui.",
    "The window capture-phase keydown has precedents (ToolbarMenu.vue:20, ServerMenu.vue:30). It is judged below only for the precedence it takes over boxes on this page."
  ],
  "findings": [
    {
      "file": "frontend/src/ipc/descriptionDomain.ts",
      "line": 57,
      "severity": "block",
      "rule_id": "IPC3",
      "problem": "isLinkedPage is the only brand guard outside ipc/domain.ts. So WebPage now has two minting rules in two files: https in domain.ts:202, http or https here. A reader asking what makes a WebPage finds only the first, against IPC3 and Main's instruction; the 300-line cap is not a reason to bend the rule.",
      "fix": "Export isLinkedPage from domain.ts next to isWebPage and use it here. Free the lines by moving a non-brand converter (toSettingsRead/toStartReply/toListing) to its own ipc file, or have the orchestrator amend IPC3 in a row."
    },
    {
      "file": "frontend/src/ui/MergeRequestDescription.vue",
      "line": 36,
      "severity": "block",
      "problem": "The window capture-phase Escape runs before every element's and the view's handler, so its defaultPrevented check can never be true. With the panel open and a hover-opened filter menu (useHoverMenu) or box (useHoverBox), Escape closes the panel and leaves the menu open. Design §1.7 says the panel yields to Escape already handled; Escape precedence is now decided in two places.",
      "fix": "Use a bubble-phase listener. In the view's escapePressed, return without preventDefault while `description` is set, after the openFor dismiss. The panel then closes on an unhandled Escape, and the `asking` prop can go."
    },
    {
      "file": "frontend/src/ui/AGENTS.md",
      "line": 71,
      "severity": "should",
      "problem": "The panel's close rule says onClickOutside ignores 'every opener' but omits the `data-refreshes-list` exemption. That bare string couples MergeRequestsView.vue:156,243 to the panel's ignore list. A future refresh trigger without the attribute would silently close the panel, against RK67.",
      "fix": "Name the `[data-refreshes-list]` exemption and why (rule 2: a list refresh leaves the panel) in this paragraph, next to the openers."
    },
    {
      "file": "frontend/src/ipc/AGENTS.md",
      "line": 9,
      "severity": "should",
      "problem": "This line still defines a WebPage as a job's, merge request's or note's https page. A description link (http or https) is now one too, and only line 23 is in the keeper list in deviations_from_brief. The next reader of the brand gets the wrong rule.",
      "fix": "Add 'ipc/AGENTS.md:9 WebPage also a description link, http or https (domain.ts guard)' to the docs keeper's list together with line 23."
    },
    {
      "file": "frontend/src/ipc/descriptionDomain.ts",
      "line": 66,
      "severity": "nit",
      "problem": "The thrown message says only `link.page`, with no path to the block or inline. Every other ipc converter gives a field path (mergeRequestDomain.ts:98 `${field}`), so a bad nested link is harder to locate from the log. Nothing else gets harder.",
      "fix": "Thread a field path through toBlock/toInline/toLink (e.g. `blocks[2].items[0].blocks[1].inlines[3].link.page`), as toMergeRequestPage does."
    }
  ]
}
