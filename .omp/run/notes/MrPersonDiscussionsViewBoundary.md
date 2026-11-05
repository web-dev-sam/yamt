# MrPersonDiscussionsViewBoundary

Agent output (`agent://MrPersonDiscussionsViewBoundary`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-05T12-42-41-688Z_01a1abbb-9c98-70e8-9233-da1eb0f2d2d5/MrPersonDiscussionsViewBoundary.md), collected 2026-11-05T14:47:58.771Z.

{
  "verdict": "fail",
  "checked": [
    "Ownership: only Owned files plus the granted Picker/ViewPage renames. MergeRequestPersonMenu.vue is not in the diff. PM6 tree/state rows go to the docs keeper (accepted).",
    "PM2/PM10: the new MergeRequest*.vue import no window root, lsp, @codemirror or @tauri; the ../mergeRequests index only. RETRY comes from aiText per ui/AGENTS.md:47.",
    "Contract: props, emits and expose match. MergeRequestMenu is generic over {label}; core narrowed is generic (choices.ts:146), so Filter and ReviewMode compile. The three text fns are tested.",
    "State: personView has one writer (mergeRequestPersonView.ts:245-260). listScrollTop and pointed/focused are component-local. Shift relies on expandEntry's already-expanded no-op (ts:59).",
    "Accepted: post-flush watch instead of nextTick, button enabled while the view shows, tooltip on a wrapper span, PEOPLE, data-discussion-id, no doc comments (CP2); risks: clamp, +N width, picker name, stale pointed.",
    "Escape: the picker closes only its open menu (defaultPrevented, asking, openFor, then preventDefault). The page's listener returns with no filter menu open, so no Escape leaves the page (#189 C)."
  ],
  "findings": [
    {
      "file": "frontend/src/ui/MergeRequestPersonEntry.vue",
      "line": 41,
      "severity": "block",
      "rule_id": "vision-2",
      "problem": "TURN_MARK is a second copy of MergeRequestDiscussions.vue:45. ui/AGENTS.md:59 records it as 'the one constant both bind', so a change to the turn look now has to be made in two components and can drift between the box and the person view.",
      "fix": "Export TURN_MARK once from a shared ui .ts module (e.g. beside RESOLVED in mergeRequestThreadText.ts) and import it in both MergeRequestDiscussions.vue and MergeRequestPersonEntry.vue. The orchestrator grants MergeRequestDiscussions.vue."
    },
    {
      "file": "frontend/src/ui/MergeRequestPersonEntry.vue",
      "line": 106,
      "severity": "should",
      "problem": "The Resolved/turn-word span pair is written twice inside the entry (lines 106-109 in the head, 132-135 under the writers). Any change to the word's look or the Resolved mark must be made in both places.",
      "fix": "Render the pair once, as one template fragment or a tiny shared component taking resolved, text and look. Place it in the head when expanded and in the foot otherwise, from a single definition."
    },
    {
      "file": "frontend/src/ui/MergeRequestPersonPicker.vue",
      "line": 28,
      "severity": "should",
      "problem": "keyOf repeats MergeRequestReviewMode.vue:34 word for word (\"me\" or user:<username>). A third people menu would copy the key rule again.",
      "fix": "Add one viewerKey(value) beside Viewer in mergeRequests/ (it fits both ReviewFor and Viewer) and use it in both menus."
    },
    {
      "file": "frontend/src/ui/MergeRequestWriters.vue",
      "line": 13,
      "severity": "should",
      "rule_id": "vision-2",
      "problem": "PICTURE_PX = 20 and GAP_PX = 4 restate MergeRequestPicture's `size-5` box class and the row's `gap-1` class as numbers. If either class changes, the fold miscounts silently and pictures get clipped.",
      "fix": "Bind the row's gap from GAP_PX (`:style` gap) instead of `gap-1`. Take the box size from one exported px/class record that MergeRequestPicture's SIZES also reads."
    }
  ]
}
