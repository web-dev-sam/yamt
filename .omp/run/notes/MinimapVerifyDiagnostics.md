**gate: pass. Overall result: fail.** Recipes 1, 2 and 4 pass and recipe 6 Alt up passes. These fail:
- **Recipe 3:** Playwright WebKit cannot launch on this machine.
- **Recipe 5b:** a real click on a far row, from the top of the file, scrolls to the wrong place.
- **Recipe 6, Alt held:** two rows go over the late-frame limit.
- **Recipe 4h, first half:** it could not run on the fixture page, so I ran it in the real app instead (passed there).

I fixed nothing and retried no failing step.

**Environment (VF5):** HEAD `f8da9db`, clean tree before the run. rustc 1.99.0 (b940084d7 2026-09-28), node v24.22.0, pnpm 12.0.0. MiniBrowser through WebKitWebDriver: its windows went to the Samsung screen (HDMI-A-1, `test-screen` placed them). Playwright WebKit: missing host libraries. The real app ran on a private Xvfb (`:2` for recipe 5, `:91` for recipe 6), device ratio 1. `target/debug/yamt` was rebuilt at HEAD with `cargo tauri build --debug --no-bundle`; the base binary was built at `7141a81` in a scratch clone under `/tmp/yamt-m/verify/base`.

```
gate: pass
failures:
  - step: "3 test:browser"
    excerpt: "Error: browserType.launch: … ║ Host system is missing dependencies to run browsers. ║ … sudo apt-get install libicu74 libxml2 libflite1 … [ELIFECYCLE] Command failed with exit code 1."
  - step: "5b real press on a far row from scrollTop 0"
    excerpt: "Alt held, xdotool click at box offsetY 301.5 (row 151, centredScrollTop 2552.5) from scrollTop 0 → scrollTops [1405,1405,1345]; reproduced twice. The same click from scrollTop 1405 → [2552,2552,2492] (correct). Sweep from 0, by screen y: 290 (row 101) → 1552 ✓; 300 (row 106, expected 1652.5) → [1645,1652,1592]: the left pane is not at the centre's value; 310 (row 111, expected 1752.5) → 1565; 320 (row 116, expected 1852.5) → 1465; 330/340/390/440 → 1405. Farther rows land higher, not lower. Values unchanged 1 s later."
  - step: "6 scroll timing, HEAD Alt held"
    excerpt: "renderer.ts all opened middle: 13 late frames vs base 8 (+3 allows 11); pnpm-lock.yaml all opened middle: 25 vs base 20 (+3 allows 23)."
```

### smoke

**1. `just check`, run once: pass.**
- Exit 0, wall time 29.8 s.
- nextest: `473 tests run: 473 passed, 1 skipped`.
- deny: `advisories ok, bans ok, licenses ok, sources ok`.
- web-test: `Test Files 108 passed (108)`, `Tests 1439 passed (1439)`.
- `arch-check: ok`, `map-check: ok`; golden: 10× `ok`; hooks-test: `pass 16, fail 0`.

