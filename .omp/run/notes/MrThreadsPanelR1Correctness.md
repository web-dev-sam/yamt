# MrThreadsPanelR1Correctness

Agent output (`agent://MrThreadsPanelR1Correctness`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-04T10-50-17-797Z_01a1a62e-5945-7602-931f-7a9c9e1dc757/MrThreadsPanelR1Correctness.md), collected 2026-11-04T16:08:21.927Z.

{
  "verdict": "pass",
  "checked": [
    "#2376: buttons-row test sets ' \\n\\t ' on read d01; both add buttons disabled, Resolve enabled, so a missing .trim() fails. Locked Ctrl+Enter is verify step 7 (#2376); panel unmounted until mr-threads-box. Accepted.",
    "CI log: useBesidePlacement gives x = anchor.left - border-box width, y = anchor.top, as the old code. WebKit rects match (right 1394.36 = box left, tops 167.23). besideLeft pinned in useMenuPlacement.test.ts.",
    "Field Escape: prevented, stopped, close forwarded to the panel. Shift/Ctrl+Escape still close via the panel. Window handlers ignore prevented Escapes; keyHold is capture-phase, so stopPropagation changes nothing.",
    "Mod-Enter: sameKey matches modifiers exactly (like .exact), Ctrl+Enter on Linux. Skipped while isComposing. Default prevented even when disabled. send still checks add.disabled (locked reason on !636).",
    "#2370: Submit review is disabled in the post-send refresh (a_refreshing_thread, 2 pending) and enabled on a read thread. Reverting to :disabled=sending fails it. Add and Resolve use the same writable prop.",
    "Survivors: imageSize.ts:56 never arm is equivalent (a). useMenuPlacement.ts:37 border-box: node has no ResizeObserver; content-box shifts x by 2 px, caught by the named WebKit rect equality (c). Both accepted."
  ],
  "findings": []
}
