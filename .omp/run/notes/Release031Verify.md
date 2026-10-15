The gate and all four recipes passed at HEAD `f1b4034`. The brief says no mutation run this time, so I did not run `just mutants`.

```
gate:     pass
failures: []
```

## 1. `just check`: exit 0, run once (wall time 33.1 s)
Tail of each recipe:
- **fmt-check:** `All matched files use the correct format. Finished in 675ms on 298 files`. `cargo fmt --all --check` printed nothing.
- **clippy:** `cargo clippy --workspace --all-targets --features yamt-app/bindings -- -D warnings` → `Finished 'dev' profile … in 1.59s`.
- **test:** `Summary [ 4.271s] 449 tests run: 449 passed, 1 skipped`. The last tests were `yamt-lsp-host::run stop_kills_a_server_that_ignores_it_after_the_grace_and_exits_once` and `yamt-session::save_round_trip every_golden_saved_…`. `yamt-app::cli version_prints_the_workspace_version` passed.
- **deny:** `advisories ok, bans ok, licenses ok, sources ok`. It printed warnings only:
  - `license-not-encountered` for ISC
  - duplicate versions of base64, bitflags, syn, thiserror and others
  - unmaintained `paste` (RUSTSEC-2024-0436) and `proc-macro-error` (RUSTSEC-2024-0370)
- **bindings-check:** `diff -u frontend/src/ipc/bindings.ts target/bindings-check.ts` printed nothing.
- **fixtures-check:** `diff -ru` for the golden and showcase fixtures printed nothing.
- **web-lint** (`oxlint --type-aware && eslint --max-warnings 0`) and **web-typecheck** (`vue-tsc -b`): no output.
- **web-test:** `Test Files 100 passed (100)`, `Tests 1336 passed (1336)`.
- **web-unused** (`knip --include exports,types`): no output.
- **arch-check:** `arch-check: ok`. **map-check:** `map-check: ok`.
- **golden:** `ok language-tools-script-setup … ok vueuse-use-magic-keys`, with no failures.
- **sfc-order:** no output.
- **hooks-test:** `ℹ tests 16 ℹ pass 16 ℹ fail 0`.

## smoke

**2. Licences — pass.**
`third-party-licenses: 356 Rust crates, 82 JS packages, 2 icon sets -> THIRD_PARTY_LICENSES.txt (739317 bytes)`. `git diff --exit-code` showed no diff, and the step exited 0.

**3. Bundle — pass.**
- The build ended with `Bundling yamt_0.3.1_amd64.deb … Finished 1 bundle at: …/target/release/bundle/deb/yamt_0.3.1_amd64.deb (4.95 MiB)`.
- This machine has no `dpkg` (`error: command not found: dpkg`), so I listed the contents with `ar p … data.tar.gz | tar -tz`.
- `usr/bin` holds only `usr/bin/yamt`. The rest is `usr/share/applications/yamt.desktop`, three icons, and `usr/lib/yamt/{THIRD_PARTY_LICENSES.txt,LICENSE}`.
- `target/release/yamt --version` prints `yamt 0.3.1`.

**4.1 Conflict project — pass.**
- The file list showed all 7 files: `assets/logo.bin`, `docs/removed.md`, `notes/crlf.txt`, `packages-private/sfc-playground/src/App.vue`, `packages/compiler-core/src/transforms/vOn.ts`, `packages/react-query-persist-client/src/PersistQueryClientProvider.tsx`, `src/added.ts`.
- `vOn.ts` opened with three panes and the toolbar read `2 changes · 1 conflict`.
- "Mark resolved" opened the "Unprocessed Changes" dialog ("1 unresolved conflict and 2 unprocessed changes still remain…"). I clicked "Save Current Result".
- After that, `ls-files -u` listed 6 files without `vOn.ts`, and the selected file was `PersistQueryClientProvider.tsx`, the next unresolved one.
- Screenshots: `/tmp/yamt-shots-rel-01-list.png`, `02-von.png`, `03-resolved.png`, `04-next.png`.

**4.2 Language servers — pass.**
I started the app with `PATH=/home/wds/.cache/yamt/servers-path:$PATH`, `RUSTUP_HOME=~/.rustup` and `CARGO_HOME=~/.cargo`.

