# MrRowDetailsFinal

Agent output (`agent://MrRowDetailsFinal`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-02T19-44-30-486Z_01a19dca-b716-72dc-ab4f-c92917fdd42d/MrRowDetailsFinal.md), collected 2026-11-02T22:12:12.077Z.

{
  "gate": "pass",
  "failures": [],
  "smoke": [
    {
      "recipe": "A. just check",
      "observed": "Exit 0, 58.27 s. vitest 'Test Files 256 passed (256) / Tests 3732 passed (3732)'; 'arch-check: ok'; 'map-check: ok'; golden 10× ok; hooks-test 'ℹ pass 18 ℹ fail 0'.",
      "pass": true
    },
    {
      "recipe": "B1 fixture dark (--mr list --size 1600x1000): author picture",
      "observed": "In-page log: enter 'Author: Anna Berg' 73683 ms, tip 'Author: Anna Berg' 74084 ms (401 ms). Anna img data:image/png naturalWidth=1. Ben 'BO' no img; Chiara 'CR' no img.",
      "pass": true
    },
    {
      "recipe": "B2 people box !638 'BOCRDV+1'",
      "observed": "Box 'Assignees Ben Okafor / Reviewers Chiara Rossi, Dmitri Volkov, Sam Weller'. The assignee has no button. Chiara 'Approved' and Dmitri 'Changes requested' have 'Re-request review from …'; Sam 'Review requested' has none. Re-request Chiara: aria-busy=true and 'animate-spin'; 1.5 s later 'Review requested', button gone. Dmitri: 'You are not allowed to re-request a review on this merge request.' (text-problem-error). !623 Sam 'Reviewed': no button. !637: tip 'No assignee or reviewer'. /tmp/vf-b-people-dark.png",
      "pass": true
    },
    {
      "recipe": "B3 approvals",
      "observed": "!640 tip \"No approvals\"; '3 approvals' tip \"Sam Weller\\nAnna Berg\\nBen Okafor\".",
      "pass": true
    },
    {
      "recipe": "B4 labels",
      "observed": "!640 has the chips 'backend' and '+1'. Hovering '+1' adds 'bug'. !636 has no chip.",
      "pass": true
    },
    {
      "recipe": "B5 due date !630 (value set by JS + change event: WebKit date input does not commit typed text; '2026-11-03' typed gave '0003-12-11')",
      "observed": "Nov 3: '!630' is the first row, 'Nov 3, 2026 / 1 day left'. Nov 1: '1 day overdue' in rgb(246,107,113), text-problem-error. Kept after a reload. Clear: 'Set a due date', and !630 is back between !631 and !629. /tmp/vf-b-due-tomorrow-dark.png",
      "pass": true
    },
    {
      "recipe": "B6 hover filters / count order / Shift (synthetic Shift keydown and shiftKey click)",
      "observed": "Assignee opened on hover: 'Me 6, None 10, Anna Berg 6, Ben Okafor 6, Chiara Rossi 6, Dmitri Volkov 6'. Label: 'None 8, bug 11, backend 8, docs 8, frontend 8, ui 8'. Switching opened Label 1 ms later and closed Assignee. Leaving closed it in 301 ms. With Shift held, 6 text-fg-muted icons. Shift-click Me gives 'Assignee: not Me'. Then frontend gives '6 of 40 merge requests | !639,!627,!623,!619,!607,!603', the same after a reload. /tmp/vf-b-filters-dark.png",
      "pass": true
    },
    {
      "recipe": "B7 [title] count",
      "observed": "Section: 0. Header Merge requests button: no title, 0 descendants.",
      "pass": true
    },
    {
      "recipe": "B8 --mr local !635",
      "observed": "'+0 −0 · 0 files', 'Pipeline pending'. Readiness goes from 'GitLab is still checking…' to 'No conflicts (checked locally). GitLab has not checked the rest yet' after 1.5 s. /tmp/vf-b-local-dark.png",
      "pass": true
    },
    {
      "recipe": "B9 shots dark/light (start-fixture: 'app-session: unknown option --settings'; light via Settings → Light)",
      "observed": "Dark: /tmp/vf-b-page-dark.png, /tmp/vf-b-people-dark.png. Light: /tmp/vf-b-tip-light.png, /tmp/vf-b-people-light.png (refusal rgb(229,82,48)), /tmp/vf-b-filter-light.png, /tmp/vf-b-labels-light.png. Sessions stopped.",
      "pass": true
    },
    {
      "recipe": "B extra tooltips in a row, Escape, scroll",
      "observed": "Anna +401 ms, Ben +1 ms, Chiara +0 ms. Escape cleared the tip, and the same Escape closed the page (page=false). The scroll hid Sam's tip; Dmitri's picture then came under the pointer and his tip showed warm 1 ms after enter.",
      "pass": true
    },
    {
      "recipe": "B extra CI box",
      "observed": "Hover 'Pipeline failed' opens 'Failed jobs | test:unit | test:e2e | lint:docs … allowed to fail'. Leaving: no box.",
      "pass": true
    },
    {
      "recipe": "B extra keyboard checklist",
      "observed": "Tab lands on 'Assignee' exp=false. Enter: focus 'Me 6'. Space: 'Assignee: Me'. Shift+Space: 'not Me', 'Assignee: not Me'. Escape: menu gone, focus back on the button, exp=false.",
      "pass": true
    },
    {
      "recipe": "B extra Tab into people box",
      "observed": "From 'Open !638', Tab gives 'BOCRDV+1' exp=true, then Tab 'Re-request review from Chiara Rossi', Tab '… Dmitri Volkov'. Enter on Chiara: busy=true, then 'Review requested'; focus moved to the box DIV.",
      "pass": true
    },
    {
      "recipe": "C real app --glab mr-row-details on /tmp/vf-scratch/rd (debug build)",
      "observed": "3 of 3. !52 '+0 −0 · 0 files | frontend (rgb(66,139,202)) | +2'. !51 has no size and 'No assignee or reviewer'. Anna yamt-picture://localhost/anna nw=16; Sam …/sam nw=32; Ben is the scenario's secure.gravatar.com address, nw=80. Chiara and Dmitri are initials with no img. !50: no re-request buttons. !52: Ben and Chiara have buttons, Dmitri has none.",
      "pass": true
    },
    {
      "recipe": "C anna's uploaded picture (#2123)",
      "observed": "Anna's img 16x16, complete, opacity 1. /tmp/vf-c-page-dark.png shows a red round picture, not initials.",
      "pass": true
    },
    {
      "recipe": "C app log WARN, CSP, re-requests",
      "observed": "'WARN yamt_merge_requests::people: unknown review state, shown as requested state=\"MERGE_TRAIN_REVIEW\"', one per load (2 lines for 2 openings). No CSP line; the securitypolicyviolation listener recorded []. 'INFO …rerequest: asked GitLab to re-request a review iid=52 outcome=\"requested\"' and '… outcome=\"refused\"'.",
      "pass": true
    },
    {
      "recipe": "C img addresses; second opening",
      "observed": "The page's img srcs are only yamt-picture://localhost/anna, …/sam and the scenario's gravatar. calls.log has 2 picture calls (avatar/2, avatar/1), both on the first load. The second load: none.",
      "pass": true
    },
    {
      "recipe": "C post 1 Ben",
      "observed": "Ben now 'Review requested', button gone. stdin: mutation mergeRequestReviewerRereview with variables {\"iid\":\"52\",\"projectPath\":\"taskboard/taskboard\",\"userId\":\"gid://gitlab/User/4\"} (ben's id).",
      "pass": true
    },
    {
      "recipe": "C post 2 Chiara",
      "observed": "Status 'Reviewer not found' under Chiara (userId User/5). The box stayed open after the pointer left because focus was in it. A click outside closed it; reopened, status [].",
      "pass": true
    },
    {
      "recipe": "C fake-glab log",
      "observed": "No 'gravatar' in calls.log; the only mutation is mergeRequestReviewerRereview (×2).",
      "pass": true
    },
    {
      "recipe": "C shots; stop",
      "observed": "/tmp/vf-c-page-dark.png, /tmp/vf-c-refusal-dark.png, /tmp/vf-c-box-light.png (theme=light). Sessions stopped.",
      "pass": true
    }
  ],
  "environment": "HEAD 3a9c9566 (.omp/run/slices.json modified only); rustc 1.99.0, node v26.13.0, pnpm 12.0.0; MiniBrowser/tauri-driver on private display, 1600x1000; owner check and mutants not run."
}
