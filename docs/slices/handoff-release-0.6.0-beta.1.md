# Handoff — publish yamt 0.6.0-beta.1 as a pre-release (2026-10-27)

The owner runs this. Pushing and publishing are the owner's actions (the safety hook keeps them so). Pushing a tag
`v…` starts `.github/workflows/release.yml`, which makes a **draft** release. Nothing is public until you publish it.

## Where things stand

- `main` holds the merge of `feat/review-range` (`a39907b`: the commit-range review window, its comment threads sent
  to GitLab, editing and deleting unsent comments, the AI behind `--ai`), the release commit `ce2cf46` (version
  `0.6.0-beta.1`, changelog) and the board updates. Nothing is pushed: `origin/main` is still at `v0.5.1` (`fc2fa97`).
  The tag goes on the head of `main`.
- The final runs are on the board ("Review a commit range" rows 14 and 17, "Release 0.6.0-beta.1" row 2; notes
  `.omp/run/notes/RVVerify2.md`–`RVVerify4.md`, `Release060Beta1Verify.md`): all pass.
- The README still names the 0.5.1 files: the releases page keeps offering 0.5.1 by default while this is a
  pre-release.
- Not checked here: a real GitLab merge request (`glab` is not installed on this machine), and the Windows and macOS
  builds (only CI makes them).

## Steps

1. **Push `main` and wait for CI:** `git push origin main`. Wait until the "ci" run for the new head is green on all four
   jobs (frontend, ubuntu-22.04, macos-14, windows-2025) at https://github.com/web-dev-sam/yamt/actions. If one is
   red, stop and tell the main session: do not tag.
2. **Tag and push** (one line): `git tag -a v0.6.0-beta.1 -m "yamt 0.6.0-beta.1" && git push origin v0.6.0-beta.1`.
   The "release" run builds it (`draft-release` and three `build` jobs: Linux, macOS universal, Windows).
3. **Check the draft** at https://github.com/web-dev-sam/yamt/releases: `yamt_0.6.0-beta.1_amd64.AppImage`,
   `yamt_0.6.0-beta.1_amd64.deb`, `yamt_0.6.0-beta.1_universal.dmg`, `yamt_0.6.0-beta.1_universal.app.tar.gz`,
   `yamt_0.6.0-beta.1_x64-setup.exe`. Paste the notes from the chat. **Tick "Set as a pre-release"** (so GitHub keeps
   0.5.1 as the latest release).
4. **Smoke one download** (Linux, 5 minutes):

   ```bash
   chmod +x ~/Downloads/yamt_0.6.0-beta.1_amd64.AppImage
   ~/Downloads/yamt_0.6.0-beta.1_amd64.AppImage --version   # yamt 0.6.0-beta.1
   rm -rf /tmp/yamt-range && ~/Projects/yamt/scripts/range-repo.sh /tmp/yamt-range
   cd /tmp/yamt-range && ~/Downloads/yamt_0.6.0-beta.1_amd64.AppImage --diff=main...feature
   ```

   The changed files are listed on the left; pick one, hover a line number, start a comment, press Ctrl+Enter; Edit it,
   then Delete it (it asks first). Close the window.

5. **Your GitLab check** (on a real merge request whose source branch you have checked out): `yamt
   --diff=<target>...<source>`, add two comments (one on an added line, one on a removed line), Post both, "Send to
   GitLab (2)". In GitLab's Changes view both sit on the right lines as pending comments of your review; publish the
   review.
6. **Publish** the draft as a pre-release.
7. Optional: `git branch -d feat/review-range` (merged; nothing is lost).

## Good to know

- **The `.deb` of a beta sorts above the final 0.6.0** for apt/dpkg (Debian reads `-beta.1` as a package revision).
  Going from this beta to 0.6.0 with the `.deb` then needs `sudo dpkg -i yamt_0.6.0_amd64.deb` (or `apt install
  --allow-downgrades`). The AppImage has no such step.

## If something fails

- **Only one system's build failed:** publish with the other files and say so in the notes, or fix it and redo the tag.
- **Redo a tag after a fix** (only before publishing): delete the draft on the website, then
  `git tag -d v0.6.0-beta.1; git push --delete origin v0.6.0-beta.1`, commit the fix, and run steps 1–3 again.
- **A flaky job:** "Re-run failed jobs" on the Actions page.
