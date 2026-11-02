# MrRowDetailsSmoke

Agent output (`agent://MrRowDetailsSmoke`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-02T19-44-30-486Z_01a19dca-b716-72dc-ab4f-c92917fdd42d/MrRowDetailsSmoke.md), collected 2026-11-02T21:30:01.873Z.

{
  "gate": "not-run",
  "failures": [
    {
      "step": "B keyboard: Enter on a re-request button inside the people box",
      "excerpt": "Fixture !639: Tab from 'Open !639' → stack \"AB\\nDV\" expanded=true → Tab → 'Re-request review from Dmitri Volkov' busy=false; press Enter → the box closes at once and focus lands on BODY (read: focus=BODY|null). The re-request did run: reopening by hover shows \"DV\\nDmitri Volkov\\n\\nYou are not allowed to re-request a review on this merge request.\" A keyboard user loses focus and never sees the reply. The refusal also survived that close: it was still there on reopen. It cleared only after a pointer close (reopen: role=status count 0). With the mouse the box stays open: spinner → result."
    },
    {
      "step": "B labels changed on rows not touched (observed once, not reproduced)",
      "excerpt": "After the re-requests on !638 in the dark fixture, !640 read \"…+12 −0 · 1 file/bug/SW/0/0\" (chip 'bug' only) instead of \"backend/+1\", and !628 showed 'bug' instead of 'backend +1' (see /tmp/rdv/B-dark-peoplebox.png). After location.reload() !640 read \"backend/+1\" again. A later attempt to reproduce it did not change any labels."
    }
  ],
  "smoke": [
    {
      "recipe": "B1 fixture --mr list 1600x1000 dark: author pictures, tip delay",
      "observed": "!640 'Author: Anna Berg': AB, img nw=1 opacity=1. 'Author: Ben Okafor' (!639): BO, img=none. 'Author: Chiara Rossi' (!638): CR, img=none. pointerover Anna @118902 → tip \"Author: Anna Berg\" @119303 (401 ms).",
      "pass": true
    },
    {
      "recipe": "B tooltips: three in a row, Escape, list scroll",
      "observed": "Anna tip after 401 ms; '0 approvals' → \"No approvals\" after 1 ms; '0 open discussions' → shown after 1 ms. Escape → tip hidden=true (Escape also left the MR page). List scroll → tip hidden. Once, after a scroll, a 1.1 s hover on Anna showed no tip; not seen again.",
      "pass": true
    },
    {
      "recipe": "B CI box hover",
      "observed": "hover 'Pipeline failed' (!640): group \"Failed jobs\\n\\ntest:unit\\ntest\\ntest:e2e\\ntest\\nlint:docs\\nlint\\nallowed to fail\". Pointer to body → gone after 0.8 s.",
      "pass": true
    },
    {
      "recipe": "B2 people stack/box, re-request",
      "observed": "!638 stack 'BOCRDV+1'. Box: Assignees Ben Okafor (no button); Reviewers Chiara [Re-request…, Approved], Dmitri [Re-request…, Changes requested], Sam [Review requested] with no button. Tip \"Approved\". Chiara click: busy, spinner → [Review requested]. Dmitri: \"You are not allowed to re-request a review on this merge request.\" rgb(246,107,113). !614 (mayRerequest false): 0 buttons. !637: 'No assignee or reviewer' svg rgb(129,126,141).",
      "pass": true
    },
    {
      "recipe": "B3 approvals tips",
      "observed": "!640 → \"No approvals\". !637 '3 approvals' → \"Sam Weller\\nAnna Berg\\nBen Okafor\" (pre-wrap).",
      "pass": true
    },
    {
      "recipe": "B4 labels",
      "observed": "!640 \"backend/+1\"; hover '+1' → \"bug\" appears, gone after leaving. !636: no chips.",
      "pass": true
    },
    {
      "recipe": "B5 due date !630",
      "observed": "WebDriver typing into the WebKit date input did not commit a value, so the date was set by JS (input.value plus a change event). 2026-11-03 → !630 first, \"Nov 3, 2026/1 day left\". 2026-11-01 → \"1 day overdue\" text-problem-error rgb(246,107,113). Reload: kept. Clear: !630 back between !631 and !629.",
      "pass": true
    },
    {
      "recipe": "B6 filters hover/Shift/frontend",
      "observed": "Assignee hover: \"Me 6, None 10, Anna Berg 6, Ben Okafor 6, Chiara Rossi 6, Dmitri Volkov 6\". Assignee→Label switch in 1 ms; leaving: closed after 301 ms. Shift held (synthetic keydown; app-session cannot hold a key): +5 text-fg-muted circle-minus icons, gone on keyup. 'Assignee: not Me' + frontend → \"6 of 40 merge requests | !639,!627,!623,!619,!607,!603\"; same after reload.",
      "pass": true
    },
    {
      "recipe": "B keyboard filter",
      "observed": "Enter on Assignee → focus 'Me 6' menuitemcheckbox; Space → checked, 'Assignee: Me'; Shift+Space → 'Assignee: not Me'; Escape → focus on \"Assignee: not Me\" with expanded=false.",
      "pass": true
    },
    {
      "recipe": "B keyboard people box",
      "observed": "Tab reaches the stack (expanded) and then 'Re-request review from Dmitri Volkov'; Enter re-requests, but the box closes and focus goes to BODY (see failures).",
      "pass": false
    },
    {
      "recipe": "B7 [title] count",
      "observed": "page section: titles=0; header Merge requests button: 0.",
      "pass": true
    },
    {
      "recipe": "B8 --mr local !635",
      "observed": "\"+0 −0 · 0 files\", 'Pipeline pending'; at first 'GitLab is still checking whether it can be merged', then 'No conflicts (checked locally). GitLab has not checked the rest yet'. Only img src: data:image/png.",
      "pass": true
    },
    {
      "recipe": "B9 shots dark/light",
      "observed": "start-fixture rejects --settings ('unknown option --settings'), so light was set in Settings → Light. Shots: /tmp/rdv/B-dark-peoplebox.png, /tmp/rdv/B-dark-page.png, /tmp/rdv/B-light-peoplebox.png, /tmp/rdv/B-light-page.png. Sessions stopped.",
      "pass": true
    },
    {
      "recipe": "C real app --glab mr-row-details rows/labels",
      "observed": "\"!52 · created 1 day ago · +0 −0 · 0 files/frontend/+2\"; !51 has no size, 'Author: unknown' and 'No assignee or reviewer'; frontend bg rgb(66, 139, 202).",
      "pass": true
    },
    {
      "recipe": "C pictures",
      "observed": "Anna src=yamt-picture://localhost/anna nw=16; Sam yamt-picture://localhost/sam nw=32; Ben https://secure.gravatar.com/avatar/0f3a9c2e…?s=80&d=identicon nw=80. Chiara and Dmitri: initials, no img. Distinct img srcs: only those three. No CSP line in the app log.",
      "pass": true
    },
    {
      "recipe": "C boxes and re-request",
      "observed": "!50: Changes requested / Review requested / Reviewed / Review requested (Erik), no buttons. !52: Ben [Re-request…, Reviewed], Chiara [Re-request…, Approved], Dmitri [Review requested] with no button. Ben → Review requested. Chiara → \"Reviewer not found\" (status), gone after pointer close and reopen.",
      "pass": true
    },
    {
      "recipe": "C fake-glab log",
      "observed": "One call each: 'api https://gitlab.example/uploads/-/system/user/avatar/2/avatar.png' and '…/1/avatar.png'. Gravatar lines: 0. Mutations: only mergeRequestReviewerRereview ×2. stdin variables {\"iid\":\"52\",\"projectPath\":\"taskboard/taskboard\",\"userId\":\"gid://gitlab/User/4\"} (ben), then User/5. The second opening made only a MergeRequestPage call, no picture call.",
      "pass": true
    },
    {
      "recipe": "C app log",
      "observed": "WARN yamt_merge_requests::people: unknown review state, shown as requested state=\"MERGE_TRAIN_REVIEW\" (one per page load, 2 loads). INFO …rerequest: asked GitLab to re-request a review iid=52 outcome=\"requested\"; the same with outcome=\"refused\". score=170 limit=250.",
      "pass": true
    },
    {
      "recipe": "C shots",
      "observed": "/tmp/rdv/C-dark-box.png, /tmp/rdv/C-dark-refusal.png, /tmp/rdv/C-light-box.png; session stopped.",
      "pass": true
    }
  ],
  "environment": "Tree 2a90ef3d. rustc 1.99.0, node v26.13.0, pnpm 12.0.0. MiniBrowser and the app ran on private displays through app-session. Debug app built with cargo tauri build --debug --no-bundle. Gravatar reachable on the network."
}
