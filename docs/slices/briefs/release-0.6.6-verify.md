# Release 0.6.6 — final run before tagging

Board "Release 0.6.6" row 2. `main` is at the release commit "chore(release): 0.6.6" (`b99c9fb8`): 0.6.5 plus the
merge-request page work since (row details, due dates, exclude filters, list search, local conflict check, CI job log;
each feature's final run passed, last `.omp/run/notes/CiJobLogRepass.md`). Version `0.6.6` (`Cargo.toml`,
`Cargo.lock`), `CHANGELOG.md` `## [0.6.6] - 2026-11-03`, and the README naming the 0.6.6 files. **No mutation run**
(VF7). Read-only recipes only (VF6); you fix nothing (VF1).

Environment: app-session names `r66-…`; scratch under `/tmp/yamt-rel-0.6.6/`; throwaway repositories
`/tmp/yamt-rel66-*`; `--home /tmp/yamt-rel-0.6.6/home-<n>` on every `start-app`. The owner's own yamt may be
running: leave it alone; never `pkill`/`killall`. Launch everything on a private display.

## Recipes

1. `just check` and `readmer check` (exit 0 each).
2. **Licences:** `scripts/third-party-licenses.sh && git diff --exit-code THIRD_PARTY_LICENSES.txt` (exit 0, no diff).
3. **Bundle:** `cargo tauri build --bundles deb`: `target/release/bundle/deb/yamt_0.6.6_amd64.deb` exists, its control
   Version is `0.6.6` (read with `bsdtar`), and `target/release/yamt --version` prints `yamt 0.6.6`.
4. **The release binary shows a failed job's log** (`start-app --binary target/release/yamt …`): the repository and
   fake-glab scenario of `ci-job-log-verify.md` step C (`--glab ci-job-log`), repository under `/tmp/yamt-rel66-cl`,
   `--home /tmp/yamt-rel-0.6.6/home-1`. Open the merge-request page; on `!71` hover the CI icon, point at `phpunit`,
   `press Shift --x11`: the log box opens at its end, coloured, focus in the field; `type fail --x11` → "6 of 6".
   `stop`; start again with the same home, reopen `phpunit`'s log: the field holds `fail`, "6 of 6". The fake glab's
   calls log has one `jobs/302/trace` per run. No CSP error in the app log. `stop`.
5. After `stop`: no yamt, Xvfb, driver or private bus from this run is left. Remove `/tmp/yamt-rel66-*`.

## Report

`gate`, `failures`, `smoke` per `skill://verification`; environment facts. Name what only the owner can check (the
macOS and Windows test runs and builds, which only CI makes; the GitLab playground checks still open on the board).
