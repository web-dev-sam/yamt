# Release 0.6.1 — final run before tagging

Board "Releases 0.6.0 and 0.6.1" row 4. `main` at the release commit "chore(release): 0.6.1": 0.6.0 (its final run
`.omp/run/notes/Release060Verify.md` passed) plus the merge of `feat/merge-requests` — the GitLab merge-request
overview in the compare and range windows (request `docs/slices/request-merge-requests.md`; its final run on the
branch passed with a debug build, `.omp/run/notes/MrFinal.md`). Version `0.6.1` (`Cargo.toml`, `Cargo.lock`),
`CHANGELOG.md` `## [0.6.1] - 2026-10-30`, the README naming the 0.6.1 files and describing the overview. This run checks
the release build. **No mutation run** (VF7). Read-only recipes only (VF6); you fix nothing (VF1); alone.

Environment: app-session names `r61-…`; scratch under `/tmp/yamt-rel-0.6.1/`; throwaway repositories `/tmp/yamt-rel61-*`;
`--home /tmp/yamt-rel-0.6.1/home-<n>` on every `start-app`. The owner's own yamt may be running: leave it alone; never
`pkill`/`killall`. Every launch on a private display. App-session options: `skill://verification` (start-app
`--diff --dir`, `--glab` with `--diff`, `opened.log`); the range window takes `--repo`.

## Recipes

1. `just check` and `readmer check` (exit 0 each).
2. **Licences:** `scripts/third-party-licenses.sh && git diff --exit-code THIRD_PARTY_LICENSES.txt` (exit 0, no diff).
3. **Bundle:** `cargo tauri build --bundles deb`: `target/release/bundle/deb/yamt_0.6.1_amd64.deb` exists; its control
   Version is `0.6.1`, `usr/bin/yamt` the only program in `usr/bin`, its `THIRD_PARTY_LICENSES.txt` equal to the
   repository's (read with `bsdtar`; `dpkg-deb` is not installed here); `target/release/yamt --version` prints
   `yamt 0.6.1`.
4. **The release binary** (`start-app --binary target/release/yamt …`):
   1. `scripts/conflict-repo.sh /tmp/yamt-rel61-merge`: the files listed; open a text conflict; Mark resolved stages
      it (`ls-files -u` no longer lists it). No merge-requests button in this window.
   2. `scripts/range-repo.sh /tmp/yamt-rel61-range` (fresh), `start-app --range main...feature --repo … --glab
      merge-requests`: the merge-requests button directly left of the gear; the page lists 5 rows newest first; one
      filter click narrows and the summary counts; CI hover on !13 lists the failed jobs, allowed-to-fail last; a job
      click writes its `https://gitlab.example/…/-/jobs/<id>` to `opened.log`; open !13's changes → a child process
      from `target/release/yamt` with `--diff=<base>..<head> --repo …` in `/proc`; the repository's refs, `status
      --porcelain` and absent `.git/FETCH_HEAD` unchanged; open !13 again → already open; `stop` reports the child
      stopped.
   3. `--diff --dir /tmp/yamt-rel61-range --glab merge-requests`: the button shows and the page lists the rows;
      `--diff` alone: no button; two JSON texts differing in one value → the difference in both columns; close →
      exit 0.
   4. After `stop`: no yamt, Xvfb, driver or private bus from this run. Remove `/tmp/yamt-rel61-*`.

## Report

`gate`, `failures`, `smoke` per `skill://verification`; environment facts. Name what only the owner can check (the
Windows and macOS builds, which only CI makes).
