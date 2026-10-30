# Release062Verify

Agent output (`agent://Release062Verify`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-10-30T13-26-49-608Z_01a18cfd-dc08-7052-b10f-ed6a2bb5d1b5/Release062Verify.md), collected 2026-10-30T18:46:10.028Z.

{
  "gate": "pass",
  "failures": [],
  "smoke": [
    {
      "recipe": "1. just check (once, at 655dcee)",
      "observed": "All 15 steps ran and the command exited 0 in 58.78 s. Last lines: golden 'ok vueuse-use-magic-keys'; hooks-test 'tests 18 pass 18 fail 0'; EXIT 0",
      "pass": true
    },
    {
      "recipe": "1. readmer check",
      "observed": "EXIT 0",
      "pass": true
    },
    {
      "recipe": "2. TMPDIR=/tmp/yamt-rel-0.6.2/tmp-link cargo nextest run -p yamt-merge-requests",
      "observed": "Summary [2.106s] 43 tests run: 43 passed, 1 skipped; EXIT 0",
      "pass": true
    },
    {
      "recipe": "2. TMPDIR=/tmp/yamt-rel-0.6.2/tmp-link cargo nextest run -p yamt-app -E 'test(/^merge_requests::/)'",
      "observed": "Summary [0.674s] 3 tests run: 3 passed, 153 skipped; EXIT 0",
      "pass": true
    },
    {
      "recipe": "3. scripts/third-party-licenses.sh && git diff --exit-code THIRD_PARTY_LICENSES.txt",
      "observed": "exit 0, no diff",
      "pass": true
    },
    {
      "recipe": "4. cargo tauri build --bundles deb",
      "observed": "Finished 1 bundle: target/release/bundle/deb/yamt_0.6.2_amd64.deb (5.86 MiB); EXIT 0. The control file inside, read with bsdtar, has 'Version: 0.6.2'. target/release/yamt --version printed 'yamt 0.6.2'",
      "pass": true
    },
    {
      "recipe": "5. start-app --name r62-a --binary target/release/yamt --range main...feature --repo /tmp/yamt-rel62-range --glab merge-requests --home /tmp/yamt-rel-0.6.2/home-1",
      "observed": "Ran on private display :3. The merge-requests page showed '5 of 5 merge requests': !13, !12, !11 (Draft), !9, !8. Clicking the 'Open the log of unit tests on GitLab' job button (from the !13 'Pipeline failed' popup) wrote 'argv: https://gitlab.example/taskboard/taskboard/-/jobs/301' to opened.log",
      "pass": true
    },
    {
      "recipe": "5. stop and cleanup",
      "observed": "stop: tauri-driver and xvfb stopped, children [], session folder removed. Afterwards pgrep found no yamt, Xvfb, driver or bus process from this run. Removed /tmp/yamt-rel62-* and /tmp/yamt-rel-0.6.2/tmp-*",
      "pass": true
    }
  ],
  "environment": "Arch Linux, kernel 7.2.11, x64. rustc 1.99.0, node v26.13.0, pnpm 12.0.0. No mutation run (VF7). The owner has to check the macOS 15 and Windows 2025 test runs and builds in CI, because that cannot be done here; on Linux the macOS symlinked temporary folder was only reproduced with TMPDIR."
}
