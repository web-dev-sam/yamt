# CiJobLogRepass

Agent output (`agent://CiJobLogRepass`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-03T09-27-39-945Z_01a1a0bc-56a9-713f-aaa0-50b9506e4465/CiJobLogRepass.md), collected 2026-11-03T12:25:09.559Z.

{
  "gate": "pass",
  "failures": [],
  "smoke": [
    {
      "recipe": "A just check",
      "observed": "Every recipe ran. Last lines: hooks-test 'ℹ tests 18 ℹ pass 18 ℹ fail 0', then 'EXIT 0' (46 s). The tree had one uncommitted file, .omp/run/slices.json (orchestrator state).",
      "pass": true
    },
    {
      "recipe": "B2 Shift opens lint:docs; job tip hidden (fixture)",
      "observed": "'Loading the log…' was true right after the WebDriver Shift press. Then label 'Log of lint:docs', focus 'Search the log'. With the pointer still on lint:docs, the .hover-tooltip 'Open the log of lint:docs on GitLab. Shift: show the log here' had display=none (/tmp/rp-tip-hidden.png). Hovering test:unit showed its own tip with display=block.",
      "pass": true
    },
    {
      "recipe": "B3 hover test:unit, type Error",
      "observed": "Label stays 'Log of lint:docs'. Count '6 of 6'. Matches [error, Error, error, error, ERROR, ERROR]; current 'ERROR'. A console capture installed before the retype logged no new lines. In the Dark run the capture logged exactly one fixture_job_log (jobs/9000) plus job_log_shown lines:37 ms:403.",
      "pass": true
    },
    {
      "recipe": "B4 Enter / Shift+Enter / zzzq",
      "observed": "From 6 of 6 (st 193 = max), Enter gave '1 of 6', centre off 1 px, st 174. Enter gave '2 of 6' (st 193, clamped). Shift+Enter gave '1 of 6', then '6 of 6'. Appending zzzq gave 'Errorzzzq', 'No results', highlights 0/0, scrollTop 193 unchanged.",
      "pass": true
    },
    {
      "recipe": "B10 Light: Ctrl+A, type e-r-r-o-r, then s-t-a-t-u-s, then scroll",
      "observed": "After 'error': highlights job-log-match 6 [error, Error, ERROR], job-log-current 1. The shot shows marks only on whole words (errors, Error, error, ERROR) and no single-letter marks: /tmp/rp-light-error.png. After 'status': 'No results', match 0, current 0. The shot shows no marks at all: /tmp/rp-light-status.png. After setting scrollTop to 40, the shot still shows no marks: /tmp/rp-light-status-scrolled.png.",
      "pass": true
    },
    {
      "recipe": "B10 Dark: same sequence",
      "observed": "After 'error': 6 matches, current 'ERROR', marks on whole words only (/tmp/rp-dark-error.png). After 'status': 'No results', 0/0, no marks (/tmp/rp-dark-status.png). With scrollTop 150, still no marks (/tmp/rp-dark-status-scrolled.png). In /tmp/rp-dark-error.png the pointer was on the other job (test:unit), so its tip showed, as designed, and sat over the count area.",
      "pass": true
    },
    {
      "recipe": "B10 one-letter query → highlights painted (≤250 ms), test:unit",
      "observed": "Each query was typed into an empty field and timed until 2 rAFs. a: 46 ms, '8999 of 8999'. s: 38 ms, '26811 of 26811'. t: 39 ms, '18000 of 18000'.",
      "pass": true
    },
    {
      "recipe": "C1 real app !71 phpunit 302, tip hidden, count uncovered",
      "observed": "Before Shift the tip showed with display=block. Shift (xdotool) opened 'Log of phpunit' with focus in the field. The short log fits, so there is no scroller. 30 styled spans. Typing 'fail' gave '6 of 6', match 6, current 1. The tip had display=none, and elementFromPoint at the count's centre was the count itself (hit:true). Shot: /tmp/rpc/app-dark-302.png (count '6 of 6' visible, no tip). calls.log: 'argv: api projects/taskboard%2Ftaskboard/jobs/302/trace' once.",
      "pass": true
    }
  ],
  "environment": "HEAD 4b9994ae. rustc 1.99.0, node v26.13.0, pnpm 12.0.0. Fixture on MiniBrowser (webkitgtk-6.0) at 1600x1000, using WebDriver keys. Rebuilt with cargo tauri build --debug --no-bundle, then ran the app on private display :3 with xdotool. Repo /tmp/rpc/cl. Both sessions stopped."
}
