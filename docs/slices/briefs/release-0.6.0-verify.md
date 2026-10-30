# Release 0.6.0 — final run before tagging

Board "Releases 0.6.0 and 0.6.1" row 2. `main` at the release commit "chore(release): 0.6.0": the product of
0.6.0-beta.2 (no product change since; its final run `.omp/run/notes/Release060Beta2Verify.md` passed), the workspace
version `0.6.0` (`Cargo.toml`, `Cargo.lock`), `CHANGELOG.md` `## [0.6.0] - 2026-10-30`, the README naming the 0.6.0
files. This run checks the release build of that commit. **No mutation run** (VF7). Read-only recipes only (VF6); you
fix nothing (VF1); alone.

Environment: app-session names `r60-…`; scratch under `/tmp/yamt-rel-0.6.0/`; throwaway repositories `/tmp/yamt-rel60-*`;
`--home /tmp/yamt-rel-0.6.0/home-<n>` on every `start-app`. The owner's own yamt may be running: leave it alone; never
`pkill`/`killall`. Every launch on a private display.

## Recipes

1. `just check` and `readmer check` (exit 0 each).
2. **Licences:** `scripts/third-party-licenses.sh && git diff --exit-code THIRD_PARTY_LICENSES.txt` (exit 0, no diff).
3. **Bundle:** `cargo tauri build --bundles deb`: `target/release/bundle/deb/yamt_0.6.0_amd64.deb` exists;
   `dpkg-deb -f <deb> Version` prints `0.6.0`; `usr/bin/yamt` is the only program in `usr/bin`; it carries
   `THIRD_PARTY_LICENSES.txt` equal to the repository's; `target/release/yamt --version` prints `yamt 0.6.0`.
4. **The release binary** (`start-app --binary target/release/yamt …`):
   1. `scripts/conflict-repo.sh /tmp/yamt-rel60-merge`: the files listed; open a text conflict; Ctrl+Shift+S, search a
      word → rows; click a row → the Result selects it; Mark resolved stages it (`ls-files -u` no longer lists it).
   2. `scripts/range-repo.sh /tmp/yamt-rel60-range`, `start-app --range main...feature --repo … --glab lined-up`: the
      list with folder sums, unchanged lines behind the wave; add a thread, Post, Send → the fake glab's log has one
      POST; close (exit 0).
   3. `--diff`: two JSON texts differing in one value → the difference in both columns; close → exit 0.
   4. After `stop`: no yamt, Xvfb, driver or private bus from this run. Remove `/tmp/yamt-rel60-*`.

## Report

`gate`, `failures`, `smoke` per `skill://verification`; environment facts.
