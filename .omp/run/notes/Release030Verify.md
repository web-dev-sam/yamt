I can't confirm the tree is releasable yet. `just check` passed (exit 0), but two points in the brief failed as written. The `.deb` check couldn't run because `dpkg` isn't installed here. The second failure is the language-server start: after clicking Start, three of the four servers showed "Stopped". They ran only once I opened a file under `web/`. Everything else passed. I edited no tracked files.

**gate: pass**

**failures**
- **Recipe 3, `dpkg -c`**: `error: command not found: dpkg`. As a stand-in (not what the brief asks for), `bsdtar` on the package's `data.tar.gz` lists only `usr/bin` and `usr/bin/yamt`.
- **Recipe 4.2, first point**: after Start, the dots read `oxfmt|Stopped ;; oxlint|Stopped ;; TypeScript|Stopped ;; ruff|Running` (read about 15 s later). After I opened `web/src/math.ts`, all four read `Running`, and `typescript-language-server --stdio`, `oxfmt --lsp` and `oxlint --lsp` started then. Either the servers really start lazily and the brief should say so, or this is a bug in starting them.

**Recipe tails**
1. **`just check`, exit 0:**
   - fmt-check: `All matched files use the correct format.`
   - clippy: clean.
   - nextest: `442 tests run: 442 passed, 1 skipped`.
   - deny: `advisories ok, bans ok, licenses ok, sources ok`, with warnings only: duplicate `thiserror` and `thiserror-impl`, and unmaintained `proc-macro-error`.
   - bindings-check and fixtures-check: empty diffs.
   - web-lint and web-typecheck: clean.
   - web-test: `Test Files 96 passed (96) / Tests 1215 passed (1215)`.
   - web-unused: clean.
   - arch-check and map-check: `ok`.
   - golden: 10 cases `ok`.
   - sfc-order: clean.
   - hooks-test: `tests 16 … pass 16 fail 0`.
2. **Licences:** the script printed `356 Rust crates, 82 JS packages, 2 icon sets -> THIRD_PARTY_LICENSES.txt (739317 bytes)` and exited 0. `git diff --exit-code` also exited 0, so there is no diff. **Pass.**
3. **Bundle:** the build exited 0 and wrote `target/release/bundle/deb/yamt_0.3.0_amd64.deb (4.94 MiB)`. `target/release/yamt --version` prints `yamt 0.3.0` (exit 0). The `dpkg -c` check failed as above.
4. **Release binary** on a private display (`:2`) through the app-session helper:
   - The helper kept its settings in `/tmp/yamt-app-session-rel-I4fgD5/home/.config` and `/tmp/yamt-app-session-rellsp-PsZhaU/home/.config`. `stop` removed both folders.
   - The owner's `~/.config/yamt/settings.json` was untouched: its sha256 was `03de9d5f…ffe22` before and after, and its last change was at 22:28, before this run.

**Recipe 4 pass points**

| Point | Result | What I saw |
|---|---|---|
| 4.1 List shows 7 files | observed | All 7 files listed. |
| 4.1 Text conflict shows three panes with changes | observed | `vOn.ts` opened with `2 changes · 1 conflict` and the Local, Result and Remote panes. |
| 4.1 Mark resolved stages it and opens the next file | observed | A dialog asked first ("Unprocessed Changes … Save Current Result / Back to Resolving"); I chose Save Current Result. `vOn.ts` then left `ls-files -u`, showed as "resolved", and `PersistQueryClientProvider.tsx` opened. |
| 4.2 Start question lists both entries | observed | "oxfmt, oxlint, TypeScript — web/" and "ruff — added by you". |
| 4.2 All four show a running dot after Start | **not observed** | See failures. |
| 4.2 `math.ts`: underlines on `debugger;` and `count` | observed | Both underlined as errors in the Result pane. |
| 4.2 `math.ts`: counts read 2 errors | observed | "2 errors, 0 warnings". |
| 4.2 Hover on `count` | observed | Real pointer via xdotool; tooltip read `Type 'string' is not assignable to type 'number'. TypeScript 2322`. |
| 4.2 `stats.py`: `os` underlined, 1 warning | observed | `os` underlined as a warning; "0 errors, 1 warning". |
| 4.2 Ctrl+S in `math.ts` | observed | Disk has `export const spaced = { a: 1, b: 2 };` and keeps the `<<<<<<< HEAD … >>>>>>> remote` block. |
| 4.2 Ctrl+S in `stats.py` | observed | Disk has `totals = {"a": 1, "b": 2}` and keeps its conflict markers. |
| 4.2 Both files stay in `ls-files -u` | observed | `api/stats.py`, `web/src/greet.ts`, `web/src/math.ts` are still listed. |

5. **Leftovers:** after `stop`, the `pgrep` matched only PIDs 8789 and 8820 (`oxlint --lsp` and `oxfmt --lsp`). Those belong to the owner's VS Code (parent 4973), started at 06:16, before this run. Nothing from this run was left: no `yamt`, `ruff server` or `typescript-language-server`.

**smoke**
- licences: pass.
- bundle: fail (`dpkg` missing); `--version` passes.
- conflict project (4.1): pass.
- language servers (4.2): fail (servers start late).
- leftovers: pass.

**Environment:**
- `rustc 1.99.0 (b940084d7 2026-09-28)`, node `v24.22.0`, pnpm `12.0.0`, `tauri-cli 2.12.2`.
- No `dpkg` (Arch Linux).
- Xvfb with Mesa printed `DRI3 error: Could not get DRI3 device`; it didn't block anything.
- `~/.cache/yamt` already had `ruff-0.17.0` and `typescript-language-server-6.0.2`, so nothing was downloaded.

**Screenshots** (from the page, through WebDriver) are in `/tmp/yamt-030-shots/`. I kept them for you:
- `merge-vOn.png`
- `after-mark-resolved.png`
- `lsp-started.png`
- `math-hover-count.png`
- `stats-py.png`
- `stats-py-after-save.png`

**What I started, and cleanup:**
- Two helper sessions, `rel` and `rellsp`. Each had a tauri-driver (PIDs 3439857 and 3443230) and an Xvfb (3439847 and 3443228); `stop` reported all four stopped.
- The servers it launched: `ruff server` (3443857), `oxfmt --lsp` (3445080), `oxlint --lsp` (3445086) and `typescript-language-server` (3445092). All are gone.
- Folders `/tmp/yamt-rel-merge`, `/tmp/yamt-rel-lsp`, `/tmp/yamt-rel-config` and both `/tmp/yamt-app-session-*` folders are removed; `ls` confirms they no longer exist.
- `git status` shows only `?? docs/slices/handoff-release-0.3.0.md`, which I didn't create.