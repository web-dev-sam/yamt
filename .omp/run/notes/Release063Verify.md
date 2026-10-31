# Release063Verify

Agent output (`agent://Release063Verify`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-10-30T21-21-14-771Z_01a18eb0-3413-7251-ad3d-5e4e0123ce8e/Release063Verify.md), collected 2026-10-31T09:13:04.670Z.

{
  "gate": "pass",
  "failures": [],
  "smoke": [
    {
      "recipe": "1. just check && readmer check",
      "observed": "just check ran to the end: golden ok ×10, hooks-test `ℹ tests 18 ℹ pass 18 ℹ fail 0`, then `EXIT 0` (61 s). readmer check: `READMER 0`.",
      "pass": true
    },
    {
      "recipe": "2. third-party-licenses.sh && git diff --exit-code THIRD_PARTY_LICENSES.txt",
      "observed": "The script exited 0. git diff printed nothing and exited 0.",
      "pass": true
    },
    {
      "recipe": "3. cargo tauri build --bundles deb; control Version; yamt --version",
      "observed": "`Bundling yamt_0.6.3_amd64.deb … Finished 1 bundle (6.03 MiB)`. The file is there (6318324 bytes). bsdtar read the control file's `Version: 0.6.3`. `target/release/yamt --version` printed `yamt 0.6.3`.",
      "pass": true
    },
    {
      "recipe": "4a. release binary --diff --dir /tmp/yamt-rel63-mrc --glab mr-conflicts; Merge requests",
      "observed": "11 rows, each a title plus a second line. !32's second-line textContent: \"!32 · created 1 day ago · +75 −12 · 5 files\". Colours: + is rgb(120, 191, 123), − is rgb(246, 107, 113), the rest of the line rgb(129, 126, 141). Screenshot: /tmp/yamt-rel-0.6.3/mr-list.png (page).",
      "pass": true
    },
    {
      "recipe": "4b. Resolve conflicts of !21",
      "observed": "pgrep: `588257 target/release/yamt --repo /tmp/yamt-rel63-mrc`. git status: On branch feature/due-dates, You have unmerged paths, both modified: src/board/card.ts. The !21 row now has \"Continue merging\" with disabled=true. Screenshot: /tmp/yamt-rel-0.6.3/mr-continue.png. The click by name alone was refused as ambiguous (a span and a button share the name), so it was repeated with --role button.",
      "pass": true
    },
    {
      "recipe": "4c. --repo /tmp/yamt-rel63-mrc; Abort merge",
      "observed": "I showed Abort merge from the toolbar's right-click menu and clicked it. The question read \"Abort the merge of main into feature/due-dates and return to develop? yamt deletes feature/due-dates…\" (screenshot /tmp/yamt-rel-0.6.3/abort-question.png). I confirmed it. The app then exited. git status: On branch develop, nothing to commit, working tree clean. Branches: develop, main. `ls .git/yamt-merge-request.json` says No such file.",
      "pass": true
    },
    {
      "recipe": "5. stop; leftovers; rm /tmp/yamt-rel63-*",
      "observed": "stop stopped tauri-driver and xvfb for both sessions. pgrep found no yamt, Xvfb, driver or dbus process from this run. Only two oxlint/oxfmt LSP processes from target/stryker-tmp matched, and they predate this run. /tmp/yamt-rel63-* is removed.",
      "pass": true
    }
  ],
  "environment": "rustc 1.99.0; node v26.13.0; pnpm 12.0.0; Arch Linux x64; private Xvfb :3 through app-session. Only the owner (CI) can check: macOS and Windows tests and builds, and gitlab.com itself (only fake glab was used here)."
}
