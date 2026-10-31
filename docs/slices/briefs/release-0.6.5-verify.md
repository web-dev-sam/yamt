# Release 0.6.5 — final run before tagging

Board "Release 0.6.5" row 2. `main` is at the release commit "chore(release): 0.6.5" (`86e49122`): 0.6.4 plus
line-range threads (plan §2 #145–#148; feature final run passed, `.omp/run/notes/LineRangesFinal.md` and
`LineRangesFinalRepass.md`). Version `0.6.5` (`Cargo.toml`, `Cargo.lock`), `CHANGELOG.md`
`## [0.6.5] - 2026-10-31`, and the README naming the 0.6.5 files. **No mutation run** (VF7). Read-only recipes only
(VF6); you fix nothing (VF1).

Environment: app-session names `r65-…`; scratch under `/tmp/yamt-rel-0.6.5/`; throwaway repositories
`/tmp/yamt-rel65-*`; `--home /tmp/yamt-rel-0.6.5/home-<n>` on every `start-app`. The owner's own yamt may be
running: leave it alone; never `pkill`/`killall`. Launch everything on a private display.

## Recipes

1. `just check` and `readmer check` (exit 0 each).
2. **Licences:** `scripts/third-party-licenses.sh && git diff --exit-code THIRD_PARTY_LICENSES.txt` (exit 0, no diff).
3. **Bundle:** `cargo tauri build --bundles deb`: `target/release/bundle/deb/yamt_0.6.5_amd64.deb` exists, its control
   Version is `0.6.5` (read with `bsdtar`), and `target/release/yamt --version` prints `yamt 0.6.5`.
4. **The release binary keeps a range thread** (`start-app --binary target/release/yamt …`):
   `scripts/range-repo.sh /tmp/yamt-rel65-rr`, then `start-app --range main...feature --repo /tmp/yamt-rel65-rr
   --home /tmp/yamt-rel-0.6.5/home-1`; open `src/board/board.ts`, collapse off. Drag the right column's number 201 down
   to 204 (`line-ranges-verify.md` step C explains tagging a number cell and `drag --dy 60`): the box header reads
   `src/board/board.ts:201-204`; type "Release range", Comment. Drag left 200 to right 204: header
   `src/board/board.ts:-200 to +204`; type "Release across", Comment. `stop`; the pair's `threads.json` under the home
   holds `"format": 2` and both places as in `line-ranges-verify.md` D.2. Start again with the same home: the badge on
   right 204 reads 2 and both headers are back. `stop`.
5. After `stop`: no yamt, Xvfb, driver or private bus from this run is left. Remove `/tmp/yamt-rel65-*`.

## Report

`gate`, `failures`, `smoke` per `skill://verification`; environment facts. Name what only the owner can check (the
macOS and Windows test runs and builds, which only CI makes; the GitLab playground check of line-range threads).
