# Release064Verify

Agent output (`agent://Release064Verify`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-10-30T21-21-14-771Z_01a18eb0-3413-7251-ad3d-5e4e0123ce8e/Release064Verify.md), collected 2026-10-31T10:38:46.159Z.

{
  "gate": "pass",
  "failures": [],
  "smoke": [
    {
      "recipe": "1. just check && readmer check",
      "observed": "just check ran all recipes ending in golden ok (10 cases), sfc-order and hooks-test 'ℹ tests 18 ℹ pass 18 ℹ fail 0'; 'EXIT 0'; readmer check 'READMER 0'.",
      "pass": true
    },
    {
      "recipe": "2. scripts/third-party-licenses.sh && git diff --exit-code THIRD_PARTY_LICENSES.txt",
      "observed": "LIC 0, DIFF 0 (no diff)",
      "pass": true
    },
    {
      "recipe": "3. cargo tauri build --bundles deb; bsdtar control; target/release/yamt --version",
      "observed": "'Bundling yamt_0.6.4_amd64.deb (.../target/release/bundle/deb/yamt_0.6.4_amd64.deb)' '(6.03 MiB)' BUILD 0; control 'Version: 0.6.4'; 'yamt 0.6.4'",
      "pass": true
    },
    {
      "recipe": "4a. start-app --binary target/release/yamt --diff --ai --dir /tmp/yamt-rel64-rr --glab merge-requests; Merge requests → Show Diff (first row)",
      "observed": "pgrep -af 'yamt --diff=': '1097482 /home/wds/Projects/yamt/target/release/yamt --diff=531ea52dfb892e20206010fb6cd6161d9c88964a..6ea97d8eee3a6a962d0411a0ed0f8d28ac90fc19 --repo /tmp/yamt-rel64-rr --ai'",
      "pass": true
    },
    {
      "recipe": "4b. same without --ai",
      "observed": "'1098733 /home/wds/Projects/yamt/target/release/yamt --diff=531ea52dfb892e20206010fb6cd6161d9c88964a..6ea97d8eee3a6a962d0411a0ed0f8d28ac90fc19 --repo /tmp/yamt-rel64-rr' (no --ai). stop reported child 1098733 stopped.",
      "pass": true
    },
    {
      "recipe": "5. start-app --binary target/release/yamt --diff --dir /tmp/yamt-rel64-mrc --glab mr-conflicts; Resolve conflicts of !21",
      "observed": "11 rows, each title + meta line: !32 Board themes … !21 'Due dates on cards / !21 · created 1 week ago · +120 −40 · 6 files'. First click by name was ambiguous in the locator (span and button share the name: 'pass --nth <i> or --role <role>'), so I clicked again with --role button: '1101159 .../target/release/yamt --repo /tmp/yamt-rel64-mrc' started; git status: 'On branch feature/due-dates … You have unmerged paths … both modified: src/board/card.ts'.",
      "pass": true
    },
    {
      "recipe": "6. stop + leftovers + rm /tmp/yamt-rel64-*",
      "observed": "stop: tauri-driver, xvfb, yamt child each 'stopped'; session folders removed; pgrep for target/release/yamt|Xvfb|tauri-driver|WebKitWebDriver|dbus yamt exit 1 (none); ls /tmp/yamt-rel64-*: 'No such file or directory'.",
      "pass": true
    }
  ],
  "environment": "rustc 1.99.0 (b940084d7 2026-09-28), node v26.13.0, pnpm 12.0.0; Arch Linux x64; private display :3 (Xvfb) via app-session. Only the owner/CI can check: the macOS and Windows test runs and builds. No mutation run (VF7)."
}