**2. `just mutants 7141a81`: pass.**
- Exit 0. Rust: `mutants: no Rust changes since 7141a81`.
- StrykerJS on `ui/useMergeController.ts`: 69 killed, 14 survived, 1 error (the clear-text report does not list the errored mutant).
- The lines this feature changed are 47, 145–149, 157–158, 165, 185 and 193. No survivor is on any of them.
- The 14 survivors are exactly the known older ones (#582/#658): 79–83, 89 (twice), 104, 133–136, 190, 196. None needs a new finding.

**3. `pnpm -C frontend test:browser`: fail.** Playwright WebKit could not launch (excerpt above, exit 1), so the probe did not run. I re-ran it twice only to grep the first error lines; both re-runs failed the same way.

**4. WebKit fixture page: pass for a–g and the second half of h.**
Setup: dev server on 5277, `just webdriver 4447`, window 1600×1000, device ratio 2, `language-tools-script-setup.ts`.
- **a. Before Alt:** `displayed:false`, `canvas:[0,0]`, `hit:"cm-scroller"`.
- **b. The hold:**
  - Alt held: `boxRect [1458,88.5,1591,955]` against `rightRect [1172,88.5,1591,955]` → `right/top/bottom equal: true`, `panes unchanged: true`, canvas `[264,1734]`.
  - Alt up → hidden. Alt then `a` → hidden, with Alt still down. Fresh Alt → shown.
  - Window `blur` → hidden; a repeated keydown → still hidden; a fresh keydown → shown. These three were synthetic events.
- **c. Two files open, Alt held:** visible file `displayed:true, paintedPx 12390`; hidden file `displayed:false, canvas [0,0], paintedPx 0`.
- **d. Colours:**
  - Keyword row 35 `export`: glyph `[224,152,107,174]` against token `[224,152,107]`.
  - Wave row 1: `[86,83,98,255]` against `[86,83,98]`. Collapsed: 54 painted rows for 54 document rows.
  - Collapsing toggled with Alt held → `paintedRows 434` (620 document rows); toggled back → 54.
- **e. Right edge:**
  - Before: modified `[20,31]`, `[68,87]`, `[98,105]`, conflict `[140,195]`.
  - Apply icon clicked; the next frame shows modified `[60,79]`, `[90,97]`, conflict `[132,187]`, still shown.
- **f. Slider:**
  - scrollTop 3000: slider `{top:205.6,height:86}`, equal to `minimapLayout` (start row 48).
  - At the end (scrollTop 11501): rows 186–618, last text row 617 drawn at canvas row 432 = last painted row 432.
  - `tanstack-query-svelte-base-query.ts` (scrollable 0): `sliderHidden:true`.
  - WebDriver press: 2830 against 2830.5 (WebKit stores whole-pixel scrollTop). Drag: 3566, equal to `draggedScrollTop` 3566. The WebDriver wheel hides the minimap because it sends no `altKey` (known); the real wheel is in 5d.
- **g. Light theme:**
  - Keyword `[0,51,179,181]` against `[0,51,179]`; wave `[208,208,208,255]`; background `rgb(255,255,255)`.
  - `.change-marks` count 0; `window.__errors` (console error/warn, onerror and rejections, collected from page load) was `[]`.
  - Theme set back to Dark afterwards.
- **h. Deleted file and the end:**
  - The fixture list has no deleted-side file (11 text files, no `"deleted"` record), so the first half ran in the real app (5, `docs/removed.md`).
  - Long file at the very end with Alt held: slider rect `[868.2, 954.2]` inside the box `[88.5, 955]`.
- Screenshots: `/tmp/yamt-m/verify/window-dark.png`, `window-light.png`, `window-long.png` (mid-scroll at 5000).

**5. Real app, `xdotool` on `:2`: fail at b; everything else passed.**
Sessions `m-verify-long`, `m-verify-lsp`, `m-verify-light`; file `vOn.ts`, 184 rows, collapsing off.
- **a.** `keydown alt` → `shown:true`, box `[1458,88.5,1591,991]` at the window's right edge over the right pane. Screenshot `app-long-alt.png`. `keyup alt` → `shown:false`.
- **b.** Cursor `[[286,286]]`, focused pane 1, right selection `[[0,0]]`, DOM selection `""` and folds 0 were all unchanged, and nothing was applied. The scroll position is wrong from the top of the file (failure above). Row 101 from the top and row 151 from 1405 are correct.
- **c.** A 100 px drag gives 1002, my hand value of `draggedScrollTop` (100 / 0.09982 → 1002); `sliderActive` true during the drag, false after. A 30 px drag gives 1303 (expected 1303). `keyup alt` in the middle of the drag hides the minimap; mouse moves of +70 and +140 px leave it at 1303.
- **d.** Three wheel-down clicks over the minimap: 1303 → 1600; sides `[1600, 1540]`.
- **e.** Drag to the end: `[[2785,2785],[2785,2785],[2725,2725]]` (scrollTop, max) right after, and the same 1 s later.
- **f.** `py/api/stats.py` after Start; status ⓧ2 ⚠1.
  - Left edge: warning `[0,3]` (row 1) and error `[19,22]` (row 11).
  - Diagnostics: warning (ruff F401) and hint (basedpyright) on line 1; two errors on line 11.
  - No hint mark: the warning is drawn on row 1. Right edge: conflict `[13,16]` (row 8).
  - Not seen: an error and a warning on the same row, so "red over yellow" on one row was not observed.
  - Screenshot `app-lsp-alt.png`.
- **g.** Right-strip apply clicked with Alt held → the mark at `[29,32]` was gone on the next read: `[conflict [36,41], modified [172,175]]`; status "1 change · 1 conflict".
- **h.** `focus-away` → false; `focus-back` → false; `keyup` then `keydown` alt → true; `xdotool key Down` → false.
- **i.** Light theme (`--settings '{"theme":"light"}'`): `["light", true]`. Screenshot `app-light-alt.png`.
- **#1238 (from 4h):** I chose Delete on `docs/removed.md` and reopened it. The Result shows "Resolved by deleting the file." Alt held → no visible `.minimap` (1 editor). Screenshot `app-deleted-alt.png`.
- All three sessions were stopped (tauri-driver and Xvfb `stopped`).

**6. Scroll timing (late frames out of 200; mean in ms): fail for Alt held.**
- The file list is a tree in the owner's real config, so the first run failed with `find(...).click` undefined. tauri-driver was restarted with a scratch `HOME=/tmp/yamt-m/verify/home`, which gives the default list view.
- The wrapper `/tmp/yamt-m/verify/timing.py` runs `.omp/run/scroll-timing.py` unchanged. In the Alt-held run it sends `keyup` then `keydown` alt before each scroll; the minimap was shown before and after every scroll (`(True, True)` ×8).

| file / files opened / pane | base | HEAD Alt up | HEAD Alt held |
|---|---|---|---|
| renderer 1 opened middle | 6 (16.6) | 7 (16.6) | 7 (16.5) |
| renderer 1 opened left | 9 (16.7) | 7 (16.6) | 8 (16.7) |
| renderer all opened middle | 8 (16.5) | 11 (16.5) | **13** (16.5) ✗ |
| renderer all opened left | 11 (16.6) | 10 (16.7) | 11 (16.7) |
| pnpm-lock 1 opened middle | 15 (16.7) | 17 (16.7) | 17 (16.8) |
| pnpm-lock 1 opened left | 11 (16.6) | 11 (16.6) | 13 (16.6) |
| pnpm-lock all opened middle | 20 (16.7) | 19 (16.6) | **25** (16.8) ✗ |
| pnpm-lock all opened left | 11 (16.6) | 11 (16.6) | 12 (16.6) |

- HEAD Alt up is within base + 3 everywhere: **pass**.
- HEAD Alt held: **fail**, 2 of 8 rows over the limit.
- An earlier Alt-held run, whose minimap state is unknown (my probe read the wrong pane), gave 11, 9, 12, 8, 16, 12, 21, 12; it is not counted.

### Cleanup
- Stopped: the dev server on 5277, webdriver on 4447, all app sessions, tauri-driver and Xvfb `:91`. `pgrep` afterwards finds only the owner's `target/debug/yamt --repo /tmp/yamt-conflict-project` (pid 61860, untouched) and editor language servers.
- The rebuild overwrote `target/debug/yamt` on disk; the owner's running process is not affected.
- **One file left behind:** importing `scroll-timing.py` created `.omp/run/__pycache__/`, which now shows as untracked in `git status`. bash-guard blocked my `rm -r` of it, so it needs removing by you.