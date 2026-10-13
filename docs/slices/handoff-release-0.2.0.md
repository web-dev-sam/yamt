# Handoff — publish yamt 0.2.0 (2026-10-13)

The owner runs this; publishing to GitHub is the owner's action (the safety hook keeps it so). Pushing the tag
`v0.2.0` starts `.github/workflows/release.yml`, which makes a **draft** release. Nothing is public until you publish it.

## Where things stand

- **Code.** `main` is on GitHub up to `8ddf740`; one later commit is docs only. Version `0.2.0` (workspace
  `Cargo.toml`); `CHANGELOG.md` has the dated `[0.2.0]` section; the README is regenerated from `.readmer/readme.json`
  with the new screenshot (`docs/screenshot.png`, 3200×2000: an addition, a deletion, a conflict, two modifications) and
  the Windows install steps.
- **Checked:** `just check` exit 0 here; **CI green on all three systems** at `8ddf740` (run 38462078995: ubuntu-22.04,
  macos-14, windows-2025, frontend), the Windows installer built as the artifact `yamt-windows-installer` (3.3 MB). It
  took four CI rounds: macOS link-limit test, the Windows manifest for test binaries, the Windows app origin in tests,
  Windows path spellings in tests — all test-side except the manifest, which tauri's own example uses.
- **Tag.** A local annotated tag `v0.2.0` points at `8ddf740`, the commit CI passed. It is not on GitHub yet.
- **Licences.** `THIRD_PARTY_LICENSES.txt` is current (356 Rust crates incl. the Windows-only ones, 82 JS packages).

## Steps

1. **Push the tag** (and the docs commit): `git push origin main v0.2.0`. The "release" run has `draft-release` and
   three `build` jobs (Linux, macOS universal, Windows — the first Windows release build); they do not cancel each
   other. Watch https://github.com/web-dev-sam/yamt/actions.
2. (merged into 1)
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
