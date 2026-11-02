# MrRowDetailsPageR1

Agent output (`agent://MrRowDetailsPageR1`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-02T19-44-30-486Z_01a19dca-b716-72dc-ab4f-c92917fdd42d/MrRowDetailsPageR1.md), collected 2026-11-02T21:44:13.661Z.

{
  "summary": "Fixed all nine findings. Core `peopleStack<P extends Person>` returns the people it is given, so MergeRequestPeople uses `stack.shown` directly (the username re-join is gone). `useScrollOutside` is extracted from useHoverBox and also closes the due-date box. Escape with a hover-opened filter list closes only the list. Disabled controls carry their tooltips on wrappers. `referrerpolicy` is written before `src`. Keyboard re-request keeps the box open and keeps focus in it. #2136 did not reproduce in 5 tries; it is the fixture's scripted second load.",
  "files_changed": [
    "frontend/src/mergeRequests/internal/people.ts",
    "frontend/src/mergeRequests/internal/people.test.ts",
    "frontend/src/ui/MergeRequestPeople.vue",
    "frontend/src/ui/useHoverBox.ts",
    "frontend/src/ui/useHoverBox.test.ts",
    "frontend/src/ui/MergeRequestDueDate.vue",
    "frontend/src/ui/MergeRequestsView.vue",
    "frontend/src/ui/CiStatusBox.vue",
    "frontend/src/ui/MergeRequestRow.vue",
    "frontend/src/ui/MergeRequestPicture.vue",
    "frontend/src/ui/AGENTS.md"
  ],
  "tests_added": [
    {
      "name": "people.test.ts: the stack gives back the people it was given, with all their fields",
      "proves": "peopleStack is generic: `shown` holds the caller's own objects, `picture` included (toBe identity). Kills #2128's need for a join."
    },
    {
      "name": "useHoverBox.test.ts: a scroll outside the area is reported, one inside is not, and any is without an area",
      "proves": "The extracted useScrollOutside calls back only for scrolls whose target is outside the area, and for any scroll when the area is null."
    },
    {
      "name": "useHoverBox.test.ts: a scroll while the box is closed leaves the focus held: the pointer leaving keeps it",
      "proves": "The open guard in useHoverBox's scroll callback: a scroll on a closed box does not reset the focus hold. Kills the `if (true)` mutant at useHoverBox.ts:122."
    }
  ],
  "smoke_evidence": [
    {
      "command": "pnpm -C frontend lint; typecheck; fmt:check; sfc-order; unused; test",
      "observed": "oxlint/eslint: no output. vue-tsc -b: no errors. \"All matched files use the correct format.\" sfc-order and knip: no findings. Test Files 256 passed (256), Tests 3732 passed (3732)."
    },
    {
      "command": "WebKit fixture r1 (--diff --mr list 1600x1000): focus 'Open !639 on GitLab', Tab, Tab, Enter; read; sleep 1.5; read",
      "observed": "Tab → \"AB|DV expanded=true\". Tab → 'Re-request review from Dmitri Volkov busy=false'. Enter → focus still on it: busy=true ariaDisabled=true spinner=true. After 1.5 s: focus BUTTON 'Re-request review from Dmitri Volkov', status=\"You are not allowed to re-request a review on this merge request.\", box still expanded."
    },
    {
      "command": "fixture: Escape, then Shift+Tab, Tab to reopen; second run: Enter, wait, Tab away, Shift+Tab back",
      "observed": "Escape → focus on stack \"AB|DV\" expanded=false, page=true. Reopened by keyboard: expanded=true, status=0 (refusal cleared). Tab-away run: 'Set a due date', expanded=0. Back: expanded=true, status=0."
    },
    {
      "command": "fixture !638 by keyboard: Tab to 'Re-request review from Chiara Rossi', Enter, sleep 1.5, read; Tab; Escape",
      "observed": "Running: busy true, spinner. After the reply: focus on DIV tabindex=-1 (the box), expanded=1, Chiara reads \"Review requested\". Tab → 'Re-request review from Dmitri Volkov'. Escape → expanded=false, page=true."
    },
    {
      "command": "fixture #2131: hover 'Assignee' (button), Escape, Escape",
      "observed": "After the hover: 1 menu, focus not moved. 1st Escape → 0 menus, page=true. 2nd Escape → page=false."
    },
    {
      "command": "fixture due box + scroll: click 'Set a due date' nth 0; scroll list 'Open merge requests' --to 400",
      "observed": "Before: 1 date input, focus on it. After the scroll (scrollTop=400): 0 date inputs, focus=BODY."
    },
    {
      "command": "fixture #2133 CI: hover 'Pipeline failed' nth 0, then hover '[role=group] li:nth-child(2)'; wait 0.6 s; shot /tmp/r1-disabled-job-tip.png",
      "observed": "Jobs: test:e2e disabled=true, desc on its li \"GitLab gave no address for this job's log\". Hovering the disabled job shows the tip \"GitLab gave no address for this job's log\" (hidden=false)."
    },
    {
      "command": "fixture #2133 Show Diff: WebDriver actions via curl (move onto row 6's button, click, move to 800,28, pause 100, move back, pause 700), with a page event log",
      "observed": "enter@4558 disabled=false | tipHidden@4661 | click@4707 | leave@4757 | enter@4926 disabled=true | tip(Show Diff)@4926 disabled=true. The wrapper gets pointerenter while the button is disabled, and the tip shows."
    },
    {
      "command": "#2136: 5× (location.reload, open page, hover 'BOCRDV+1', click Chiara's then Dmitri's re-request, read); then Back, wait 32 s, reopen",
      "observed": "try 1–5 identical: \"!638 people:CR/Chiara Rossi;DV/Dmitri Volkov/You are not allowed…;SW/Sam Weller !640:backend/+1 !628:backend/+1\". After Back + 32 s + reopen: \"!640:bug !628:bug\"."
    },
    {
      "command": "cargo tauri build --debug --no-bundle; local-conflicts-repo.sh /tmp/yamt-r1-scratch/rd; start-app --name r1app --diff --dir … --glab mr-row-details; read section imgs",
      "observed": "Every img's attributes in order: \"referrerpolicy,src,alt,class\", rp=no-referrer. anna yamt-picture://localhost/anna nw=16; sam …/sam nw=32; ben https://secure.gravatar.com/avatar/0f3a9c2e…?s=80&d=identicon nw=80. calls.log: 0 lines name gravatar. Shot /tmp/r1-real-pictures.png; both sessions stopped."
    }
  ],
  "mutation": {
    "command": "just mutants HEAD (Stryker on people.ts and useHoverBox.ts): 140 killed, 12 survived, 0 no-cov, score 92.11",
    "survivors": [
      "src/ui/useHoverBox.ts:117 at: shallowRef({}) — equivalent: `show` always writes `at` before `open` turns true; placement is read only while the box exists.",
      "src/mergeRequests/internal/people.ts:4,10–21 (11 constant-literal mutants) — not changed lines: this round changed only lines 1 and 24–27 of people.ts."
    ]
  },
  "acceptance_not_run": [],
  "deviations_from_brief": [
    "#2133/#2135: the re-request button uses `aria-disabled` while running, not `disabled` with a wrapper tooltip. A disabled button loses focus in WebKit, and that blur closed the box (#2135). With aria-disabled the button keeps focus and pointer events, so its tooltip works without a wrapper. The state's running guard (mergeRequestRerequests.ts:49) already ignores a second press.",
    "#2135: when a reply removes the focused re-request button, a pre-flush watch moves focus to the box (tabindex=-1). The box therefore stays open and Tab continues inside it.",
    "#2133: the CI job's tooltip sits on its existing `li`, not on a new span. The `aria-description` therefore moves from the job button to the li, as it already does for the row action's wrapper.",
    "#2129: a scroll that closes the due-date box sets `open=false` and leaves focus where it falls (body), as a click outside does. Focus is not returned to the opener.",
    "#2136: not a bug, so no fix. With script `list`, every load after the first drops the label \"backend\" (fixtureMergeRequests.ts:110). Leaving the page and reopening it after RECHECK_PAUSE_MS (30 s) reloads the list. The verifier's Escape had left the page.",
    "ui/AGENTS.md: lines 49 and 51 now describe the wrapper-tooltip rule, useScrollOutside, Escape on a filter list, the generic peopleStack and keyboard focus in the people box. frontend/src/mergeRequests/AGENTS.md is unchanged; it is not owned and stays accurate."
  ],
  "open_risks": [
    {
      "location": "frontend/src/ui/MergeRequestPeople.vue:87 (keepFocusInBox)",
      "risk": "Relies on Vue running the pre-flush watcher before the patch that removes the button. Observed working in WebKit; there is no unit test (no component test setup)."
    },
    {
      "location": "frontend/src/ui/MergeRequestDueDate.vue:36",
      "risk": "Closing on scroll drops focus to body when it was in the date field. Escape on the page then goes Back."
    },
    {
      "location": "frontend/src/mergeRequests/internal/people.ts:4-21",
      "risk": "Stryker reports the module-level constant mutants as surviving even though people.test.ts asserts these values. This looks like a static-mutant activation issue in the runner, not a test gap; not investigated."
    }
  ]
}
