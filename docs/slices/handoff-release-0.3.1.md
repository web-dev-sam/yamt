# Handoff — publish yamt 0.3.1 (2026-10-15)

The owner runs this. Publishing to GitHub is the owner's action (the safety hook keeps it so). Pushing the tag
`v0.3.1` starts `.github/workflows/release.yml`, which makes a **draft** release. Nothing is public until you publish it.

## Where things stand

- **Code.** Version `0.3.1` (workspace `Cargo.toml`), release commit `91a05af`. `CHANGELOG.md` has the dated `[0.3.1]`
  section: language servers for Rust, Go, Python, PHP, C/C++, Biome and Vue, install steps per language, "From the
  list" in Settings, servers found in `.venv`, `vendor/bin` and the usual home folders. The README names the 0.3.1 files.
  Product code is unchanged after `a5babf6`; one test changed after the release commit (`7d52482`, #1052).
- **Checked.** Final run at `f1b4034`: the full check, licences, `yamt_0.3.1_amd64.deb`, `yamt 0.3.1`, the release
  binary on the conflict and language-server projects (board "Release 0.3.1" row 2). CI on `7d4f6cc`: frontend, Linux,
  macOS green; **Windows red** on one language-server test that found its own helper program on Windows' test-time
  PATH. `7d52482` gives that program a unique name; it is not yet run on Windows (only GitHub has a Windows machine).
- **Tag.** None made. Your `fetch.prunetags` deletes local-only tags (#807), so tag and push in one command.

## Steps

1. **Push `main` and wait for CI:** `git push origin main`. Wait until the "ci" run for the new head is green on all
   four jobs (frontend, ubuntu-22.04, macos-14, windows-2025) at https://github.com/web-dev-sam/yamt/actions. If Windows
   is still red, stop and tell the main session.
2. **Tag and push** (one line): `git tag -a v0.3.1 -m "yamt 0.3.1" && git push origin v0.3.1`. The "release" run has
   `draft-release` and three `build` jobs (Linux, macOS universal, Windows).
3. **Check the draft** at https://github.com/web-dev-sam/yamt/releases. It should hold `yamt_0.3.1_amd64.AppImage`
   and `yamt_0.3.1_amd64.deb` (the README's install commands use these names), a macOS `.dmg` and
   `yamt_0.3.1_x64-setup.exe`.
4. **Release notes.** Paste the notes from the chat (short form), or the `## [0.3.1] - 2026-10-15` section of
   `CHANGELOG.md`.
5. **Smoke one download** (Linux, 5 minutes):

   ```bash
   chmod +x ~/Downloads/yamt_0.3.1_amd64.AppImage
   ~/Downloads/yamt_0.3.1_amd64.AppImage --version   # yamt 0.3.1
   rm -rf /tmp/yamt-lsp-project && scripts/lsp-repo.sh --servers /tmp/yamt-lsp-project
   cd /tmp/yamt-lsp-project && PATH="$(~/Projects/yamt/scripts/lsp-servers.sh --path):$PATH" ~/Downloads/yamt_0.3.1_amd64.AppImage
   ```

   Expect the start question to list Biome, clangd, gopls, Phpactor, ruff, ty, basedpyright, rust-analyzer, oxfmt,
   oxlint and TypeScript; after Start, problems underlined in each project's conflicted file (hover for the message) and
   Ctrl+S formatting. If an older run added `.venv/bin/ruff server` or `py/.venv/bin/ruff server` under Settings →
   Language servers, remove it: ruff is found by itself now.

6. **Publish** the draft.

## If something fails

- **Only one system's build failed:** publish with the other files and say so in the notes, or fix it and redo the tag.
- **Redo the tag after a fix** (only before publishing): delete the draft on the website, then
  `git tag -d v0.3.1; git push --delete origin v0.3.1`, commit the fix, and run step 1 again.
- **A flaky job:** "Re-run failed jobs" on the Actions page.
