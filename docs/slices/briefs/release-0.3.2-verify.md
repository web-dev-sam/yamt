# Release 0.3.2 — final run before tagging

Board "Release 0.3.2" row 2. Owner request #1075: release 0.3.2. The release commit changes no product code: the
workspace version is `0.3.2` (`Cargo.toml`, `Cargo.lock`), `CHANGELOG.md` has `## [0.3.2] - 2026-10-15`, the README names
the 0.3.2 files (`readmer check` passes). Since 0.3.1 the product gained the removal tooltip (plan §2 #73) and the
owner's dark theme (`3e465cb`); `crates/`, `frontend/src/`, `src-tauri/` are unchanged since `1b7ccd1`, which the
tooltip's final run checked (`.omp/run/notes/RemovalVerify.md`, `just mutants 3e465cb` included), so no mutation run
this time. No dependency changed. Read-only recipes only (VF6); you fix nothing (VF1).

## Recipes

1. `just check` — the whole gate. Paste each recipe's tail and the exit status.
2. **Licences, as the release job checks them:** `scripts/third-party-licenses.sh && git diff --exit-code
   THIRD_PARTY_LICENSES.txt`. Pass: exit 0, no diff.
3. **Bundle:** `cargo tauri build --bundles deb`. Pass: `target/release/bundle/deb/yamt_0.3.2_amd64.deb` exists (the
   README's install command uses that name); its contents list `usr/bin/yamt` as the only program in `usr/bin`;
   `target/release/yamt --version` prints `yamt 0.3.2`.
4. **The release binary** (`target/release/yamt`) on a private display through the app-session helper
   (`pnpm -s -C frontend exec tsx scripts/app-session.ts <command> …`): `start-app --name <n> --binary
   target/release/yamt --repo <dir>`. Real input only. The owner's settings file (`~/.config/yamt/`) and
   `~/go/bin`, `~/.cargo/bin`, `~/.local/bin` must stay untouched: say where the helper kept its settings.
   1. **Conflict project:** `scripts/conflict-repo.sh /tmp/yamt-rel-merge`. The file list shows the 7 files; open a
      text conflict: three panes with the changes; "Mark resolved" stages it (`git -C /tmp/yamt-rel-merge ls-files -u`
      no longer lists it) and opens the next unresolved file. Dark theme: one screenshot of the window.
   2. **Removal tooltip:** `just golden-repo language-tools-script-setup /tmp/yamt-rel-removal`; `hover` the left
      pane's bar at the start of the removed `if` line (chunk 3) → the tooltip shows
      `\tif (options.vueCompilerOptions.target >= 3.3) {` with syntax colours, drawn over the gap strip (screenshot);
      1 px beside the bar → no tooltip; apply that side → it closes.
   3. **Language servers:** `scripts/lsp-repo.sh --servers /tmp/yamt-rel-lsp`, started with the PATH line it prints
      (and the real `RUSTUP_HOME`/`CARGO_HOME`). Pass: the start question lists Biome, clangd, gopls, Phpactor, ruff,
      ty, basedpyright, rust-analyzer, oxfmt, oxlint, TypeScript; after Start, a hover in `rs/core/src/lib.rs` and in
      App.vue shows its server's message; Ctrl+S in `py/api/stats.py` formats and the file keeps git's conflict markers
      on disk and stays in `git ls-files -u`.
   4. **No leftovers:** after `stop`, `pgrep -af` for `target/release/yamt` and every preset program finds nothing
      from this run. Remove `/tmp/yamt-rel-*`.

## Report

`gate` pass/fail, `failures`, `smoke` per `skill://verification`; environment facts (VF5); screenshots' paths.
