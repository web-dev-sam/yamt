# Handoff — publish yamt 0.3.0 (2026-10-14)

The owner runs this. Publishing to GitHub is the owner's action (the safety hook keeps it so). Pushing the tag
`v0.3.0` starts `.github/workflows/release.yml`, which makes a **draft** release. Nothing is public until you publish it.

## Where things stand

- **Code.** Version `0.3.0` (workspace `Cargo.toml`). `CHANGELOG.md` has the dated `[0.3.0]` section. The README is
  regenerated from `.readmer/readme.json`: 0.3.0 file names, Ctrl+S, Reset, a "Language servers" section with ruff as
  the added-server example, and the new screenshot (`docs/screenshot.png`, 3200×2000: file tree, collapsed lines, an
  insertion, a deletion, a conflict, server problems with a hover message). No product code changed after `2ed501d`.
- **Checked.** The final run passed at `a4faa91`: the full check, licences unchanged, the `.deb` builds as
  `yamt_0.3.0_amd64.deb`, `yamt --version` prints `yamt 0.3.0`, and the release binary works on the conflict and
  language-server projects (board "Release 0.3.0" row 3). CI on `main` at `2dd7675` (run 38632852557) covers all
  product code of this release and passed on all three systems: frontend, ubuntu-22.04, macos-14, windows-2025.
- **Tag.** None made. Your `fetch.prunetags` deletes local-only tags (#807), so tag and push in one command.

## Steps

1. **Push `main`, then tag and push** (one line):
   `git push origin main && git tag -a v0.3.0 -m "yamt 0.3.0" && git push origin v0.3.0`. The "release" run has
   `draft-release` and three `build` jobs (Linux, macOS universal, Windows). Watch
   https://github.com/web-dev-sam/yamt/actions.
2. **Check the draft** at https://github.com/web-dev-sam/yamt/releases. It should hold `yamt_0.3.0_amd64.AppImage`
   and `yamt_0.3.0_amd64.deb` (the README's install commands use these names), a macOS `.dmg` and
   `yamt_0.3.0_x64-setup.exe`.
3. **Release notes.** Paste the `## [0.3.0] - 2026-10-14` section of `CHANGELOG.md`.
4. **Smoke one download** (Linux, 5 minutes):

   ```bash
   scripts/conflict-repo.sh /tmp/yamt-release-smoke
   chmod +x ~/Downloads/yamt_0.3.0_amd64.AppImage
   cd /tmp/yamt-release-smoke && ~/Downloads/yamt_0.3.0_amd64.AppImage --version   # yamt 0.3.0
   ~/Downloads/yamt_0.3.0_amd64.AppImage
   ```

   Expect 7 files. For the language servers: `rm -rf /tmp/yamt-lsp-project && scripts/lsp-repo.sh --servers
   /tmp/yamt-lsp-project` (the smoke repository has grown a project per language since 0.3.0; 0.3.0 detects only the
   `web/` tools), then `cd /tmp/yamt-lsp-project && PATH="$(~/Projects/yamt/scripts/lsp-servers.sh --path):$PATH"
   ~/Downloads/yamt_0.3.0_amd64.AppImage`. Expect oxfmt, oxlint and TypeScript running, problems underlined in
   `web/src/math.ts`, and Ctrl+S formatting it. For ruff, add `py/.venv/bin/ruff server` with file types `py, pyi` in
   Settings → Language servers (0.3.0 has no ruff preset): problems in `py/api/stats.py`, Ctrl+S formats it. If an older
   run added `.venv/bin/ruff server` there, remove it.

5. **Publish** the draft.

## If something fails

- **Only one system's build failed:** publish with the other files and say so in the notes, or fix it and redo the tag.
- **Redo the tag after a fix** (only before publishing): delete the draft on the website, then
  `git tag -d v0.3.0; git push --delete origin v0.3.0`, commit the fix, and run step 1 again.
- **A flaky job:** "Re-run failed jobs" on the Actions page.
