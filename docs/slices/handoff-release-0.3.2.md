# Handoff — publish yamt 0.3.2 (2026-10-15)

The owner runs this. Pushing and publishing are the owner's actions (the safety hook keeps them so). Pushing the tag
`v0.3.2` starts `.github/workflows/release.yml`, which makes a **draft** release. Nothing is public until you publish it.

## Where things stand

- **Code.** Version `0.3.2` (workspace `Cargo.toml`), release commit `184ab85`. `CHANGELOG.md` has the dated `[0.3.2]`
  section: the removed code in a tooltip on a removal bar, wider removal bars, the new dark theme with a matching
  native window background. The README names the 0.3.2 files. Product code is unchanged after `1b7ccd1`.
- **Not pushed yet.** `main` is ahead of `origin/main` by your theme commit `3e465cb`, the tooltip commits and the
  release commit.
- **Checked.** The tooltip's final run at `1b7ccd1` (full check, mutation run, real app) and the release's final run
  (board "Release 0.3.2" row 2: full check, licences, `yamt_0.3.2_amd64.deb`, `yamt 0.3.2`, the release binary on the
  conflict, removal and language-server projects). The in-browser layout tests cannot start on this machine (missing
  libicu74, libxml2, libflite1); CI's frontend job runs the same unit tests as here.
- **Tag.** None made. Your `fetch.prunetags` deletes local-only tags (#807), so tag and push in one command.

## Steps

1. **Push `main` and wait for CI:** `git push origin main`. Wait until the "ci" run for the new head is green on all
   four jobs (frontend, ubuntu-22.04, macos-14, windows-2025) at https://github.com/web-dev-sam/yamt/actions. If one is
   red, stop and tell the main session.
2. **Tag and push** (one line): `git tag -a v0.3.2 -m "yamt 0.3.2" && git push origin v0.3.2`. The "release" run has
   `draft-release` and three `build` jobs (Linux, macOS universal, Windows).
3. **Check the draft** at https://github.com/web-dev-sam/yamt/releases. It should hold `yamt_0.3.2_amd64.AppImage`
   and `yamt_0.3.2_amd64.deb` (the README's install commands use these names), a macOS `.dmg` and
   `yamt_0.3.2_x64-setup.exe`.
4. **Release notes.** Paste the notes from the chat (short form), or the `## [0.3.2] - 2026-10-15` section of
   `CHANGELOG.md`.
5. **Smoke one download** (Linux, 3 minutes):

   ```bash
   chmod +x ~/Downloads/yamt_0.3.2_amd64.AppImage
   ~/Downloads/yamt_0.3.2_amd64.AppImage --version   # yamt 0.3.2
   rm -rf /tmp/yamt-removal && ~/Projects/yamt/scripts/golden-repo.sh language-tools-script-setup /tmp/yamt-removal
   cd /tmp/yamt-removal && ~/Downloads/yamt_0.3.2_amd64.AppImage
   ```

   Expect one conflicted file. Rest the pointer on the small bar at the start of left line 363: a tooltip shows the
   removed `if (options.vueCompilerOptions.target >= 3.3) {` line in colour.

6. **Publish** the draft.

## If something fails

- **Only one system's build failed:** publish with the other files and say so in the notes, or fix it and redo the tag.
- **Redo the tag after a fix** (only before publishing): delete the draft on the website, then
  `git tag -d v0.3.2; git push --delete origin v0.3.2`, commit the fix, and run step 1 again.
- **A flaky job:** "Re-run failed jobs" on the Actions page.
