# Release 0.6.4 — final run before tagging

Board "Release 0.6.4" row 2. `main` is at the release commit "chore(release): 0.6.4": 0.6.3 (final run
`.omp/run/notes/Release063Verify.md` passed) plus two changes. First, `--ai` is carried from `yamt --diff --ai`
and from range windows to the changes window that a merge request's Show Diff opens (plan §2 #144, commits
`5512dd65` and `57597e15`). Second, the mr-conflict-repo tests are gated to unix (`a0ed7d52`, tests only; ci run
41189732015 green on all four jobs). Version `0.6.4` (`Cargo.toml`, `Cargo.lock`), `CHANGELOG.md`
`## [0.6.4] - 2026-10-31`, and the README naming the 0.6.4 files. **No mutation run** (VF7). Read-only recipes only
(VF6); you fix nothing (VF1).

Environment: app-session names `r64-…`; scratch under `/tmp/yamt-rel-0.6.4/`; throwaway repositories
`/tmp/yamt-rel64-*`; `--home /tmp/yamt-rel-0.6.4/home-<n>` on every `start-app`. The owner's own yamt may be
running: leave it alone; never `pkill`/`killall`. Launch everything on a private display.

## Recipes

1. `just check` and `readmer check` (exit 0 each).
2. **Licences:** `scripts/third-party-licenses.sh && git diff --exit-code THIRD_PARTY_LICENSES.txt` (exit 0, no diff).
3. **Bundle:** `cargo tauri build --bundles deb`: `target/release/bundle/deb/yamt_0.6.4_amd64.deb` exists, its control
   Version is `0.6.4` (read with `bsdtar`), and `target/release/yamt --version` prints `yamt 0.6.4`.
4. **The release binary passes `--ai` on** (`start-app --binary target/release/yamt …`):
   `scripts/range-repo.sh /tmp/yamt-rel64-rr`, then `start-app --diff --ai --dir /tmp/yamt-rel64-rr --glab
   merge-requests`. Open "Merge requests" and click "Show Diff" on the first row. `pgrep -af 'yamt --diff='` shows
   the started window with `--ai` at its end. `stop`, then do the same without `--ai`: the started window has no
   `--ai`.
5. **The release binary's merge-request page:** `scripts/mr-conflict-repo.sh /tmp/yamt-rel64-mrc`, then
   `start-app --diff --dir /tmp/yamt-rel64-mrc --glab mr-conflicts`. The page lists 11 two-line rows. Click
   "Resolve conflicts of !21": a merge window starts (`pgrep`), and `git status` shows `feature/due-dates` with
   unmerged paths.
6. After `stop`: no yamt, Xvfb, driver or private bus from this run is left. Remove `/tmp/yamt-rel64-*`.

## Report

`gate`, `failures`, `smoke` per `skill://verification`; environment facts. Name what only the owner can check (the
macOS and Windows test runs and builds, which only CI makes).
