# Release042Verify - release 0.4.2 final run (verifier)

Output verbatim.

Every recipe in the brief passed (1–4), so the gate passes. Nothing was fixed or retried.

```
gate      "pass"
failures  []
```

**Environment (VF5):** `main` at `62f8a30 chore(release): 0.4.2`. rustc 1.99.0 (b940084d7 2026-09-28), node v24.22.1, pnpm 12.0.0. The app ran through `just app-session` on a private Xvfb display `:2` with tauri-driver. `dpkg-deb` is not installed here, so I read the `.deb` with `bsdtar`.

**Exit status and closing windows:** yamt's exit status and stderr came from a scratch wrapper, `/tmp/yamt-rel-0.4.2/yamt-wrap`, used as `--binary` around `target/release/yamt`. Windows were closed with `WM_DELETE_WINDOW`, sent by `/tmp/yamt-rel-0.4.2/wmclose.py` (Xlib through ctypes), not through WebDriver.

## smoke

| recipe | observed | pass |
|---|---|---|
| 1 `just check` | `EXIT 0`, 36.67 s.<br>• fmt: oxfmt `All matched files use the correct format.`, `cargo fmt` clean.<br>• clippy `-D warnings`: finished with no warnings.<br>• nextest: `Summary [ 7.130s] 595 tests run: 595 passed, 10 skipped`.<br>• deny: `advisories ok, bans ok, licenses ok, sources ok`. It printed duplicate-crate warnings and two unmaintained warnings (`paste` RUSTSEC-2024-0436, `proc-macro-error` RUSTSEC-2024-0370), both allowed by `--warn unmaintained`.<br>• bindings-check and fixtures-check: no diff output.<br>• web-lint, web-typecheck, web-unused: no output.<br>• vitest node: `Test Files 126 passed (126)`, `Tests 1756 passed (1756)`.<br>• `arch-check: ok`, `map-check: ok`.<br>• golden: all 10 cases `ok`.<br>• sfc-order: clean.<br>• hooks-test: `tests 16 pass 16 fail 0`.<br>Log: `/tmp/yamt-rel-0.4.2/check.log` | pass |
| 2 licences | `third-party-licenses: 356 Rust crates, 82 JS packages, 2 icon sets -> THIRD_PARTY_LICENSES.txt (740867 bytes)`, script `EXIT 0`; `git diff --exit-code` `EXIT 0` with no diff | pass |
| 3 bundle | `cargo tauri build --bundles deb` `EXIT 0`: `Bundling yamt_0.4.2_amd64.deb … Finished 1 bundle … (5.08 MiB)`. The data tar has `usr/bin/yamt` as the only entry under `usr/bin`, plus `usr/lib/yamt/THIRD_PARTY_LICENSES.txt` (740867 bytes) and `usr/lib/yamt/LICENSE`. `cmp` of the bundled licence file against the repository's: `EXIT 0`. `target/release/yamt --version` prints `yamt 0.4.2` (exit 0) | pass |
| 4.1 conflict project | The list shows all 7 files (`assets/logo.bin`, `docs/removed.md`, `notes/crlf.txt`, `…/App.vue`, `…/vOn.ts`, `…/PersistQueryClientProvider.tsx`, `src/added.ts`). Opened `notes/crlf.txt`; headers `Local (yours): local` and `Remote (theirs): remote`. I did not resolve the file's 1 conflict before clicking Mark resolved, so the question `Unprocessed Changes — 1 unresolved conflict still remains…` appeared; I chose Save Current Result. After that, `ls-files -s` shows `4e7cdf2… 0 notes/crlf.txt`, `ls-files -u` no longer lists it, the list row reads `notes/crlf.txt resolved`, and the next unresolved file (`packages-private/sfc-playground/src/App.vue`) opened. WM close: `exit 1`, stderr `yamt: 6 of 7 files still unresolved`. Screenshot: `/tmp/yamt-rel-0.4.2/merge-after-mark.png` | pass |
| 4.2 rebase | Left `Local (yours): 0b4e8d6 feature: board columns, logo and notes`; right `Remote (theirs): eb9a85a main: …`. Tag `REBASE` at the bottom of the file list, hover `Rebasing feature onto main · 1 of 3` plus the commit message. Resolved the files: notes Keep, logo Take left, board.ts Mark resolved → Save Current Result. Continue → `· 2 of 3` with `src/card.ts` and `3412aab feature: card title`. No restart: it was the same yamt pid 42756 throughout. Resolved card.ts the same way; the next Continue ran to the end: `exit 0`, stderr `Successfully rebased and updated refs/heads/feature.` / `yamt: rebase finished`. `git log main..feature` shows `feature: reminders`, `feature: card title`, `feature: board columns, logo and notes` (with its body `The board gets a doing column.`), and the branch is `## feature`. Dark screenshot at step 1 (`data-theme` dark): `/tmp/yamt-rel-0.4.2/rebase-step1-dark.png` | pass |
| 4.3 cherry-pick Abort | Before: tip `4678834054d9…`, branch `main`, 0 stashes. Abort cherry-pick was already in the toolbar without a right-click. The question read `Abort Cherry-Pick — Every resolution and every save in this cherry-pick will be lost… yamt closes.` Confirming gave `exit 1`, stderr `yamt: cherry-pick aborted`. After: porcelain empty, `main` at `4678834054d9…`, 0 stashes, no `CHERRY_PICK_HEAD` or sequencer folder. Screenshot: `/tmp/yamt-rel-0.4.2/pick-abort-question.png` | pass |
| 4.4 remembered resolution | List row `src/board.ts remembered`, hover `git rerere filled in a resolution you recorded before; review it, then Mark resolved`. `ls-files -u` showed 3 stages. Mark resolved asked no question → `d11bd34… 0 src/board.ts`, `ls-files -u` empty. WM close → `exit 0`. Screenshot: `/tmp/yamt-rel-0.4.2/rerere-remembered.png` | pass |
| 4.5 no leftovers | All `r-*` sessions stopped, each reporting tauri-driver and xvfb `stopped`. `pgrep -af target/release/yamt` is empty, and no tauri-driver, Xvfb or WebKitWebDriver process is left. The `/tmp/yamt-rel-*` repositories are removed; only `/tmp/yamt-rel-0.4.2/` remains (screenshots, logs, wrapper). The LSP processes 26290 and 26296 were already running and are not mine. I used `--home /tmp/yamt-rel-0.4.2/home-{1..4}`, so `~/.config/yamt/` was not used | pass |

**Notes:**
- The brief says Abort needs a right-click on the toolbar to show it. At a cherry-pick stop the button was already visible.
- In 4.2, after the last Continue, the `app-session click` command itself exited with code 1. The app had exited on its own at that point, after `exit 0` and `yamt: rebase finished`.
- `git status --porcelain` on the main checkout shows ` M .omp/run/findings.jsonl` after the run. I did not write to it; the hooks may have.