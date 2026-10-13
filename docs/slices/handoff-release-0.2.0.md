# Handoff — publish yamt 0.2.0 (2026-10-13)

The owner runs this; publishing to GitHub is the owner's action (the safety hook keeps it so). Pushing the tag
`v0.2.0` starts `.github/workflows/release.yml`, which makes a **draft** release. Nothing is public until you publish it.

## Where things stand

- **Code.** Local `main` holds everything since `origin/main`: the settings work, the toolbar menu, crisp code text and
  the Windows build. Version `0.2.0` (workspace `Cargo.toml`); `CHANGELOG.md` has the dated `[0.2.0]` section; the README
  is regenerated from `.readmer/readme.json` with the new screenshot (`docs/screenshot.png`, 3200×2000, an addition, a
  deletion, a conflict and two modifications) and the Windows install steps.
- **Checked here:** the full gate (`just check`, exit 0) on the feature; the release commit adds only version strings,
  docs and the version test, re-run below. The Windows build is linted for Windows on Linux; it has **never been built
  on Windows**: the first CI push and this tag are its first runs.
- **Licences.** `THIRD_PARTY_LICENSES.txt` is current (356 Rust crates incl. the Windows-only ones, 82 JS packages).

## Steps

1. **Push `main`.** `git push origin main`. This starts the new **ci** workflow for the first time: three jobs
   (ubuntu-22.04, macos-14, windows-2025), each running the Rust tests and building the app; Windows uploads the
   installer as the artifact `yamt-windows-installer`. Watch https://github.com/web-dev-sam/yamt/actions. A green Windows
   job is the first proof the Windows build works (board row 6).
2. **Tag and push.** `git tag -a v0.2.0 -m "yamt 0.2.0" && git push origin v0.2.0` (skip the `git tag` if it already
   exists: `git tag -l v0.2.0`). The "release" run has `draft-release` and three `build` jobs (Linux, macOS universal,
   Windows); they do not cancel each other.
3. **Check the draft** at https://github.com/web-dev-sam/yamt/releases: `yamt_0.2.0_amd64.AppImage`,
   `yamt_0.2.0_amd64.deb` (the README's install commands use these names), a macOS `.dmg`, and
   `yamt_0.2.0_x64-setup.exe`.
4. **Release notes.** Paste the `## [0.2.0] - 2026-10-13` section of `CHANGELOG.md`.
5. **Smoke one download** (Linux, 5 minutes):

   ```bash
   scripts/conflict-repo.sh /tmp/yamt-release-smoke
   chmod +x ~/Downloads/yamt_0.2.0_amd64.AppImage
   cd /tmp/yamt-release-smoke && ~/Downloads/yamt_0.2.0_amd64.AppImage --version   # yamt 0.2.0
   ~/Downloads/yamt_0.2.0_amd64.AppImage
   ```

   Expect 7 files; settings show Antialiasing with Subpixel pressed. On a Windows machine, if you have one: run the
   setup, add its folder to PATH, run `yamt` in a repository stopped in a merge.

6. **Publish** the draft.

## If something fails

- **Only Windows failed:** publish with the Linux and macOS files and say so in the notes, or fix and redo the tag. The
  likely spots (none could run here): `just` finding Git Bash's `bash`, the licence-file check under Git Bash, and the
  gitio timeout tests that use `sleep` inside a git alias.
- **Redo the tag after a fix** (only before publishing): delete the draft on the website, then
  `git tag -d v0.2.0 && git push --delete origin v0.2.0`, commit the fix, `git push origin main`, tag and push again.
- A flaky job: "Re-run failed jobs" on the Actions page.
