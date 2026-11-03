# MrDiscussionsPageBoundary

Agent output (`agent://MrDiscussionsPageBoundary`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-03T13-40-22-327Z_01a1a1a3-b2b7-767e-a680-0d48afba3020/MrDiscussionsPageBoundary.md), collected 2026-11-03T15:33:17.411Z.

{
  "verdict": "pass",
  "checked": [
    "Ownership: all 13 changed files are in Owned. mergeRequests.ts, mergeRequestDiscussions.ts, settings.ts, ipc/**, mergeRequests/** untouched by 1855d467.",
    "PM10/PM7/PM9: the new components import no window root or lsp/. The box uses useMergeRequests() plus a type import, as CiStatusJobLog.vue:17 does. The roots only fill SettingsView's slot.",
    "After R1 the box gets only discussions, discussionDetails, askDiscussions via discussionsOf (mergeRequestDiscussions.ts:190). Entries keep one writer; discussionDetails is derived from settings.",
    "Box has the people box's shape (useHoverBox, area with @click.stop, opener with aria-expanded and no tooltip). Off/0 keeps the vTooltip span. No problem bar, no v-html, no title. Deviations accepted.",
    "openPage reports step: clicked (mergeRequests.ts:215), so \"discussion\" in MergeRequestStep is needed. NOT_OFFERED is a Record (TS17). Setting matches Antialiasing. VU2/VU4/CP hold. TS3 no-default is allowed.",
    "AGENTS.md has the box, setting and state-slice lines. R1's own doc lines are the docs keeper's (per R1 note). The 'each iid once' smoke wording is the brief's error, per the orchestrator."
  ],
  "findings": [
    {
      "file": "frontend/src/ui/mergeRequestsText.ts",
      "line": 64,
      "severity": "should",
      "rule_id": "principles §2",
      "problem": "The list's glab words now live in `discussionsRefusedText`, typed on the discussions IPC answer, and the list (:78) and re-request reply (:134) call it. A change to that answer's payload or to the box's wording would break or reword the list and re-request text too.",
      "fix": "Rename it to a neutral `glabRefusalText` typed on a local `{glabMissing} | {notLoggedIn; detail} | {failed; message}` union, and have the box, listFailureText and rerequestReplyText each call it."
    }
  ]
}
