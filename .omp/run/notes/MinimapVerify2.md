**Result: the gate passes and all five recipes pass.** The far-scroll failure from the first run (recipe 5b) is gone: every press from the top of the file lands where it was sent and stays there. I fixed nothing and re-ran no step that failed. One timing number was over the limit in an extra repeat, outside the pass rule; it is described under recipe 5.

**Environment (VF5):**
- HEAD `d7aaeb6`, clean tree before and after the run.
- Toolchain: rustc 1.99.0 (b940084d7 2026-09-28), node v24.22.0, pnpm 12.0.0.
- WebKit: MiniBrowser through `just webdriver 4447`, which printed `test-screen: test windows go to Samsung (HDMI-A-1, KWin screen 0, at 2600,40)`. Device ratio 2 on the fixture page.
- The real app ran on a private Xvfb (`:2` from `app-session`, `:92` for timing) at device ratio 1.
- `target/debug/yamt` was rebuilt at HEAD with `cargo tauri build --debug --no-bundle` (exit 0).
- The base binary is the first run's `7141a81` build. Its scratch clone is still at `7141a81` with a clean tree. I did not rebuild it.

```
gate: pass
failures: []
```

### smoke

**1. `just check`, run once: pass.** Exit 0, wall time 22.0 s.
- nextest: `Summary [ 4.996s] 473 tests run: 473 passed, 1 skipped`.
- deny: `advisories ok, bans ok, licenses ok, sources ok`. It also printed duplicate-crate and unmaintained warnings, which do not fail the step.
- web-test: `Test Files 109 passed (109)`, `Tests 1445 passed (1445)`.
- `arch-check: ok`, `map-check: ok`, golden all `ok`, hooks-test `pass 16`, `fail 0`.

**2. `just mutants 7141a81`: pass.** Exit 0.
- Rust: `mutants: no Rust changes since 7141a81`.
- StrykerJS on `useMergeController.ts`: 69 killed, 14 survived, 1 error.
- The 14 survivors are exactly the known older ones: lines 79, 80, 81, 82, 83 (ConditionalExpression), 89:5 (ObjectLiteral), 89:36 (ArrayDeclaration), 104 (BooleanLiteral), 133, 134, 135, 136 (ArrowFunction), 190 (StringLiteral) and 196 (ArrowFunction). None is new.
- `editor/`, where `exactScroll.ts` lives, is not mutated.

**3. WebKit fixture page, items a, b, e, f: pass.** Window 1600×1000, `language-tools-script-setup.ts`.
- **a. Before Alt:** `displayed:false`, `canvas:[0,0]`, `hit:"cm-scroller"`.
- **b. Alt held:**
  - The minimap box is at `[1458,88.5,1591,955]` against the right pane `[1172,88.5,1591,955]`: `right/top/bottom equal: true`, `panes unchanged: true`, canvas `[264,1734]`.
  - Alt up → hidden. Alt again → shown. Alt then `a` → hidden. A fresh Alt → shown.
  - Window `blur` → hidden; a repeated keydown → still hidden; a fresh keydown → shown. These three were synthetic events.
- **e. Right edge:**
  - Before: modified `[20,31]`, `[68,87]`, `[98,105]`, conflict `[140,195]`.
  - Apply icon clicked at `[684,203]`; the next frame shows modified `[60,79]`, `[90,97]`, conflict `[132,187]`, with the minimap still shown (`block`).
- **f. Slider:**
  - scrollTop 3000: slider `{top:205.6,height:86}`, equal to `minimapLayout` (start row 48).
  - At the end (scrollTop 11501): last text row drawn at canvas row 432, and the last painted row is 432.
  - Press: 3190 against `centredScrollTop` 3190.5 (WebKit stores whole pixels); the cursor, selections and folds were unchanged.
  - Drag: 3926, equal to `draggedScrollTop` 3926.
  - Short file `tanstack-query-svelte-base-query.ts` (scrollable 0): `sliderHidden:true`; `window.__errors` was `[]`.
  - The WebDriver wheel hides the minimap because it sends no Alt (known); the real wheel is in 4b.
- Screenshot: `/tmp/yamt-m/verify2/window-dark.png`.

**4. Real app, `xdotool`, `vOn.ts`, collapsing off, a fresh session for each step: pass.** Arrays are [left, center, right].

**a. From the top, Alt held** (each start: `[[0,3688,903],[0,3688,903],[0,3628,903]]`, minimap shown before each press):

| row | `centredScrollTop` | first frame | after 2 frames | after 1 s |
|---|---|---|---|---|
| 101 | 1552.5 | [0,1552,0] | [1552,1552,1492] | [1552,1552,1492] |
| 106 | 1652.5 | [0,1652,0] | [1652,1652,1592] | [1652,1652,1592] |
| 111 | 1752.5 | [0,1752,0] | [1752,1752,1692] | [1752,1752,1692] |
| 116 | 1852.5 | [0,1852,0] | [1852,1852,1792] | [1852,1852,1792] |
| 151 | 2552.5 | [0,2552,0] | [2552,2552,2492] | [2552,2552,2492] |

