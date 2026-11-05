# Release 0.7.0 — final run before tagging

Board "Release 0.7.0" row 2. `main` is at the release commit "chore(release): 0.7.0": 0.6.9 plus `@` completion, the
fast comment preview, the review fixes, table alignment and the one-person discussions view (each feature's final run
passed: `.omp/run/notes/MrMentionsFinal.md`, `MrFastPreviewFinal.md`, `MrReviewFixesFinal.md`,
`TableAlignmentFinal.md`, `MrPersonDiscussionsFinal.md`; the Discussions button's outline fix `27ab078c` after it).
Version `0.7.0` (`Cargo.toml`, `Cargo.lock`), `CHANGELOG.md` `## [0.7.0] - 2026-11-05`, and the README naming the 0.7.0
files. **No mutation run** (VF7). Read-only recipes only (VF6); you fix nothing (VF1).

Environment: app-session names `r70-…`; scratch under `/tmp/yamt-rel-0.7.0/`; throwaway repositories
`/tmp/yamt-rel70-*`; `--home /tmp/yamt-rel-0.7.0/home-<n>` on every `start-app`. The owner's own yamt may be
running: leave it alone; never `pkill`/`killall`. Launch everything on a private display.

## Recipes

1. `just check` and `readmer check` (exit 0 each).
2. **Licences:** `scripts/third-party-licenses.sh && git diff --exit-code THIRD_PARTY_LICENSES.txt` (exit 0, no diff;
   0.7.0 added no third-party dependency).
3. **Bundle:** `cargo tauri build --bundles deb`: `target/release/bundle/deb/yamt_0.7.0_amd64.deb` exists, its control
   Version is `0.7.0` (read with `bsdtar`), and `target/release/yamt --version` prints `yamt 0.7.0`.
4. **The release binary shows this release's features**: `scripts/local-conflicts-repo.sh /tmp/yamt-rel70-mr`, then
   `just app-session start-app --name r70-mr --binary target/release/yamt --diff --dir /tmp/yamt-rel70-mr
   --glab mr-threads --mr --home /tmp/yamt-rel-0.7.0/home-1`:
   - the page with its rows at once;
   - "Discussions" → the view in the list's place, the button outlined (not filled) while pressed; the entries of !90
     and !91 with their first comments formatted (d01: bold, code, link, table) and the writers' pictures under them;
   - Shift over d01's entry expands its thread inline; `@an` in its reply field lists Anna; Preview of a plain
     "Thanks" shows at once with no `markdown` line in the fake glab log;
   - "Add comment" with "Thanks" → the fake glab log has the one `POST …/90/discussions/<d01>/notes` line;
   - "Back to list" → the list; private-display screenshots of the view (one entry expanded) in dark and light;
   - no CSP error in the app log. `stop`.
5. After `stop`: no yamt, Xvfb, driver or private bus from this run is left. Remove `/tmp/yamt-rel70-*`.

## Report

`gate`, `failures`, `smoke` per `skill://verification`; environment facts. Name what only the owner can check (the
macOS and Windows test runs and builds, which only CI makes; the GitLab playground checks still open on the board).
