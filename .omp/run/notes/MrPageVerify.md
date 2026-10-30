# MrPageVerify

Agent output (`agent://MrPageVerify`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-10-30T19-31-04-168Z_01a18e4b-5568-7113-b48d-cb43e7b9c05a/MrPageVerify.md), collected 2026-10-30T20:11:26.549Z.

{
  "gate": "pass",
  "failures": [
    {
      "step": "smoke 1 (fix-round change): click on the empty CI slot of a row without a pipeline opens that row's page",
      "excerpt": "Fixture --mr list. `just app-session click --name mrv \"span.w-7\" --nth 3` (!637, slot EMPTY) -> {\"clicked\":{\"role\":\"\",\"name\":\"\"},\"viewport\":{\"x\":1529,\"y\":353}}; no new fixture_page line. Second row without a pipeline (!629, --nth 11) -> viewport y 758, slot rect {\"x\":1515,\"y\":668,\"width\":28,\"height\":0}; log [] (nothing). The empty slot span is 28x0, so a WebDriver click on it lands about 66–90 px below, on another row. Hit test: elementFromPoint(1529, row centre 286) = DIV.flex items-center gap-3 (the row). A synthetic JS click there logged `mergeRequests.fixture_page {page: \".../merge_requests/637\"}`. That suggests a real pointer click on the row's slot area works, but the recipe could not show it with a real click. The 0-height empty slot is the finding for the window slice."
    }
  ],
  "smoke": [
    {
      "recipe": "just check",
      "observed": "Ran once, EXIT 0 (50.7 s). Last lines: golden ok ×10, sfc-order, hooks-test ℹ tests 18 pass 18 fail 0.",
      "pass": true
    },
    {
      "recipe": "fixture title tooltip/name (fix round)",
      "observed": "title buttons: aria-label=title=\"Open !640 on GitLab: Snooze a reminder\", \"Open !639 on GitLab: Show overdue cards in red\", …; innerTitles=0 for each",
      "pass": true
    },
    {
      "recipe": "1a click title (fixture, WebKit)",
      "observed": "[info] mergeRequests.fixture_page {page: \"https://gitlab.example/taskboard/taskboard/-/merge_requests/640\"} (one line)",
      "pass": true
    },
    {
      "recipe": "1b click empty middle of the row",
      "observed": "click div.flex-1.items-baseline nth 1 at (823,197) -> one line …/merge_requests/639",
      "pass": true
    },
    {
      "recipe": "1c click discussions / approvals count",
      "observed": "\"2 open discussions\" -> one line …/merge_requests/638; \"3 approvals\" -> one line …/merge_requests/637",
      "pass": true
    },
    {
      "recipe": "1d open-changes button, fetching, click again",
      "observed": "after the click, !637's button disabled=true aria-busy=true; clicked again while disabled; fixture_page count stayed 4 (no new line). The row then showed \"GitLab is still preparing the changes of !637; try again in a moment.\"",
      "pass": true
    },
    {
      "recipe": "1e CI hover, failed job click, CI icon click",
      "observed": "hovering \"Pipeline failed\" (!640) shows the jobs box; clicking \"Open the log of test:unit on GitLab\" logs only {page: \".../-/jobs/9001\"}; clicking the \"Pipeline failed\" icon adds no line",
      "pass": true
    },
    {
      "recipe": "1 empty CI slot click (fix round)",
      "observed": "recipe click on the 28x0 slot missed (y 353 / 758) and logged no line; see failures",
      "pass": false
    },
    {
      "recipe": "1f Tab to title, Enter",
      "observed": "focus on \"Open !639 on GitLab: Show overdue cards in red\" (Shift+Tab, Tab), document.hasFocus()=true; Enter -> one line …/merge_requests/639",
      "pass": true
    },
    {
      "recipe": "1g hovered row screenshot",
      "observed": "/tmp/yamt-mrverify/hover.png (source: page). Row !638 hovered: cursor=pointer, li bg rgba(233,228,254,0.05) against rgba(0,0,0,0) on the other rows; the lighter band is visible in the shot",
      "pass": true
    },
    {
      "recipe": "2 real app: range-repo + start-app --range main...feature --glab merge-requests",
      "observed": "debug build (cargo tauri build --debug --no-bundle). Rows !13, !12, …; clicking row !12's middle and then the job \"Open the log of unit tests on GitLab\" wrote to opened.log: \"argv: https://gitlab.example/taskboard/taskboard/-/merge_requests/12\" and \"argv: https://gitlab.example/taskboard/taskboard/-/jobs/301\". No problem line (only the \"Failed jobs\" box heading). Session stopped; /tmp/yamt-mrsmoke-range removed",
      "pass": true
    }
  ],
  "environment": "rustc 1.99.0 (b940084d7 2026-09-28); node v26.13.0; pnpm 12.0.0; fixture: MiniBrowser via just app-session (private display); app: target/debug/yamt via tauri-driver on Xvfb :3. No mutation run."
}
