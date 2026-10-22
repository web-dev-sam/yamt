# PasteCrashVerify (3.F final run, board Paste crash row 4)

**gate: pass.** All seven recipes in `docs/slices/briefs/3.F-verify.md` were run against `1ff77d1` (`feat/raw-compare`). No paste crashed the fixed build on X11 or Wayland, and the old crash still happens at `bea67f0`. Two things to look at: the context menu has no "Paste As Plain Text" item to test, and the internal-copy paste missed once because I pasted into a read-only Result first.

**Environment (VF5):** rustc 1.99.0 (b940084d7 2026-09-28), node v24.22.1, pnpm 12.0.0, webkit2gtk-4.1 2.54.1-1, gtk3 1:3.24.52-2. Every X11 run used a private Xvfb `:2` started by `just app-session` (`GDK_BACKEND=x11`, `WAYLAND_DISPLAY` unset). The Wayland run used a private `kwin_wayland --virtual --socket yamt-verify-wl` under `dbus-run-session`. Logs and screenshots are in `/tmp/yamt-raw/paste-verify/`.

```
gate        "pass"
failures    []
```

## smoke

**1 · `just check` — pass**
- Exit 0, run once. Log: `/tmp/yamt-raw-verify-check.log`.
- Tests: `Summary [7.367s] 681 tests run: 681 passed, 10 skipped`, `advisories ok, bans ok, licenses ok, sources ok`, `Test Files 147 passed (147)`, `Tests 1947 passed (1947)`.
- Checks: `arch-check: ok`, `map-check: ok`, every golden `ok …`.
- Hooks: `ℹ tests 16`, `ℹ pass 16`, `ℹ fail 0`.

**2 · `just mutants bea67f0` — pass (no new survivor on a changed line)**
- Exit 0. Log: `/tmp/yamt-raw-verify-mutants.log`.
- Rust: `14 mutants tested in 2m: 5 missed, 3 caught, 6 unviable`. Stryker: `All files 87.47 … 1002 killed, 3 timeout, 130 survived, 14 no cov, 0 errors`.
- Every survivor on a changed line had already been judged:

| Survivor | Earlier judgement |
|---|---|
| `src-tauri/src/clipboard.rs:22` `read_clipboard` → None / `Some("")` / `Some("xyzzy")` | Dropped (c) wiring, `PasteCrashClipboardCorrectness.md`. |
| `clipboard.rs:39` `requested_text` → None | The GTK call itself, covered by the smoke (same file). Today's real-app pastes landed text. |
| `clipboard.rs:67` `requested_text` → `Some(Default::default())` | Dropped (a): non-Linux code, `Receiver` has no `Default`. |
| `scripts/clipboardFence.ts:33:6` `name !== undefined` → `true` | Dropped (a), `PasteCrashWindowR1Correctness.md` (was `:28`). |
| `scripts/clipboardFence.ts:53:38` `"script.ts"` → `""` | Dropped (a), same file (was `:48`). |
| `src/ui/linuxPaste.ts:66:5` `focused === null` → `false` | Dropped (b)+(a), same file. |
| `src/ui/linuxPaste.ts:22` `!(pasted instanceof Node)` → `false` / empty block | Dropped (a), `PasteCrashWindowCorrectness.md`. |
| `src/ui/linuxPaste.ts:29-30` `log.warn("paste.read_failed", …)` ×3 | Finding #1574, triaged "dropped: a log line only" in `findings.jsonl`. |
| `src/ipc/tauri.ts:144` NoCoverage | Dropped (c) as `tauri.ts:146`, `PasteCrashWindowCorrectness.md`. |

The other survivors are in `keys.ts` (109, 125–146, 184), `settings.ts` (119–215), `fences.ts`, `index.ts:87,91` and `domain.ts:171,172,254`. None of those lines changed: the changed hunks are `keys.ts:100-104`, `settings.ts:5,75`, `fences.ts:7-8,12,202-203,224`, `index.ts:21,66,82` and `domain.ts:54-55`.

**3 · Pastes with no readable clipboard — pass for every item, except Paste As Plain Text, which could not be run**
- Build: `cargo tauri build --debug --no-bundle` → exit 0.
- After each item: `pgrep -f target/debug/yamt` still listed the app (2259637 merge, 2280776 compare), and `coredumpctl list --since 15:20` said `No coredumps found.`
- **Fresh display, nobody ever owned the clipboard.** Before pressing anything, `xclip -o -t TARGETS` → `Error: target TARGETS not available`.
  - Merge Result (`notes/crlf.txt`): Ctrl+V, Shift+Insert and Ctrl+Shift+V left `"line one\nline two\nline three\n"` unchanged.
  - Compare Left column on its own fresh display: the same three keys left `["",""]`.
- **Owner killed.** An `xclip -loops 0` owner was started, then `kill $pid`, and TARGETS was confirmed not available. The same three keys gave:
  - Merge Result and Local side pane: texts unchanged.
  - Find field: `["Find",""]` before and after.
  - Settings path field: still `…/home/.config/yamt/settings.json`.
  - Compare Left and Right columns: `["",""]`.
  - Tab rename: `["Tab name","Compare 1"]` (`tabrename-dead.png`).