The start question listed:
- Biome — biome/
- clangd — c/
- gopls — go/
- Phpactor — php/
- ruff, ty, basedpyright — py/
- rust-analyzer — rs/
- oxfmt, oxlint, TypeScript — web/

After Start, all 11 servers showed in the status bar. I hovered with the real pointer (`xdotool mousemove` on the private display `:2`) and read each tooltip:

| File | Tooltip |
|---|---|
| `biome/src/index.js` | "This is an unexpected use of the debugger statement. Biome lint/suspicious/noDebugger" |
| `web/src/App.vue` | "Type 'string' is not assignable to type 'number'. TypeScript 2322" |
| `py/api/stats.py` | "Object of type `Literal["three"]` is not assignable to `int` ty invalid-assignment / Type "Literal['three']" is not assignable to declared type "int" … basedpyright reportAssignmentType" |
| `rs/core/src/lib.rs` | "expected 2 arguments, found 1 rust-analyzer E0061" |
| `go/calc/calc.go` | "cannot use "three" (untyped string constant) as int value in variable declaration gopls IncompatibleAssign" |
| `php/src/Stats.php` | "Function undefined_helper not found. Phpactor function.notFound / Learn more at https://phpstan.org/… Phpactor function.notFound / Function "undefined_helper" not found Phpactor worse.unresolved_name" |
| `c/src/main.c` | "Incompatible pointer to integer conversion initializing 'int' with an expression of type 'char[6]' clangd -Wint-conversion" |

The rs, go, php and c lines with the problems were hidden under the "Show unchanged lines" waves. I showed them by clicking the middle wave with the real pointer.

Ctrl+S (real key via xdotool, cursor in Result):
- `lib.rs`: `pub fn spaced()->i32{1}` became `pub fn spaced() -> i32 {\n    1\n}`.
- `stats.py`: `totals={"a":1,"b":2}` became `totals = {"a": 1, "b": 2}`.
- Both files on disk still have `<<<<<<< HEAD / ======= / >>>>>>> remote`, and `ls-files -u` still lists stages 1, 2 and 3 for each.

Settings → Language servers → "From the list" opened yamt's own `role=menu` with 16 entries: oxfmt, Biome, oxlint, TypeScript, eslint, rust-analyzer, gopls, ruff, ty, basedpyright, pyright, Phpactor, Intelephense, clangd, Deno, bash-language-server, each with its command.

Screenshots: `/tmp/yamt-shots-rel-05-lspask.png` through `22-from-list.png`. The hover ones are 07, 08, 09, 12, 14, 17 and 19; the saves are 20 and 21.

**4.3 No leftovers — pass.**
- Each `stop` reported tauri-driver and xvfb stopped and the helper folder removed.
- `pgrep -af` for `target/release/yamt`, `yamt-rel-`, `servers-path`, `yamt-app-session`, `WebKitWebProcess` and `tauri-driver` found nothing (exit 1).
- The preset-name pgrep found only PIDs 5711, 5718, 5777, 6261 and 6262. They are the owner's VS Code oxlint/oxfmt `--lsp`, rust-analyzer and proc-macro-srv; they were already running before this run (the same PIDs are in `PresetsVerify.md`).
- I removed `/tmp/yamt-rel-*`, and `ls` confirms they are gone.

**Settings location:** the helper kept its settings in `/tmp/yamt-app-session-rel-xYcNRL/home/.config` and `/tmp/yamt-app-session-rellsp-ndn5yn/home/.config`, and removed both on stop. The owner's `~/.config/yamt/settings.json` was last changed 2026-10-14 22:28. `find ~/go/bin ~/.cargo/bin ~/.local/bin -newermt '2026-10-15 14:00'` found nothing.

**Note:** the hooks blocked one `read` command because it contained `>` (`[ownership/SP1] No slice registered …`). I sent the same command again without the comparison; nothing was written.

## Environment (VF5)
- rustc 1.99.0 (b940084d7 2026-09-28), node v24.22.0, pnpm 12.0.0, tauri-cli 2.12.2.
- The release binary ran under Xvfb `:2` through tauri-driver.
- `docs/slices/handoff-release-0.3.1.md` is an untracked file in the tree that was there before this run; I did not touch it.