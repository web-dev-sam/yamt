# MrPersonDiscussionsViewCorrectness

Agent output (`agent://MrPersonDiscussionsViewCorrectness`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-05T12-42-41-688Z_01a1abbb-9c98-70e8-9233-da1eb0f2d2d5/MrPersonDiscussionsViewCorrectness.md), collected 2026-11-05T14:48:57.740Z.

{
  "verdict": "pass",
  "checked": [
    "PersonViewPage tests (granted name) fail if the feature is removed: starter is earlier[0] not last, date tip from first.createdAt, writers order, no row for one comment, turn words from person (Anna marked), expanded hides clamp and writers",
    "Page swap and scroll (MergeRequestsView.vue:141-159): scrollTop restored in a flush:post watch after the ul mounts; goBack steals no focus. Accepted: button enabled while view open, tooltip on a wrapper span",
    "E1/RK59/RK73: one Shift watch, pointed else focused, never while typing; Shift only expands. Escape: reply cancel focuses chevron. Picker listener checks defaultPrevented, asking and openFor; the page's listener runs first, does nothing",
    "Open risks accepted: stale pointed/focused is the box's pattern (Discussions.vue:112-118, ids stable); clamp is four line heights (design 2.8 #8); 'SWMe' is an app-session quirk, aria-hidden falls through [INFERENCE]",
    "Writers.vue:20 fold: floor((w+4)/24) slots, chip takes slot 1 (personDiscussions.ts:109). Matches smoke: 273px gives 11 slots, '+3' and the 10 newest, tip lists the oldest 3. TURN_MARK copy and PEOPLE word left to the boundary lens",
    "Mutation: mergeRequestsText.ts only (163 killed, 0 survivors); .vue files are outside VF7, so no kept reasons to check. Menu generic via narrowed<C> (choices.ts:146); radio items in MENU_ITEMS. No tests run"
  ],
  "findings": [
    {
      "file": "frontend/src/ui/MergeRequestWriters.vue",
      "line": 40,
      "severity": "should",
      "rule_id": "RK77",
      "problem": "The '+N' chip is min-w-5 and shrink-0, but the fold reserves only one 20 px slot for it. With two or more digits ('+10' in text-xs is about 21–30 px) and little slack in the row, overflow-hidden cuts a few px off the newest picture (the implementer's open risk). Nothing gets harder as the app grows; the effect is cosmetic and rare.",
      "fix": "Keep the chip inside its slot (a fixed w-5 with a smaller font or overflow-hidden), or measure the chip and subtract its width before computing fits."
    }
  ]
}
