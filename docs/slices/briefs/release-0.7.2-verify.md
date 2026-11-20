# Release 0.7.2 — final run before tagging

Board "Release 0.7.2" row 2. `main` is at the release commit "chore(release): 0.7.2" (`831a01c1`): 0.7.1 plus the
local conflict check fix (board "Conflicts vanish after refresh", plan §2 #197; its final run passed:
`.omp/run/notes/LocalConflictsFinal2.md`). Version `0.7.2` (`Cargo.toml`, `Cargo.lock`), `CHANGELOG.md`
`## [0.7.2] - 2026-11-20`, README naming the 0.7.2 files. **No mutation run** (VF7). Read-only recipes only (VF6); you
fix nothing (VF1).

Environment: app-session names `r72-…`; scratch under `/tmp/yamt-rel-0.7.2/`; `--home /tmp/yamt-rel-0.7.2/home` on
every `start-app`. The owner's own yamt may be running: leave it alone; never `pkill`/`killall`. Everything on a private
display.

## Recipes

1. `just check` and `readmer check` (exit 0 each).
2. **Licences:** `scripts/third-party-licenses.sh && git diff --exit-code THIRD_PARTY_LICENSES.txt` (exit 0, no diff;
   0.7.2 adds no dependency).
3. **Bundle:** `cargo tauri build --bundles deb`: `target/release/bundle/deb/yamt_0.7.2_amd64.deb` exists, its control
   Version is `0.7.2` (read with `bsdtar`), and `target/release/yamt --version` prints `yamt 0.7.2`.
4. **The release binary shows this release's fix:** `docs/slices/briefs/local-conflicts-verify.md` recipe **C** with
   `--binary target/release/yamt`, scratch `/tmp/yamt-rel-0.7.2/lc`, name `r72-lc`: the same nine labels (conflicting
   rows "Has conflicts"), a Refresh keeps them and its log line says no merge ran, the four snapshots byte-identical.
   One `shot` in dark. `stop`.
5. After `stop`: no yamt, Xvfb, driver or private bus from this run is left. Remove `/tmp/yamt-rel-0.7.2/`.

## Report

`gate`, `failures`, `smoke` per `skill://verification`; environment facts. Name what only the owner can check: the
macOS and Windows test runs and builds (CI only), and his merge request !3197 on Apple git 2.50.1 showing
"Has conflicts" after a restart and a Refresh.
