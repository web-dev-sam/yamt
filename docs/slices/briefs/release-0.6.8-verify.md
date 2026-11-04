# Release 0.6.8 — final run before tagging

Board "Release 0.6.8" row 2. `main` is at the release commit "chore(release): 0.6.8" (`631a8f25`): 0.6.7 plus the
merge-request page work since (adding and removing people, the description panel, linked epics/issues/commits; each
feature's final run passed, last `.omp/run/notes/MrLinksFinal.md`) and the owner's icon fix `3012182c`. Version
`0.6.8` (`Cargo.toml`, `Cargo.lock`), `CHANGELOG.md` `## [0.6.8] - 2026-11-04`, and the README naming the 0.6.8 files.
**No mutation run** (VF7). Read-only recipes only (VF6); you fix nothing (VF1).

Environment: app-session names `r68-…`; scratch under `/tmp/yamt-rel-0.6.8/`; throwaway repositories
`/tmp/yamt-rel68-*`; `--home /tmp/yamt-rel-0.6.8/home-<n>` on every `start-app`. The owner's own yamt may be
running: leave it alone; never `pkill`/`killall`. Launch everything on a private display.

## Recipes

1. `just check` and `readmer check` (exit 0 each).
2. **Licences:** `scripts/third-party-licenses.sh && git diff --exit-code THIRD_PARTY_LICENSES.txt` (exit 0, no diff;
   0.6.8 added the direct dependencies `dom_query` and `url`).
3. **Bundle:** `cargo tauri build --bundles deb`: `target/release/bundle/deb/yamt_0.6.8_amd64.deb` exists, its control
   Version is `0.6.8` (read with `bsdtar`), and `target/release/yamt --version` prints `yamt 0.6.8`.
4. **The release binary shows this release's three features**: `scripts/local-conflicts-repo.sh /tmp/yamt-rel68-mr`,
   then `just app-session start-app --name r68-mr --binary target/release/yamt --diff --dir /tmp/yamt-rel68-mr
   --glab mr-links --mr --home /tmp/yamt-rel-0.6.8/home-1`:
   - the page with its rows at once; !62's people box has the add buttons beside "Assignees" and "Reviewers";
   - !62's info button opens the description panel, Escape closes it;
   - hovering !62's links button lists Epics 3, Issues 6, Commits 4; the link-line icons sit centred on their line
     (private-display screenshot of the box);
   - no CSP error in the app log. `stop`.
5. After `stop`: no yamt, Xvfb, driver or private bus from this run is left. Remove `/tmp/yamt-rel68-*`.

## Report

`gate`, `failures`, `smoke` per `skill://verification`; environment facts. Name what only the owner can check (the
macOS and Windows test runs and builds, which only CI makes; the GitLab playground checks still open on the board).
