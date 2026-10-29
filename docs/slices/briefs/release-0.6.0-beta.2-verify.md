# Release 0.6.0-beta.2 — final run before tagging

Board "Release 0.6.0-beta.2" row 2. Owner request #1753 ("create the next beta prerelease of 0.6.0"): `feat/beta-feedback`
merged into `main` (a merge commit; the tree equals the branch head), then the release commit: the workspace version is
`0.6.0-beta.2` (`Cargo.toml`, `Cargo.lock`), `CHANGELOG.md` has `## [0.6.0-beta.2] - <date>`. The README keeps naming
the 0.5.1 files: a pre-release is not what the releases page offers by default. Since 0.6.0-beta.1 the product gained
(board "After 0.6.0-beta.1", rows 1–4): the AI thread's capped thinking list and Ask AI at a thread's bottom; folder
sums in the range window's tree; collapsed unchanged lines in the range window (plan §2 #126); the window-wide search
in the merge and range windows (plan §2 #127). Their final runs passed with debug builds (`.omp/run/notes/
AiThreadVerify.md`, `FolderSumsVerify.md`, `RangeCollapseVerify.md`, `SearchVerify.md`). This run checks the release
build. **No mutation run** (VF7, owner #1630). Read-only recipes only (VF6); you fix nothing (VF1); alone.

Environment: app-session names `r2-…`; scratch and screenshots under `/tmp/yamt-rel-0.6.0-b2/`; throwaway repositories
`/tmp/yamt-rel2-*`, git writes only as `git -C /tmp/…`; `--home /tmp/yamt-rel-0.6.0-b2/home-<n>` on every `start-app`
(the owner's own settings stay untouched). The owner's own yamt may be running: leave it alone; never `pkill`/`killall`
(#1560). Every launch on a private display; a private D-Bus bus you start is killed by its PID before you report.
Record yamt's exit status with a wrapper around the binary, as the earlier final runs did; close windows with
`WM_DELETE_WINDOW`, not WebDriver (#1447).

## Recipes

1. `just check` — the whole gate. Paste each recipe's tail and the exit status. Also `readmer check` (exit 0).
2. **Licences, as the release job checks them:** `scripts/third-party-licenses.sh && git diff --exit-code
   THIRD_PARTY_LICENSES.txt`. Pass: exit 0, no diff.
3. **Bundle:** `cargo tauri build --bundles deb`. Pass: `target/release/bundle/deb/yamt_0.6.0-beta.2_amd64.deb`
   exists; `dpkg-deb -f <deb> Version` prints `0.6.0-beta.2`; its contents list `usr/bin/yamt` as the only program in
   `usr/bin` and carry `THIRD_PARTY_LICENSES.txt` equal to the repository's; `target/release/yamt --version` prints
   `yamt 0.6.0-beta.2`.
4. **The release binary** (`target/release/yamt`) on a private display through the app-session helper (`start-app
   --name <n> --binary target/release/yamt … --home <home>`):
   1. **Conflict project:** `scripts/conflict-repo.sh /tmp/yamt-rel2-merge`: the files listed; open a text conflict;
      Ctrl+Shift+S, search a word in it → rows with pane icons; click a row → the Result selects it; hide → the
      keyboard back in the file; Mark resolved stages it (`git -C … ls-files -u` no longer lists it) and opens the
      next unresolved file.
   2. **Range window:** `scripts/range-repo.sh /tmp/yamt-rel2-range`, then `start-app --range main...feature --repo
      /tmp/yamt-rel2-range --glab lined-up`: the list, the tree view's folder sums, both columns with unchanged lines
      collapsed behind the wave (the toggle after Previous/Next turns it off and on); Ctrl+Shift+S, search a word in
      collapsed lines, click its row → the stretch shows, the match selected; add a thread and a reply; Edit the reply
      → its new text; Delete the thread's first note → question → Delete → the reply stays; Post the edited reply,
      Send → the fake glab's log has one POST carrying the edited text; close (exit 0). `git -C /tmp/yamt-rel2-range
      status --porcelain=v2` and the refs equal before and after.
   3. **AI, real `omp acp`:** the same repository with `--ai --home <home> --settings
      '{"agent":{"command":["env","PI_CODING_AGENT_DIR=/home/wds/.omp/agent","omp","acp"]}}'`: type a question in a
      thread's box and press Ask AI at the thread's bottom → your comment added, then the steps (the thinking list at
      most 20rem tall) and an answer; close → Discard (or no question when nothing changed) → exit 0, no `omp acp`
      left.
   4. **Compare window:** `--diff`: type two JSON texts that differ in one value → the difference shows in both
      columns; no search panel; close with `WM_DELETE_WINDOW` → exit 0.
   5. **No leftovers:** after `stop`, no yamt, omp, Xvfb, driver or private bus from this run (`pgrep -af` by this
      run's paths). Remove `/tmp/yamt-rel2-*` repositories (keep the screenshots folder).

## Report

`gate` pass/fail, `failures`, `smoke` per `skill://verification`; environment facts (VF5); screenshots' paths. Name
what only the owner can check (a real GitLab merge request; the Windows and macOS builds, which only CI makes).
