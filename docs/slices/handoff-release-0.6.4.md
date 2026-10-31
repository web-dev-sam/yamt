# Handoff — publish yamt 0.6.4 (2026-10-31)

The owner runs this. Pushing a tag `v…` starts `.github/workflows/release.yml`, which makes a **draft** release.
Nothing is public until you publish it.

## Where things stand

- After `v0.6.3`, `main` holds: `--ai` passed on to the changes window a merge request's Show Diff opens (plan §2
  #144), the Windows test fix (tests only; ci green on `29c06125`), the release commit (version `0.6.4`, changelog,
  README) and board commits.
- The final run passed with the release build (board "Release 0.6.4" row 2).
- Not checked here: the macOS and Windows test runs and builds (only CI runs them).

## Steps

1. **Push `main` and wait for CI:** `git push origin main`. Wait until the "ci" run for the new head is green on all
   four jobs (frontend, ubuntu-22.04, macos-15, windows-2025) at https://github.com/web-dev-sam/yamt/actions. If one is
   red, do not tag: send the failing job's error to the main session.
2. **Tag 0.6.4** (one line): `git tag -a v0.6.4 -m "yamt 0.6.4" && git push origin v0.6.4`.
3. **Check the draft** at https://github.com/web-dev-sam/yamt/releases: it should hold `yamt_0.6.4_amd64.AppImage`,
   `yamt_0.6.4_amd64.deb`, `yamt_0.6.4_universal.dmg`, `yamt_0.6.4_universal.app.tar.gz` and
   `yamt_0.6.4_x64-setup.exe`. Paste the notes from the chat, leave "Set as a pre-release" unticked, and publish.

## If something fails

- **Redo a tag after a fix** (only before publishing): delete the draft on the website, then
  `git tag -d v0.6.4; git push --delete origin v0.6.4`, commit the fix, and run the steps again.
- **A flaky job:** use "Re-run failed jobs" on the Actions page.
