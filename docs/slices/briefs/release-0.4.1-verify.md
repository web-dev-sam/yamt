# Release 0.4.1 — final run before tagging

Board "Release 0.4.1" row 2. Owner request #1301, corrected by #1304 to a patch version: release 0.4.1 after merging
`feat/servers-and-panes` (#1300). `main` is the merge `aadb1c8` (tree equal to `960da3b`) plus the release commit,
which changes no product code: the workspace version is `0.4.1` (`Cargo.toml`, `Cargo.lock`), `CHANGELOG.md` has
`## [0.4.1] - 2026-10-20`, the README names the 0.4.1 files and describes the Servers drop-down, the off switch, the pane
dividers and the remembered file list width (`readmer check` passes). Since 0.4.0 the product gained found language
servers switched off per repository, one "Servers" drop-down with pins in the header (plan §2 #83), and three resizable
panes with dots on every handle, the split and the file list's width remembered (#84). `crates/`, `frontend/`,
`src-tauri/` are unchanged since `cf7ecff`, which the feature's final run checked (`.omp/run/notes/QHVerify.md`,
`just mutants 6c5f91a` included), so no mutation run this time. No dependency changed since `6c5f91a`. Read-only
recipes only (VF6); you fix nothing (VF1); alone.

Environment: app-session names `r-…`; scratch and screenshots under `/tmp/yamt-rel-0.4.1/`; throwaway repositories
`/tmp/yamt-rel-*`, git writes only as `git -C /tmp/…`; `--home /tmp/yamt-rel-0.4.1/home-<n>` on every `start-app` (a
restart reuses its `--home`). The owner's own `target/debug/yamt --repo /tmp/yamt-conflict-project` may be running:
leave it alone. The owner's settings file (`~/.config/yamt/`), the window storage under the data folder and
`~/go/bin`, `~/.cargo/bin`, `~/.local/bin` must stay untouched.

## Recipes

1. `just check` — the whole gate. Paste each recipe's tail and the exit status.
2. **Licences, as the release job checks them:** `scripts/third-party-licenses.sh && git diff --exit-code
   THIRD_PARTY_LICENSES.txt`. Pass: exit 0, no diff; the file has the "==== Copied code (1) ====" section naming
   microsoft/vscode at `789f2c470d13c4760f2b5cc6a9e1919c05d04f7d` under MIT.
3. **Bundle:** `cargo tauri build --bundles deb`. Pass: `target/release/bundle/deb/yamt_0.4.1_amd64.deb` exists (the
   README's install command uses that name); its contents list `usr/bin/yamt` as the only program in `usr/bin` and carry
   `THIRD_PARTY_LICENSES.txt` equal to the repository's; `target/release/yamt --version` prints `yamt 0.4.1`.
4. **The release binary** (`target/release/yamt`) on a private display through the app-session helper
   (`pnpm -s -C frontend exec tsx scripts/app-session.ts <command> …`): `start-app --name <n> --binary
   target/release/yamt --repo <dir> --home <home>`. Real input only (`xdotool` through the helper).
   1. **Conflict project:** `scripts/conflict-repo.sh /tmp/yamt-rel-merge`. The file list shows the 7 files; open a
      text conflict: three panes with the changes; "Mark resolved" stages it (`git -C /tmp/yamt-rel-merge ls-files -u`
      no longer lists it) and opens the next unresolved file. Dark theme: one screenshot of the window.
   2. **Panes:** in that project, three dots on the file list's edge and on both pane dividers (screenshot). Drag
      "Local and Result widths" by +150 px: Local and Result change, Remote keeps its width to the pixel. A
      double-click on that divider makes the three panes equal. Drag it again and drag the file list's edge wider; note
      both widths; `stop`, `start-app` again with the same `--repo` and `--home`: the split and the file list's width
      are the same.
   3. **Language servers:** `scripts/lsp-repo.sh --servers /tmp/yamt-rel-lsp`, started with the PATH line it prints
      (and the real `RUSTUP_HOME`/`CARGO_HOME`). Pass: the start question lists Biome, clangd, gopls, Phpactor, ruff,
      ty, basedpyright, rust-analyzer, oxfmt, oxlint, TypeScript; after Start the header shows the counts and only the
      "Servers" button; its drop-down lists every server with its state; pin ruff and rust-analyzer → their two buttons
      left of "Servers". A hover in `rs/core/src/lib.rs` and in App.vue shows its server's message; Ctrl+S in
      `py/api/stats.py` formats and the file keeps git's conflict markers on disk and stays in `git ls-files -u`.
      Settings → Language servers → ruff's switch off: `pgrep -f "ruff server"` finds nothing, ruff's underlines leave
      the Result, ruff is in neither the header nor the drop-down. `stop`, `start-app` again with the same `--repo` and
      `--home`: no start question, ruff still off and not started after 10 s, rust-analyzer still pinned. ruff on → it
      starts and its pinned button is back.
   4. **No leftovers:** after `stop`, `pgrep -af` for `target/release/yamt` and every preset program finds nothing
      from this run. Remove `/tmp/yamt-rel-*` repositories (keep the screenshots folder).

## Report

`gate` pass/fail, `failures`, `smoke` per `skill://verification`; environment facts (VF5); screenshots' paths.
