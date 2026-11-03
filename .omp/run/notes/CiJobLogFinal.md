# CiJobLogFinal

Agent output (`agent://CiJobLogFinal`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-03T09-27-39-945Z_01a1a0bc-56a9-713f-aaa0-50b9506e4465/CiJobLogFinal.md), collected 2026-11-03T12:08:00.263Z.

{
  "gate": "pass",
  "failures": [
    {
      "step": "B10 shot, yamt Light: old highlights stay painted (WebKit fixture, lint:docs)",
      "excerpt": "Light theme, lint:docs log: Ctrl+A in 'Search the log', type 'error'. The count reads '6 of 6' and CSS.highlights holds only job-log-match 6 [\"error\",\"Error\",\"ERROR\"] and job-log-current 1. The screenshot still shows single-letter purple marks under many 'e'/'r' letters ('Executing', 'step', 'date', 'resolved', …), left over from the keystrokes before the full word. They move with the text when the log scrolls (scrollTop 193→153); lines scrolled into view have none. Second try: Ctrl+A, type 'status' gives 'No results' and CSS.highlights [[\"job-log-match\",0,[]]], but the shot still shows 's'/'st' marks ('system', 'stage', 'blocks', 'since') plus the old 'e' marks. Shots: /tmp/cjf-lint-light.png, /tmp/cjf-lint-light2.png, /tmp/cjf-lint-light3.png, /tmp/cjf-lint-light4.png (crops /tmp/cjf-crop.png, /tmp/cjf-crop3.png, /tmp/cjf-crop4.png). Dark, same steps: no stray marks (/tmp/cjf-lint-dark.png, crop /tmp/cjf-cropd.png). App light 302 'fail' (/tmp/cjf/app-light-302.png): no stray marks."
    }
  ],
  "smoke": [
    {
      "recipe": "A just check",
      "observed": "Every recipe ran. Last lines: golden 'ok vueuse-use-magic-keys', sfc-order ran, hooks-test 'ℹ tests 18 ℹ pass 18 ℹ fail 0', then 'EXIT 0' (56 s).",
      "pass": true
    },
    {
      "recipe": "B1 hover CI icon, then lint:docs",
      "observed": "Tip: 'Open the log of lint:docs on GitLab. Shift: show the log here'. Job buttons have aria-keyshortcuts=\"Shift\". `press --x11` refused: 'press --x11 needs the private display of a start-app session; \"cl\" is a fixture session', so B used WebDriver keys.",
      "pass": true
    },
    {
      "recipe": "B2 Shift opens lint:docs",
      "observed": "'Loading the log…' right after the press, then 'Log of lint:docs' with focus in the field. Log right edge 1394.36 = CI box left edge; tops 167.23 both. 193+537=730 (at end). Red run rgb(240,82,79) vs text rgb(214,212,221). No timestamps, no section_start. Only the last Progress line shows. The escaped b/script line shows as written (0 elements). First line 'itleRunning…' (accepted per design §2.4).",
      "pass": true
    },
    {
      "recipe": "B3 hover test:unit, type Error",
      "observed": "Label stays 'Log of lint:docs'. Count '6 of 6'. Highlights [error, Error, error, error, ERROR, ERROR]; current 'ERROR'. Only one fixture_job_log line.",
      "pass": true
    },
    {
      "recipe": "B4 Enter / Shift+Enter / no results",
      "observed": "From 6/6, Enter: '1 of 6' (centre off 1 px), then '2 of 6' (clamped at max 193). Shift+Enter: '1 of 6', then '6 of 6'. From st 174, appending 'zzzq' gives 'Errorzzzq', 'No results', st 174.",
      "pass": true
    },
    {
      "recipe": "B5 Escape twice",
      "observed": "First Escape: {log:false, focus:'lint:docs…', ci:2}. Second: {log:false, focus:'Pipeline failed', ci:0}.",
      "pass": true
    },
    {
      "recipe": "B6 remembered text",
      "observed": "Row !640 test:unit, 'fail': '93 of 93'. Row 4 (job 9241): v 'fail', sel [0,4], focus true, '93 of 93'. After reload: the same. Emptied, closed, reopened: ''; ls {\"lint:docs\":\"z\"} (no test:unit key).",
      "pass": true
    },
    {
      "recipe": "B7 switching jobs",
      "observed": "Focus in the field, Shift over test:unit: still lint:docs, 1 fixture_job_log. After a click into the log body, Shift opens 'Log of test:unit' with 'Earlier lines are on GitLab. Open the whole log on GitLab'. The button logs '[info] mergeRequests.fixture_page {page: \".../-/jobs/9001\"}'.",
      "pass": true
    },
    {
      "recipe": "B8 refusal rows, Shift again, test:e2e",
      "observed": "9080 'GitLab has no log for this job.'; 9081 'Could not read the log: glab timed out'; 9160 'glab is not logged in: … — run glab auth login in a terminal, then press Shift over the job again.'; 9161 'glab is not installed (not found on PATH) — install glab, then press Shift…'. Shift again adds a second 9081 and a second 9161 line. test:e2e: count stays 9.",
      "pass": true
    },
    {
      "recipe": "B9 outside click, log scroll, list scroll",
      "observed": "Click on the heading: both closed. Log scroll 174991→0: both stay open. The list `scroll` recipe leaves scrollTop at 14 (the wheel lands on the log). Setting the list's scrollTop to 314: both closed.",
      "pass": true
    },
    {
      "recipe": "B10 Shift → long log painted (≤1.5 s)",
      "observed": "944, 876, 844 ms; gap 0; last line 'ERROR: Job failed: exit code 1'.",
      "pass": true
    },
    {
      "recipe": "B10 one-letter query → highlights painted (≤250 ms), test:unit",
      "observed": "a 74 ms (8999 of 8999); s 80 ms (26811 of 26811); t 56 ms (18000 of 18000).",
      "pass": true
    },
    {
      "recipe": "B10 BLOCKER/ELIFECYCLE readability",
      "observed": "Dark: BLOCKER rgb(23,22,28) on rgb(255,64,80) ≈5.3:1; ELIFECYCLE on rgb(240,82,79) ≈5.2:1. Light: white on rgb(229,19,19) ≈4.7:1; white on rgb(206,5,5) ≈5.8:1. Ratios computed by hand. Both readable in the shots.",
      "pass": true
    },
    {
      "recipe": "B10 shots Dark/Light",
      "observed": "Dark: /tmp/cjf-unit-a.png, /tmp/cjf-lint-dark.png. Light: /tmp/cjf-lint-light*.png, /tmp/cjf-unit-light.png. In Light, old highlight paint stays on screen (see failures).",
      "pass": false
    },
    {
      "recipe": "C setup",
      "observed": "'Built application at: /home/wds/Projects/yamt/target/debug/yamt'. Repo /tmp/cjf/cl; --glab ci-job-log on display :3. Rows !71, !70, !69 'Pipeline failed'.",
      "pass": true
    },
    {
      "recipe": "C1 !71 phpunit 302",
      "observed": "Shift (xdotool): log at its end (gap 0), focus in the field, 9 coloured spans. 'fail': '6 of 6', 6 highlights. The hover tip covers the count (/tmp/cjf/app-dark-302.png).",
      "pass": true
    },
    {
      "recipe": "C2 !70 phpunit 312",
      "observed": "Field 'fail', selected [0,4], '4 of 4', 4 highlights.",
      "pass": true
    },
    {
      "recipe": "C3 !71 lint 303",
      "observed": "Cut notice shown. opened.log: 'argv: https://gitlab.example/taskboard/taskboard/-/jobs/303'. App log: outcome=\"log\" bytes=520706 cut=true.",
      "pass": true
    },
    {
      "recipe": "C4 e2e 304, docs 305, deploy",
      "observed": "Both 'GitLab has no log for this job.' (outcome=\"noLog\"). Shift over deploy: nothing new.",
      "pass": true
    },
    {
      "recipe": "C5 !69 fork 310",
      "observed": "Log ends 'FORK LOG: Tests\\ThemeTest::testDarkCards failed / FAILURES! / ERROR: Job failed: exit code 1'. calls.log: 'argv: api projects/sam%2Ftaskboard/jobs/310/trace'.",
      "pass": true
    },
    {
      "recipe": "C6 reopen 302",
      "observed": "Reopened twice (once in Light). calls.log still has one jobs/302/trace. The reopen logs only frontend job_log_shown lines=24 ms=20.",
      "pass": true
    },
    {
      "recipe": "C7 no unasked trace; app log; shots",
      "observed": "Traces 302, 312, 303, 304, 305 and sam/310 only. One 'yamt_merge_requests::job_log: read a failed job's log page=… outcome=…' line per ask; no log text in the app log. Shots /tmp/cjf/app-dark-302.png, /tmp/cjf/app-light-302.png.",
      "pass": true
    }
  ],
  "environment": "HEAD 3bb05979. rustc 1.99.0, node v26.13.0, pnpm 12.0.0. MiniBrowser on webkitgtk-6.0. Fixture at 1600x1000 on WebDriver keys (--x11 refused for fixture sessions). App on private display :3 with xdotool. Both sessions stopped."
}
