# MrThreadsPanelR1Boundary

Agent output (`agent://MrThreadsPanelR1Boundary`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-04T10-50-17-797Z_01a1a62e-5945-7602-931f-7a9c9e1dc757/MrThreadsPanelR1Boundary.md), collected 2026-11-04T16:07:50.697Z.

{
  "verdict": "fail",
  "checked": [
    "#2370 fixed: one `writable` (read, not refreshing, not sending) in MergeRequestThread.vue:62-67 disables Submit review (:142) and is the field's only gate (ReplyField :54-64); `ready` deleted, no second copy.",
    "#2371 fixed: ImageSize derived once in ui (mergeRequestImageSize.ts:3, exported); DescriptionImage.vue:6,9 imports it as `ImageSize | null`, matching bindings.ts:432; contract prop unchanged.",
    "#2372 fixed: useBesidePlacement/besideLeft (useMenuPlacement.ts:15-31) share a private usePlacement with one useElementSize; CiStatusJobLog.vue:55 and Thread.vue:50 use it; useMenuPlacement callers unchanged.",
    "#2373 key rule: boxKeydown is the one Mod-Enter/Escape rule (ipc keyList, isComposing); field Escape emits `close`, forwarded by the panel, matching the brief's Escape→close. Mod-Enter allowed by the finding.",
    "#2376: the whitespace step in the_buttons_row test pins `.trim()`; Ctrl+Enter on locked !636 is deferred to verify step 7 (acceptance_not_run), accepted because `send` checks add.disabled.",
    "No new import edge trips PM2/PM3/PM10 (windowFence sharedPageFinding checks only ROOT_FILES and lsp/); MergeRequestThread props and emits contract unchanged."
  ],
  "findings": [
    {
      "file": "frontend/src/ui/MergeRequestReplyField.vue",
      "line": 24,
      "severity": "block",
      "rule_id": "PM9",
      "problem": "The merge-request page file now imports `ui/rangeKeys.ts`, which windowFence WINDOW_FILE classifies as the range window's. #2178 promoted this same edge (CiStatusBox → rangeKeys `isTypingTarget`) as a bent boundary and fixed it by moving the helper to the neutral `ui/typingTarget.ts`, so this fix brings the edge back and no fence catches it.",
      "fix": "Rename `ui/rangeKeys.ts` (+ test) to a window-neutral `ui/boxKeys.ts` and import it from RangeThreadBox.vue, RangeMessageEditor.vue and the field; Owned grows by those files. Docs keeper updates ui/AGENTS.md:11, tree.md:270 and RK35."
    }
  ]
}
