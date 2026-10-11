# Handoff — publish yamt 0.1.0 (2026-10-11)

The owner runs this. Goal: v0.1.0 out today. Pushing a tag `v0.1.0` starts
`.github/workflows/release.yml`. That run makes a **draft** release with the Linux AppImage and
`.deb` and a universal macOS `.dmg`. Nothing is public until you publish the draft.

## Where things stand

- **Code.** `main` is pushed to github.com/web-dev-sam/yamt (`a28064c`) and the version is `0.1.0`
  (workspace `Cargo.toml`). This handoff adds one commit (the changelog date and two handoff files),
  so push `main` once more first. No tag exists yet, so **no release build has ever run**: this tag
  is the first run, and the first macOS build ever.
- **Licences.** `THIRD_PARTY_LICENSES.txt` is current (regenerated today: 332 Rust crates, 82 JS
  packages, no diff). The release jobs check exactly this and stop if it is stale.
- **What is verified for the last feature** (the disk is the truth):
  - every reviewer passed;
  - the full test suite passed (`just check`, exit 0, twice);
  - all 8 desktop steps passed on a copy of the Vue merge. The start-up check takes 64 ms for the
    7 files.
- **Every automated check has since passed too**: mutation testing of the new code (the 4 GB cap
  held; memory never below 9.3 GB) and the file-switch check with real clicks. What is left is your
  own use of it: `handoff-verify-0.1.0.md`.
- **Known follow-ups** that are not bugs are on the work board: rows 11, 11', 12, 12', 13'''.

## Steps

1. **Push and tag.** Done 2026-10-11: the first tag `v0.1.0` (`847607a`) failed on macOS (see "If
   something fails"); the fix `7844ebd` is tagged **`v0.1.1`** (run 38174078717). By your call the
   files inside still say 0.1.0 (plan §2 #38): the downloads are named `yamt_0.1.0_*` and
   `yamt --version` prints 0.1.0.

   Delete the old **`v0.1.0` draft** on the releases page: its macOS job failed and its Linux files
   install the internal `export-bindings` tool.

2. **Watch the build** at https://github.com/web-dev-sam/yamt/actions. Run "release" has three jobs:
   - `draft-release`;
   - `build (ubuntu-22.04)`;
   - `build (macos-14)` (the universal build: Apple Silicon and Intel).

   The two build jobs do not cancel each other. Expect roughly 15–30 min [INFERENCE: tauri builds on
   hosted runners; never measured for this repo].

3. **Check the draft** at https://github.com/web-dev-sam/yamt/releases. Draft `v0.1.1` should list:
   - `yamt_0.1.0_amd64.AppImage` and `yamt_0.1.0_amd64.deb`. The README's install commands use these
     exact names.
   - A macOS `.dmg` (tauri-action names it after the target, e.g. `yamt_0.1.0_universal.dmg`) and an
     `.app.tar.gz`.
4. **Release notes.** Paste the `## [0.1.0] - 2026-10-11` section of `CHANGELOG.md` into the draft's
   description (the version inside the files is 0.1.0).
5. **Smoke one download** before publishing; 5 minutes, Linux:

   ```bash
   scripts/conflict-repo.sh /tmp/yamt-release-smoke          # a repository stopped in a merge, 7 conflicts
   chmod +x ~/Downloads/yamt_0.1.0_amd64.AppImage
   cd /tmp/yamt-release-smoke && ~/Downloads/yamt_0.1.0_amd64.AppImage
   ```

   Expect a window titled `yamt-release-smoke — yamt` listing 7 files. Resolve one file and close the
   window. The exit status is 1 while files are unresolved (`echo $?`).

   On the Mac, open the `.dmg`, drag yamt to Applications, then right-click → Open the first time
   (the build is unsigned).

6. **Publish.** Press "Publish release" on the draft.

## If something fails

- **Only one platform failed** (e.g. macOS): either publish with the assets that are there and say
  so in the notes, or fix it and redo the tag (next bullet). A failed job can also simply be
  re-run from the Actions page ("Re-run failed jobs"), which is enough for a flaky download or a
  runner hiccup.
- **Redoing the tag after a fix:**
  1. Delete the draft release on the website.
  2. Delete the tag and push the fix:
     ```bash
     git tag -d v0.1.0 && git push --delete origin v0.1.0
     # commit the fix, then:
     git push origin main && git tag -a v0.1.0 -m "yamt 0.1.0" && git push origin v0.1.0
     ```
  Redoing a tag is fine only before the release is published.
- **"THIRD_PARTY_LICENSES.txt is stale"**: run `just third-party-licenses`, commit the file, then
  redo the tag.
- **Never bump** tauri 2.12.1, tauri-build 2.7.1, @tauri-apps/api 2.12.1 or tauri-cli 2.12.1 to fix
  a build. The workflow installs tauri-cli 2.12.1 on purpose.
- **First tag run (2026-10-11): macOS failed** with `Failed to copy binary ...
  universal-apple-darwin/release/export-bindings ... does not exist`. Cause: tauri packs every
  program of the app package, and the internal bindings generator was one of them. The universal
  macOS build makes only `yamt`, so the copy failed; the Linux `.deb` and AppImage carried the
  generator in `/usr/bin`. Fixed: the generator now needs the `bindings` feature, so no package has
  it (a fresh `.deb` holds only `usr/bin/yamt`). Redo the tag as above.

## After publishing

- Do the two tries in `handoff-verify-0.1.0.md`; a problem found there goes into 0.1.1.
- Board: rows 4 (macOS check, now on your Mac with the release build) and C' (a real merge of your
  own, side by side with WebStorm) are yours. The review of the project's rules (D'') and the v0
  write-up (`docs/walkthroughs/v0.md`) come after C'.
