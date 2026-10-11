# yamt

yamt is a three-way merge window like the one in JetBrains IDEs, for git conflicts. It takes over
the whole merge at once: every conflicted file is in one window, your side on the left, theirs on the
right, the result in the middle.

![yamt resolving a conflict](docs/screenshot.png)

## Install

Download from the [releases page](../../releases):

- **Linux**: the `.AppImage` (make it executable, then run it) or the `.deb`
  (`sudo apt install ./yamt_0.1.0_amd64.deb`). If AppImageLauncher is installed, it asks once
  whether to integrate the AppImage before yamt starts.
- **Arch Linux**: the AppImage, or build from source (below).
- **macOS**: the `.dmg`; drag yamt to Applications. The build is not signed, so the first time
  right-click yamt → Open, or run `xattr -d com.apple.quarantine /Applications/yamt.app`.

## Use

When `git merge`, `git rebase` or `git cherry-pick` stops with conflicts, run `yamt` in the
repository (or `yamt --repo <path>` from anywhere).

- The file list on the left shows every conflicted file; click one to open it.
- Each change has an arrow that applies it to the result and a × that ignores it. The toolbar applies
  all non-conflicting changes from the left or from the right in one click.
- The result pane is a normal editor: type, Tab / Shift+Tab indent and outdent, undo and redo.
- **Mark resolved** writes the result and stages the file. **Reset file** brings the conflict back
  as git left it.
- Files the editor cannot show (binary, deleted on one side, symlinks, submodules) get a choice
  instead: two buttons, one sentence per side.
- Closing the window exits with status 0 when every file is resolved and 1 otherwise, so scripts can
  tell. Then continue as usual (`git commit`, `git rebase --continue`, …).

A git alias makes it feel built in:

```sh
git config --global alias.resolve '!yamt'
git resolve
```

`git mergetool` is not the way to start yamt: it runs the tool once per file, while yamt handles all
files in one window.

## Build from source

You need the Rust toolchain from `rust-toolchain.toml` (installed by
[rustup](https://rustup.rs) on the first `cargo` call), [pnpm](https://pnpm.io), and on Linux
webkit2gtk-4.1 (Arch: `webkit2gtk-4.1`; Debian/Ubuntu: `libwebkit2gtk-4.1-dev`).

```sh
cargo install tauri-cli --version 2.12.1
pnpm -C frontend install
cargo tauri build
```

The bundles land in `target/release/bundle/`.

## NVIDIA on Linux

WebKitGTK's DMABUF renderer crashes on some NVIDIA setups. yamt switches it off by itself when the
NVIDIA driver is loaded; a value you set for `WEBKIT_DISABLE_DMABUF_RENDERER` wins.

## License

MIT, see [LICENSE](LICENSE). Bundled third-party software: [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
