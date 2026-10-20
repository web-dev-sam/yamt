# Handoff — publish yamt 0.4.1 (2026-10-20)

The owner runs this. Pushing and publishing are the owner's actions (the safety hook keeps them so). Pushing the tag
`v0.4.1` starts `.github/workflows/release.yml`, which makes a **draft** release. Nothing is public until you publish it.

## Where things stand

- **Code.** `feat/servers-and-panes` is merged into `main` (`aadb1c8`, a merge commit). Version `0.4.1` (workspace
  `Cargo.toml`), release commit `22ce491`. `CHANGELOG.md` has the dated `[0.4.1]` section: found language servers
  switched off in Settings, one "Servers" drop-down with pins in the header, the three panes resizable with dots on
  every handle, the split and the file list's width remembered. The README names the 0.4.1 files and describes all of
  it. Product code is unchanged after `cf7ecff`.
- **Not pushed yet.** `origin/main` is the merge you pushed (`aadb1c8`); `main` is ahead of it by the release commit
  `22ce491` and the handoff commit. The local branch `feat/servers-and-panes` is fully in `main`; delete it when you
  like (`git branch -d feat/servers-and-panes`).
- **Checked.** The feature's final run at `cf7ecff` (full check, mutation run, WebKit, real app, scroll timing with one
  scenario a few frames slower, accepted by you) and the release's final run at `22ce491` (board "Release 0.4.1"
  row 2: full check, licences, `yamt_0.4.1_amd64.deb`, `yamt 0.4.1`, the release binary: Mark resolved, pane dividers
  and the file list's width across a restart, the Servers drop-down, pins and the off switch across a restart).
- **Tag.** None made. Your `fetch.prunetags` deletes local-only tags, so tag and push in one command.

## Steps

1. **Push `main` and wait for CI:** `git push origin main`. Wait until the "ci" run for the new head is green on all
   four jobs (frontend, ubuntu-22.04, macos-14, windows-2025) at https://github.com/web-dev-sam/yamt/actions. If one is
   red, stop and tell the main session.
2. **Tag and push** (one line): `git tag -a v0.4.1 -m "yamt 0.4.1" && git push origin v0.4.1`. The "release" run has
   `draft-release` and three `build` jobs (Linux, macOS universal, Windows).
3. **Check the draft** at https://github.com/web-dev-sam/yamt/releases. It should hold `yamt_0.4.1_amd64.AppImage`
   and `yamt_0.4.1_amd64.deb` (the README's install commands use these names), `yamt_0.4.1_universal.dmg`,
   `yamt_0.4.1_universal.app.tar.gz` and `yamt_0.4.1_x64-setup.exe`.
4. **Release notes.** Paste the notes from the chat (short form), or the `## [0.4.1] - 2026-10-20` section of
   `CHANGELOG.md`.
5. **Smoke one download** (Linux, 3 minutes):

   ```bash
   chmod +x ~/Downloads/yamt_0.4.1_amd64.AppImage
   ~/Downloads/yamt_0.4.1_amd64.AppImage --version   # yamt 0.4.1
   rm -rf /tmp/yamt-panes && ~/Projects/yamt/scripts/conflict-repo.sh /tmp/yamt-panes
   cd /tmp/yamt-panes && ~/Downloads/yamt_0.4.1_amd64.AppImage
   ```

   Open a text file. Drag the strip between Local and Result to the right: Local gets wider, Result narrower, Remote
   stays. Close the window and start it again: the panes keep that split. Double-click the strip: three equal panes.

6. **Publish** the draft.
7. **Close GitHub issues 3 and 4**, pointing to the release.
8. **Your own checks left from the feature:** the dots' look against your picture in issue 4, the header with many
   servers in your monorepo, and a real mouse double-click on a strip (the automated check could only send one within
   about 1 px).

## If something fails

- **Only one system's build failed:** publish with the other files and say so in the notes, or fix it and redo the tag.
- **Redo the tag after a fix** (only before publishing): delete the draft on the website, then
  `git tag -d v0.4.1; git push --delete origin v0.4.1`, commit the fix, and run step 1 again.
- **A flaky job:** "Re-run failed jobs" on the Actions page.
