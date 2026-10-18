# Release 0.4.0 — final run before tagging

Board "Release 0.4.0" row 2. Owner request #1251: merge `feat/minimap` into `main` and release 0.4. `main` is the merge
`2b7cb47` plus the release commit, which changes no product code: the workspace version is `0.4.0` (`Cargo.toml`,
`Cargo.lock`), `CHANGELOG.md` has `## [0.4.0] - 2026-10-18`, the README names the 0.4.0 files and gained one line on the
minimap (`readmer check` passes). Since 0.3.2 the product gained Abort merge in the toolbar (plan §2 #74), the minimap
while Alt is held (#81) and far scrolls that land where sent (#82). `crates/`, `frontend/src/`, `src-tauri/` are
unchanged since `d7aaeb6`, which the minimap's second final run checked (`.omp/run/notes/MinimapVerify2.md`,
`just mutants 7141a81` included), so no mutation run this time. No dependency changed. Read-only recipes only (VF6); you
fix nothing (VF1); alone.

Environment: app-session names `r-…`; scratch and screenshots under `/tmp/yamt-rel-0.4.0/`; throwaway repositories
`/tmp/yamt-rel-*`, git writes only as `git -C /tmp/…`. The owner's own `target/debug/yamt --repo /tmp/yamt-conflict-project`
may be running: leave it alone. The owner's settings file (`~/.config/yamt/`), the window storage under the data folder
and `~/go/bin`, `~/.cargo/bin`, `~/.local/bin` must stay untouched: say where the helper kept its settings and storage.

## Recipes

1. `just check` — the whole gate. Paste each recipe's tail and the exit status.
2. **Licences, as the release job checks them:** `scripts/third-party-licenses.sh && git diff --exit-code
   THIRD_PARTY_LICENSES.txt`. Pass: exit 0, no diff; the file has the "==== Copied code (1) ====" section naming
   microsoft/vscode at `789f2c470d13c4760f2b5cc6a9e1919c05d04f7d` under MIT.
3. **Bundle:** `cargo tauri build --bundles deb`. Pass: `target/release/bundle/deb/yamt_0.4.0_amd64.deb` exists (the
   README's install command uses that name); its contents list `usr/bin/yamt` as the only program in `usr/bin` and carry
   `THIRD_PARTY_LICENSES.txt` equal to the repository's; `target/release/yamt --version` prints `yamt 0.4.0`.
4. **The release binary** (`target/release/yamt`) on a private display through the app-session helper
   (`pnpm -s -C frontend exec tsx scripts/app-session.ts <command> …`): `start-app --name <n> --binary
   target/release/yamt --repo <dir>`. Real input only (`xdotool` through the helper).
   1. **Conflict project:** `scripts/conflict-repo.sh /tmp/yamt-rel-merge`. The file list shows the 7 files; open a
      text conflict: three panes with the changes; "Mark resolved" stages it (`git -C /tmp/yamt-rel-merge ls-files -u`
      no longer lists it) and opens the next unresolved file. Dark theme: one screenshot of the window.
   2. **Minimap:** in that project, `vOn.ts` with collapsing off (the toolbar button). Hold Alt: the minimap shows at
      the window's right edge over the right pane, the panes keep their size; screenshot. Still holding Alt, click a
      minimap row far below the box: the Result's `scrollTop` equals `centredScrollTop` for that row (whole pixels)
      after two frames and after 1 s, and the side panes follow. Release Alt: hidden.
   3. **Abort merge:** a fresh `scripts/conflict-repo.sh /tmp/yamt-rel-abort`, fresh storage: no Abort merge button;
      right-click the toolbar: 8 entries, "Abort merge" first and unchecked; choose it: the button sits right after
      "Mark resolved". Mark one file resolved, then "Abort merge" → the question → "Abort Merge": the window closes
      without the unsaved-work question, exit status **1** from the binary you started, stderr `yamt: merge aborted`,
      `git -C /tmp/yamt-rel-abort status --short` shows only untracked files, no `MERGE_HEAD`.
   4. **Language servers:** `scripts/lsp-repo.sh --servers /tmp/yamt-rel-lsp`, started with the PATH line it prints
      (and the real `RUSTUP_HOME`/`CARGO_HOME`). Pass: the start question lists Biome, clangd, gopls, Phpactor, ruff,
      ty, basedpyright, rust-analyzer, oxfmt, oxlint, TypeScript; after Start, a hover in `rs/core/src/lib.rs` and in
      App.vue shows its server's message; Ctrl+S in `py/api/stats.py` formats and the file keeps git's conflict markers
      on disk and stays in `git ls-files -u`.
   5. **No leftovers:** after `stop`, `pgrep -af` for `target/release/yamt` and every preset program finds nothing
      from this run. Remove `/tmp/yamt-rel-*` repositories (keep the screenshots folder).

## Report

`gate` pass/fail, `failures`, `smoke` per `skill://verification`; environment facts (VF5); screenshots' paths.