- **Right-click in the Result.** WebKit's menu shows Cut, Copy, Paste, Delete, Select All, Insert Emoji, Insert Unicode Control Character, Inspect Element (`ctx.png`). Paste with the owner killed: app alive, Result unchanged (`ctx-after.png`).
- **"Paste As Plain Text" — not run.** The menu does not offer it, even with a live `text/html` owner (`ctx-html.png`).
- **Middle button after the PRIMARY owner was killed** (PRIMARY TARGETS not available): app alive, Result unchanged (`middle-dead.png`).

**4 · Pastes from a live clipboard — pass**
- **3 lines.** Merge Result: Ctrl+V → `"line one\nline two\nline three\nLIVE1\nLIVE2\nLIVE3"` (`live3.png`); one Ctrl+Z → `"line one\nline two\nline three\n"`. Compare Left: `"C1\nC2\nC3"` (`raw-three.png`); one Ctrl+Z → `""`.
- **`seq 300`** into the compare column: `[301,"1\n2\n3\n4\n5\n6\n","7\n298\n299\n300\n"]`, i.e. 300 lines plus the trailing empty line (`raw-seq.png`). Ctrl+Z → `""`.
- **Payload over 8 MiB** (9,437,184 bytes): app alive, column lengths `[0,0]`, notice `"Compare 1, left: not pasted — a column holds up to 8 MiB"` (`raw-big.png`).
- **Text copied inside yamt.** I selected 3 lines in the crlf Result and pressed Ctrl+C. The clipboard TARGETS then included `org.webkitgtk.WebKit.custom-pasteboard-data`.
  - My first Ctrl+V went into the `docs/removed.md` Result, which is read-only there (`state.readOnly` = `true`), so nothing was pasted.
  - The same clipboard pasted into the `src/added.ts` Result gave `"line one\nline two\nline three\n"` (`internal-copy.png`).
  - Double-clicking `answer` in the Local pane set PRIMARY to `answer`. A middle click in the Result then added `answer`, not the clipboard's lines (`word-middle.png`).
- **Live `sel` and `clip` owners**, both confirmed running by `pgrep` before and after: middle click → `…selsel`, then Ctrl+V → `…selselclip`.
  - Before that I tried once with `&`-started owners. Both had exited before the Ctrl+V (TARGETS not available), so that Ctrl+V pasted nothing, which is correct for an empty clipboard.
  - That was a setup fault, so I redid the case with `setsid -f` owners.

**5 · Owner hung with `kill -STOP` — pass**
- **Focus kept.** Ctrl+V at 15:21:25.568. Typing `zz` landed straight away (`…answerzz`, read at 15:21:26.21), and nothing was pasted while the owner hung. After `kill -CONT` → `…answerzzLATE`.
- **Focus moved away.** Ctrl+V, then a click on an empty part of the file list (`active` became `["BODY",""]`), then `kill -CONT`. The Result stayed `…answerzzLATE` with no second LATE (`hung-blur.png`).
- After `kill 2278412` the app was alive (2259637) and there was no new core.

**6 · Wayland — pass**
- Tools found: `/usr/bin/kwin_wayland`, `wl-copy`, `wl-paste`. Ran `dbus-run-session bash /tmp/yamt-raw/paste-verify/wl.sh`: private socket `/run/user/1000/yamt-verify-wl`, tauri-driver on :4471, keys sent only through WebDriver `actions`.
- The app ran with `GDK_BACKEND=wayland` and `WAYLAND_DISPLAY=yamt-verify-wl`.
- **Owner quit.** `wl-paste: WLDEAD`, then after killing `wl-copy` `wl-paste after quit: Nothing is copied`. Ctrl+V → `alive: 2289675`, columns `["",""]`.
- **Live owner.** `wl-paste: WL1|WL2|WL3`, Ctrl+V → `["WL1\nWL2\nWL3",""]` (`wl-live.png`).

**7 · Before the fix (`bea67f0`) — still crashes, as expected**
- Scratch worktree, `pnpm install --offline` → 0, `cargo tauri build --debug --no-bundle` → 0.
- Owner killed, Ctrl+V into the crlf Result at 15:25:24. The process was gone, and `coredumpctl` shows `15:25:30 … 2298502 … SIGSEGV present /tmp/yamt-raw/paste-verify/base/target/debug/yamt`.
- Frames: `Signal: 11 (SEGV) si_code: SEGV_MAPERR`, `#0 libwebkit2gtk-4.1.so.0 + 0x17cc385`, `#1–#3 libgtk-3.so.0 (+0x3b8b17, +0x3b81b5, +0x75096)`, `#5 g_signal_emit_by_name`, `#12 gtk_main_do_event`. These are the same frames as `RawComparePasteCheck.md`.

**Cleanup — pass**
- All three sessions were stopped with `just app-session stop` and their folders removed.
- The base worktree was removed; `git worktree list` shows only the main checkout.
- I killed by pid one `xdg-desktop-portal-kde` that my private dbus had started (2289779).
- `pgrep` finds no Xvfb, tauri-driver, yamt, xclip, wl-copy or private kwin of mine. It does list the owner's own oxlint/oxfmt language servers, which matched only because their path contains `.vite-plus`.
- `git status --porcelain` is empty.