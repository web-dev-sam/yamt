# MrPageSmoke

Agent output (`agent://MrPageSmoke`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-10-30T19-31-04-168Z_01a18e4b-5568-7113-b48d-cb43e7b9c05a/MrPageSmoke.md), collected 2026-10-30T19:57:54.863Z.

{
  "gate": "not-run",
  "failures": [],
  "smoke": [
    {
      "recipe": "1a fixture --diff --mr list: click title of !639",
      "observed": "click 'Open !639 on GitLab' → console: [info] mergeRequests.fixture_page {page: \"https://gitlab.example/taskboard/taskboard/-/merge_requests/639\"} (one line)",
      "pass": true
    },
    {
      "recipe": "1b click empty middle of a row (li 3, !638; elementFromPoint at the spot = the row's flex-1 DIV, not the title)",
      "observed": "one line: mergeRequests.fixture_page {page: \".../-/merge_requests/638\"}",
      "pass": true
    },
    {
      "recipe": "1c click discussions / approvals count",
      "observed": "'2 open discussions' (!638 row) → one line .../merge_requests/638; '3 approvals' (!637 row) → one line .../merge_requests/637",
      "pass": true
    },
    {
      "recipe": "1d open-changes button, then click again while fetching",
      "observed": "after click: button 'Open the changes of !637' disabled=true aria-busy=true; second click on it → log [] (no fixture_page), still disabled. The row later showed 'GitLab is still preparing the changes of !637; try again in a moment.'",
      "pass": true
    },
    {
      "recipe": "1e hover CI icon, click failed job, click CI icon",
      "observed": "hover 'Pipeline failed' (!640) → aria-expanded=true, box 'Failed jobs test:unit test:e2e lint:docs (allowed to fail)'; click 'Open the log of test:unit on GitLab' → only: mergeRequests.fixture_page {page: \".../taskboard/-/jobs/9001\"}; click 'Pipeline failed' icon → log []",
      "pass": true
    },
    {
      "recipe": "1f Tab to a title, Enter",
      "observed": "focus 'Ready' filter (document.hasFocus() true), Tab → activeElement 'Open !640 on GitLab'; Enter → exactly one line .../merge_requests/640",
      "pass": true
    },
    {
      "recipe": "1g hovered row screenshot",
      "observed": "hover row !635: li:hover true, computed cursor 'pointer', background rgba(233, 228, 254, 0.05) vs neighbour rgba(0, 0, 0, 0); page screenshot /tmp/yamt-mrsmoke-hover.png (WebDriver page source) showed row !635 slightly lighter than the others. File removed with the cleanup.",
      "pass": true
    },
    {
      "recipe": "2 real app: range-repo + start-app --range main...feature --glab merge-requests",
      "observed": "MR page listed !13 !12 !11 !9 !8. Click row !12 middle → opened.log 'argv: https://gitlab.example/taskboard/taskboard/-/merge_requests/12'; hover !13 'Pipeline failed', click 'Open the log of lint on GitLab' → opened.log gained 'argv: https://gitlab.example/taskboard/taskboard/-/jobs/302'; no [role=alert], no problem text (only 'Failed jobs', 'allowed to fail'). Session stopped; /tmp/yamt-mrsmoke-* removed.",
      "pass": true
    }
  ],
  "environment": "tree 0b71c37; rustc 1.99.0 (b940084d7 2026-09-28), node v26.13.0, pnpm 12.0.0; debug app built with `cargo tauri build --debug --no-bundle`; fixture on MiniBrowser/WebKitWebDriver, app on tauri-driver + xvfb :3 via just app-session. Console lines were captured by wrapping console.info/warn/error from `app-session read` (app-session has no console capture command)."
}
