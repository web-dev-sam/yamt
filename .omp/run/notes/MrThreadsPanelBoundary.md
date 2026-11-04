# MrThreadsPanelBoundary

Agent output (`agent://MrThreadsPanelBoundary`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-04T10-50-17-797Z_01a1a62e-5945-7602-931f-7a9c9e1dc757/MrThreadsPanelBoundary.md), collected 2026-11-04T15:58:59.450Z.

{
  "verdict": "fail",
  "checked": [
    "Ownership/fences: all 10 files in Owned (test rename approved, TS1149); imports are ipc types, mergeRequests core, ui text/store/tooltip/useMenuPlacement/aiText; no window root, no lsp (PM10); no v-html/href/title",
    "State: panel only reads thread/replyTexts and calls Threads actions (setReplyText via computed setter, preview, send, resolve, submit, retry); only local state is DescriptionImage `natural`, reset on address change",
    "VU2 order, VU4 useTemplateRef, VU5 typed macros, VU6 flat templates in all 3 SFCs; Content/Shown sum types with never defaults follow MergeRequestDescription.vue (focus on mount, Escape+defaultPrevented, RETRY)",
    "Text module: one const per word, TS17 Record tables; failure sentences via problemText (deviation accepted, as aiText.ts); added `platform` param only adds; per-panel 'Loading…' matches DESCRIPTION_LOADING",
    "imageStyle follows the contract's 5 rules, CSS 2.1 §10.5 cited (CP1); Inlines passes size, stand-in ignores it (A3); WebKit sizes in note; field height/Escape risks accepted for mr-threads-box",
    "Deviations accepted: buttons row in field component (Ctrl+Enter shares add.disabled), Resolve off while refreshing, zero-block preview = Nothing to preview., VU15 reasons, tree.md rows to docs keeper"
  ],
  "findings": [
    {
      "file": "frontend/src/ui/MergeRequestThread.vue",
      "line": 67,
      "severity": "block",
      "rule_id": "principles §2 / one rule",
      "problem": "The two components compute 'a write may start' differently. Submit review is disabled only while `sending` (:67, :139), but ReplyField's `ready` (:52-55) also blocks while refreshing. The state's `write` drops calls during a refresh, so a Submit review click right after a reply silently does nothing.",
      "fix": "Derive one `writable` (load read, not refreshing, not sending) in MergeRequestThread.vue. Disable Submit review with it and pass it to MergeRequestReplyField as a prop in place of its own `ready`."
    },
    {
      "file": "frontend/src/ui/mergeRequestImageSize.ts",
      "line": 3,
      "severity": "should",
      "rule_id": "TS6",
      "problem": "`ImageSize` is derived from DescriptionInline twice: here (non-null) and in MergeRequestDescriptionImage.vue:9 (nullable). A shape change has to be followed in two places, and a third renderer would copy it again.",
      "fix": "Export `ImageSize` from mergeRequestImageSize.ts and import it in MergeRequestDescriptionImage.vue as `ImageSize | null`, or have the ipc owner re-export it from ipc/index.ts."
    },
    {
      "file": "frontend/src/ui/MergeRequestThread.vue",
      "line": 51,
      "severity": "should",
      "rule_id": "principles §3",
      "problem": "The 'right edge meets the anchor's left, tops level' placement is copied from CiStatusJobLog.vue:56-60. Each copy adds a useElementSize on an element useMenuPlacement already measures. A third side panel copies it again, and a gap change needs both edits.",
      "fix": "Extract `useBesidePlacement(element, anchor)` into useMenuPlacement.ts, reusing its size, and call it from CiStatusJobLog.vue and MergeRequestThread.vue (Owned grows by those two files)."
    },
    {
      "file": "frontend/src/ui/MergeRequestReplyField.vue",
      "line": 169,
      "severity": "should",
      "rule_id": "rework 3.RV-thread-boxes-1 item 3",
      "problem": "The submit key is a Vue `.ctrl.enter.exact` modifier, a second rule beside rangeKeys.ts BOX_KEYS (built through ipc/keys.ts, skipping `isComposing`). An IME composition can send mid-word, and a key change has two places to follow.",
      "fix": "Match with `pressesKey(event, keyList(\"Ctrl-Enter\"), navigator.platform)` from ipc/keys.ts (\"Mod-Enter\" if GitLab's Ctrl/Cmd is meant) behind an `isComposing` check, or share boxKeydown's submit predicate."
    },
    {
      "file": "frontend/src/ui/MergeRequestThread.vue",
      "line": 57,
      "severity": "nit",
      "problem": "`shown` names a `Thread` while `Thread.shown` is a `ShownThread`, so the code reads `shown.value?.shown.iid`. A reader needs a lookup to tell them apart; nothing else gets harder.",
      "fix": "Rename the computed to `current` (or `panelThread`)."
    }
  ]
}
