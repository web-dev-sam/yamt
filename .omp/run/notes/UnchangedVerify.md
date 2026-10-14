# UnchangedVerify — 3.U final run (board "Unchanged lines" row 4)

Brief `docs/slices/briefs/3.U-verify.md`; HEAD `fb4b30c`. Verbatim verifier report below.

Orchestrator rulings: step 1 — the right pane's lower waves sit 60 px higher below a one-sided deletion and the right strip's joins are S-curves; this is plan #63's rule (`drawConnectorLine`: a wave when level, an S-curve when not) and the existing linear scroll sync (architecture §6), not a defect; the board's acceptance wording 'same height in all three panes' was too strict and is corrected. Step 9 — vacuous on a 4-line file; the rule is pinned by `gap.test.ts` 'an empty side gets no joins on its strip while the other strip keeps them'.

---

The gate passes. `just mutants 72e68d1` left one TypeScript survivor, and it is equivalent. I ran all eleven real-app steps; two need your judgment. In step 1 the right pane's lower waves sit 60 px higher than in the other panes. Step 9 couldn't be tested in a meaningful way.

**gate: pass** · **failures: []**

### `just check` (one run, EXIT=0)
- **fmt-check:** `All matched files use the correct format. Finished in 525ms on 202 files`; `cargo fmt --all --check` was silent.
- **clippy:** `Finished dev profile … in 0.24s`, no warnings.
- **test:** `Summary [1.967s] 377 tests run: 377 passed, 1 skipped`
- **deny:** `advisories ok, bans ok, licenses ok, sources ok`. It printed warnings only: duplicate `thiserror` and `thiserror-impl` versions, and `proc-macro-error` unmaintained (RUSTSEC-2024-0370).
- **bindings-check, fixtures-check:** both diffs were silent.
- **web-lint, web-typecheck:** silent.
- **web-test:** `Test Files 66 passed (66)`, `Tests 743 passed (743)`
- **web-unused** (knip): silent.
- **arch-check, map-check:** `arch-check: ok`, `map-check: ok`
- **golden:** all 10 cases `ok`, from `language-tools-script-setup` to `vueuse-use-magic-keys`.
- **sfc-order:** silent.
- **hooks-test:** `tests 16 pass 16 fail 0`

### `just mutants 72e68d1` (EXIT=0)
- No Rust changed (`mutants: no Rust changes since 72e68d1`).
- Stryker mutated `connectors/index.ts`: 178 mutants, 173 killed, 1 survived, score 99.43.
- **Survivor:** `src/connectors/index.ts:112 if (y1 > y2) → if (y1 >= y2)`. **(a) equivalent.** `slopedJoin` is only called when `|right−left|/width ≥ 0.2` (line 144). For any width > 0 that means y1 ≠ y2, so `>` and `>=` behave the same. This matches the earlier ruling in `UnchangedStrips.survivors.txt`.

### Real app (smoke)
I built with `cargo tauri build --debug --no-bundle` from HEAD `fb4b30c`. The session ran through `app-session start-app --name uv --fresh-repo` on private display `:2`. The helper keeps its storage in `/tmp/yamt-app-session-uv-mJZugy/` (`home/.config`, `repo`, `logs`), so your own storage was not touched. I used real X input only. Screenshots are in `/tmp/uv/`.

