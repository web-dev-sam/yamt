The gate passes, but the final check fails overall. One scroll-timing scenario is slower at HEAD than at base by more than the brief allows. Mutation testing also left untested code on lines changed since `6c5f91a`. Every WebKit, real-app and browser-test check behaved as the brief describes.

**Environment:** rustc 1.99.0 (b940084d7 2026-09-28), node v24.22.0, pnpm 12.0.0. HEAD is `cf7ecff`, tree clean apart from `M .omp/run/slices.json`. Playwright WebKit only ran with `PLAYWRIGHT_BROWSERS_PATH=/tmp/h-pw` and `LD_LIBRARY_PATH=/tmp/h-pwlibs/root/usr/lib/x86_64-linux-gnu`. The WebKit fixture session ran through `just app-session start-fixture` (MiniBrowser). The real app ran on private Xvfb displays `:2` and `:91`. Screenshots are in `/tmp/yamt-qh/verify/`.

```
gate: pass

failures:
- step: scroll timing (recipe 6), "pnpm-lock.yaml | 1 opened | middle"
  excerpt: "late frames, base 6c5f91a: 18, 19, 20 (median 19); HEAD cf7ecff: 25, 21, 26 (median 25).
            The limit is base + 3 = 22, and the base spread is 18–20. Not rerun (VF2)."
- step: just mutants 6c5f91a, real gaps on changed lines (details in smoke 2)
  excerpt: "paneSplit.ts:43 `total / PANES` → `total * PANES` survived;
            useDropdownMenu.ts:51-54,117-121 (contextMenuElsewhere, #1292) and :73,:77 have no test;
            useMenuPlacement.ts:8-25 has no test (whole file);
            spec.ts:52 message → '' survived"
```

**smoke**

1. **`just check`** — pass. Exit 0 in 28.31 s; every recipe ran.
   - `cargo fmt` and clippy clean.
   - nextest: `Summary [   5.057s] 479 tests run: 479 passed, 1 skipped`.
   - `cargo deny`: warnings only.
   - web tests: `Test Files  116 passed (116)` / `Tests  1573 passed (1573)`.
   - `knip` clean, `arch-check: ok`, `map-check: ok`, golden `ok …` for all 10 cases.
   - `hooks-test`: `ℹ pass 16 ℹ fail 0`.

