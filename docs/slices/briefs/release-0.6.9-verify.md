# Release 0.6.9 — final run before tagging

Board "Release 0.6.9" row 2. `main` is at the release commit "chore(release): 0.6.9" (`4a13d9fc`): 0.6.8 plus the
merge-request threads feature (its final run passed, `.omp/run/notes/MrThreadsFinal.md` and
`.omp/run/notes/MrThreadsRepassR2.md`). Version `0.6.9` (`Cargo.toml`, `Cargo.lock`), `CHANGELOG.md`
`## [0.6.9] - 2026-11-04`, and the README naming the 0.6.9 files. **No mutation run** (VF7). Read-only recipes only
(VF6); you fix nothing (VF1).

Environment: app-session names `r69-…`; scratch under `/tmp/yamt-rel-0.6.9/`; throwaway repositories
`/tmp/yamt-rel69-*`; `--home /tmp/yamt-rel-0.6.9/home-<n>` on every `start-app`. The owner's own yamt may be
running: leave it alone; never `pkill`/`killall`. Launch everything on a private display.

## Recipes

1. `just check` and `readmer check` (exit 0 each).
2. **Licences:** `scripts/third-party-licenses.sh && git diff --exit-code THIRD_PARTY_LICENSES.txt` (exit 0, no diff;
   0.6.9 added no third-party dependency, `serde_json` in `yamt-gitio` was already in the build).
3. **Bundle:** `cargo tauri build --bundles deb`: `target/release/bundle/deb/yamt_0.6.9_amd64.deb` exists, its control
   Version is `0.6.9` (read with `bsdtar`), and `target/release/yamt --version` prints `yamt 0.6.9`.
4. **The release binary shows this release's feature**: `scripts/local-conflicts-repo.sh /tmp/yamt-rel69-mr`, then
   `just app-session start-app --name r69-mr --binary target/release/yamt --diff --dir /tmp/yamt-rel69-mr
   --glab mr-threads --mr --home /tmp/yamt-rel-0.6.9/home-1`:
   - the page with its rows at once;
   - !90's discussions box shows the turn words ("Your turn", "Author's turn", "Anna Berg's turn", "Open") and
     "4 of 13 wait for you";
   - Shift over d01 opens its thread left of the box: four comments and the "Pending" draft; Write / Preview switches
     (Preview shows the fake glab's rendered text);
   - "Add comment" with "Thanks" shows the after-post thread, and the fake glab log has the one
     `POST …/90/discussions/<d01>/notes` line;
   - private-display screenshot of the box with the panel open;
   - no CSP error in the app log. `stop`.
5. After `stop`: no yamt, Xvfb, driver or private bus from this run is left. Remove `/tmp/yamt-rel69-*`.

## Report

`gate`, `failures`, `smoke` per `skill://verification`; environment facts. Name what only the owner can check (the
macOS and Windows test runs and builds, which only CI makes; the GitLab playground checks still open on the board).
