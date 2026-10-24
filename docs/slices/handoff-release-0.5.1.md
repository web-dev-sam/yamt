# Handoff — publish yamt 0.5.1 (2026-10-24)

The owner runs this. Pushing and publishing are the owner's actions (the safety hook keeps them so). Pushing a tag
`v…` starts `.github/workflows/release.yml`, which makes a **draft** release. Nothing is public until you publish it.

## Where things stand

- `main` holds the merge of `feat/themes` (`732b709`), the licence notices for the copied theme colours (`e45c6cd`),
  the release commit `d652757` (version 0.5.1, changelog, README file names), the Windows test fix `3b45909` (the
  0.5.0 `windows-2025` ci failure, #1623; tests only) and the board updates. Nothing is pushed: `origin/main` is
  still at `v0.5.0` (`17849b0`). The tag goes on the head of `main`.
- The final runs before tagging are on the board ("Release 0.5.1" row 2, "Windows CI" row 2; notes
  `.omp/run/notes/Release051Verify.md`, `WindowsTestsVerify.md`). No Windows machine here: the `windows-2025` job in
  step 1 is the first real Windows run of the fix.
- Not in 0.5.1: a settings file broken at start shows no problem (finding #1619, older than 0.5.0; board "Themes"
  row 4').

## Steps

1. **Push `main` and wait for CI:** `git push origin main`. Wait until the "ci" run for the new head is green on all four
   jobs (frontend, ubuntu-22.04, macos-14, windows-2025) at https://github.com/web-dev-sam/yamt/actions. If one is
   red, stop and tell the main session: do not tag (the 0.5.0 tag went out with `windows-2025` red).
2. **Tag and push** (one line): `git tag -a v0.5.1 -m "yamt 0.5.1" && git push origin v0.5.1`. The "release" run
   builds 0.5.1 (`draft-release` and three `build` jobs: Linux, macOS universal, Windows).
3. **Check the draft** at https://github.com/web-dev-sam/yamt/releases: `yamt_0.5.1_amd64.AppImage`,
   `yamt_0.5.1_amd64.deb`, `yamt_0.5.1_universal.dmg`, `yamt_0.5.1_universal.app.tar.gz`, `yamt_0.5.1_x64-setup.exe`.
   Paste the 0.5.1 notes from the chat.
4. **Smoke one download** (Linux, 3 minutes):

   ```bash
   chmod +x ~/Downloads/yamt_0.5.1_amd64.AppImage
   ~/Downloads/yamt_0.5.1_amd64.AppImage --version   # yamt 0.5.1
   rm -rf /tmp/yamt-merge && ~/Projects/yamt/scripts/conflict-repo.sh /tmp/yamt-merge
   cd /tmp/yamt-merge && ~/Downloads/yamt_0.5.1_amd64.AppImage
   ```

   Open a conflict, then the gear → Theme: five groups (yamt, WebStorm, VS Code, Zed, Atom). Pick Zed's One Dark:
   the whole window recolours, flat panels with one thin line between them. Close yamt and start it again: it opens
   in One Dark without a flash of another colour. Pick your own theme back (your settings file keeps the last pick).

5. **Publish** the draft. GitHub then shows 0.5.1 as the latest release.
6. Optional: `git branch -d feat/themes` (merged; nothing is lost).

## If something fails

- **Only one system's build failed:** publish with the other files and say so in the notes, or fix it and redo the tag.
- **Redo a tag after a fix** (only before publishing): delete the draft on the website, then
  `git tag -d v0.5.1; git push --delete origin v0.5.1`, commit the fix, and run steps 1–3 again.
- **A flaky job:** "Re-run failed jobs" on the Actions page.