2. **`just mutants 6c5f91a`** — fail (gaps above).
   - Rust: `8 mutants tested in 59s: 8 unviable`. All 8 replace a function with `Ok(Default::default())` or `Builder::…`, which does not compile (`commands.rs:14`, `settings.rs:106/129/148`, `crates/settings/src/lib.rs:202`). No Rust survivors.
   - TS: `All files 78.29 | 93.54 | 2369 killed | 7 timeout | 164 survived | 495 no coverage`. I filtered these down to lines changed since `6c5f91a` (`git diff -U0`).
   - Real gaps, reported as findings:
     - `src/ui/paneSplit.ts:43` `Math.min(MIN_PANE_PX, total / PANES)` → `total * PANES` survived. This is the narrow-window boundary. It differs once the panes are under 660 px in total and the pair is uneven. Owner: PaneSplitModel.
     - `src/ui/useDropdownMenu.ts:51,53,54` (contextMenuElsewhere), `:117-121` (the `contextmenu` capture listener), `:73` (`?.focus()`), `:77` (the `items` array): no test reaches them. Smoke 4h shows the behaviour works in WebKit, but these are branches, not wiring. Owner: ServerGroupHeader (#1289–#1293).
     - `src/ui/useMenuPlacement.ts:8,10,16-25` (`belowLeft`, the placement computed): no test reaches the whole file.
     - `src/lsp/internal/spec.ts:52` `RangeError("a server key is never empty")` → `""` survived. Only the message text changes; listed rather than dropped because it is visible to the caller.
   - Dropped as equivalent:
     - `paneSplit.ts:62-63` `typeof local/remote === "number"` → `true` or swapped: any non-number from JSON still fails `local + remote <= 1 - MIN_SHARE`, because string concatenation gives NaN and `true + x` exceeds 0.95.
     - `serverPins.ts:44` and `serverSetup.ts:77` `root === null ? []` → `false`: a null root only looks up the key `"null"`, and repository roots are absolute paths.
     - `usePaneDividers.ts:44` `"remote"` → `""`: `dragged` only tests `=== "local"`.
     - `useColumnDrag.ts:67` `currentTarget instanceof Element` → `true`: the listener sits on an element, so `currentTarget` is always an Element.
   - Dropped as already judged in review:
     - Module-level constants: the `fixtureServers.ts` tree (lines 5-21), `serverText.ts` `GROUP_URGENCY`/`SERVERS`/`LANGUAGE_SERVERS`, the `paneSplit.ts` constants (21, 27, 29), `serverPins.ts:14` `STORAGE_KEY`, and `fixtureSettings.ts:16` `REPOSITORY` (#732; same class, not named in the brief).
     - `useColumnDrag.ts:111,134` `[false,false]`, and `:54` the `PointerEvent` guard.
     - `serverPins.ts:18`, the stored-shape check (#1282).
     - The thin app-session drivers: `args.ts:201`, `drive.ts:60-105`, `start.ts:52-73`, `app-session.ts:22`.
     - The `useDropdownMenu.ts:123-124` blur watch.
   - Dropped as wiring: `serverPins.ts:40`, the log event name `"servers.pins_storage_failed"`.

3. **`pnpm -C frontend test:browser`** — pass.
   - `Test Files  2 failed | 2 passed (4)`, `Tests  4 failed | 8 passed (12)`.
   - `strips.browser.test.ts` passes 3/3 ("a press on a band below its icon row…", "a press on an icon's hit area…", "a press on a wave join…").
   - The 4 failures are the older ones and also fail at `6c5f91a` (`Tests  4 failed | 5 passed (9)`). First error: `Error: Access denied to "/tmp/yamt-lsp-editor/problem-tooltip.png". See Vite config documentation for "server.fs"`. The three removals tests fail after it.
   - I ran the whole project twice, not once: the second run only pulled out the per-test lines. Both runs gave the same result.

4. **WebKit, fixture page** (1600×1000 window, 1600×964 page) — pass.
   - **4a dots.**
     - Dark tokens are `#565362` / `#aba9b6`. All three handles have 3 dots, each `rgb(86, 83, 98) 3x3`, centred at 0.00, cursor `col-resize`.
     - Hover is still `rgb(86, 83, 98)` at 100 ms and `rgb(171, 169, 182)` at 500 ms, then back after leaving.
     - While an icon is held and dragged for 600 ms across the strip, the dot stays `rgb(86, 83, 98)` and `body` cursor is `auto`.
     - Light tokens are `#aeb3c2` / `#767a8a`, dots `rgb(174, 179, 194)`.
     - Screenshots: `4a-dots-dark.png`, `4a-dots-light.png`.
   - **4b divider drag.**
     - `drag "Local and Result widths" --dx 120`: pane widths 418.984/419.016/419 → 538.984/299.016/418.984. Remote moved 1/64 px.
     - Right strip's empty part, dx −60: 538.984 (unchanged) / 239.016 / 479.
     - Strips stay `[40, 40]`. Band paths unchanged (`775:712441992`, `536:-1253358175`).
     - Locked scroll `[60, 140, 140]` is the same before and after.
     - The zoomed crops `4b-zoom-L.png` and `4b-zoom-R.png` show the waves joining unbroken. Full view: `4b-after-drag.png`.
   - **4c presses that are not drags.**
     - `drag ".chunk-action-apply rect" --dx 0 --nth 0`: apply icons go from 5 to 4.
     - A vertical drag over icons: 5 → 3.
     - A wave click opened lines: the waves below moved 232.5→312.5 and 552.5→712.5.
     - A double-click on an apply icon applied it (4→3), and the split stayed `{"local":0.40491994828957834,"remote":0.3333333333333333}`.
     - `click "Local and Result widths" --double` gives split 1/3, 1/3 and widths `[418.98, 419.02, 419]`.
     - My first `drag`/`click` attempts errored because several elements matched; that was my invocation, fixed with `--nth`.
   - **4d minimum and narrow windows.**
     - Drag −2000 gives Local 220 (`[220, 618, 419]`). WebDriver refuses points outside the page (`move target out of bounds`), so the pointer was clamped at x=1.
     - At 1100: `[302.125, 220, 234.875]`, so the minimum applies and the ratio of the other two is kept.
     - At 1000: `[219, 219, 219]` (equal, since 657/3 < 220).
     - At 700: `[119, 119, 119]`.
     - Back at 1600 the split is restored.
   - **4e same split everywhere.**
     - Another file (vite-modulepreload-polyfill.ts): `[220, 618, 419]`. After reload: the same.
     - Garbage `{"local":"x",oops` or `{"local":0.9,"remote":0.5}` → `[418.98, 419.02, 419]`.
     - The fixture has no binary or deleted-side file; those views are covered in 5c.
   - **4f file list.** Drag +100 → 340 and `yamt.files.width:"340"`. Reload → 340. Double-click → 240 and the key is removed. Drag −200 → 160, +1200 → 800. CSS is `min-width: 160px; max-width: 50vw`.
   - **4g keyboard and selection during a drag.**
     - Before, held and after: `activeElement` stays `cm-content|1`, the DOM selection stays `#text:0-13`, and the selection boxes only move by +80 px.
     - While held: `body` cursor `col-resize`, html class `col-resizing`. Released: `auto`.
     - With Alt held, the minimap is `block` at x 1458–1591, the right pane's right edge (1591). That is the Remote pane, which hosts the minimap per `editor/AGENTS.md`, not the Result as the brief words it.
     - Ctrl+F bar runs 808.97–1116 inside its pane (792.97–1132). Screenshot `4g-find.png`.
   - **4h `?servers`.**
     - The question lists "oxlint, TypeScript, Vue (not installed), eslint (not installed) — the repository root" (`4h-question.png`). Then "Don't start".
     - The header shows only the group button (aria-label "Language servers", text `Servers`, `aria-haspopup=menu`).
     - The list has 4 rows and 4 `menuitemcheckbox` pins.
     - Pinning eslint, then TypeScript, gives `TypeScript@1305, eslint@1399, Language servers@1462` (list order), and the menu stays open (`4h-pins-open-dark.png` / `-light.png`).
     - Escape puts focus on "Language servers". Enter focuses `oxlint|menuitem`. Down goes Pin oxlint → TypeScript → Pin TypeScript. Space unpins TypeScript. Enter on the Vue row opens `Copy, Show log` with focus on Copy. Escape returns to "Language servers".
     - Right-click on the toolbar with the list open shows only one menu: `Abort merge, Previous change, …, Undo, Redo`.
     - Blur, done by opening a second WebDriver window because fixture sessions have no `focus-away`: the list closes.
     - Reload keeps `["eslint (repository root)", "Vue (repository root)"]`, and after "Don't start" the header shows `Vue, eslint, Language servers`.
   - **4i Settings.**
     - Four switches, all `"true"`. `click "TypeScript" --role switch` gives `"false"` right after and 500 ms later; its label turns muted `rgb(129, 126, 141)` against `rgb(214, 212, 221)`. Screenshot `4i-settings-ts-off.png`.
     - The header list shows `oxlint, Vue, eslint`. Switching TypeScript again gives `"true"`.
     - With all four off, the header shows only `Mark resolved | 3 changes · 1 conflict` and the Settings button, with no status area (`4i-all-off-header.png`).

5. **Real app** — pass. `cargo tauri build --debug --no-bundle` built `target/debug/yamt`. Display `:2`.
   - **5a.** The servers came from `--servers` with PATH `~/.cache/yamt/servers-path`.
     - The question lists 7 projects (`5a-question.png`). Start.
     - Header: `1 conflict | 1 | 0 | Servers`. The list shows 11 servers with state dots; Biome is running and the rest are waiting (`5a-list.png`).
     - Pinned ruff and oxlint. ruff's menu shows `Stop, Restart, Show log`. Stop → `pgrep` empty, title "Stopped", menu `Start, Show log`. Start → `ruff server` pid 879870. Show log → "ruff log" with the start, stop and second start (`5a-ruff-log.png`).
     - In `py/api/stats.py`, ruff's warning underline is on `os`. Settings → ruff off: `ruff=false`, `pgrep -af 'ruff server'` exit 1, and `os` keeps only basedpyright's `cm-lintRange-hint` ("Import "os" is not accessed / basedpyright reportUnusedImport", no underline). ruff is gone from the header and the list.
     - Stop, then start again with the same `--repo` and `--home`: no question; header shows `oxlint, Language servers`; file list 300; split `{"local":0.41686…}` with widths `[498.98, 299.02, 399]`. With the py file open for 10 s, ruff's `pgrep` exit is 1 while ty and basedpyright run.
     - ruff on → `ruff server` pid 884254, and the header shows `ruff, oxlint` again.
   - **5b.** With oxfmt switched off: abort, `web/` copied to `web2/` on both branches, merged again (12 conflicted files).
     - Header: `ruff, oxlint (web), Language servers`. The pin `oxlint (web)=true`.
     - The list has no `oxfmt (web)` but does have `oxfmt (web2)` (`5b-web2-list.png`).
   - **5c.** `conflict-repo.sh /tmp/yamt-qh/verify/plain` with oxlint and taplo hand-added.
     - Question: "oxlint, taplo — added by you". Start, pin oxlint.
     - The `assets/logo.bin` choice view and the `docs/removed.md` deleted-side view both show the header `oxlint@1400, Language servers@1463`.
     - Dragging the choice view's gutter +100 changes grids to `547.66px 1px 347.66px 1px 447.67px` and `512.58px 40px 325.41px 40px 419px`. Split is `{"local":0.40779,…}`. `src/added.ts` follows.
     - Screenshots `5c-choice-{dark,light}.png`, `5c-deleted-{dark,light}.png`.
   - **5d.** Real pointer with `xdotool`, window "plain — yamt" at 0,0.
     - Double-click on the divider gives equal panes. Drag +150 gives `[568.98, 269.02, 419]`; the Remote pane is unchanged.
     - File list dragged to 340, then double-clicked → 240.
     - Light theme set via Settings: dots `rgb(174, 179, 194)`. Screenshots `5d-app-dark.png`, `5d-app-light.png`.
   - All sessions stopped (`"session":"ended"`). No yamt, tauri-driver, Xvfb or ruff process is left. `~/.config/yamt/settings.json` mtime is 2026-10-17 08:44, so it was untouched.

6. **Scroll timing** — fail on one scenario. Late frames (over 20 ms, of 200), interleaved base / HEAD × 3:

   | file | files opened | pane | base (6c5f91a) | median | HEAD (cf7ecff) | median | within limit |
   |---|---|---|---|---|---|---|---|
   | renderer.ts | 1 opened | middle | 6, 10, 12 | 10 | 7, 8, 10 | 8 | yes |
   | renderer.ts | 1 opened | left | 9, 7, 8 | 8 | 7, 7, 13 | 7 | yes |
   | renderer.ts | all opened | middle | 13, 11, 13 | 13 | 13, 14, 10 | 13 | yes |
   | renderer.ts | all opened | left | 9, 9, 11 | 9 | 12, 14, 10 | 12 | yes (= base + 3) |
   | pnpm-lock.yaml | 1 opened | middle | 18, 19, 20 | 19 | 25, 21, 26 | 25 | **no (limit 22)** |
   | pnpm-lock.yaml | 1 opened | left | 11, 11, 11 | 11 | 11, 11, 11 | 11 | yes |
   | pnpm-lock.yaml | all opened | middle | 25, 26, 20 | 25 | 26, 24, 30 | 26 | yes (within base spread) |
   | pnpm-lock.yaml | all opened | left | 11, 11, 11 | 11 | 11, 11, 11 | 11 | yes |

   - Setup: base built in a scratch clone (`/tmp/yamt-qh/verify/base`). Private `Xvfb :91` with tauri-driver on 4764 and `HOME=/tmp/yamt-qh/verify/home-st`. The `~/yamt-trial/vue-merge-yamt` vapor ← minor merge was cloned to `/tmp/yamt-qh/verify/vue` (7 conflicted files).

**Notes:**
- The failing browser-test run left an untracked `frontend/.vitest/` folder of failure screenshots in the main checkout. I did not remove it.
- Scratch helpers I wrote are in `/tmp/yamt-qh/verify/` (`wd.py`, `run.py`, `lib.js`, `filter.py`, probe files).