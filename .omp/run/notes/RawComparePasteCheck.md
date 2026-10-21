# RawComparePasteCheck (3.C final run follow-up, board Raw compare row 12')

**Verdict: pre-existing at 8db7609.** The crash is not caused by the `--raw` feature. It happens when Ctrl+V runs while the X clipboard has no live owner: `xclip` set it and was then killed. The build from before the feature (8db7609) segfaults the same way, at the same address `libwebkit2gtk-4.1.so.0 + 0x17cc385`. This changes row 12's reading: a paste from a live `xclip` does not crash. 5 such pastes on 8db7609 and 7 on HEAD (`8bb6bb1`) all landed with no crash.

```
gate        "pass"
failures    []
```

**Environment:** rustc 1.99.0 (b940084d7 2026-09-28), node v24.22.1, pnpm 12.0.0. Private `Xvfb :2` (1920x1080x24, `-nolisten tcp`), started with `env -u WAYLAND_DISPLAY GDK_BACKEND=x11`. Both builds were made with `cargo tauri build --debug --no-bundle`, each in its own scratch worktree under `/tmp/yamt-raw/paste/`, both exit 0. Crashes were confirmed with `coredumpctl`, because `pgrep` still lists the process while its core is being written.

## smoke

| recipe | observed | pass |
|---|---|---|
| gate `just check` | Ran once: `exit=0` in 25.9 s; the last lines were the hooks-test summary `ℹ tests 16`, `ℹ pass 16`, `ℹ fail 0`. Log: `/tmp/yamt-raw/paste/check.log`. | pass |
| `just mutants 8db7609` | `exit=0`. Rust: `Found 150 mutants to test`, `150 mutants tested in 4m: 86 caught, 64 unviable`. Stryker: `All files … 1928 killed, 3 timeout, 167 survived, 346 no coverage, 0 errors`. That is identical to row 12. Since `0081695` only the notes and brief (docs) changed, so row 12's list of survivors and its drops still hold [INFERENCE]. Its open real gaps are still open: `fixtureCompare.ts:122`, `:57/:59/:62`, `compareStore.ts:101`, `:257`, `usePanelWidth.ts:11–38`, `settingsStore.ts`. Log: `/tmp/yamt-raw/paste/mutants.log`. | fail (row 12's gaps still open) |
| 1 · 8db7609, merge window, `notes/crlf.txt` Result pane, row 12's `xclip` paste | `printf 'pasted\n' \| xclip -selection clipboard` then `xdotool key ctrl+v`, 4 times: the text lands (`kpasted`), the process stays alive, and `coredumpctl` lists no core. Then the same set followed by `pkill -x xclip` before Ctrl+V: `EXIT 139`, core pid 1346001. Top frames: `Signal: 11 (SEGV) si_code: SEGV_MAPERR`, `#0 libwebkit2gtk-4.1.so.0 + 0x17cc385`, `#1–#3 libgtk-3.so.0 (+0x3b8b17, +0x3b81b5, +0x75096)`, `#5 g_signal_emit_by_name`, `#12 gtk_main_do_event`, `#19/#20 base/target/debug/yamt`. | crash is pre-existing |
| 2 · HEAD, same paste | **Merge window:** 4 pastes from a live owner, no crash. After `pkill -x xclip`: `EXIT 139`, core 1345448, same frames #0–#5, #12. **Compare window:** 3 live pastes of 3 lines each, then a 300-line paste in a session driven by `just app-session` through `tauri-driver`: all landed, no core. After `pkill -x xclip`: `EXIT 139`, core 1348923. **Row 12's own binary** (`target/debug/yamt`, a dev-URL build, served by vite on 5173 under app-session) also crashed with the dead owner: core 1342412, same frames, `#20 … yamt_app::window::open_and_wait`. Row 12's three cores (e.g. 1175317) have the same frames. | reproduced; the trigger is a dead clipboard owner |
| 3 · live owner, and a window manager | **Without a WM, on both builds:** a live default `xclip` (`-loops 0`) answered `TARGETS UTF8_STRING`, and every paste landed with no core. **Under `kwin_x11` 6.7.5** (`dbus-run-session`, private bus, window decorated and `getactivewindow` = `repo-head — yamt` / `repo-base — yamt`): `xclip -selection clipboard -loops 0`, Ctrl+V twice, gave `live`/`live` in Result on both builds with no core. After `pkill -x xclip`: HEAD `EXIT 139` (core 1346869), 8db7609 `EXIT 139` (core 1347595). `xsel` is not installed, so the xsel variant did not run. | no crash with a live owner; a WM does not help |
| 4 · HEAD, `xdotool type`, no clipboard | `pgrep -x xclip` showed no clipboard owner. `xdotool type 'alpha…pasted'` plus `key Return` and `type alpha/beta/gamma` into the Left column produced 4 lines and no core in 10 s. `xdotool type` drops the `\n`s, so the newlines were sent as `Return` keys. | pass |
| cleanup | Both worktrees removed with `git worktree remove --force`, needed because they held untracked build output. `git worktree list` shows only the main checkout; `git status --porcelain` is empty. No yamt, Xvfb, kwin, xclip, tauri-driver or vite is left running. The exit 143s in the supervisor are processes I killed on purpose. | pass |

## Things that went wrong along the way
- **A window opened on your desktop.** My first base launch inherited `WAYLAND_DISPLAY=wayland-0` and opened on the Wayland desktop instead of `:2`. I killed it within seconds; no input was sent to it.
- **`target/debug/yamt` is a dev-URL build** (`http://localhost:5173`). Run alone it only shows "Could not connect to localhost", so recipe 2 used a fresh HEAD build. Row 12's binary was also checked with a dev server running.
- **I restarted `Xvfb :2` once before recipe 4.** After kwin was killed, the next window was never mapped. This was environment setup, not a rerun of a failing check.
- **One setup click missed.** `app-session click notes/crlf.txt` failed once while the page was still loading and worked 3 s later. A click on "Add tab" also failed (no element by that name); that paste went into the existing tab instead.

Everything is in `/tmp/yamt-raw/paste/`: `check.log`, `mutants.log`, the build logs, and the private-display screenshots (`*.png`).