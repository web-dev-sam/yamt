# Handoff — publish yamt 0.6.3 (2026-10-31)

The owner runs this. Pushing a tag `v…` starts `.github/workflows/release.yml`, which makes a **draft** release.
Nothing is public until you publish it.

## Where things stand

- `main` holds, after `v0.6.2` (`88086cb`): resolving a merge request's conflicts (row size, merge status icon,
  Resolve, Continue, Abort, the push question), a row opening its GitLab page, the true merge status on gitlab.com,
  the two-line coloured row, the release commit `578886f9` (version `0.6.3`, changelog, README) and board commits.
- The final run passed with the release build (board "Release 0.6.3" row 2).
- Not checked here: the macOS and Windows test runs and builds (only CI runs them).

## Steps

1. **Push `main` and wait for CI:** `git push origin main`. Wait until the "ci" run for the new head is green on all
   four jobs (frontend, ubuntu-22.04, macos-15, windows-2025) at https://github.com/web-dev-sam/yamt/actions. If one is
   red, do not tag: send the failing job's error to the main session.
2. **Tag 0.6.3** (one line): `git tag -a v0.6.3 -m "yamt 0.6.3" && git push origin v0.6.3`.
3. **Check the draft** at https://github.com/web-dev-sam/yamt/releases: `yamt_0.6.3_amd64.AppImage`,
   `yamt_0.6.3_amd64.deb`, `yamt_0.6.3_universal.dmg`, `yamt_0.6.3_universal.app.tar.gz`, `yamt_0.6.3_x64-setup.exe`.
   Paste the notes from the chat. Leave "Set as a pre-release" unticked. Publish.

## If something fails

- **Redo a tag after a fix** (only before publishing): delete the draft on the website, then
  `git tag -d v0.6.3; git push --delete origin v0.6.3`, commit the fix, and run the steps again.
- **A flaky job:** "Re-run failed jobs" on the Actions page.
