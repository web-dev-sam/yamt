# MrRowDetailsSmokeRepass

Agent output (`agent://MrRowDetailsSmokeRepass`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-02T19-44-30-486Z_01a19dca-b716-72dc-ab4f-c92917fdd42d/MrRowDetailsSmokeRepass.md), collected 2026-11-02T21:48:04.785Z.

{
  "gate": "not-run",
  "failures": [],
  "smoke": [
    {
      "recipe": "just app-session start-fixture --name rp --diff --mr list --size 1600x1000 (dark), click 'Merge requests'",
      "observed": "dataset.theme=dark. Page opened, status \"40 of 40 merge requests\". Shot /tmp/rp-e2e-tip-dark.png (source page).",
      "pass": true
    },
    {
      "recipe": "Keyboard people box: focus 'Open !639 on GitLab', Tab, Tab, Enter; read; sleep 1.5; read",
      "observed": "Tab: BUTTON ABDV, expanded=1. Tab: 'Re-request review from Dmitri Volkov' busy=false. Enter: focus still on that button, aria-busy=true, aria-disabled=true, spinner=true, box open. After 1.5 s: focus still on the button, busy=false, box open, status \"You are not allowed to re-request a review on this merge request.\"",
      "pass": true
    },
    {
      "recipe": "Refusal clears on keyboard close: Escape; Shift+Tab, Tab; then Enter again and Tab, Tab away",
      "observed": "Escape: focus BUTTON ABDV, expanded=0, refusal in body=false. Reopened by keyboard: expanded=1, refusal=false. Second run (Enter, wait 1.5 s, Tab, Tab): focus 'Pipeline passed', refusal=false.",
      "pass": true
    },
    {
      "recipe": "#2136: hover 'BOCRDV+1' on !638, re-request Chiara Rossi, wait 1.5 s, re-request Dmitri Volkov, wait 1.5 s",
      "observed": "Labels before: !638 ui; !640 backend +1; !628 backend +1. After: box still open. Reviewers: Chiara Rossi [Review requested]; Dmitri Volkov \"You are not allowed to re-request a review on this merge request.\" [Changes requested]; Sam Weller [Review requested]. Labels unchanged: !638 ui; !640 backend +1; !628 backend +1. Shot /tmp/rp-2136-dark.png.",
      "pass": true
    },
    {
      "recipe": "#2136 implementer claim: click Back, sleep 32 s, click 'Merge requests'",
      "observed": "Page closed (section gone=true). After reopening: !638 ui; !640 bug; !628 bug. The backend +1 labels became a single bug label, so the claim is confirmed. I did not find where the fixture scripts this: grepping fixtureMergeRequests.ts for reload/bug found nothing.",
      "pass": true
    },
    {
      "recipe": "Escape on hover-opened checklist: hover 'Assignee' button, Escape, Escape",
      "observed": "After the hover: menus listbox:Tabs and menu:Assignee; focus did not move into the menu. 1st Escape: only listbox:Tabs left, page open=true. 2nd Escape: page=false.",
      "pass": true
    },
    {
      "recipe": "Due-date box on scroll: click 'Set a due date' nth 0; scroll 'Open merge requests' --to 400",
      "observed": "Before: 1 date input, focus INPUT, scrollTop 0. After: scrollTop 400, 0 date inputs, focus BODY.",
      "pass": true
    },
    {
      "recipe": "Disabled CI job tip: hover 'Pipeline failed' nth 0, hover '[role=group] li:nth-child(2)', 0.6 s, shot",
      "observed": "Jobs: test:unit dis=false; test:e2e dis=true; lint:docs allowed to fail dis=false. Shot /tmp/rp-e2e-tip-dark.png shows the tip \"GitLab gave no address for this job's log\" beside the Failed jobs box. The tip has no role=tooltip, so it was confirmed from the screenshot.",
      "pass": true
    },
    {
      "recipe": "[title] count in section 'Merge requests' and on the header 'Merge requests' button",
      "observed": "Section: 0. Header button: no title attribute and 0 descendants with one. Re-read after the CI hover: 0. The whole document has 7, all in compare-window chrome (New tab, Close tab, Format, Language, Previous/Next change, Settings), outside page brief step 7's scope.",
      "pass": true
    },
    {
      "recipe": "just app-session stop --name rp",
      "observed": "stopped rp; webdriver and vite stopped; folder removed",
      "pass": true
    }
  ],
  "environment": "HEAD 8010d81f; rustc 1.99.0, node v26.13.0, pnpm 12.0.0; WebKit fixture via just app-session (MiniBrowser on a private display), 1600x1000, dark theme only as named; steps A and C not run."
}
