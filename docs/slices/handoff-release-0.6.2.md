# Handoff — publish yamt 0.6.2 (2026-10-30)

The owner runs this. Pushing a tag `v…` starts `.github/workflows/release.yml`, which makes a **draft** release.
Nothing is public until you publish it.

## Where things stand

- `feat/merge-requests` was already merged into `main` (`2a4b7af`); it has no commit outside `main`.
- `main` holds, after `v0.6.1` (`0927634`): the merge-request tests made portable to macOS and Windows (`c171d5c`,
  tests only), the release commit `34c5369` (version `0.6.2`, changelog, README file names) and board commits. No app
  code changed since 0.6.1.
- The final run passed with the release build (board "Release 0.6.2" row 3).
- Not checked here: the macOS and Windows test runs and builds (only CI runs them).

## Steps

1. **Push `main` and wait for CI:** `git push origin main`. Wait until the "ci" run for the new head is green on all
   four jobs (frontend, ubuntu-22.04, macos-15, windows-2025) at https://github.com/web-dev-sam/yamt/actions. If one is
   red, do not tag: send the failing job's error to the main session.
2. **Tag 0.6.2** (one line): `git tag -a v0.6.2 -m "yamt 0.6.2" && git push origin v0.6.2`.
3. **Check the draft** at https://github.com/web-dev-sam/yamt/releases: `yamt_0.6.2_amd64.AppImage`,
   `yamt_0.6.2_amd64.deb`, `yamt_0.6.2_universal.dmg`, `yamt_0.6.2_universal.app.tar.gz`, `yamt_0.6.2_x64-setup.exe`.
   Paste the notes from the chat. Leave "Set as a pre-release" unticked. Publish.

## If something fails

- **Redo a tag after a fix** (only before publishing): delete the draft on the website, then
  `git tag -d v0.6.2; git push --delete origin v0.6.2`, commit the fix, and run the steps again.
- **A flaky job:** "Re-run failed jobs" on the Actions page.
