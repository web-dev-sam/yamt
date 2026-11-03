# CiJobLogSmoke

Agent output (`agent://CiJobLogSmoke`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-03T09-27-39-945Z_01a1a0bc-56a9-713f-aaa0-50b9506e4465/CiJobLogSmoke.md), collected 2026-11-03T11:26:01.535Z.

{
  "gate": "not-run",
  "failures": [
    {
      "step": "B10 one-letter query timing (≤250 ms)",
      "excerpt": "On test:unit's 9,000-line log: set the field and fire input, then wait for the highlight count and two requestAnimationFrames. Painted ms: a=1986 (8999 matches), s=3190, s=3164, s=3068 (26811 matches), t=2120 (18000). The highlights are set 86–463 ms after input. Paint takes another ~1.9–2.7 s, so this fails the ≤250 ms limit by about 8–13×."
    },
    {
      "step": "B2 OSC title sequence left on screen",
      "excerpt": "The first line of lint:docs shows 'itleRunning with gitlab-runner 17.5.0 (8ec04662)'. The raw fixture line is `${E}]0;title\\u0007Running…`, and the parser drops only ']0;t'. fixtureMergeRequestLogs.test.ts:79 expects the 'itle…' string, so the test pins the bug."
    },
    {
      "step": "B8 Shift again over a refused job",
      "excerpt": "After a refusal, focus stays in 'Search the log', so Shift over the same job does nothing: there was still only 1 fixture_job_log line for jobs/9161. It asks again only after a click into the log body, which adds a second fixture_job_log …/jobs/9161 and job_log_shown kind refused ms 401. The refusal text says '… then press Shift over the job again.', which does not work as written."
    },
    {
      "step": "Readability of ANSI background runs",
      "excerpt": "Light: ' BLOCKER ' is rgb(117,117,117) on rgb(229,19,19), contrast about 1.0:1, unreadable (/tmp/cjl-lint-light.png). ' ELIFECYCLE ' is black on rgb(206,5,5), about 3.6:1. Dark: ' ELIFECYCLE ' is rgb(135,135,135) on rgb(240,82,79), about 1.0:1, also unreadable (/tmp/cjl-lint-dark.png). Dark ' BLOCKER ' is white on rgb(255,64,80), about 3.4:1. App light 302: 'RED BACKGROUND' is black on red; 'truecolor red' shows in the plain text colour."
    }
  ],
  "smoke": [
    {
      "recipe": "B1 hover CI icon then lint:docs",
      "observed": "Tip text: 'Open the log of lint:docs on GitLab. Shift: show the log here'. Every job button has aria-keyshortcuts=\"Shift\". With --x11 the press fails: 'press --x11 needs the private display of a start-app session; \"cl\" is a fixture session'. All B steps used WebDriver keys instead.",
      "pass": true
    },
    {
      "recipe": "B2 Shift opens lint:docs log",
      "observed": "'Loading the log…', then 'Log of lint:docs', focus on 'Search the log'. Log right edge 1394.36 = CI box left edge; both tops 167.23. Scroll 193+537=730=scrollHeight. Red run rgb(255,64,80); box text rgb(214,212,221). No timestamps or section_start. Only the last Progress line shows. '<b>not bold</b> &amp; <script>x</script>' is shown as written, 0 b/script elements. Defect: the first line is 'itleRunning…'.",
      "pass": false
    },
    {
      "recipe": "B3 hover test:unit, type Error",
      "observed": "The label stays 'Log of lint:docs' and the count reads '6 of 6'. Current match: 'ERROR' on the last line. Matches cover 'errors', 'Error:' and 'ERROR', so matching ignores case.",
      "pass": true
    },
    {
      "recipe": "B4 Enter/Shift+Enter, centring, no results",
      "observed": "Enter from 6/6 goes to '1 of 6': top 174, match middle 0.5 px from the scroller's middle. Shift+Enter from 1/6 goes to '6 of 6', and again to '5 of 6'. At the end it is clamped (top=max=193). Appending 'z' gives 'No results' and scrollTop stays 174.",
      "pass": true
    },
    {
      "recipe": "B5 Escape twice",
      "observed": "First Escape: log closed, focus on lint:docs's button, CI box still open with 3 buttons. Second Escape: CI box closed, focus on 'Pipeline failed'.",
      "pass": true
    },
    {
      "recipe": "B6 remembered search",
      "observed": "'fail' gives '93 of 93'. On another row, test:unit: v 'fail', selection [0,4], 93 highlights. After location.reload and reopening: still 'fail', '93 of 93'. Emptied, closed, reopened: ''. localStorage holds {\"lint:docs\":\"Errorz\"} with no test:unit key.",
      "pass": true
    },
    {
      "recipe": "B7 switching jobs",
      "observed": "With focus in the field, Shift over test:unit kept lint:docs. After a click into the log body, Shift opened 'Log of test:unit' with 'Earlier lines are on GitLab. Open the whole log on GitLab'. The button logged '[info] mergeRequests.fixture_page {page: \".../-/jobs/9001\"}'.",
      "pass": true
    },
    {
      "recipe": "B8 refusal rows, test:e2e",
      "observed": "Seen in the box: 'GitLab has no log for this job.'; 'Could not read the log: glab timed out'; 'glab is not logged in: … — run glab auth login in a terminal, then press Shift over the job again.'; 'glab is not installed (not found on PATH) — install glab, then press Shift over the job again.'. Shift right after a refusal does not ask again (see failures). test:e2e: Shift does nothing (still 9 fixture_job_log lines).",
      "pass": false
    },
    {
      "recipe": "B9 outside click / scrolls",
      "observed": "An outside click closed both boxes. A scroll inside the log kept both open. The recipe's list `scroll` sends the wheel to the list's centre, which lands on the log box, so the list did not move. Setting list scrollTop 14→314 closed both.",
      "pass": true
    },
    {
      "recipe": "B10 Shift to long log painted (≤1.5 s)",
      "observed": "848, 1006, 778 ms (MutationObserver plus two rAF; includes the 400 ms fixture pause). job_log_shown lines 9000 cut true ms 435.",
      "pass": true
    },
    {
      "recipe": "B10 one-letter query painted (≤250 ms)",
      "observed": "1986 (a), 3190, 3164, 3068 (s), 2120 (t) ms.",
      "pass": false
    },
    {
      "recipe": "B10 shots Dark/Light",
      "observed": "Dark: .omp/run/shots/cjl-fixture-dark.png, /tmp/cjl-lint-dark.png. Light: /tmp/cjl-lint-light.png, /tmp/cjl-unit-light.png. BLOCKER cannot be read in Light, and ELIFECYCLE cannot be read in Dark.",
      "pass": false
    },
    {
      "recipe": "C setup",
      "observed": "cargo tauri build --debug --no-bundle: 'Built application at: /home/wds/Projects/yamt/target/debug/yamt'. Repo /tmp/cjv/cl; start-app with --glab ci-job-log. Rows !71, !70 and !69 show 'Pipeline failed'.",
      "pass": true
    },
    {
      "recipe": "C1 !71 phpunit 302",
      "observed": "Coloured log at its end (gap 0), focus in the field. Search 'fail' gives '6 of 6', 6 highlights. Shot /tmp/cjv/app-dark-302.png.",
      "pass": true
    },
    {
      "recipe": "C2 !70 phpunit 312",
      "observed": "Field holds 'fail', '4 of 4', 4 highlights.",
      "pass": true
    },
    {
      "recipe": "C3 !71 lint 303",
      "observed": "Cut notice shown. opened.log: 'argv: https://gitlab.example/taskboard/taskboard/-/jobs/303'. App log: outcome=\"log\" bytes=520706 cut=true.",
      "pass": true
    },
    {
      "recipe": "C4 e2e 304, docs 305, deploy",
      "observed": "e2e and docs both show 'GitLab has no log for this job.' (outcome noLog). Shift over deploy does nothing.",
      "pass": true
    },
    {
      "recipe": "C5 !69 fork 310",
      "observed": "Log ends with 'FORK LOG: Tests\\ThemeTest::testDarkCards failed / FAILURES! / ERROR: Job failed: exit code 1'. calls.log: 'argv: api projects/sam%2Ftaskboard/jobs/310/trace'.",
      "pass": true
    },
    {
      "recipe": "C6 reopen 302",
      "observed": "Log shown again. calls.log has one jobs/302/trace only. The app log adds only the frontend line job_log_shown lines=24 ms=21.",
      "pass": true
    },
    {
      "recipe": "C7 no unasked trace; app log; shots",
      "observed": "Trace calls: 302, 312, 303, 304, 305, 310 only. Each ask has one 'yamt_merge_requests::job_log: read a failed job's log page=… outcome=…' line, and the log text never appears. Shots: /tmp/cjv/app-dark-302.png, /tmp/cjv/app-light-302.png. In light, the hover tip covers the count.",
      "pass": true
    }
  ],
  "environment": "HEAD 0e831670. rustc 1.99.0, node v26.13.0, pnpm 12.0.0, webkitgtk-6.0 2.54.2-1 (MiniBrowser). Fixture at 1600x1000 with WebDriver keys (--x11 is refused for fixture sessions). App on private display :3 with xdotool."
}
