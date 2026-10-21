# Release 0.4.2 — final run before tagging

Board "Release 0.4.2" row 2. Owner request #1454 ("release a patch version"): release 0.4.2 after merging
`feat/git-operations` (#1453, `a817e0e`). `main` is the merge plus the release commit, which changes no product code:
the workspace version is `0.4.2` (`Cargo.toml`, `Cargo.lock`), `CHANGELOG.md` has `## [0.4.2] - 2026-10-22`, the README
names the 0.4.2 files (`readmer check` passes). Since 0.4.1 the product gained rebase, cherry-pick, revert, merge,
squash merge and `git am` as first-class operations (plan §2 #85–#92): own work on the left, both sides named, Abort
and Continue for each, the operation as a gray tag at the bottom of the file list, a rerere resolution reviewed not
staged. `crates/`, `frontend/`, `src-tauri/` are unchanged since `f458b66`, whose gate passed at `e0e1721`; the feature's
final run (`b90ad8b`, `just mutants 71fc4ce` included) and the tag's checks are in `.omp/run/notes/GitOpsVerify.md`,
`GitOpsTagVerify.md`. No mutation run this time. No dependency changed since `71fc4ce`. Read-only recipes only (VF6);
you fix nothing (VF1); alone.

Environment: app-session names `r-…`; scratch and screenshots under `/tmp/yamt-rel-0.4.2/`; throwaway repositories
`/tmp/yamt-rel-*`, git writes only as `git -C /tmp/…`; `--home /tmp/yamt-rel-0.4.2/home-<n>` on every `start-app`. The
owner's own yamt may be running: leave it alone. The owner's settings file (`~/.config/yamt/`) and window storage stay
untouched. Record yamt's exit status with a wrapper around the binary, as the feature's final run did
(`.omp/run/notes/GitOpsVerify.md`); close windows with `WM_DELETE_WINDOW`, not WebDriver (#1447).

## Recipes

1. `just check` — the whole gate. Paste each recipe's tail and the exit status.
2. **Licences, as the release job checks them:** `scripts/third-party-licenses.sh && git diff --exit-code
   THIRD_PARTY_LICENSES.txt`. Pass: exit 0, no diff.
3. **Bundle:** `cargo tauri build --bundles deb`. Pass: `target/release/bundle/deb/yamt_0.4.2_amd64.deb` exists; its
   contents list `usr/bin/yamt` as the only program in `usr/bin` and carry `THIRD_PARTY_LICENSES.txt` equal to the
   repository's; `target/release/yamt --version` prints `yamt 0.4.2`.
4. **The release binary** (`target/release/yamt`) on a private display through the app-session helper (`start-app
   --name <n> --binary target/release/yamt --repo <dir> --home <home>`):
   1. **Conflict project:** `scripts/conflict-repo.sh /tmp/yamt-rel-merge`: the 7 files listed; open a text conflict;
      Mark resolved stages it (`git -C … ls-files -u` no longer lists it) and opens the next unresolved file.
   2. **Rebase:** `scripts/operations-repo.sh rebase /tmp/yamt-rel-rebase`: own commit on the left, named; the tag
      `REBASE` at the bottom of the file list with its hover "… · 1 of 3"; resolve every file, Continue → "· 2 of 3"
      without a restart; continue to the end → exit 0, stderr `yamt: rebase finished`, `git log` shows the three
      rebased commits with their own messages. Dark screenshot of the window at step 1.
   3. **Abort:** `scripts/operations-repo.sh cherry-pick /tmp/yamt-rel-pick`: Abort (right-click the toolbar to show
      it) → after its question, exit 1, stderr `yamt: cherry-pick aborted`, `git status --porcelain`, branch tip and
      stash list as before.
   4. **Remembered resolution:** `scripts/operations-repo.sh rerere /tmp/yamt-rel-rerere`: the file marked
      "remembered" and still in `git ls-files -u`; Mark resolved stages it.
   5. **No leftovers:** after `stop`, `pgrep -af target/release/yamt` finds nothing from this run. Remove
      `/tmp/yamt-rel-*` repositories (keep the screenshots folder).

## Report

`gate` pass/fail, `failures`, `smoke` per `skill://verification`; environment facts (VF5); screenshots' paths.
