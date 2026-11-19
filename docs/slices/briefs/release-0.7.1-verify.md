# Release 0.7.1 — final run before tagging

Board "Release 0.7.1" row 2. `main` is at the release commit "chore(release): 0.7.1" (`c3fa489e`): 0.7.0 plus the
Reviewed marks in the diff window (its final run passed: `.omp/run/notes/RangeReviewedFinal.md`). Version `0.7.1`
(`Cargo.toml`, `Cargo.lock`), `CHANGELOG.md` `## [0.7.1] - 2026-11-19`, and the README naming the 0.7.1 files and the
Reviewed paragraph. **No mutation run** (VF7). Read-only recipes only (VF6); you fix nothing (VF1).

Environment: app-session names `r71-…`; scratch under `/tmp/yamt-rel-0.7.1/`; throwaway repositories
`/tmp/yamt-rel71-*`; `--home /tmp/yamt-rel-0.7.1/home` on every `start-app` (restarts share it). The owner's own yamt
may be running: leave it alone; never `pkill`/`killall`. Launch everything on a private display. `app-session stop`
reports no exit code (known); read exit codes by running the binary under `xvfb-run` where asked.

## Recipes

1. `just check` and `readmer check` (exit 0 each).
2. **Licences:** `scripts/third-party-licenses.sh && git diff --exit-code THIRD_PARTY_LICENSES.txt` (exit 0, no diff;
   0.7.1 added no third-party dependency: the new crate `yamt-reviewed` uses workspace dependencies only).
3. **Bundle:** `cargo tauri build --bundles deb`: `target/release/bundle/deb/yamt_0.7.1_amd64.deb` exists, its control
   Version is `0.7.1` (read with `bsdtar`), and `target/release/yamt --version` prints `yamt 0.7.1`.
4. **The release binary shows this release's feature**: `scripts/range-repo.sh /tmp/yamt-rel71-repo`, `git -C … switch
   feature`, then `just app-session start-app --name r71-rv --binary target/release/yamt --range main...HEAD --repo
   /tmp/yamt-rel71-repo --home /tmp/yamt-rel-0.7.1/home`:
   - "Reviewed" first in the header, outlined; "0 of 13 reviewed";
   - on `docs/current.md` Reviewed → the next file opens, "1 of 13"; on `src/board/board.ts` Reviewed → "2 of 13";
     the two rows show the check, names muted. `stop`;
   - commit on `feature` a one-line change to `src/board/board.ts`; start again: `docs/current.md` still checked,
     board.ts "changed since reviewed", its view "Changed since you reviewed it" with only that line, left heading
     "As you reviewed it"; "Review from start" → the whole change, no mark;
   - private-display screenshots of the since view in dark and light; no CSP error in the app log. `stop`.
5. After `stop`: no yamt, Xvfb, driver or private bus from this run is left. Remove `/tmp/yamt-rel71-*`.

## Report

`gate`, `failures`, `smoke` per `skill://verification`; environment facts. Name what only the owner can check (the
macOS and Windows test runs and builds, which only CI makes; the GitLab playground checks still open on the board).
