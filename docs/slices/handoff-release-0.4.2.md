# Handoff — publish yamt 0.4.1, then 0.4.2 (2026-10-22)

The owner runs this. Pushing and publishing are the owner's actions (the safety hook keeps them so). Pushing a tag
`v…` starts `.github/workflows/release.yml`, which makes a **draft** release. Nothing is public until you publish it.

## Where things stand

- **0.4.1 was never published.** GitHub's newest release is 0.4.0 and there is no `v0.4.1` tag. Its release commit
  `22ce491` (version `0.4.1`) is already on `origin/main`, passed its own final run (board "Release 0.4.1" row 2), and no
  product code changed after it up to `origin/main` (`71fc4ce`). You chose to publish it first (#1455).
- **0.4.2.** `feat/git-operations` is merged into `main` (`a817e0e`). Release commit `62f8a30` (version `0.4.2`,
  `CHANGELOG.md` `[0.4.2] - 2026-10-22`, the README names the 0.4.2 files). Its final run passed at `62f8a30` (board
  "Release 0.4.2" row 2: full check, licences, `yamt_0.4.2_amd64.deb`, `yamt 0.4.2`, the release binary on a merge, a
  rebase to the end, a cherry-pick Abort and a remembered resolution).
- **Not pushed yet.** `main` is ahead of `origin/main` by the feature, the release commit and this handoff. The local
  branch `feat/git-operations` is fully in `main`; delete it when you like (`git branch -d feat/git-operations`).
- **Tags.** None made. Your `fetch.prunetags` deletes local-only tags, so tag and push in one command.

## Steps

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
