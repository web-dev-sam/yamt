# Handoff — publish yamt 0.4.0 (2026-10-18)

The owner runs this. Pushing and publishing are the owner's actions (the safety hook keeps them so). Pushing the tag
`v0.4.0` starts `.github/workflows/release.yml`, which makes a **draft** release. Nothing is public until you publish it.

## Where things stand

- **Code.** `feat/minimap` is merged into `main` (`2b7cb47`, a merge commit). Version `0.4.0` (workspace `Cargo.toml`),
  release commit `b19f48f`. `CHANGELOG.md` has the dated `[0.4.0]` section: Abort merge in the toolbar, the minimap
  while Alt is held, the toolbar menu remembering each choice, and four fixes. The README names the 0.4.0 files and
  describes the minimap. Product code is unchanged after `d7aaeb6`.
- **Not pushed yet.** `main` is ahead of `origin/main` by the change-marks merge, the minimap commits, the merge and
  the release commits. The local branch `feat/minimap` is fully in `main`; delete it when you like
  (`git branch -d feat/minimap`).
- **Checked.** The minimap's second final run at `d7aaeb6` (full check, mutation run, WebKit, real app, scroll timing)
  and the release's final run at `b19f48f` (board "Release 0.4.0" row 2: full check, licences with VS Code's notice,
  `yamt_0.4.0_amd64.deb`, `yamt 0.4.0`, the release binary: Mark resolved, the minimap, Abort merge, language servers).
  The in-browser layout tests still cannot start on this machine; CI's frontend job runs the same unit tests as here.
- **Tag.** None made. Your `fetch.prunetags` deletes local-only tags, so tag and push in one command.

## Steps

1. **Push `main` and wait for CI:** `git push origin main`. Wait until the "ci" run for the new head is green on all
   four jobs (frontend, ubuntu-22.04, macos-14, windows-2025) at https://github.com/web-dev-sam/yamt/actions. If one is
   red, stop and tell the main session.
2. **Tag and push** (one line): `git tag -a v0.4.0 -m "yamt 0.4.0" && git push origin v0.4.0`. The "release" run has
   `draft-release` and three `build` jobs (Linux, macOS universal, Windows).
3. **Check the draft** at https://github.com/web-dev-sam/yamt/releases. It should hold `yamt_0.4.0_amd64.AppImage`
   and `yamt_0.4.0_amd64.deb` (the README's install commands use these names), `yamt_0.4.0_universal.dmg`,
   `yamt_0.4.0_universal.app.tar.gz` and `yamt_0.4.0_x64-setup.exe`.
4. **Release notes.** Paste the notes from the chat (short form), or the `## [0.4.0] - 2026-10-18` section of
   `CHANGELOG.md`.
5. **Smoke one download** (Linux, 3 minutes):

   ```bash
   chmod +x ~/Downloads/yamt_0.4.0_amd64.AppImage
   ~/Downloads/yamt_0.4.0_amd64.AppImage --version   # yamt 0.4.0
   rm -rf /tmp/yamt-minimap && ~/Projects/yamt/scripts/conflict-repo.sh /tmp/yamt-minimap
   cd /tmp/yamt-minimap && ~/Downloads/yamt_0.4.0_amd64.AppImage
   ```

   Open `vOn.ts` and turn off "Collapse unchanged fragments" in the toolbar. Hold Alt: the minimap shows at the
   window's right edge. Still holding Alt, click near its bottom: that line comes to the middle of the Result. Release
   Alt: it goes.

6. **Publish** the draft.
7. **Optional, on the other systems' downloads:** on Windows, Alt alone must not open a menu; on macOS, holding Option
   shows the minimap. On your Linux desktop, hold Alt and drag the minimap's box once: a desktop that moves windows
   with Alt+drag takes that drag (clicks and the wheel still work).

## If something fails

- **Only one system's build failed:** publish with the other files and say so in the notes, or fix it and redo the tag.
- **Redo the tag after a fix** (only before publishing): delete the draft on the website, then
  `git tag -d v0.4.0; git push --delete origin v0.4.0`, commit the fix, and run step 1 again.
- **A flaky job:** "Re-run failed jobs" on the Actions page.
