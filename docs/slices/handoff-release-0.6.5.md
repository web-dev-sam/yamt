# Handoff — publish yamt 0.6.5 (2026-10-31)

The owner runs this. Pushing a tag `v…` starts `.github/workflows/release.yml`, which makes a **draft** release.
Nothing is public until you publish it.

## Where things stand

- After `v0.6.4`, `main` holds: review threads on a range of lines chosen by dragging over the line numbers, in one
  column or across both sides, sent to GitLab as multi-line comments (plan §2 #145–#148); the threads file moves to
  format 2 at its first change; the release commit (version `0.6.5`, changelog, README) and board commits.
- The final run passed with the release build (board "Release 0.6.5" row 2).
- Not checked here: the macOS and Windows test runs and builds (only CI runs them), and how GitLab shows a sent range
  (your playground check, board "Line-range threads" row 8).

## Steps

1. **Optional, before tagging — GitLab playground:** run `scripts/gitlab-playground.sh`, drag right 201 → 204 and
   left 200 → right 204 in `src/board/board.ts`, comment and send both. GitLab's diff should show "Comment on lines
   201 to +204" and "Comment on lines -200 to +204" on those lines. If not, do not tag: send what GitLab shows to the
   main session.
2. **Push `main` and wait for CI:** `git push origin main`. Wait until the "ci" run for the new head is green on all
   four jobs (frontend, ubuntu-22.04, macos-15, windows-2025) at https://github.com/web-dev-sam/yamt/actions. If one is
   red, do not tag: send the failing job's error to the main session.
3. **Tag 0.6.5** (one line): `git tag -a v0.6.5 -m "yamt 0.6.5" && git push origin v0.6.5`.
4. **Check the draft** at https://github.com/web-dev-sam/yamt/releases: it should hold `yamt_0.6.5_amd64.AppImage`,
   `yamt_0.6.5_amd64.deb`, `yamt_0.6.5_universal.dmg`, `yamt_0.6.5_universal.app.tar.gz` and
   `yamt_0.6.5_x64-setup.exe`. Paste the notes from the chat, leave "Set as a pre-release" unticked, and publish.

## If something fails

- **Redo a tag after a fix** (only before publishing): delete the draft on the website, then
  `git tag -d v0.6.5; git push --delete origin v0.6.5`, commit the fix, and run the steps again.
- **A flaky job:** use "Re-run failed jobs" on the Actions page.
