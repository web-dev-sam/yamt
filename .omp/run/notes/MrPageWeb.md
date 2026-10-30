# MrPageWeb

Agent output (`agent://MrPageWeb`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-10-30T19-31-04-168Z_01a18e4b-5568-7113-b48d-cb43e7b9c05a/MrPageWeb.md), collected 2026-10-30T19:55:21.793Z.

{
  "summary": "A merge request's row now opens its GitLab page. The click works anywhere on the row except the CI box and the open-changes button. The title is a button labelled \"Open !N on GitLab\" that opens on Enter or Space. Brand/answer/opener renamed JobPage/JobOpened/openJobPage → WebPage/PageOpened/openPage. Rows convert and check `page` like a job's; fixture rows carry <ORIGIN>/-/merge_requests/<iid> and log `mergeRequests.fixture_page`. One `pageProblem` line with one `pageProblemText(answer, kind)`; a failed MR call reports at the new step \"page\".",
  "files_changed": [
    "frontend/src/ipc/AGENTS.md",
    "frontend/src/ipc/MergeRequestSource.ts",
    "frontend/src/ipc/domain.ts",
    "frontend/src/ipc/index.ts",
    "frontend/src/ipc/mergeRequestDomain.ts",
    "frontend/src/ipc/mergeRequestDomain.test.ts",
    "frontend/src/ipc/tauriMergeRequests.ts",
    "frontend/src/ipc/tauriMergeRequests.test.ts",
    "frontend/src/ipc/fixtureMergeRequests.ts",
    "frontend/src/ipc/fixtureMergeRequests.test.ts",
    "frontend/src/ipc/fixtureMergeRequestData.ts",
    "frontend/src/ui/MergeRequestRow.vue",
    "frontend/src/ui/CiStatusBox.vue",
    "frontend/src/ui/MergeRequestsView.vue",
    "frontend/src/ui/mergeRequests.ts",
    "frontend/src/ui/mergeRequests.test.ts",
    "frontend/src/ui/mergeRequestsText.ts",
    "frontend/src/ui/mergeRequestsText.test.ts",
    "frontend/src/ui/problem.ts",
    "frontend/src/ui/problemText.ts",
    "frontend/src/ui/problemText.test.ts"
  ],
  "tests_added": [
    {
      "name": "mergeRequestDomain.test: a merge request page %j that is not https is refused like a job's",
      "proves": "A row's page that is http, //, relative or empty is refused, with the message `rows[0].page must be an https address`."
    },
    {
      "name": "mergeRequestDomain.test: no pipeline and no page stay null",
      "proves": "A null row page stays null after conversion, and the ROW fixture's page passes through unchanged."
    },
    {
      "name": "fixtureMergeRequests.test: the listed page %s opens as logged",
      "proves": "A job page and an MR page are each among the offered pages, and openPage logs `mergeRequests.fixture_page {\"page\":…}` once."
    },
    {
      "name": "fixtureMergeRequests.test: every listed row has its own merge request's page",
      "proves": "Every ?mr=list row has the page <ORIGIN>/-/merge_requests/<its iid>."
    },
    {
      "name": "mergeRequests.test: a %s click on %s answered %j leaves the page problem %j",
      "proves": "The exact page reaches source.openPage for both a job click and an MR click. opened → null; notOffered/failed → the right sentence for each kind. Dismissing clears it."
    },
    {
      "name": "mergeRequests.test: an opened page clears an earlier page problem, whichever kind it was",
      "proves": "There is one problem field across both kinds: an opened MR page clears a job's notOffered line."
    },
    {
      "name": "mergeRequests.test: a failed %s page call is reported at its own step",
      "proves": "A failed call reports step \"job\" for a job and step \"page\" for an MR, and leaves no page problem."
    },
    {
      "name": "mergeRequestsText.test: the answer %j for a %s page shows %j; openPageTitle",
      "proves": "pageProblemText wording for every answer and kind; openPageTitle gives \"Open !13 on GitLab\"."
    },
    {
      "name": "problemText.test: a failed merge-request call at page",
      "proves": "Step \"page\" reads \"Could not open the merge request's page: …\"."
    }
  ],
  "smoke_evidence": [
    {
      "command": "pnpm -C frontend typecheck; pnpm -C frontend lint; pnpm -C frontend test",
      "observed": "`vue-tsc -b` printed no errors. `lint` (oxlint --type-aware + eslint) exited 0. Tests: \"Test Files 235 passed (235) / Tests 3252 passed (3252)\". `sfc-order`, `unused` (knip) and `fmt:check` were clean (\"All matched files use the correct format.\")."
    },
    {
      "command": "grep -rn \"JobPage\\|isJobPage\\|JobOpened\\|openJobPage\\|jobProblem\\|fixture_job\" frontend/src",
      "observed": "No output, grep exit 1."
    },
    {
      "command": "just app-session start-fixture --name mrweb --diff --mr list; click \"Merge requests\"; hook console.info into window.__lines; click \"Open !640 on GitLab\"",
      "observed": "Exactly one line: `[info] mergeRequests.fixture_page {page: \"https://gitlab.example/taskboard/taskboard/-/merge_requests/640\"}`. No second open from the click bubbling up."
    },
    {
      "command": "click css \"ul[aria-label='Open merge requests'] li:nth-child(2) div.flex-1\" (viewport 823,197: empty space right of the created text, which ends at x≈595)",
      "observed": "New line: `mergeRequests.fixture_page {page: \".../-/merge_requests/639\"}`."
    },
    {
      "command": "click \"Open the changes of !640\"; read aria-busy and the line count",
      "observed": "aria-busy \"true\" (fetching spinner); the line count stayed 2, so no fixture_page. A second later the row shows \"Opened !640 in a new window.\""
    },
    {
      "command": "hover \"Pipeline failed\" (row 1); click \"Open the log of test:unit on GitLab\"; click the icon \"Pipeline failed\" --nth 0; click the disabled test:e2e job",
      "observed": "The job click logged only `fixture_page {page: \".../-/jobs/9001\"}`, not the row's page. The icon click and the disabled-job click added no lines (count stayed 3)."
    },
    {
      "command": "focus \"Open the changes of !639\"; press Tab; press Enter; press Space",
      "observed": "activeElement had aria-label and title \"Open !638 on GitLab\". Enter and Space each logged exactly one `fixture_page {page: \".../-/merge_requests/638\"}`."
    },
    {
      "command": "hover li:nth-child(4) div.flex-1; read computed style; shot /tmp/yamt-MrPageWeb-hovered-row.png",
      "observed": "Hovered li: cursor \"pointer\", background rgba(233,228,254,0.05); unhovered li is transparent. The screenshot shows row !637 with the hover background and !638's title button with the focus ring."
    },
    {
      "command": "cargo tauri build --debug --no-bundle; scripts/range-repo.sh /tmp/yamt-mrweb-range; just app-session start-app --name mrwebapp --range main...feature --repo /tmp/yamt-mrweb-range --glab merge-requests; click \"Merge requests\"",
      "observed": "The list shows the titles \"Open !13/!12/!11/!9/!8 on GitLab\"."
    },
    {
      "command": "click row 2's empty middle; click \"Open !13 on GitLab\"; hover \"Pipeline failed\"; click \"Open the log of unit tests on GitLab\"; cat <session>/glab/opened.log",
      "observed": "`argv: https://gitlab.example/taskboard/taskboard/-/merge_requests/12`, `argv: https://gitlab.example/taskboard/taskboard/-/merge_requests/13`, `argv: https://gitlab.example/taskboard/taskboard/-/jobs/301`. No problem line shown."
    },
    {
      "command": "just app-session stop --name mrwebapp; rm -rf /tmp/yamt-mrweb-range",
      "observed": "Both sessions stopped and their folders were removed. No /tmp/yamt-mrweb-* left; the screenshot was kept as /tmp/yamt-MrPageWeb-hovered-row.png."
    }
  ],
  "mutation": {
    "command": "just mutants HEAD: 851 killed, 85 survived, 18 no-cov (89.20%); one survivor on a changed line, the rest on unchanged lines",
    "survivors": [
      "frontend/src/ui/mergeRequestsText.ts:128 ConditionalExpression/BlockStatement (NoCoverage) on pageProblemText's `default: { const _exhaustive: never = opened }` — gate-covered: vue-tsc proves this arm unreachable (TS3)."
    ]
  },
  "acceptance_not_run": [],
  "deviations_from_brief": [
    "Owned extended by Main: ui/problem.ts gains MergeRequestStep \"page\", ui/problemText.ts has \"Could not open the merge request's page\" and problemText.test.ts has its case. A failed MR-page call reports at step \"page\"; jobs stay at \"job\".",
    "jobOpenedText(answer): string became pageProblemText(answer, kind): string | null. \"opened\" now gives null, so the never-shown sentence \"Opened the job's log in the browser.\" is gone and the store assigns the result directly.",
    "New vocabulary: `PageKind = \"job\" | \"mergeRequest\"` lives in ui/mergeRequestsText.ts beside the texts it selects. The store action is `openPage(clicked: PageKind, page: WebPage)` with `pageProblem`/`dismissPageProblem`. The row emits `openPage: [clicked, page]`.",
    "CiStatusBox keeps its job-only `openJob` emit and function: they never cover an MR page, so they are not on the brief's rename list.",
    "Not done here: docs/architecture.md, project-map tree.md/state.md and ipc-contract still say openJobPage/jobProblem/fixture_job (docs keeper).",
    "Behaviour 3 (a row whose page is null) was not driven in WebKit: every fixture and range-repo row has a page. It is covered only by the template's v-if/v-else and the conversion test."
  ],
  "open_risks": [
    {
      "location": "frontend/src/ui/MergeRequestRow.vue:62-71",
      "risk": "The title button's tooltip \"Open !N on GitLab\" is on the button, and the full-title tooltip is on the inner span. The span fills the button, so hovering the text shows the full title and the \"Open …\" tooltip rarely appears; the accessible name is still \"Open !N\"."
    },
    {
      "location": "frontend/src/ui/MergeRequestRow.vue:56-60",
      "risk": "A click anywhere on the li opens the page, so a mouse-up after selecting text inside one span may open it too. Not tested."
    },
    {
      "location": "frontend/src/ui/MergeRequestRow.vue:101-112",
      "risk": "Clicking the open-changes button while it is disabled (fetching) relies on WebKit not sending the click to the li. Not exercised."
    }
  ]
}
