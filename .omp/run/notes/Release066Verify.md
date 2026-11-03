# Release066Verify

Agent output (`agent://Release066Verify`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-03T09-27-39-945Z_01a1a0bc-56a9-713f-aaa0-50b9506e4465/Release066Verify.md), collected 2026-11-03T12:37:33.845Z.

{
  "gate": "pass",
  "failures": [],
  "smoke": [
    {
      "recipe": "1. just check; readmer check",
      "observed": "HEAD d5a7a926 (docs commit on top of release b99c9fb8), clean tree. `just check` EXIT 0 in 72 s; last recipe hooks-test: tests 18 pass 18 fail 0. `readmer check` EXIT 0.",
      "pass": true
    },
    {
      "recipe": "2. scripts/third-party-licenses.sh && git diff --exit-code THIRD_PARTY_LICENSES.txt",
      "observed": "script exit 0; git diff --exit-code exit 0, no diff.",
      "pass": true
    },
    {
      "recipe": "3. cargo tauri build --bundles deb",
      "observed": "EXIT 0; Finished 1 bundle at target/release/bundle/deb/yamt_0.6.6_amd64.deb (6.22 MiB); bsdtar control: Version: 0.6.6; target/release/yamt --version prints yamt 0.6.6.",
      "pass": true
    },
    {
      "recipe": "4. release binary, failed job log (--glab ci-job-log, /tmp/yamt-rel66-cl, home-1)",
      "observed": "Run 1: !71 hover Pipeline failed, hover phpunit (jobs/302), Shift --x11: Log of phpunit opens, focus INPUT Search the log; 24 lines fit the box (537/537 px), last line ERROR: Job failed: exit code 1 visible; 11 span colours (e.g. rgb(246,107,113), rgb(120,191,123)). type fail: value fail, 6 of 6. App log: job_log read outcome=log bytes=2457, mergeRequests.job_log_shown lines=24. Run 2 same home: reopened, field holds fail, 6 of 6. calls.log per run: one jobs/302/trace. No CSP/Refused in logs. Screenshot refused by ownership hook (SP1), evidence from WebDriver reads.",
      "pass": true
    },
    {
      "recipe": "5. cleanup",
      "observed": "stop: tauri-driver and xvfb stopped, children none, session folders removed. ps: no Xvfb/driver/private bus left; only the owner's own target/debug/yamt --diff --ai (pid 1280769, playground) remains, untouched. /tmp/yamt-rel66-cl removed.",
      "pass": true
    }
  ],
  "environment": "Arch Linux 7.2.11 x64; rustc 1.99.0; node v26.13.0; pnpm 12.0.0; private Xvfb :3 via app-session. Owner-only: macOS and Windows test runs/builds (CI), GitLab playground checks open on the board."
}
