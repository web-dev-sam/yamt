# Handoff — publish yamt 0.5.0 (2026-10-23)

The owner runs this. Pushing and publishing are the owner's actions (the safety hook keeps them so). Pushing a tag
`v…` starts `.github/workflows/release.yml`, which makes a **draft** release. Nothing is public until you publish it.

## Where things stand

- `main` holds the merge of `feat/raw-compare` (`e5c0502`) and the release commit `ae7c707` (version 0.5.0, changelog,
  README file names). Neither is pushed.
- The final run before tagging is on the board ("Release 0.5.0" row 2, notes `.omp/run/notes/Release050Verify.md`).
- If the 0.4.1 or 0.4.2 drafts are still unpublished, publish them first (`handoff-release-0.4.2.md`), so the release
  list stays in order.

## Steps

1. **Push `main` and wait for CI:** `git push origin main`. Wait until the "ci" run for `ae7c707` is green on all four
   jobs (frontend, ubuntu-22.04, macos-14, windows-2025) at https://github.com/web-dev-sam/yamt/actions. If one is
   red, stop and tell the main session.
2. **Tag and push** (one line): `git tag -a v0.5.0 -m "yamt 0.5.0" && git push origin v0.5.0`. The "release" run
   builds 0.5.0 (`draft-release` and three `build` jobs: Linux, macOS universal, Windows).
3. **Check the draft** at https://github.com/web-dev-sam/yamt/releases: `yamt_0.5.0_amd64.AppImage`,
   `yamt_0.5.0_amd64.deb`, `yamt_0.5.0_universal.dmg`, `yamt_0.5.0_universal.app.tar.gz`, `yamt_0.5.0_x64-setup.exe`.
   Paste the 0.5.0 notes from the chat.
4. **Smoke one download** (Linux, 3 minutes):

   ```bash
   chmod +x ~/Downloads/yamt_0.5.0_amd64.AppImage
   ~/Downloads/yamt_0.5.0_amd64.AppImage --version   # yamt 0.5.0
   ~/Downloads/yamt_0.5.0_amd64.AppImage --raw
   ```

   The compare window opens with your tabs. Paste two JSON texts, press Format: both columns are laid out and the
   difference is marked. Close it, start it again: the texts are back. Then a rebase:

   ```bash
   rm -rf /tmp/yamt-rebase && ~/Projects/yamt/scripts/operations-repo.sh rebase /tmp/yamt-rebase
   cd /tmp/yamt-rebase && ~/Downloads/yamt_0.5.0_amd64.AppImage
   ```

   Point at "REBASE" at the bottom of the file list: the tooltip "Rebasing feature onto main · 1 of 3" appears at once.

5. **Publish** the draft. GitHub then shows 0.5.0 as the latest release.
6. Optional: `git branch -d feat/raw-compare` (merged; nothing is lost).

## If something fails

- **Only one system's build failed:** publish with the other files and say so in the notes, or fix it and redo the tag.
- **Redo a tag after a fix** (only before publishing): delete the draft on the website, then
  `git tag -d v0.5.0; git push --delete origin v0.5.0`, commit the fix, and run steps 1–3 again.
- **A flaky job:** "Re-run failed jobs" on the Actions page.
