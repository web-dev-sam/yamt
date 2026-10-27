# Release 0.6.0-beta.1 — final run before tagging

Board "Release 0.6.0-beta.1" row 2. Owner request #1637 ("the next minor PRE-release"): `feat/review-range` merged into
`main` (a merge commit; the tree equals the branch head), then the release commit: the workspace version is
`0.6.0-beta.1` (`Cargo.toml`, `Cargo.lock`), `CHANGELOG.md` has `## [0.6.0-beta.1] - <date>`. The README keeps naming
the 0.5.1 files: a pre-release is not what the releases page offers by default. Since 0.5.1 the product gained the
commit-range review window, its comment threads sent to GitLab, editing and deleting unsent comments, and the AI behind
`--ai` (plan §2 #103–#123). Their final runs passed with debug builds (`.omp/run/notes/RVVerify2.md`, `RVVerify3.md`,
and the run for board rows 15–17). This run checks the release build. **No mutation run** (VF7, owner #1630).
Read-only recipes only (VF6); you fix nothing (VF1); alone.

Environment: app-session names `r-…`; scratch and screenshots under `/tmp/yamt-rel-0.6.0/`; throwaway repositories
`/tmp/yamt-rel-*`, git writes only as `git -C /tmp/…`; `--home /tmp/yamt-rel-0.6.0/home-<n>` on every `start-app`
(the owner's own settings stay untouched). The owner's own yamt may be running: leave it alone; never `pkill`/`killall`
(#1560). Every launch on a private display. Record yamt's exit status with a wrapper around the binary, as the earlier
final runs did; close windows with `WM_DELETE_WINDOW`, not WebDriver (#1447).

## Recipes

1. `just check` — the whole gate. Paste each recipe's tail and the exit status. Also `readmer check` (exit 0).
2. **Licences, as the release job checks them:** `scripts/third-party-licenses.sh && git diff --exit-code
   THIRD_PARTY_LICENSES.txt`. Pass: exit 0, no diff.
3. **Bundle:** `cargo tauri build --bundles deb`. Pass: `target/release/bundle/deb/yamt_0.6.0-beta.1_amd64.deb`
   exists; `dpkg-deb -f <deb> Version` prints `0.6.0-beta.1`; its contents list `usr/bin/yamt` as the only program in
   `usr/bin` and carry `THIRD_PARTY_LICENSES.txt` equal to the repository's; `target/release/yamt --version` prints
   `yamt 0.6.0-beta.1`.
4. **The release binary** (`target/release/yamt`) on a private display through the app-session helper (`start-app
   --name <n> --binary target/release/yamt … --home <home>`):
   1. **Conflict project:** `scripts/conflict-repo.sh /tmp/yamt-rel-merge`: the files listed; open a text conflict;
      Mark resolved stages it (`git -C … ls-files -u` no longer lists it) and opens the next unresolved file.
   2. **Range window:** `scripts/range-repo.sh /tmp/yamt-rel-range`, then `start-app --range main...feature --repo
      /tmp/yamt-rel-range --glab lined-up`: the list and both columns; add a thread and a reply; Edit the reply → its
      new text; Delete the thread's first note → question → Delete → the reply stays; add a second thread with one
      note and Delete it → the thread, its line mark and the file count go; Post the edited reply, Send → the fake
      glab's log has one POST carrying the edited text; close (exit 0); reopen → the edited reply "Pending on GitLab",
      no Edit/Delete on it. `git -C /tmp/yamt-rel-range status --porcelain=v2` and the refs equal before and after.
   3. **AI, real `omp acp`:** the same repository with `--ai --home <home> --settings
      '{"agent":{"command":["env","PI_CODING_AGENT_DIR=/home/wds/.omp/agent","omp","acp"]}}'`: Ask AI on a thread →
      the steps and an answer; close → Discard (or no question when nothing changed) → exit 0, no `omp acp` left.
   4. **Compare window:** `--diff`: type two JSON texts that differ in one value → the difference shows in both
      columns; close with `WM_DELETE_WINDOW` → exit 0.
   5. **No leftovers:** after `stop`, no yamt, omp, Xvfb or driver from this run (`pgrep -af` by this run's paths).
      Remove `/tmp/yamt-rel-*` repositories (keep the screenshots folder).

## Report

`gate` pass/fail, `failures`, `smoke` per `skill://verification`; environment facts (VF5); screenshots' paths. Name
what only the owner can check (a real GitLab merge request; the Windows and macOS builds, which only CI makes).
