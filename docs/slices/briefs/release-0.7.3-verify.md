# Release 0.7.3 — final run before tagging

Board "Release 0.7.3" row 2. `main` is at the release commit "chore(release): 0.7.3" (`4ed4ccba`): 0.7.2 plus folder
rows in the range window's file tree showing the muted reviewed check (title "every file reviewed") when every file
below the folder, at any depth, is marked reviewed (`1ed48f9e`, `rangeFolderSums.ts` `reviewedFolders`). Version `0.7.3`
(`Cargo.toml`, `Cargo.lock`), `CHANGELOG.md` `## [0.7.3] - 2026-11-20`, README naming the 0.7.3 files. **No mutation
run** (VF7). Read-only recipes only (VF6); you fix nothing (VF1).

Environment: app-session names `r73-…`; scratch under `/tmp/yamt-rel-0.7.3/`; `--home /tmp/yamt-rel-0.7.3/home` on
every `start-app`. The owner's own yamt may be running: leave it alone; never `pkill`/`killall`. Everything on a private
display.

## Recipes

1. `just check` and `readmer check` (exit 0 each).
2. **Licences:** `scripts/third-party-licenses.sh && git diff --exit-code THIRD_PARTY_LICENSES.txt` (exit 0, no diff;
   0.7.3 adds no dependency).
3. **Bundle:** `cargo tauri build --bundles deb`: `target/release/bundle/deb/yamt_0.7.3_amd64.deb` exists, its control
   Version is `0.7.3` (read with `bsdtar`), and `target/release/yamt --version` prints `yamt 0.7.3`.
4. **The release binary shows this release's change:** in `/tmp/yamt-rel-0.7.3/repo` make a git repo whose `base`
   commit is followed by a `feature` commit changing `src/board/card.ts`, `src/board/view.ts`, `src/main.ts`,
   `docs/a.md`. `just app-session start-app --name r73-rv --binary target/release/yamt --home /tmp/yamt-rel-0.7.3/home
   --range base..feature --repo /tmp/yamt-rel-0.7.3/repo`; switch the list to the tree. Mark `src/board/card.ts` and
   `src/board/view.ts` Reviewed: `board` gets the check (title "every file reviewed", muted colour, name not muted),
   `src` does not. Mark `src/main.ts`: `src` gets it. Unmark `src/board/view.ts`: both `board` and `src` lose it; `docs`
   never has it. One `shot` with `board` and `src` checked. `stop`.
5. After `stop`: no yamt, Xvfb, driver or private bus from this run is left. Remove `/tmp/yamt-rel-0.7.3/`.

## Report

`gate`, `failures`, `smoke` per `skill://verification`; environment facts. Name what only the owner can check: the
macOS and Windows test runs and builds (CI only).
