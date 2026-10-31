# Release065Verify

Agent output (`agent://Release065Verify`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-10-31T11-08-11-230Z_01a191a5-4a5e-76c4-84d2-9d529607b1b1/Release065Verify.md), collected 2026-10-31T15:37:21.363Z.

{
  "gate": "pass",
  "failures": [],
  "smoke": [
    {
      "recipe": "1. just check; readmer check",
      "observed": "just check EXIT=0 (golden 10 ok, hooks-test 18/18 pass, 61.55 s); readmer check EXIT=0",
      "pass": true
    },
    {
      "recipe": "2. third-party-licenses.sh && git diff --exit-code THIRD_PARTY_LICENSES.txt",
      "observed": "exit 0, no diff",
      "pass": true
    },
    {
      "recipe": "3. cargo tauri build --bundles deb",
      "observed": "EXIT=0; target/release/bundle/deb/yamt_0.6.5_amd64.deb 6331308 bytes; control Version: 0.6.5; target/release/yamt --version prints yamt 0.6.5",
      "pass": true
    },
    {
      "recipe": "4. release binary range threads (r65-a, r65-b, home-1)",
      "observed": "Headers src/board/board.ts:201-204 and src/board/board.ts:-200 to +204; threads.json format 2 with both places exactly as D.2; after restart R204 badge 2 and both headers back. Shots /tmp/yamt-rel-0.6.5/r65-a-two-threads.png, r65-b-restored.png (page).",
      "pass": true
    },
    {
      "recipe": "5. cleanup",
      "observed": "No yamt/Xvfb/driver/bus from this run left (only unrelated stryker-sandbox oxlint/oxfmt lsp); /tmp/yamt-rel65-* removed",
      "pass": true
    }
  ],
  "environment": "Arch Linux 7.2.11 x64; rustc 1.99.0; node v26.13.0; pnpm 12.0.0; tauri-cli 2.12.4; private Xvfb :3. Owner-only: macOS/Windows CI runs and builds, GitLab playground check. No mutation run."
}
