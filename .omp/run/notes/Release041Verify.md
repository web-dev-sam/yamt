The gate passes and every recipe in the brief (1, 2, 3, 4.1–4.4) passed. I ran them in order from the main checkout at `22ce491`, which had only your two uncommitted files changed. Nothing failed, so I reran nothing.

**gate:** pass
**failures:** none

## smoke

**1. `just check` — pass.** Exit status 0, wall time 32.97 s. Full log: `/tmp/yamt-rel-0.4.1/check.log`. Tail of each step:

| Step | Tail |
|---|---|
| fmt-check | `oxfmt --check` → `Finished in 691ms on 344 files using 24 threads.`; `cargo fmt --all --check` printed nothing |
| clippy | `-D warnings` ran with no warnings |
| test | `Summary [ 5.009s] 479 tests run: 479 passed, 1 skipped` |
| deny | `advisories ok, bans ok, licenses ok, sources ok` (warnings only: duplicate crates; unmaintained `paste` RUSTSEC-2024-0436 and `proc-macro-error` RUSTSEC-2024-0370; ISC licence not encountered) |
| bindings-check / fixtures-check | the `diff -u` / `diff -ru` commands printed nothing |
| web-lint / web-typecheck | `oxlint --type-aware && eslint --max-warnings 0` and `vue-tsc -b` printed nothing |
| web-test | `Test Files 116 passed (116)` / `Tests 1573 passed (1573)` |
| web-unused | `knip` printed nothing |
| arch-check / map-check | `arch-check: ok` / `map-check: ok` |
| golden | `ok` for all 10 cases, `language-tools-script-setup` … `vueuse-use-magic-keys` |
| sfc-order | printed nothing |
| hooks-test | `ℹ tests 16 ℹ pass 16 ℹ fail 0` |

**2. Licences — pass.**
- `scripts/third-party-licenses.sh` exited 0: `third-party-licenses: 356 Rust crates, 82 JS packages, 2 icon sets -> THIRD_PARTY_LICENSES.txt (740867 bytes)`.
- `git diff --exit-code THIRD_PARTY_LICENSES.txt` exited 0 with no diff.
- Line 16375 is `==== Copied code (1) ====`, followed by `---- Visual Studio Code minimap (MIT) ----` and `(microsoft/vscode 789f2c470d13c4760f2b5cc6a9e1919c05d04f7d, …)`.

**3. Bundle — pass.**
- `cargo tauri build --bundles deb` exited 0: `Finished 1 bundle at: …/target/release/bundle/deb/yamt_0.4.1_amd64.deb (4.99 MiB)`.
- `dpkg-deb` is not installed here, so I listed and unpacked the `.deb` with `bsdtar` instead.
- The only file in `usr/bin` is `-rwxr-xr-x … 16332240 usr/bin/yamt`.
- `usr/lib/yamt/THIRD_PARTY_LICENSES.txt` (740867 bytes) is byte-identical to the repository's (checked with `cmp`).
- `target/release/yamt --version` prints `yamt 0.4.1`.

**4.1 Conflict project — pass.**
- `scripts/conflict-repo.sh /tmp/yamt-rel-merge` made a repository whose file list shows all 7 files: `assets/logo.bin, docs/removed.md, notes/crlf.txt, packages-private/sfc-playground/src/App.vue, packages/compiler-core/src/transforms/vOn.ts, packages/react-query-persist-client/…/PersistQueryClientProvider.tsx, src/added.ts`.
- The theme was `dark`. Opening `vOn.ts` showed three panes, Local / Result / Remote, with bands between them and "2 changes · 1 conflict".
- "Mark resolved" first showed an "Unprocessed Changes" dialog: "1 unresolved conflict and 2 unprocessed changes still remain…". I chose "Save Current Result".
- After that, `git ls-files -u` no longer listed `vOn.ts`, `git status` showed `M  packages/compiler-core/src/transforms/vOn.ts`, the list showed it with "✓ resolved", and the app opened `PersistQueryClientProvider.tsx`.
- Screenshots: `4.1-merge-dark.png`, `4.1-after-mark.png`.

**4.2 Panes — pass.**
- The screenshot shows dots on the file list's edge and on both pane dividers: `4.2-pane-dots.png`.
- Pane widths (Local / Result / Remote, px) through the steps:

| Step | Local | Result | Remote |
|---|---|---|---|
| Start | 418.98 | 419.02 | 419 |
| Drag "Local and Result widths" +150 | 568.98 | 269.02 | 419 (unchanged) |
| Double-click that divider | 418.98 | 419.02 | 419 (equal again) |
| Drag it −100, then the file list's edge +120 | 288.53 | 469.47 | 379 |

- After the last drags the file list's edge was at x=365.
- After `stop` and `start-app` with the same `--repo` and `--home`: panes `[288.53125, 469.46875, 379]` and the edge at x=365, identical. Screenshots: `4.2-before-restart.png`, `4.2-after-restart.png`.

