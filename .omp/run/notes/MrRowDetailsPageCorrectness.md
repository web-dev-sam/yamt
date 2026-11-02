# MrRowDetailsPageCorrectness

Agent output (`agent://MrRowDetailsPageCorrectness`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-02T19-44-30-486Z_01a19dca-b716-72dc-ab4f-c92917fdd42d/MrRowDetailsPageCorrectness.md), collected 2026-11-02T21:24:49.180Z.

{
  "verdict": "fail",
  "checked": [
    "Survivors at mergeRequestsText.ts:60 and :125 are VF7 (b): emptying the `never` default falls off the function's end, which vue-tsc rejects (TS2366). The .vue files rely on the notes' WebKit/real-app evidence.",
    "Tests: mergeRequestsText.test.ts pins each new sentence (glab ones checked against listFailureText). mergeRequestTitles.test.ts reads files from disk; its sample catches title= and :title= with line, passes data-title.",
    "Wiring: due/asks props, setDue→setDueDate, peopleBoxClosed→dismissRerequestRefusals on the box's open→false. Re-request only when mayRerequest && reviewDone; while running: disabled, aria-busy, spinner.",
    "A pinned menu and the focused people, CI and due boxes preventDefault on Escape, so the page stays. Shift's minus icon follows useKeyModifier. aria-checked is true for included and excluded.",
    "Open risks accepted: blur-save of a complete date fits design §2.3; the focus rule is backed by the Clear evidence; hue-rotate is design §1.3's settled choice (white stays white).",
    "CiStatusBox on useHoverBox behaves as the removed code did (show, held, Escape, scroll re-check). No risk-register row names a touched owner."
  ],
  "findings": [
    {
      "file": "frontend/src/ui/MergeRequestsView.vue",
      "line": 84,
      "severity": "block",
      "problem": "Escape on a checklist opened by hover closes the whole page and not the checklist (request rule 8). Focus stays outside the menu ('kept'), so the menu's keydown never runs and escapePressed calls goBack. Item 6's evidence never presses Escape.",
      "fix": "In escapePressed, when openFor.value !== null, preventDefault and call the hover menu's dismiss() (spread from useDropdownMenu) instead of goBack."
    },
    {
      "file": "frontend/src/ui/MergeRequestDueDate.vue",
      "line": 27,
      "severity": "block",
      "problem": "The date box is position:fixed and never closes on scroll. If the list scrolls while it is open, the box stays over another row, and a date picked there is saved on the original row. Every other fixed row box (useHoverBox, the CI box) closes on a scroll outside it.",
      "fix": "Close the box on a capture-phase window scroll outside it, as useHoverBox does (useEventListener(window, 'scroll', …, { capture: true, passive: true }))."
    },
    {
      "file": "frontend/src/ui/CiStatusBox.vue",
      "line": 95,
      "severity": "block",
      "rule_id": "R-disabled-hover",
      "problem": "[INFERENCE] v-tooltip needs pointerenter, which WebKit does not send to disabled controls (3.M-rework-1.md:18-20). So the disabled test:e2e job's tip never shows; the native title did. Same for re-request while running (MergeRequestPeople.vue:167) and Open changes while fetching. Untested.",
      "fix": "Put v-tooltip on a wrapper span and give the button disabled:pointer-events-none, as the row action does (MergeRequestRow.vue action span). Then hover test:e2e in the fixture's CI box."
    },
    {
      "file": "frontend/src/ui/MergeRequestPicture.vue",
      "line": 48,
      "severity": "nit",
      "problem": "[INFERENCE] Vue sets attributes in template order, so :src is set before referrerpolicy. If WebKit starts the request as soon as src is set, the Gravatar request can carry the default referrer, against plan #152. Nothing gets harder as the app grows.",
      "fix": "Move referrerpolicy=\"no-referrer\" before :src in the img tag."
    }
  ]
}
