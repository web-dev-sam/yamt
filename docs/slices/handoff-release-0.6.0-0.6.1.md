# Handoff — publish yamt 0.6.0, then 0.6.1 (2026-10-30)

The owner runs this. Pushing and publishing are the owner's actions (the safety hook keeps them so). Pushing a tag
`v…` starts `.github/workflows/release.yml`, which makes a **draft** release. Nothing is public until you publish it.

## Where things stand

- `main` holds, in order: the 0.6.0 release commit `8ece003` with its board commit `ec5c914` (version `0.6.0`,
  changelog, README file names; product unchanged since 0.6.0-beta.2); the merge of `feat/merge-requests` `2a4b7af`
  (the GitLab merge-request overview); the 0.6.1 release commit `43461ef` (version `0.6.1`, changelog, README file
  names and a paragraph on the overview); board and brief commits. `origin/main` is still at `d97a270`.
- Both final runs passed with the release build (board "Releases 0.6.0 and 0.6.1" rows 2 and 4; notes
  `.omp/run/notes/Release060Verify.md`, `Release061Verify.md`): `just check`, licences, the `.deb`'s name and version,
  `--version`, the release binary on a merge, a range review, the compare window and, for 0.6.1, the merge-request
  page with a stand-in GitLab.
- **`v0.6.0` goes on `ec5c914`**, not on the head of `main`. `v0.6.1` goes on the head of `main`.
- Not checked here: the Windows and macOS builds (only CI makes them).

## Steps

1. **Push the 0.6.0 commit and wait for CI:** `git push origin ec5c914:main`. Wait until the "ci" run for `ec5c914`
   is green on all four jobs (frontend, ubuntu-22.04, macos-14, windows-2025) at
   https://github.com/web-dev-sam/yamt/actions. If one is red, stop and tell the main session: do not tag.
2. **Tag 0.6.0** (one line): `git tag -a v0.6.0 ec5c914 -m "yamt 0.6.0" && git push origin v0.6.0`.
3. **Check the 0.6.0 draft** at https://github.com/web-dev-sam/yamt/releases: `yamt_0.6.0_amd64.AppImage`,
   `yamt_0.6.0_amd64.deb`, `yamt_0.6.0_universal.dmg`, `yamt_0.6.0_universal.app.tar.gz`, `yamt_0.6.0_x64-setup.exe`.
   Paste the 0.6.0 notes from the chat. Leave "Set as a pre-release" **unticked**. Publish.
4. **Push the rest of `main` and wait for CI:** `git push origin main`; the same four jobs green for the new head,
   with the macOS job now named `macos-15`.
5. **Tag 0.6.1** (one line): `git tag -a v0.6.1 -m "yamt 0.6.1" && git push origin v0.6.1`.
6. **Check the 0.6.1 draft**: the same five files named `0.6.1`. Paste the 0.6.1 notes from the chat. Publish; GitHub
   then shows 0.6.1 as the latest release.
7. **Smoke one download** (Linux, 3 minutes):

   ```bash
   chmod +x ~/Downloads/yamt_0.6.1_amd64.AppImage
   ~/Downloads/yamt_0.6.1_amd64.AppImage --version   # yamt 0.6.1
   cd <one of your GitLab repositories> && ~/Downloads/yamt_0.6.1_amd64.AppImage --diff=main...<branch>
   ```

   The merge-requests button sits left of the gear; it lists your project's open merge requests.

8. Optional: `git branch -d feat/merge-requests && git push origin --delete feat/merge-requests` (merged; nothing is
   lost).

## Good to know

- **From a 0.6.0 beta `.deb`:** dpkg sorts `0.6.0-beta.2` above `0.6.0` and `0.6.1` is above both, so
  `sudo apt install ./yamt_0.6.1_amd64.deb` upgrades normally; only installing the 0.6.0 `.deb` over a beta needs
  `sudo dpkg -i` (or `apt install --allow-downgrades`). The AppImage has no such step.
- **macOS 14 runners are being retired** (GitHub, retired 2026-11-02; brownouts fail every macOS 14 job daily
  14:00–24:00 UTC until then). `main` after `bff974e` builds on macOS 15. The `v0.6.0` tag still names `macos-14`:
  its macOS job only runs on "Re-run failed jobs" between 00:00 and 14:00 UTC on 31 October or 1 November. Otherwise
  publish 0.6.0 without the two macOS files and say so in its notes; 0.6.1 carries them.

## If something fails

- **Only one system's build failed:** publish with the other files and say so in the notes, or fix it and redo the tag.
- **Redo a tag after a fix** (only before publishing): delete the draft on the website, then
  `git tag -d v0.6.x; git push --delete origin v0.6.x`, commit the fix, and run that release's steps again.
- **A flaky job:** "Re-run failed jobs" on the Actions page.