**4.3 Language servers — pass.** I started the app with `PATH=/home/wds/.cache/yamt/servers-path:$PATH`, `RUSTUP_HOME=~/.rustup`, `CARGO_HOME=~/.cargo`.
- **Start question:** it listed "Biome — biome/, clangd — c/, gopls — go/, Phpactor — php/, ruff, ty, basedpyright — py/, rust-analyzer — rs/, oxfmt, oxlint, TypeScript — web/" (`4.3-start-question.png`).
- **Header after Start:** "⊗1 ⚠0" and a single "Servers" button (accessible name "Language servers").
- **Drop-down:** all 11 servers with their state. Biome was Running; the other 10 were Stopped (`4.3-servers-dropdown.png`).
- **Pins:** after pinning, the header shows `ruff@1293`, `rust-analyzer@1346`, then `Language servers@1459` (`4.3-pinned.png`).
- **Hovers:**
  - `lib.rs` (after expanding the collapsed fragments): "expected 2 arguments, found 1 / rust-analyzer E0061" (`4.3-hover-rs.png`).
  - App.vue: "Type 'string' is not assignable to type 'number'. / TypeScript 2322" (`4.3-hover-vue.png`).
- **Ctrl+S in `py/api/stats.py`:**
  - The file on disk changed from `totals={"a":1,"b":2}` to `totals = {"a": 1, "b": 2}`.
  - The `<<<<<<< HEAD` / `=======` / `>>>>>>> remote` markers are still on disk.
  - `git ls-files -u` still lists stages 1, 2 and 3 (`4.3-ctrl-s-py.png`).
- **ruff switched off** in Settings → Language servers:
  - `pgrep -f "ruff server"` exited 1.
  - ruff's `os` warning left the Result. What remains are an `os` hint from basedpyright (reportUnusedImport) and the `"three"` error from ty and basedpyright.
  - The header shows only `rust-analyzer` pinned before `Language servers`; the drop-down lists the other 10 servers without ruff (`4.3-ruff-off-dropdown.png`).
- **After stop and restart:**
  - There was no start question.
  - After 11 s `pgrep` still found no ruff.
  - The header still has the rust-analyzer pin and no ruff.
  - A banner read "py/api/stats.py differs on disk from git's merge — 1 conflict left", which follows from the Ctrl+S save (`4.3-after-restart.png`).
- **ruff back on:**
  - `324185 /tmp/yamt-rel-lsp/py/.venv/bin/ruff server` is running and the header shows `ruff, rust-analyzer, Language servers` (`4.3-ruff-on.png`).
  - I also opened `stats.py` before checking, so this doesn't show whether the switch itself or the open file started ruff.
- **Problem in the test helper, not the product:** the drop-down's pin controls have role `menuitemcheckbox`, not `button`, so a click with `--role button` doesn't find them. Settings closes with its "Back" button, not Escape.

**4.4 No leftovers — pass.**
- After `stop`, `pgrep -af` for `target/release/yamt`, the server programs, `tauri-driver`, Xvfb and `WebKitWebDriver` found only two processes. They are `oxlint --lsp` (pid 90790) and `oxfmt --lsp` (pid 90821) from `frontend/node_modules`; both were already running before this run started, so I left them alone.
- I removed `/tmp/yamt-rel-merge` and `/tmp/yamt-rel-lsp`. What remains is `/tmp/yamt-rel-0.4.1` (screenshots) and the older `/tmp/yamt-rel-0.5.0`, which I didn't touch.

## Environment
- Toolchain: `rustc 1.99.0 (b940084d7 2026-09-28)`, node `v24.22.0`, pnpm `12.0.0`, `tauri-cli 2.12.2`. `dpkg-deb` is missing (see recipe 3).
- **Display:** a private Xvfb display `:2`, started by the app-session helper through `tauri-driver`. All screenshots came from the WebDriver page (`"source":"page"`).
- **Where the helper kept settings and window storage:**
  - Recipes 4.1 and 4.2: `--home /tmp/yamt-rel-0.4.1/home-1`, settings in `/tmp/yamt-rel-0.4.1/home-1/.config`.
  - Recipe 4.3: `--home /tmp/yamt-rel-0.4.1/home-2`, settings in `home-2/.config`.
  - The window storage lived under those homes as well.
- **Your own files are untouched:**
  - I took sha256 sums of every file under `~/.config/yamt/` and `~/.local/share/dev.yamt.merge/` (window storage) before the run and again after; the two lists match exactly.
  - `find ~/go/bin ~/.cargo/bin ~/.local/bin -newer <snapshot>` found nothing.
  - `git status` shows only `.omp/run/slices.json` and `docs/slices/handoff-release-0.4.1.md`.
  - `scripts/lsp-repo.sh` kept its PATH folder in `~/.cache/yamt/servers-path`, which it creates itself.

Screenshots and logs are in `/tmp/yamt-rel-0.4.1/`:
- `4.1-merge-dark.png`
- `4.1-after-mark.png`
- `4.2-pane-dots.png`
- `4.2-before-restart.png`
- `4.2-after-restart.png`
- `4.3-start-question.png`
- `4.3-servers-dropdown.png`
- `4.3-pinned.png`
- `4.3-librs.png`
- `4.3-hover-rs.png`
- `4.3-hover-vue.png`
- `4.3-ctrl-s-py.png`
- `4.3-ruff-off-settings.png`
- `4.3-ruff-off-dropdown.png`
- `4.3-after-restart.png`
- `4.3-ruff-on.png`
- logs: `check.log`, `licenses.log`, `bundle.log`