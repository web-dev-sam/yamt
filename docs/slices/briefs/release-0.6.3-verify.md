# Release 0.6.3 — final run before tagging

Board "Release 0.6.3" row 2. `main` is at the release commit "chore(release): 0.6.3": everything after `v0.6.2`
(`88086cb`). That covers the merge-request conflicts feature (row size, merge status icon, Resolve, Continue,
Abort, the push question), the row opening its GitLab page, and session 40's row work: `diffStats` instead of
`diffStatsSummary`, the two-line coloured row, and the cursor and button highlight. Version `0.6.3` (`Cargo.toml`,
`Cargo.lock`), `CHANGELOG.md` `## [0.6.3] - 2026-10-31`, and the README naming the 0.6.3 files (generated from
`.readmer/readme.json`). **No mutation run** (VF7). Use read-only recipes only (VF6); you fix nothing (VF1).

Environment: app-session names `r63-…`; scratch under `/tmp/yamt-rel-0.6.3/`; throwaway repositories
`/tmp/yamt-rel63-*`; `--home /tmp/yamt-rel-0.6.3/home-<n>` on every `start-app`. The owner's own yamt may be
running: leave it alone, and never `pkill`/`killall`. Launch everything on a private display.

## Recipes

1. `just check` and `readmer check` (exit 0 each).
2. **Licences:** `scripts/third-party-licenses.sh && git diff --exit-code THIRD_PARTY_LICENSES.txt` (exit 0, no diff).
3. **Bundle:** `cargo tauri build --bundles deb`. Check that `target/release/bundle/deb/yamt_0.6.3_amd64.deb` exists,
   that its control Version is `0.6.3` (read with `bsdtar`), and that `target/release/yamt --version` prints
   `yamt 0.6.3`.
4. **The release binary on the merge-request page** (`start-app --binary target/release/yamt …`): run
   `scripts/mr-conflict-repo.sh /tmp/yamt-rel63-mrc`, then
   `start-app --diff --dir /tmp/yamt-rel63-mrc --glab mr-conflicts`, and open "Merge requests":
   - 11 rows. Each row is two lines: the title, then `!iid · created … · size`. Report `!32`'s second-line
     `textContent` and the computed colours of its `+`/`−` parts. Take a screenshot.
   - Click "Resolve conflicts of !21". A merge window starts (`pgrep -af 'yamt --repo /tmp/yamt-rel63-mrc'`), and
     `git -C /tmp/yamt-rel63-mrc status` shows the branch `feature/due-dates` with unmerged paths. The row then
     offers "Continue merging", disabled while the window is open.
   - In the merge window (its own app-session, or `stop` and start it with `--repo /tmp/yamt-rel63-mrc`), Abort
     the merge. The checkout is back on `develop`, `git status` is clean, and the record
     `yamt-merge-request.json` is gone (`git rev-parse --git-path yamt-merge-request.json`).
5. After `stop`: no yamt, Xvfb, driver or private bus from this run is left. Remove `/tmp/yamt-rel63-*`.

## Report

Report `gate`, `failures` and `smoke` per `skill://verification`, plus the environment facts. Name what only the
owner can check: the macOS and Windows test runs and builds (only CI makes them), and gitlab.com itself.
