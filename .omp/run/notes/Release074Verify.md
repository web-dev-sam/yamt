# Release074Verify

Agent output (`agent://Release074Verify`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-24T17-57-44-527Z_01a20eb4-dfcf-7208-ac0d-c1fed1fa9dd9/Release074Verify.md), collected 2026-11-25T11:47:42.975Z.

{
  "gate": "pass",
  "failures": [],
  "smoke": [
    {
      "recipe": "1. just check + readmer check",
      "observed": "`just check` EXIT 0 (79 s). nextest: \"1588 tests run: 1588 passed, 65 skipped\". vitest: \"Test Files 316 passed (316)\", \"Tests 4803 passed (4803)\". hooks-test: \"pass 18 fail 0\". `readmer check` exit 0.",
      "pass": true
    },
    {
      "recipe": "2. scripts/third-party-licenses.sh && git diff --exit-code THIRD_PARTY_LICENSES.txt",
      "observed": "Script exit 0. git diff --exit-code exit 0, no diff.",
      "pass": true
    },
    {
      "recipe": "3. cargo tauri build --bundles deb",
      "observed": "Exit 0: \"Finished 1 bundle at: target/release/bundle/deb/yamt_0.7.4_amd64.deb (7.13 MiB)\". Control file read with bsdtar: \"Version: 0.7.4\". `target/release/yamt --version` printed \"yamt 0.7.4\".",
      "pass": true
    },
    {
      "recipe": "4a. Next file: start-app --name r74-sn --binary target/release/yamt --range main...feature --repo /tmp/yamt-rel-0.7.4/snr --home …",
      "observed": "Tree order: b/x, b/y, z/w, a, c. After clicking y.txt: \"Reviewed b/y.txt 0 of 5 reviewed\", and [title=\"left to review\"] read \"+15−15\". After Reviewed: \"Reviewed z/w.txt 1 of 5 reviewed\" and \"+12−12\", a drop of b/y.txt's +3−3. The shot shows the muted total left of the view toggle, a ✓ on y.txt, and w.txt selected. Shot r74-sn.png viewed, then deleted with the scratch dir.",
      "pass": true
    },
    {
      "recipe": "4b. Queue: range-repo.sh, start-app --name r74-cq --binary target/release/yamt --range main...feature --glab lined-up --home …",
      "observed": "New box buttons: Queue, Note, Cancel. A raw W3C Shift keyDown turned them into \"Send | Note | Cancel\". A pointer click with Shift held, then keyUp: calls.log showed exactly 1 POST (projects/7/merge_requests/12/draft_notes), \"1 sent, 0 refused\" and \"Pending on GitLab\". A plain Queue on a second box left the POST count at 1, showed \"Send to GitLab (1)\" and \"Queued for GitLab\". Shot r74-cq.png viewed, then deleted.",
      "pass": true
    },
    {
      "recipe": "5. Teardown",
      "observed": "Both stops reported tauri-driver and xvfb \"stopped\", children [] and the session folder removed. Afterwards, ps found no Xvfb, tauri-driver, WebKitWebDriver, release yamt or dbus process from this run. There are no r74 state files. /tmp/yamt-rel-0.7.4 is removed.",
      "pass": true
    }
  ],
  "environment": "Arch Linux, kernel 7.3.5, x64. rustc 1.99.0, node v26.13.1, pnpm 12.0.0. HEAD ca2ef557. The tree had uncommitted orchestrator files: slices.json, SLICES.md, and the untracked brief. Windows ran on private Xvfb. No mutation run (VF7). Owner-only: macOS and Windows test runs and builds (CI)."
}
