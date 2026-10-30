# Handoff — publish yamt 0.6.0-beta.2 as a pre-release (2026-10-29)

The owner runs this. Pushing and publishing are the owner's actions (the safety hook keeps them so). Pushing a tag
`v…` starts `.github/workflows/release.yml`, which makes a **draft** release. Nothing is public until you publish it.

## Where things stand

- `main` holds the merge of `feat/beta-feedback` (`0ca0ed4`: the AI thread's capped thinking list and Ask AI at a
  thread's bottom, folder sums in the range window's tree, collapsed unchanged lines in the range window, the
  window-wide search in both windows), the release commit `512a6fe` (version `0.6.0-beta.2`, changelog), the test
  fix `ca1ddd4` (two Rust tests that failed on Windows and macOS since 0.6.0-beta.1) and the board updates. The tag
  goes on the head of `main`.
- The first push (`e965fca`) had ci red on macOS and Windows: those two tests, not the product. Because the tests
  failed first, the app build step has not run on those systems since 0.6.0-beta.1; here Windows type-checks, and
  macOS everything but the app crate (it needs Apple's compiler).
- The final runs are on the board ("After 0.6.0-beta.1" rows 1–4, "Search" rows 7–8, "Release 0.6.0-beta.2" row 2;
  notes `.omp/run/notes/SearchVerify.md`, `SearchFinalFix.md`, `Release060Beta2Verify.md`).
- The README still names the 0.5.1 files: the releases page keeps offering 0.5.1 by default while this is a
  pre-release.
- Not checked here: a real GitLab merge request (`glab` is not installed on this machine), and the Windows and macOS
  builds (only CI makes them).

## Steps

1. **Push `main` and wait for CI:** `git push origin main`. Wait until the "ci" run for the new head is green on all four
   jobs (frontend, ubuntu-22.04, macos-14, windows-2025) at https://github.com/web-dev-sam/yamt/actions. If one is
   red, stop and tell the main session: do not tag.
2. **Tag and push** (one line): `git tag -a v0.6.0-beta.2 -m "yamt 0.6.0-beta.2" && git push origin v0.6.0-beta.2`.
   The "release" run builds it (`draft-release` and three `build` jobs: Linux, macOS universal, Windows).
3. **Check the draft** at https://github.com/web-dev-sam/yamt/releases: `yamt_0.6.0-beta.2_amd64.AppImage`,
   `yamt_0.6.0-beta.2_amd64.deb`, `yamt_0.6.0-beta.2_universal.dmg`, `yamt_0.6.0-beta.2_universal.app.tar.gz`,
   `yamt_0.6.0-beta.2_x64-setup.exe`. Paste the notes from the chat. **Tick "Set as a pre-release"** (so GitHub keeps
   0.5.1 as the latest release).
4. **Smoke one download** (Linux, 5 minutes):

   ```bash
   chmod +x ~/Downloads/yamt_0.6.0-beta.2_amd64.AppImage
   ~/Downloads/yamt_0.6.0-beta.2_amd64.AppImage --version   # yamt 0.6.0-beta.2
   rm -rf /tmp/yamt-range && ~/Projects/yamt/scripts/range-repo.sh /tmp/yamt-range
   cd /tmp/yamt-range && ~/Downloads/yamt_0.6.0-beta.2_amd64.AppImage --diff=main...feature
   ```

   The changed files are listed on the left; unchanged lines sit behind the wavy line. Press Ctrl+Shift+S, type a word,
   click a result: the file opens at it. Close the window.

5. **Publish** the draft as a pre-release.
6. Optional: `git branch -d feat/beta-feedback` (merged; nothing is lost).

## Good to know

- **The `.deb` of a beta sorts above the final 0.6.0** for apt/dpkg (Debian reads `-beta.2` as a package revision).
  Going from this beta to 0.6.0 with the `.deb` then needs `sudo dpkg -i yamt_0.6.0_amd64.deb` (or `apt install
  --allow-downgrades`). The AppImage has no such step.

## If something fails

- **Only one system's build failed:** publish with the other files and say so in the notes, or fix it and redo the tag.
- **Redo a tag after a fix** (only before publishing): delete the draft on the website, then
  `git tag -d v0.6.0-beta.2; git push --delete origin v0.6.0-beta.2`, commit the fix, and run steps 1–3 again.
- **A flaky job:** "Re-run failed jobs" on the Actions page.