**b. The other minimap moves, Alt held:**
- Row 151 from mid-file `[1405,1405,1345]`: first frame `[1405,2552,1345]`, after 2 frames `[2552,2552,2492]`, the same after 1 s.
- Slider drag of 100 px: `[1002,1002,942]`; 30 px more: `[1303,1303,1243]`.
- Three wheel clicks over the minimap: `[1600,1600,1540]`.
- Drag to the very end, as (scrollTop, max): `[[2785,2785],[2785,2785],[2725,2725]]` right after and 1 s later.

**c. Without Alt:**
- Native scrollbar thumb drag (an overlay scrollbar, `x` 1128) from the top to the end: every frame was recorded. Centre steps 204, 408, 613, 817, … up to 2785; the sides follow one frame later. The centre went back up 0 times.
- After release and 1 s later: `[[2785,2785],[2785,2785],[2725,2725]]`.
- Ten wheel-up clicks over the Result: smooth, steadily falling steps from `[2785,2785,2725]` to `[1795,1795,1735]`, with no jump back. It is the same 1 s later.

**d. Keyboard navigation** (golden `language-tools-script-setup`, `scriptSetup.ts`): one click in the left pane at the top, then Down:
- Down 1: `[1423,1463,1463]`. WebStorm's placement for line 87 is 1720 − 903/3 + 4 = 1423 ✓.
- Downs 2–3: unchanged; changes 2–3 were already in view.
- Down 4, to the conflict at left lines 363–374 (span `[7240,7480]`): `[6943,7048,7298]`. The expected left value is 6943 ✓; the other panes followed. The same 1 s later.
- Screenshot: `app-keyboard-conflict.png`.

**e. Focus and light theme** (`--settings '{"theme":"light"}'`, theme `light`):
- Before Alt: false. Alt held: true.
- `focus-away`: false. `focus-back`: false.
- `keyup alt` then `keydown alt`: true. Released: false.
- Screenshot `app-light-alt.png`: light panes, the minimap at the right edge over the right pane.

**5. Scroll timing: pass.** Private Xvfb `:92`, a scratch `HOME` (list view), a fresh clone of `vue-merge-yamt` with 7 conflicted files. Each cell is late frames out of 200, with the mean in ms. With Alt held, the minimap was shown before and after every scroll (`(True, True)` ×8).

| row | base `7141a81` | HEAD Alt up | HEAD Alt held |
|---|---|---|---|
| renderer 1 opened middle | 10 (16.6) | 8 (16.6) | 8 (16.6) |
| renderer 1 opened left | 13 (16.8) | 9 (16.6) | 7 (16.6) |
| renderer all opened middle | 17 (16.5) | 11 (16.5) | 12 (16.5) |
| renderer all opened left | 10 (16.6) | 12 (16.7) | 12 (16.7) |
| pnpm-lock 1 opened middle | 16 (16.7) | 15 (16.8) | 20 (16.7) |
| pnpm-lock 1 opened left | 11 (16.6) | 11 (16.5) | 12 (16.5) |
| pnpm-lock all opened middle | 25 (16.8) | 23 (16.6) | 22 (16.7) |
| pnpm-lock all opened left | 11 (16.6) | 11 (16.6) | **15** (16.6) |

- HEAD Alt up is within base + 3 on every row, which is the pass rule.
- HEAD Alt held is within base + 3 on every row except pnpm-lock all opened left (15 against 14). The brief's pass rule covers only Alt up, so this is reported, not failed.

Three interleaved repeats, renderer.ts all opened middle:

| repeat | base | HEAD Alt up | HEAD Alt held |
|---|---|---|---|
| 1 | 10 (16.4) | 8 (16.5) | 9 (16.5) |
| 2 | 7 (16.5) | **12** (16.5) | **18** (16.5) |
| 3 | 8 (16.5) | 8 (16.4) | 8 (16.5) |
| median | 8 | 8 | 9 |

In repeat 2, Alt up (12) is 2 frames over that repeat's own base + 3 (10). This is outside the pass rule, which is per row of the full table. The medians are equal, and spread between runs on this machine reached 8 frames before.

### Cleanup
- Stopped: the WebDriver session, `just webdriver` and the dev server (exit 143 from my kill), all `m-verify2-*` app sessions, tauri-driver and Xvfb `:92`.
- Still running: only the owner's `target/debug/yamt --repo /tmp/yamt-conflict-project` (pid 61860, untouched) and the editor language servers.
- `git status` is clean, and no `.omp/run/__pycache__` was created (`PYTHONDONTWRITEBYTECODE=1`).
- Rebuilding overwrote `target/debug/yamt` on disk; the owner's running process is not affected.
- Everything else (logs, scripts, screenshots, binaries, repos) is under `/tmp/yamt-m/verify2/`.