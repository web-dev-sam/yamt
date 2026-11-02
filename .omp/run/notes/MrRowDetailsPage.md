# MrRowDetailsPage

Agent output (`agent://MrRowDetailsPage`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-02T19-44-30-486Z_01a19dca-b716-72dc-ab4f-c92917fdd42d/MrRowDetailsPage.md), collected 2026-11-02T21:18:19.793Z.

{
  "summary": "The page is wired. Each row shows: the author's picture, its labels (a chip plus a \"+N\" hover box), a people stack whose hover box lists reviewers with GitLab's re-request button and state icons, a due-date column with a native date box, and approvers as a tooltip. The three filters share one hover menu in the View, with included/excluded values and Shift. Every title in the page's components is now `v-tooltip`, and `mergeRequestTitles.test.ts` fails on any new one. CiStatusBox now uses useHoverBox. `pnpm -C frontend typecheck` is clean.",
  "files_changed": [
    "frontend/src/ui/MergeRequestPicture.vue",
    "frontend/src/ui/MergeRequestPeople.vue",
    "frontend/src/ui/MergeRequestLabels.vue",
    "frontend/src/ui/MergeRequestDueDate.vue",
    "frontend/src/ui/MergeRequestRow.vue",
    "frontend/src/ui/MergeRequestFilter.vue",
    "frontend/src/ui/MergeRequestsView.vue",
    "frontend/src/ui/CiStatusBox.vue",
    "frontend/src/ui/MergeRequestReadiness.vue",
    "frontend/src/ui/MergeRequestsButton.vue",
    "frontend/src/ui/mergeRequestsText.ts",
    "frontend/src/ui/mergeRequestsText.test.ts",
    "frontend/src/ui/mergeRequestTitles.test.ts",
    "frontend/src/ui/AGENTS.md"
  ],
  "tests_added": [
    {
      "name": "mergeRequestsText.test.ts: the people box, re-request and due-date words…; the re-request button is named after its reviewer",
      "proves": "ASSIGNEES, REVIEWERS, REREQUEST_REVIEW, SET_DUE_DATE and CLEAR_DUE_DATE match their exact words, and so does rerequestLabel."
    },
    {
      "name": "mergeRequestsText.test.ts: the re-request reply %j reads %j (6 cases); a refused re-request reads the list's sentence…",
      "proves": "Each refusal kind reads its exact sentence. For glabMissing and notLoggedIn the sentence equals listFailureText's; refused and failed give the message as sent."
    },
    {
      "name": "mergeRequestsText.test.ts: due-date label; an excluded value is named with not",
      "proves": "dueDateLabel gives \"Due Nov 9, 2026, 7 days left. Change the due date\" and notValueLabel(\"anna\") gives \"not anna\"."
    },
    {
      "name": "mergeRequestTitles.test.ts: no title attribute / reported with file and line / read from disk",
      "proves": "The detector reads every ui/MergeRequest*.vue and CiStatus*.vue from disk with import.meta.glob ?raw. The real tree is clean. A sample with :title= and title= is reported as file and line; data-title and v-tooltip are not."
    }
  ],
  "smoke_evidence": [
    {
      "command": "pnpm -C frontend lint; typecheck; test; fmt:check; sfc-order; unused",
      "observed": "lint and eslint: no output (exit 0). vue-tsc -b: no errors. Test Files 256 passed (256), Tests 3729 passed (3729). fmt: \"All matched files use the correct format.\" sfc-order and knip: no findings."
    },
    {
      "command": "WebKit fixture (start-fixture --name rd --diff --mr list --size 1600x1000), item 1: read on !640 and on rows by author, then pointerenter on the author picture",
      "observed": "The picture is the row's first element, aria-label \"Author: Anna Berg\", and anna's img has naturalWidth 1. The tip is absent at 200 and 350 ms and reads \"Author: Anna Berg\" at 450 ms. Ben's rows (!639, !634, !629) show \"BO\" with img null after the error. Chiara's row !638 has no img."
    },
    {
      "command": "fixture item 2: hover the !638 stack, then click re-request on Chiara, then on Dmitri",
      "observed": "3 pictures and +1. Box: Assignees Ben (0 buttons). Reviewers: Chiara Approved and Dmitri Changes requested, each with the button before the icon; Sam Review requested, none. Hover tip \"Approved\". Chiara: aria-busy, disabled, spinner; 1.2 s later Review requested, no button. Dmitri: the refusal sentence in red; 0 refusals after the box closes. !623/!614 (mayRerequest false): no buttons. !637: muted icon \"No assignee or reviewer\"."
    },
    {
      "command": "fixture items 3–4: approvals tips and labels",
      "observed": "!640 approvals tip: \"No approvals\". The \"3 approvals\" tip's innerText is \"Sam Weller\\nAnna Berg\\nBen Okafor\". !640 shows the chip \"backend\" (teal on white) and \"+1\"; its box reads \"bug\". !636 renders no labels element."
    },
    {
      "command": "fixture item 5: type 11/03/2026 + Enter on !630, then 11/01/2026 + Enter, reload, then Clear",
      "observed": "\"Nov 3, 2026\\n1 day left\" and !630 is the first row. Then \"Due Nov 1, 2026, 1 day overdue…\" in text-problem-error rgb(246, 107, 113). After the reload !630 is still first with the same date. Clear: the order is back to !640 !639 … !631 !630, storage is {}, and focus is on \"Set a due date\"."
    },
    {
      "command": "fixture item 6: hover Assignee, then Label, then leave (pointerleave timed in the page); Shift; Shift+click Me; click frontend; reload",
      "observed": "Only the Assignee menu opens and focus does not move. On Label, only the Label menu: None 8 | bug 11 | backend 8 | docs 8 | frontend 8 | ui 8. After leaving: still open at 200 ms, 0 menus at 400 ms. Shift keydown turns every leading SPAN into an svg (circle-minus). Shift+click Me gives \"Assignee: not Me\", aria-label \"not Me\", red and struck. Clicking frontend gives \"6 of 40 merge requests\" with !639 !627 !623 !619 !607 !603, the same after a reload."
    },
    {
      "command": "fixture item 7: count [title] in the page section and on the header button; failed CI box opened",
      "observed": "[0, false, [false]], and 0 with the CI box open too. 27 elements carry aria-description. The job buttons' aria-description reads \"Open the log of test:unit on GitLab\"."
    },
    {
      "command": "fixture item 8 (--mr local): read !635 after 2.5 s",
      "observed": "\"!635 · created 1 week ago · +0 −0 · 0 files\"; CI \"Pipeline pending\"; readiness \"No conflicts (checked locally). GitLab has not checked the rest yet\"."
    },
    {
      "command": "fixture item 9: shot dark and light (light set through Settings → Light), then stop --name rd",
      "observed": "/tmp/rd-dark.png, /tmp/rd-people-box.png, /tmp/rd-refusal.png, /tmp/rd-labels.png, /tmp/rd-shift.png, /tmp/rd-overdue.png, /tmp/rd-local.png, /tmp/rd-light.png (data-theme light, people box open). Every session was stopped."
    },
    {
      "command": "real app: local-conflicts-repo.sh /tmp/yamt-rd-scratch/rd; cargo tauri build --debug --no-bundle; start-app --name rd --diff --dir … --glab mr-row-details",
      "observed": "anna: src yamt-picture://localhost/anna, naturalWidth 16, drawn as an image. sam: yamt-picture://localhost/sam, w 32. ben: src exactly https://secure.gravatar.com/avatar/0f3a…d2f4?s=80&d=identicon (loaded, w 80). chiara and dmitri: initials, img null. Labels: frontend rgb(66, 139, 202) and +2. !52: +0 −0 · 0 files. !51: no size, the muted icon and \"Author: unknown\"."
    },
    {
      "command": "real app: !50 and !52 boxes; re-request ben on !52; calls.log; tauri-driver.log",
      "observed": "!50: Changes requested, Review requested, Reviewed, Review requested, no buttons. !52: ben has a button, dmitri (Review requested) none. After clicking ben he reads Review requested. calls.log: stdin body with \"userId\":\"gid://gitlab/User/4\" (ben). Two picture calls (avatar/1, avatar/2), 0 lines naming gravatar. Exactly 1 WARN: unknown review state, shown as requested state=\"MERGE_TRAIN_REVIEW\". Shot taken, session stopped."
    }
  ],
  "mutation": {
    "command": "just mutants HEAD: Stryker on mergeRequestsText.ts (the only changed non-test .ts): 177 killed, 0 survived, 14 no-cov, score 92.67",
    "survivors": [
      "src/ui/mergeRequestsText.ts:60 listFailureText default {}/default: NoCoverage — gate-covered: the `never` exhaustive arm cannot be reached (vue-tsc and tsgolint switch-exhaustiveness)",
      "src/ui/mergeRequestsText.ts:125 rerequestReplyText default {}/default: NoCoverage — gate-covered: the same `never` arm; the other 10 no-cov are the same arms on unchanged lines 166–268"
    ]
  },
  "acceptance_not_run": [],
  "deviations_from_brief": [
    "VU15, four new components: MergeRequestPicture (one picture, used in 4 places), MergeRequestPeople (stack plus hover box and re-request), MergeRequestLabels (chips plus +N box), MergeRequestDueDate (column plus date box). Each is a separate row control with its own hover or click box.",
    "Core `peopleStack` is typed over the core Person, which drops `picture`. MergeRequestPeople maps the shown people back to the row's domain Person by username. Proposed core change: `peopleStack<P extends Person>(assignees: readonly P[], reviewers: readonly { person: P }[])`.",
    "MergeRequestFilter's defineExpose also exposes `narrowBox` (add-only), so the View can focus it after an opener click. The View finds each filter through `$props.filter` on the template-ref array. The `typed` text resets whenever `open` turns true.",
    "Shift+click and holding Shift in the fixture were done with synthetic events (a MouseEvent with shiftKey; a keydown on document), because app-session has no modifier click and `press` releases at once.",
    "The date field was typed as \"11/03/2026\" and then Enter, because WebKitGTK fires `input` per digit and `change` only on Enter or blur.",
    "Docs keeper: tree.md rows for MergeRequestPicture/People/Labels/DueDate.vue. The plan §2 #157 layout is as built. The TS15 / state.md lines from the hover slice are written into ui/AGENTS.md here.",
    "The fixture's light theme was set through Settings → Light: start-fixture has no --settings option."
  ],
  "open_risks": [
    {
      "location": "frontend/src/ui/MergeRequestDueDate.vue:65 (picked)",
      "risk": "WebKitGTK fires `change` on blur. A typed date followed by a click outside therefore saves before the box closes. Escape still closes without saving."
    },
    {
      "location": "frontend/src/ui/MergeRequestDueDate.vue:57 (closeToOpener)",
      "risk": "Focus returns to the opener only when it fell to body. This rule is needed because a dated row moves, and the move blurs the opener. A click on a non-focusable spot outside also lands focus there."
    },
    {
      "location": "frontend/src/ui/MergeRequestPeople.vue:61-71",
      "risk": "The domain Person is found again by username after peopleStack. Two reviewers with one username would collapse, which GitLab does not send."
    },
    {
      "location": "frontend/src/ui/MergeRequestPicture.vue:22",
      "risk": "hue-rotate also turns the text-on-primary initials. They stay light, but this was not measured against WCAG contrast in every theme."
    }
  ]
}
