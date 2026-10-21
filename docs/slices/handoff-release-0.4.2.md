# Handoff — publish yamt 0.4.1, then 0.4.2 (2026-10-22)

The owner runs this. Pushing and publishing are the owner's actions (the safety hook keeps them so). Pushing a tag
`v…` starts `.github/workflows/release.yml`, which makes a **draft** release. Nothing is public until you publish it.

## Where things stand (updated after both tags were pushed)

- **Both tags are pushed** (`v0.4.1` → `22ce491`, `v0.4.2` → `fb0d4ea`). Both "release" runs finished green on all
  three builds, so both drafts hold their five files. CI on `v0.4.1` is green.
- **CI on `v0.4.2` and `main` was red on macOS only:** two rebase tests whose test helper edited git's todo list with
  a sed command macOS's sed reads differently. Test code only: the release builds run no tests and the apps are
  unaffected. Fixed on `main` (`90361db`, `6116026`); the full check passes here. macOS itself can only be proven by CI
  after the push.
- **Not pushed yet:** the test fix, and your shell-function section copied into `.readmer/readme.json` (it was only
  in the generated `README.md`, so the next regeneration would have dropped it). The `v0.4.2` tag stays at `fb0d4ea`;
  its CI mark stays red. Redoing the tag only for that would rebuild every file with identical app code; not needed.

## Remaining steps

1. Publish the 0.4.1 draft (notes from the chat); close GitHub issues 3 and 4, pointing to it.
2. Smoke the 0.4.2 AppImage (step 6 below), then publish the 0.4.2 draft (notes from the chat).
3. `git push origin main`; the "ci" run for the new head should be green on all four jobs, macOS included. If macOS is
   still red, tell the main session.

## The original steps (1–5 done)

1. **0.4.1: tag its release commit and push the tag** (one line; `main` does not need pushing for this):
   `git tag -a v0.4.1 22ce491 -m "yamt 0.4.1" && git push origin v0.4.1`. The "release" run builds 0.4.1 from that
   commit (`draft-release` and three `build` jobs: Linux, macOS universal, Windows).
2. **Check the 0.4.1 draft** at https://github.com/web-dev-sam/yamt/releases: `yamt_0.4.1_amd64.AppImage`,
   `yamt_0.4.1_amd64.deb`, `yamt_0.4.1_universal.dmg`, `yamt_0.4.1_universal.app.tar.gz`, `yamt_0.4.1_x64-setup.exe`.
   Paste the 0.4.1 notes from the chat. Publish it. Close GitHub issues 3 and 4, pointing to it.
3. **Push `main` and wait for CI:** `git push origin main`. Wait until the "ci" run for the new head is green on all four
   jobs (frontend, ubuntu-22.04, macos-14, windows-2025) at https://github.com/web-dev-sam/yamt/actions. If one is red,
   stop and tell the main session.
4. **0.4.2: tag and push** (one line): `git tag -a v0.4.2 -m "yamt 0.4.2" && git push origin v0.4.2`.
5. **Check the 0.4.2 draft:** the same five files named `0.4.2`. Paste the 0.4.2 notes from the chat.
6. **Smoke one download** (Linux, 3 minutes):

   ```bash
   chmod +x ~/Downloads/yamt_0.4.2_amd64.AppImage
   ~/Downloads/yamt_0.4.2_amd64.AppImage --version   # yamt 0.4.2
   rm -rf /tmp/yamt-rebase && ~/Projects/yamt/scripts/operations-repo.sh rebase /tmp/yamt-rebase
   cd /tmp/yamt-rebase && ~/Downloads/yamt_0.4.2_amd64.AppImage
   ```

   Your commit is on the left and "REBASE" sits at the bottom of the file list (hover: "Rebasing feature onto main ·
   1 of 3"). Resolve the three files (Keep, Take left, Mark resolved), press Continue rebase: the next stop opens,
   "2 of 3".

7. **Publish** the 0.4.2 draft. GitHub then shows 0.4.2 as the latest release.

## If something fails

- **Only one system's build failed:** publish with the other files and say so in the notes, or fix it and redo the tag.
- **Redo a tag after a fix** (only before publishing): delete the draft on the website, then
  `git tag -d v0.4.2; git push --delete origin v0.4.2`, commit the fix, and run its steps again. For 0.4.1 a fix would
  need a new commit on top of `22ce491`; tell the main session instead.
- **A flaky job:** "Re-run failed jobs" on the Actions page.
