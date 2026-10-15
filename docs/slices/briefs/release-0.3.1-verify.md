# Release 0.3.1 — final run before tagging

Board "Release 0.3.1" row 2. Owner request #1050: release 0.3.1. The release commit `91a05af` changes no product code:
the workspace version is `0.3.1` (`Cargo.toml`, `Cargo.lock`), `CHANGELOG.md` has `## [0.3.1] - 2026-10-15`, the README
names the 0.3.1 files. `crates/`, `frontend/src/`, `src-tauri/` are unchanged since `a5babf6`, which the presets' final
runs checked (`.omp/run/notes/PresetsVerify*.md`, `just mutants c74c92e` included), so no mutation run this time. The
`--version` test reads `CARGO_PKG_VERSION`. Read-only recipes only (VF6); you fix nothing (VF1).

## Recipes

1. `just check` — the whole gate. Paste each recipe's tail and the exit status.
2. **Licences, as the release job checks them:** `scripts/third-party-licenses.sh && git diff --exit-code
   THIRD_PARTY_LICENSES.txt`. Pass: exit 0, no diff.
3. **Bundle:** `cargo tauri build --bundles deb`. Pass: `target/release/bundle/deb/yamt_0.3.1_amd64.deb` exists (the
   README's install command uses that name); its contents list `usr/bin/yamt` as the only program in `usr/bin` (`dpkg -c`,
   or `ar p … data.tar.* | tar -t` if there is no `dpkg`); `target/release/yamt --version` prints `yamt 0.3.1`.
4. **The release binary** (`target/release/yamt`) on a private display through the app-session helper
   (`pnpm -s -C frontend exec tsx scripts/app-session.ts <command> …`): `start-app --name <n> --binary
   target/release/yamt --repo <dir>`. Real input only. The owner's settings file (`~/.config/yamt/`) and
   `~/go/bin`, `~/.cargo/bin`, `~/.local/bin` must stay untouched: say where the helper kept its settings.
   1. **Conflict project:** `scripts/conflict-repo.sh /tmp/yamt-rel-merge`. The file list shows the 7 files; open a
      text conflict: three panes with the changes; "Mark resolved" stages it (`git -C /tmp/yamt-rel-merge ls-files -u`
      no longer lists it) and opens the next unresolved file.
   2. **Language servers:** `scripts/lsp-repo.sh --servers /tmp/yamt-rel-lsp`, started with the PATH line it prints
      (and the real `RUSTUP_HOME`/`CARGO_HOME`). Pass: the start question lists Biome, clangd, gopls, Phpactor, ruff,
      ty, basedpyright, rust-analyzer, oxfmt, oxlint, TypeScript with their folders; after Start, one hover per language
      shows its server's message (App.vue through TypeScript, `py/api/stats.py`, `rs/core/src/lib.rs`,
      `go/calc/calc.go`, `php/src/Stats.php`, `c/src/main.c`, `biome/src/index.js`); Ctrl+S in `rs/core/src/lib.rs`
      and `py/api/stats.py` formats and the file keeps git's conflict markers on disk and stays in `git ls-files -u`;
      Settings → Language servers → "From the list" opens yamt's menu.
   3. **No leftovers:** after `stop`, `pgrep -af` for `target/release/yamt` and every preset program finds nothing
      from this run. Remove `/tmp/yamt-rel-*`.

## Report

`gate` pass/fail, `failures`, `smoke` per `skill://verification`; environment facts (VF5); screenshots' paths.
