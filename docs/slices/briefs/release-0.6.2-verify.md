# Release 0.6.2 — final run before tagging

Board "Release 0.6.2" row 3. `main` at the release commit "chore(release): 0.6.2" (`34c5369`): 0.6.1 (its final run
`.omp/run/notes/Release061Verify.md` passed) plus test-only changes that make the merge-request tests portable to
macOS and Windows (`c171d5c`, notes `.omp/run/notes/MrPortableTests.md`) and CI changes (`.github/**`: build cache,
macOS 15). No product code changed since 0.6.1. Version `0.6.2` (`Cargo.toml`, `Cargo.lock`), `CHANGELOG.md`
`## [0.6.2] - 2026-10-30`, the README naming the 0.6.2 files. **No mutation run** (VF7). Read-only recipes only (VF6);
you fix nothing (VF1).

Environment: app-session names `r62-…`; scratch under `/tmp/yamt-rel-0.6.2/`; throwaway repositories `/tmp/yamt-rel62-*`;
`--home /tmp/yamt-rel-0.6.2/home-<n>` on every `start-app`. The owner's own yamt may be running: leave it alone; never
`pkill`/`killall`. Every launch on a private display.

## Recipes

1. `just check` and `readmer check` (exit 0 each).
2. **Merge-request tests through a symlinked temporary folder** (the macOS path form, reproduced on Linux):
   `mkdir -p /tmp/yamt-rel-0.6.2/tmp-real && ln -sfn /tmp/yamt-rel-0.6.2/tmp-real /tmp/yamt-rel-0.6.2/tmp-link`, then
   `TMPDIR=/tmp/yamt-rel-0.6.2/tmp-link cargo nextest run -p yamt-merge-requests` and
   `TMPDIR=/tmp/yamt-rel-0.6.2/tmp-link cargo nextest run -p yamt-app -E 'test(/^merge_requests::/)'`: all pass.
3. **Licences:** `scripts/third-party-licenses.sh && git diff --exit-code THIRD_PARTY_LICENSES.txt` (exit 0, no diff).
4. **Bundle:** `cargo tauri build --bundles deb`: `target/release/bundle/deb/yamt_0.6.2_amd64.deb` exists; its control
   Version is `0.6.2` (read with `bsdtar`); `target/release/yamt --version` prints `yamt 0.6.2`.
5. **The release binary** (`start-app --binary target/release/yamt …`): `scripts/range-repo.sh /tmp/yamt-rel62-range`,
   `start-app --range main...feature --repo … --glab merge-requests`: the merge-requests page lists 5 rows; a job click
   writes its `https://gitlab.example/…/-/jobs/<id>` to `opened.log`. After `stop`: no yamt, Xvfb, driver or private
   bus from this run. Remove `/tmp/yamt-rel62-*` and `/tmp/yamt-rel-0.6.2/tmp-*`.

## Report

`gate`, `failures`, `smoke` per `skill://verification`; environment facts. Name what only the owner can check (the
macOS and Windows test runs and builds, which only CI makes).
