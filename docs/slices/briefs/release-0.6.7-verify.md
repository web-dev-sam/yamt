# Release 0.6.7 — final run before tagging

Board "Release 0.6.7" row 2. `main` is at the release commit "chore(release): 0.6.7" (`4f2b4084`): 0.6.6 plus the
merge-request page work since (whose turn in open discussions, review mode, the list's age, `yamt --mr`,
`YAMT_AI`; each feature's final run passed, last `.omp/run/notes/MrStartsRepass.md`). Version `0.6.7` (`Cargo.toml`,
`Cargo.lock`), `CHANGELOG.md` `## [0.6.7] - 2026-11-03`, and the README naming the 0.6.7 files. **No mutation run**
(VF7). Read-only recipes only (VF6); you fix nothing (VF1).

Environment: app-session names `r67-…`; scratch under `/tmp/yamt-rel-0.6.7/`; throwaway repositories
`/tmp/yamt-rel67-*`; `--home /tmp/yamt-rel-0.6.7/home-<n>` on every `start-app`. The owner's own yamt may be
running: leave it alone; never `pkill`/`killall`. Launch everything on a private display.

## Recipes

1. `just check` and `readmer check` (exit 0 each).
2. **Licences:** `scripts/third-party-licenses.sh && git diff --exit-code THIRD_PARTY_LICENSES.txt` (exit 0, no diff).
3. **Bundle:** `cargo tauri build --bundles deb`: `target/release/bundle/deb/yamt_0.6.7_amd64.deb` exists, its control
   Version is `0.6.7` (read with `bsdtar`), and `target/release/yamt --version` prints `yamt 0.6.7`;
   `target/release/yamt --help` names `--mr` and `YAMT_AI=1`.
4. **The release binary starts on the merge-request page with AI on**: `scripts/range-repo.sh /tmp/yamt-rel67-mr`,
   then `YAMT_AI=1 just app-session start-app --name r67-mr --binary target/release/yamt --diff --dir
   /tmp/yamt-rel67-mr --glab merge-requests --mr --home /tmp/yamt-rel-0.6.7/home-1`: the page with its rows at once,
   no click; "just now" left of Refresh, its hover today's `HH:MM`. Click "Show Diff" on row 0: `pgrep -af 'yamt
   --diff='` shows the child ending with `--ai`, and a private-display screenshot shows the child's window with "Ask
   AI" on a new thread. No CSP error in the app log. `stop`.
5. After `stop`: no yamt, Xvfb, driver or private bus from this run is left. Remove `/tmp/yamt-rel67-*`.

## Report

`gate`, `failures`, `smoke` per `skill://verification`; environment facts. Name what only the owner can check (the
macOS and Windows test runs and builds, which only CI makes; the GitLab playground checks still open on the board).
