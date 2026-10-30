# Release061Verify

Agent output (`agent://Release061Verify`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-10-30T13-26-49-608Z_01a18cfd-dc08-7052-b10f-ed6a2bb5d1b5/Release061Verify.md), collected 2026-10-30T17:19:49.042Z.

{
  "gate": "pass",
  "failures": [],
  "smoke": [
    {
      "recipe": "1. just check + readmer check",
      "observed": "just check exit=0; tail hooks-test 'tests 18 pass 18 fail 0'; wall 57.17 s (log /tmp/yamt-rel-0.6.1/check.log). readmer check exit 0.",
      "pass": true
    },
    {
      "recipe": "2. third-party-licenses.sh && git diff --exit-code THIRD_PARTY_LICENSES.txt",
      "observed": "script exit 0; git diff exit 0, no diff.",
      "pass": true
    },
    {
      "recipe": "3. cargo tauri build --bundles deb",
      "observed": "exit 0, 'Bundling yamt_0.6.1_amd64.deb' (6141740 bytes). control 'Version: 0.6.1'; usr/bin only usr/bin/yamt; usr/lib/yamt/THIRD_PARTY_LICENSES.txt cmp-equal to the repository copy (cmp=0). target/release/yamt --version -> 'yamt 0.6.1'.",
      "pass": true
    },
    {
      "recipe": "4.1 release binary merge window",
      "observed": "7 files listed (logo.bin, removed.md, crlf.txt, App.vue, vOn.ts, PersistQueryClientProvider.tsx, added.ts); no Merge requests button. Opened vOn.ts, Mark resolved -> 'Unprocessed Changes' dialog -> Save Current Result (fresh repo) -> ls-files -u no longer lists vOn.ts, status 'M  …/vOn.ts'.",
      "pass": true
    },
    {
      "recipe": "4.2 range main...feature --glab merge-requests",
      "observed": "MR button x1527-1555, gear x1559-1587. '5 of 5': !13,!12,!11,!9,!8 newest first. Drafts -> '1 of 5 | !11'. Hover !13 -> 'unit tests', 'lint allowed to fail' last. Job click -> opened.log 'https://gitlab.example/taskboard/taskboard/-/jobs/301'. Open !13 -> child 'target/release/yamt --diff=531ea52…..6ea97d8… --repo /tmp/yamt-rel61-range'. Refs/status unchanged, no FETCH_HEAD. Again -> '!13 is already open in another yamt window.' stop -> yamt child stopped.",
      "pass": true
    },
    {
      "recipe": "4.3 --diff --dir range --glab; --diff alone; JSON; close",
      "observed": "With --glab: button, page '5 of 5 | !13 !12 !11 !9 !8'. --diff alone: no MR button. {..count:1} vs {..count:2}: mode 'Auto · JSON', 1 and 2 highlighted both columns (json-diff.png). WM_DELETE_WINDOW close via existing 0.6.0 exit wrapper -> '0 --diff'.",
      "pass": true
    },
    {
      "recipe": "4.4 cleanup",
      "observed": "Each stop: tauri-driver and xvfb stopped. pgrep yamt/Xvfb/driver/dbus: only the owner's sddm/plasma session. /tmp/yamt-rel61-* removed. git status clean.",
      "pass": true
    }
  ],
  "environment": "HEAD 4d81d47, clean. rustc 1.99.0, node v26.13.0, pnpm 12.0.0. tauri-driver WebKit, Xvfb :3, no WM; no dpkg-deb. Owner-only: Windows/macOS builds (CI). Mis-click opened !8 changes; reaped at stop."
}
