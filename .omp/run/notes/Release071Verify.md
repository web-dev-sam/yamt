# Release071Verify

Agent output (`agent://Release071Verify`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-19T08-36-51-995Z_01a1f2f3-949b-76c1-ae63-bdcb627ac0da/Release071Verify.md), collected 2026-11-19T11:32:39.109Z.

{
  "gate": "pass",
  "failures": [],
  "smoke": [
    {
      "recipe": "1a just check",
      "observed": "exit 0 (82 s). nextest: \"Summary [14.408s] 1559 tests run: 1559 passed, 64 skipped\"; vitest: \"Test Files 314 passed (314) / Tests 4709 passed (4709)\"; hooks-test: \"ℹ tests 18 ℹ pass 18 ℹ fail 0\". Full log /tmp/yamt-rel-0.7.1/check.log",
      "pass": true
    },
    {
      "recipe": "1b readmer check",
      "observed": "exit 0 (READMER 0)",
      "pass": true
    },
    {
      "recipe": "2 scripts/third-party-licenses.sh && git diff --exit-code THIRD_PARTY_LICENSES.txt",
      "observed": "script exit 0; git diff exit 0, no diff",
      "pass": true
    },
    {
      "recipe": "3 cargo tauri build --bundles deb",
      "observed": "exit 0; \"Finished 1 bundle at: target/release/bundle/deb/yamt_0.7.1_amd64.deb (7.11 MiB)\"; file exists (7456814 bytes); bsdtar control: \"Version: 0.7.1\"; target/release/yamt --version → \"yamt 0.7.1\"",
      "pass": true
    },
    {
      "recipe": "4a range-repo.sh + switch feature + start-app release binary --range main...HEAD",
      "observed": "range-repo.sh exit 0; \"Switched to branch 'feature'\"; header text \"Reviewed\\nconfig\\n0 of 13 reviewed\\nSend to GitLab (0)\"; Reviewed button is the header's first child (index 0), class border border-control-border, borderStyle solid, background rgba(0,0,0,0) = outlined",
      "pass": true
    },
    {
      "recipe": "4b Reviewed on docs/current.md then src/board/board.ts",
      "observed": "on docs/current.md: \"0 of 13\" → click Reviewed → \"1 of 13 reviewed\", selection moved to docs/keys.md (next file); on board.ts → \"2 of 13 reviewed\", selection moved to src/board/reminders.ts. Screenshot /tmp/yamt-rel-0.7.1/two.png: both rows show ✓, names greyed. Note: my first two attempts mis-targeted the row click (rows are role=option, my name lookup failed) and marked config/data/big.txt; I stopped, deleted the scratch home and redid it cleanly — this is a driving error, not an app fault.",
      "pass": true
    },
    {
      "recipe": "4c commit one-line change on feature to board.ts, restart",
      "observed": "diff: line 3 '' → ' // r71 edit'. After restart: docs/current.md row labels \"modified,reviewed\"; board.ts row \"modified,changed since reviewed\" (+45 −22); header \"Changed since you reviewed it\", \"Review from start\", \"1 of 13 reviewed\"; left heading \"As you reviewed it\", right \"HEAD (eb163ee)\"; only line 3 differs (screenshot since-dark.png)",
      "pass": true
    },
    {
      "recipe": "4d Review from start",
      "observed": "header back to plain view, left heading \"merge base of main and HEAD (531ea52)\", whole change shown (hunks at 16–21, 176–187, 200–208, 251–258…; 142 cm lines); board.ts row no mark (\"no mark\"); count stays \"1 of 13 reviewed\". Screenshot /tmp/yamt-rel-0.7.1/fromstart.png",
      "pass": true
    },
    {
      "recipe": "4e screenshots dark+light, no CSP error",
      "observed": "dark: /tmp/yamt-rel-0.7.1/since-dark.png (page, data-theme dark); light (--settings '{\"theme\":\"light\"}', data-theme light): /tmp/yamt-rel-0.7.1/since-light.png (--display, private display :3). App log (tauri-driver.log) has only INFO detect/font_rendering and MESA DRI3 warnings; no CSP/security/refused line.",
      "pass": true
    },
    {
      "recipe": "5 cleanup after stop",
      "observed": "stop: tauri-driver and xvfb \"stopped\", folder removed; ps shows no target/release/yamt, Xvfb :3, tauri-driver, WebKitWebDriver or session dbus; /tmp/yamt-app-session-r71-* and /tmp/yamt-rel71-* gone (ls: No such file). Scratch screenshots/logs kept in /tmp/yamt-rel-0.7.1/.",
      "pass": true
    }
  ],
  "environment": "rustc 1.99.0 (b940084d7 2026-09-28); node v26.13.1; pnpm 12.0.0; Arch Linux 7.3.4, Xvfb private display :3, no DRI3 (software GL). Only the owner can check: macOS and Windows test runs and builds (CI only), and the GitLab playground checks still open on the board. No mutation run (VF7)."
}
