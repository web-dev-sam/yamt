# Release 0.5.0 — final run before tagging

Board "Release 0.5.0" row 2. Owner request #1585 ("merge into main and release 0.5.0"): `feat/raw-compare` merged
into `main` (`e5c0502`, a merge commit; the tree equals the branch head `1415413`), then the release commit, which
changes no product code: the workspace version is `0.5.0` (`Cargo.toml`, `Cargo.lock`), `CHANGELOG.md` has
`## [0.5.0] - 2026-10-23`, the README names the 0.5.0 files (`readmer check` passes). Since 0.4.2 the product gained
the compare window `yamt --diff` (plan §2 #93–#98), the Linux paste-crash fix (#99) and the operation tag's own tooltip
(#100). After the release commit the owner renamed the compare flag from `--raw` to `--diff` before tagging (#101,
#1586): `c83202d` (fixture `?diff`, app-session `--diff`/`--diff-case`), `803c2d7` (the shell's flag and messages) and
their review round (`.omp/run/notes/DiffFlag*.md`). The tooltip's final run passed at `4e4bb65`
(`.omp/run/notes/OperationTooltipVerify.md`); the compare and paste final runs are `.omp/run/notes/RawCompareVerify.md`,
`PasteCrashVerify.md`. Mutation runs for the rename are in its notes; none here. Dependencies changed since 0.4.2 (the
`yamt-compare` crate), so the licence check matters. Read-only recipes only (VF6); you fix nothing (VF1); alone.

Environment: app-session names `r-…`; scratch and screenshots under `/tmp/yamt-rel-0.5.0/`; throwaway repositories
`/tmp/yamt-rel-*`, git writes only as `git -C /tmp/…`; `--home /tmp/yamt-rel-0.5.0/home-<n>` on every `start-app`
(a `--diff` session included: the owner's own compare tabs stay untouched). The owner's own yamt may be running: leave
it alone; never `pkill`/`killall` (finding #1560): start each clipboard owner as `xclip … -loops 0 -quiet & pid=$!` and
end it with `kill $pid`. Every launch on a private display. Record yamt's exit status with a wrapper around the binary,
as the earlier final runs did; close windows with `WM_DELETE_WINDOW`, not WebDriver (#1447).

## Recipes

1. `just check` — the whole gate. Paste each recipe's tail and the exit status.
2. **Licences, as the release job checks them:** `scripts/third-party-licenses.sh && git diff --exit-code
   THIRD_PARTY_LICENSES.txt`. Pass: exit 0, no diff.
3. **Bundle:** `cargo tauri build --bundles deb`. Pass: `target/release/bundle/deb/yamt_0.5.0_amd64.deb` exists; its
   contents list `usr/bin/yamt` as the only program in `usr/bin` and carry `THIRD_PARTY_LICENSES.txt` equal to the
   repository's; `target/release/yamt --version` prints `yamt 0.5.0`; `--help` names `yamt --diff` and the `--diff`
   option; `yamt --raw; echo $?` → "yamt: unknown argument --raw" and 2; `yamt --diff --repo x; echo $?` → "yamt:
   --diff compares pasted text and takes no --repo" and 2. `just app-session start-fixture --diff-case json-payload`
   opens the compare page with that case in tab 1.
4. **The release binary** (`target/release/yamt`) on a private display through the app-session helper (`start-app
   --name <n> --binary target/release/yamt … --home <home>`):
   1. **Conflict project:** `scripts/conflict-repo.sh /tmp/yamt-rel-merge`: the 7 files listed; open a text conflict;
      Mark resolved stages it (`git -C … ls-files -u` no longer lists it) and opens the next unresolved file.
   2. **Rebase and the tag's tooltip:** `scripts/operations-repo.sh rebase /tmp/yamt-rel-rebase`: own commit on the
      left; the real pointer onto `REBASE` → yamt's tooltip at once with "Rebasing feature onto main · 1 of 3" and the
      commit message, no GTK tooltip window after a 3 s rest; resolve every file, Continue → "· 2 of 3"; continue to
      the end → exit 0, stderr `yamt: rebase finished`. Dark screenshot with the tooltip open.
   3. **Compare window:** `--diff`: type two JSON texts that differ in one value → the difference shows in both
      columns; Format → both laid out, keys in their order; "+" adds a tab; close with `WM_DELETE_WINDOW` → exit 0;
      start again with the same home → both tabs and their texts are back; a second `--diff` with the first open → it
      says so and exits 2; the first stays. Screenshot of the formatted tab.
   4. **Paste never crashes:** with a clipboard owner killed (`xclip -selection clipboard`, then `kill $pid`): Ctrl+V
      into the merge window's Result and into a compare column → the process alive, no new core in `coredumpctl
      list`, every text unchanged; a live owner's text pastes into a compare column.
   5. **No leftovers:** after `stop`, no yamt, Xvfb, xclip or driver from this run (`pgrep -af` by this run's paths).
      Remove `/tmp/yamt-rel-*` repositories (keep the screenshots folder).

## Report

`gate` pass/fail, `failures`, `smoke` per `skill://verification`; environment facts (VF5); screenshots' paths.
