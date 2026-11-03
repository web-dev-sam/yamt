# Release067Verify

Agent output (`agent://Release067Verify`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-03T19-24-34-084Z_01a1a2de-d1a4-7647-bda9-8034bb7125ef/Release067Verify.md), collected 2026-11-03T20:36:34.238Z.

{
  "gate": "pass",
  "failures": [],
  "smoke": [
    {
      "recipe": "1. just check; readmer check",
      "observed": "just check exited 0 in 68 s; it ended with the golden run (10 ok cases) and hooks tests 18 pass, 0 fail. readmer check exited 0.",
      "pass": true
    },
    {
      "recipe": "2. third-party-licenses.sh && git diff --exit-code THIRD_PARTY_LICENSES.txt",
      "observed": "The script exited 0 and git diff exited 0 with no diff; the tree is clean.",
      "pass": true
    },
    {
      "recipe": "3. cargo tauri build --bundles deb",
      "observed": "The build exited 0 and yamt_0.6.7_amd64.deb (6.30 MiB) exists. Its control has Version: 0.6.7. --version printed yamt 0.6.7. --help names --mr and YAMT_AI=1.",
      "pass": true
    },
    {
      "recipe": "4. YAMT_AI=1 start-app r67-mr release binary --diff --glab merge-requests --mr",
      "observed": "The app started on the merge-request page with no click: 5 of 5 merge requests, rows !13 !12 !11 !9 !8. 'just now' sits left of Refresh, and hovering it showed tooltip 21:34, the current time. After Show Diff on row 0, pgrep showed the child ending with --ai. Private-display shot /tmp/yamt-rel-0.6.7/child-ask-ai.png shows the child window with a new thread at src/board/board.ts:21 and buttons Comment / Ask AI / Cancel. The app log has no CSP error.",
      "pass": true
    },
    {
      "recipe": "5. stop and cleanup",
      "observed": "stop reported tauri-driver, xvfb and the yamt child stopped. Nothing from this run is left (pgrep empty, no dbus-daemon). /tmp/yamt-rel67-* is removed. The owner's debug yamt playground was not started by this run and is untouched.",
      "pass": true
    }
  ],
  "environment": "Linux 7.2.11-arch1-1 x64; rustc 1.99.0; node v26.13.0; pnpm 12.0.0; private Xvfb :3, no GPU. No mutation run. Only owner/CI: macOS and Windows test runs and builds, and the GitLab playground checks still open on the board."
}
