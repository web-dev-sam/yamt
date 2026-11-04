# Release068Repass

Agent output (`agent://Release068Repass`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-03T21-08-17-015Z_01a1a33d-c5f7-7658-b66f-85ea275269a1/Release068Repass.md), collected 2026-11-04T08:09:23.573Z.

{
  "gate": "pass",
  "failures": [],
  "smoke": [
    {
      "recipe": "1. just check && readmer check",
      "observed": "just check ran all the way through to hooks-test: golden 'ok vueuse-use-magic-keys' …, hooks 'ℹ tests 18 ℹ pass 18 ℹ fail 0', EXIT=0 (82 s). readmer check: READMER=0.",
      "pass": true
    },
    {
      "recipe": "release build at HEAD: cargo tauri build --bundles deb; target/release/yamt --version",
      "observed": "'Bundling yamt_0.6.8_amd64.deb … Finished 1 bundle (6.74 MiB)', EXIT=0; 'yamt 0.6.8'; HEAD 5b0e5d0f",
      "pass": true
    },
    {
      "recipe": "4b. start-app --name r68-people --binary target/release/yamt --glab mr-people --mr --home /tmp/yamt-rel-0.6.8/home-2",
      "observed": "The page showed '3 of 3 merge requests' (!52, !51, !50). I opened !52's people box. Its buttons: 'Add assignee | More for Sam Doe | Add reviewer | Re-request review from Ben Okafor | More for Ben Okafor | Re-request review from Chiara Rossi | More for Chiara Rossi | More for Dmitri Volkov'. 'More for Sam Doe' gave menuitem 'Remove assignee'. 'More for Ben Okafor' gave 'Remove reviewer'. Screenshot /tmp/yamt-rel-0.6.8/people3.png (private display :3). !50 has no add/More buttons, as expected: the scenario gives it updateMergeRequest:false.",
      "pass": true
    },
    {
      "recipe": "5. stop + leftovers + rm /tmp/yamt-rel68-*",
      "observed": "stop: tauri-driver stopped, xvfb stopped, children [], session folder removed. pgrep for yamt-rel / r68- / target/release/yamt / Xvfb :3 / WebKitWebDriver / tauri-driver found nothing (exit 1). After rm, 'ls: cannot access /tmp/yamt-rel68-*: No such file or directory'.",
      "pass": true
    }
  ],
  "environment": "HEAD 5b0e5d0f; rustc 1.99.0, node v26.13.0, pnpm 12.0.0; private display :3. Owner-only: macOS/Windows CI runs and builds, the GitLab playground checks on the board."
}
