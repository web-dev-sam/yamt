# Release 0.7.4 — final run before tagging

Board "Release 0.7.4" row 2. `main` is at the release commit "chore(release): 0.7.4" (`ca2ef557`): 0.7.3 plus the
`CHANGELOG.md` `## [0.7.4] - 2026-11-25` entries — Queue/Note and Shift+Send in the diff window's comment boxes, the
merge-request heading, folder sums only with Shift, the next file in the sidebar's order with the "left to review"
total, and url 2.5.9 / cookie 0.18.3 (`345838bc`). Version `0.7.4` (`Cargo.toml`, `Cargo.lock`), README naming the
0.7.4 files. **No mutation run** (VF7). Read-only recipes only (VF6); you fix nothing (VF1).

Environment: app-session names `r74-…`; scratch under `/tmp/yamt-rel-0.7.4/`; `--home /tmp/yamt-rel-0.7.4/home` on
every `start-app`. The owner's own yamt may be running: leave it alone; never `pkill`/`killall`. Everything on a private
display.

## Recipes

1. `just check` and `readmer check` (exit 0 each).
2. **Licences:** `scripts/third-party-licenses.sh && git diff --exit-code THIRD_PARTY_LICENSES.txt` (exit 0, no diff).
3. **Bundle:** `cargo tauri build --bundles deb`: `target/release/bundle/deb/yamt_0.7.4_amd64.deb` exists, its control
   Version is `0.7.4` (read with `bsdtar`), and `target/release/yamt --version` prints `yamt 0.7.4`.
4. **The release binary shows this release's changes** (`--binary target/release/yamt`):
   - Next file: in `/tmp/yamt-rel-0.7.4/snr` the repo of `docs/slices/briefs/sidebar-next-file-smoke.md` §1
     (`main` with `a.txt`, `b/x.txt`, `b/y.txt`, `c.txt`, `z/w.txt`; `feature` changes each). `start-app --name r74-sn
     --range main...feature --repo …`; tree view: `b/y.txt` → Reviewed → `z/w.txt` shown; the muted "left to review"
     total left of the view toggle drops by that file's counts. One `shot`. `stop`.
   - Queue: `scripts/range-repo.sh` repo, `start-app --name r74-cq --range main...feature --repo … --glab lined-up`:
     a new comment's box shows Queue (Send while Shift is held, real WebDriver key actions) and Note; Shift+click Send
     sends exactly one draft POST (`glab/calls.log`), a plain Queue leaves it queued. One `shot`. `stop`.
5. After `stop`: no yamt, Xvfb, driver or private bus from this run is left. Remove `/tmp/yamt-rel-0.7.4/`.

## Report

`gate`, `failures`, `smoke` per `skill://verification`; environment facts. Name what only the owner can check: the
macOS and Windows test runs and builds (CI only).