| # | observed | pass |
|---|---|---|
| 1 | vOn.ts shows three waves per pane, for the 15-, 65- and 95-line runs (the 2-line run has none). The wave rows have no line number, and the first number after the top wave is 12 in all panes. Left and middle waves sit at y 94/394/614; the right pane's are at 94/334/554. The right pane has 3 fewer lines above, because its side deletes the conflict lines. The left strip joins are level (y 100–106, 400–406, 620–626). The right strip's first join is level and its other two are S-curves (343–404, 563–624). Screenshot `1-von.png`. | **partial:** the brief asks for the same screen row in all three; true for the top wave only |
| 2 | Pointer on the middle's wave of the 65-line run: 5 elements get `fold-wave-hover`, all `data-fold-run=2` (3 panes and 2 strips). Strip stroke widths go from 1px to 2px on that run only, and the cursor is `pointer`. Pointer off: 0 elements, all strips back to 1px. Screenshot `2-hover.png`. | pass |
| 3 | I clicked the left conflict (`chunk-focus` ×3, focus in pane 0). Line numbers around the run's wave, left/middle and right: before 25\|83 and 22\|80. After the middle-wave click: 29\|79 and 26\|76. After the left strip join: 37\|71 and 34\|68. After the right pane's wave: 12..92 and 12..89 with no wave, so the run is fully shown. Focus stayed in pane 0 and the outline stayed (3 lines) throughout. Screenshot `3-expanded.png`. | pass |
| 4 | Down on the left changed nothing, since the conflict is the left side's only change. Enter applied it: the middle now reads `export const fnExpRE: RegExp =`, and focus moved to the right pane. Ctrl+Z brought back `const fnExpRE =`. Wave counts were [2,2,2] the whole time. | pass |
| 5 | Ctrl+F in the middle, searched `compileScript` (only at base line 108, inside the 95-line run). The match is selected and shown; no waves remain in any pane. Gutters read 60..155 / 60..156 / 57..152. Line 120 sits at y 785 in left and middle, and the right's matching line 117 is also at 785, so the panes stay row-aligned. Screenshot `5-find.png`. | pass |
| 6 | Each step on a wave removed no text and showed that run's next step. Delete at position 0: 12 → 8. Ctrl+Shift+K on the top wave (after a Reset): 12 → 8. Ctrl+X on the top wave: 8 → fully shown. Backspace at the end of the 65-line run's wave: 25\|83 → 29\|79. Line 92 stayed numbered 92 through all of these. On a visible line, one Ctrl+X moved line 92 to 91, so exactly one line went; Ctrl+Z put it back at 92. | pass |
| 7 | Saved stages 1–3 first (base 183 lines). Applied all from the left, then from the right, then » on the conflict ("All changes processed"), then Mark resolved. `git ls-files -u` no longer lists the file. The written file is 183 lines. Lines 30–78 (the 65-line run, still hidden) and 93–183 (the 95-line run, still hidden) are byte-identical to the base. The only differences are lines 16, 19 and 87–88, which are the decided changes. | pass |
| 8 | PersistQueryClientProvider.tsx shows waves for runs 2 and 4 only (the 18- and 7-line runs). Gutters read 1..15 ~ 26..55 ~ / 1..15 ~ 26..52 ~ / 1..18 ~ 29..53 ~. The right pane is again offset, with S-curve joins. Screenshot `8-persist.png`. | pass |
| 9 | docs/removed.md: the right pane shows "Deleted in this branch." with a Delete button; the file is 4 lines, so it has no foldable run and no joins. The app log has only `INFO frontend: event="file.loaded"` lines, with no ERROR or WARN from the frontend. | **vacuous:** a 4-line file can't test the join rule, and the helper has no console capture beyond this log |
| 10 | Pane `.fold-wave` background and strip stroke: Dark `rgb(85, 85, 85)` = #555555; Light `rgb(208, 208, 208)` = #d0d0d0 (`10-light.png`); Dark again `rgb(85, 85, 85)`. | pass |
| 11 | Ran `.omp/run/scroll-timing.py` on private Xvfb `:93`, middle pane, frames over 20 ms out of 200, 3 rounds alternating between the base and HEAD builds. **Base `72e68d1`**: 1 opened 9/13/16, all opened 18/12/8 late; p95 19–23 ms, max 35–43 ms. **HEAD**: 0/0/0 late in both scenarios; p95 17 ms, max 17–18 ms. Mean is 16.1–16.8 ms for both. This is not like-for-like: at HEAD the collapsed middle is much shorter, so the scroll reaches the bottom sooner. | pass (no worse) |

### What needs your call
- **Step 1, same row:** the acceptance in `SLICES.md` says "one wave line at the same height in all three panes". Here the panes match at the top wave and at the scroll anchor, but below a one-sided deletion the right pane's waves sit 60 px higher and the strip joins become S-curves. `architecture.md` (lines 790–794) says a pane "stretches linearly, as unequal runs always did", so this may be the intended design rather than a defect.
- **Step 9:** checking "no join beside the hidden side" would need a deleted-side file long enough to have runs.

### Environment
- rustc 1.99.0 (b940084d7 2026-09-28), node v24.21.0, pnpm 12.0.0.
- WebKitGTK through tauri-driver on Xvfb. The driver log shows `MESA-EGL: DRI3 error`, so rendering was software.
- I didn't run `pnpm test:browser`; the brief doesn't list it.
- The ownership hook blocked two `read` calls whose JavaScript contained `>` (it took it for a redirect); I rewrote them as `0<…`.
- I removed the base tree, the timing repository, the copied binaries and my `target/uv-base` build directory. `git status` is clean. The app session, driver and both displays are stopped.