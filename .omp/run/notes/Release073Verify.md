# Release073Verify

Agent output (`agent://Release073Verify`), collected 2026-11-20T10:37:13Z.

{
  "gate": "pass",
  "failures": [],
  "smoke": [
    {
      "recipe": "1. just check + readmer check",
      "observed": "`just check` exit=0, 75.56 s. nextest \"1563 tests run: 1563 passed, 64 skipped\"; vitest \"Test Files 314 passed (314)\", \"Tests 4710 passed (4710)\"; hooks-test \"pass 18 fail 0\". `readmer check` exit 0.",
      "pass": true
    },
    {
      "recipe": "2. scripts/third-party-licenses.sh && git diff --exit-code THIRD_PARTY_LICENSES.txt",
      "observed": "script exit 0; git diff exit 0, no diff.",
      "pass": true
    },
    {
      "recipe": "3. cargo tauri build --bundles deb",
      "observed": "build exit 0; \"Bundling yamt_0.7.3_amd64.deb … (7.11 MiB)\"; file exists, 7455970 bytes; control file from bsdtar: \"Version: 0.7.3\"; `target/release/yamt --version` printed \"yamt 0.7.3\".",
      "pass": true
    },
    {
      "recipe": "4. app-session start-app r73-rv --binary target/release/yamt --range base..feature (tree view)",
      "observed": "Slip: an invalid row selector made Reviewed mark a.md; docs got the check and lost it when I unmarked a.md, and never had it after. Then card+view reviewed: board checked (title \"every file reviewed\", muted rgb(129,126,141); name rgb(214,212,221), not muted), src not. Added main.ts: src and board both checked. Unmarked view.ts: both lost it; card and main still reviewed, view not. Page shot: /tmp/r73-tree.png, src and board checked, \"3 of 4 reviewed\".",
      "pass": true
    },
    {
      "recipe": "5. stop + leftovers + remove scratch",
      "observed": "stop: tauri-driver and xvfb \"stopped\", session folder removed. Afterwards `ps` showed no yamt-rel, Xvfb, WebKitWebDriver, tauri-driver, dbus-daemon or target/release/yamt process. /tmp/yamt-rel-0.7.3 removed (ls: No such file or directory).",
      "pass": true
    }
  ],
  "environment": "Arch Linux, kernel 7.3.4, x64; rustc 1.99.0 (b940084d7 2026-09-28); node v26.13.1; pnpm 12.0.0. HEAD 4ed4ccba. Only the brief and the board files were uncommitted. Private display :3. No mutation run. Only the owner or CI can check: macOS and Windows test runs and builds."
}