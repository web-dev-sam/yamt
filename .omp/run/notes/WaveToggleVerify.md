# WaveToggleVerify — 3.V final run (board "Unchanged lines, part 2" row 4)

Brief `docs/slices/briefs/3.V-verify.md`; HEAD `c6e369e`. Verbatim report below. Orchestrator rulings: step 5's selection case behaves as plan #68 and IntelliJ's `onFoldProcessingEnd` say — the head (line 86) is outside the hidden lines so it stays, and the selection is dropped because its anchor is inside; the brief's wording was loose (#873, dropped). Step 10's Delete is #869 again (#874): the cursor sat at the end of the hidden range, which looks the same as its start on the wave line; reported to the owner as an existing #63 quirk, not part of #64/#68. The `--x11` click offset at `GDK_SCALE=2` (#875) goes to the next retro with the helper.

---

The gate passed and the wave fix holds, but two behaviours from the brief don't match: Delete at the top wave line removes a line break, and a selection running from line 50 to line 86 leaves the cursor on line 86. A third, smaller gap: `GDK_SCALE=2` breaks the helper's `--x11` clicks. Nothing was edited or re-run to make it pass.

## gate: pass

`just check` ran once and exited 0. The last lines of each recipe:
- **fmt-check:** `All matched files use the correct format.`; `cargo fmt --all --check` was silent.
- **clippy:** `Finished dev profile`, no warnings.
- **test:** `Summary [1.943s] 377 tests run: 377 passed, 1 skipped`
- **deny:** `advisories ok, bans ok, licenses ok, sources ok`
- **bindings-check, fixtures-check:** both diffs were empty.
- **web-lint, web-typecheck:** both silent.
- **web-test:** `Test Files 70 passed (70)`, `Tests 799 passed (799)`
- **web-unused:** knip was silent.
- **arch-check, map-check:** `arch-check: ok`, `map-check: ok`
- **golden:** `ok …` for all 10 cases.
- **sfc-order:** silent.
- **hooks-test:** `ℹ tests 16 … pass 16 fail 0`

## failures: []

The gate had no failures. The findings below come from the real-app smoke.

## smoke

**`just mutants a040da6` — pass**
- `mutants: no Rust changes since a040da6`.
- Stryker covered 7 files and 577 mutants: score 95.61, 545 killed, 24 survived, 1 with no coverage, 1 error.
- Changed lines since `a040da6`:
  - `connectors/index.ts` 34–37, 39–73, 78–80
  - `collapsing.ts` 1–27
  - `store.ts` 16, 84–85, 117
  - `toolbarButtons.ts` 1, 4, 9, 49–55
  - `useMergeController.ts` 32–37, 107, 122–126, 141–144
- Survivors on changed lines are only the two already judged:
  - `connectors/index.ts:150` `y1 > y2` → `>=` (judged equivalent; this line is not in the diff)
  - `collapsing.ts:11` `STORAGE_KEY` → `""`
- Every other survivor is on lines this feature did not touch, so none is a finding here:
  - `store.ts` 179, 185, 276
  - `toolbarButtons.ts` 23, 26, 31
  - `useMergeController.ts` 67–71, 77, 85–88, 134
  - the no-coverage mutant at `useMergeController.ts:128`
- The error mutant has no clear-text entry, so I can't place it.

**Real app — setup**
- I built the debug app from HEAD with `cargo tauri build --debug --no-bundle`.
- I built `a040da6` from `git archive` in `/tmp/yv-base`, with its own target dir.
- Sessions ran through `app-session start-app --fresh-repo` on a private Xvfb (`:2`).
- Each session keeps its storage in a private HOME at `/tmp/yamt-app-session-<n>-*/home`: WebKit storage under `.local/share/dev.yamt.merge/localstorage`, settings under `.config/yamt/settings.json`. The owner's own storage was not touched.
- Crops are in `/tmp/yv/*-run*-*.png`. The before/after pair is `/tmp/yv/before-after-local_C.png`.

**Step 1: the wave meets the joins, scale 1 — pass**
The worst "meet" for any level join is ≤ 0.19 device px. The only larger value is the remote_R edge in runs 2 and 3 (0.86): those are S-curves, the pane side reads 0.00 and the join arrives from below, which is the S-curve rule.

| layout | L\|local | local\|C | C\|remote | remote\|R (run 0 / runs 2–3, S-curve) |
|---|---|---|---|---|
| 1600, list | 0.00 | 0.00 | 0.00–0.08 | 0.00 / 0.86 |
| 1600, hidden | 0.00 | 0.00 | 0.03 | 0.00 / 0.86 |
| 1237, hidden | 0.00 | 0.00 | 0.00–0.08 | 0.00 / 0.86 |
| 1237, list | 0.00 | 0.09–0.10 | 0.11–0.19 | 0.00 / 0.86 |

The `a040da6` build at 1600 with the list shown measures 4.17, 3.77, 4.09–4.16 and 3.77–4.63. The analyser reads the step as about 4 px, not the 3 px in the brief. In the crop pair the old join starts visibly above the pane wave; the new one continues it.

**Step 2: `GDK_SCALE=2` — pass, but the helper's clicks miss**
- The helper passes `GDK_SCALE` to the app because it inherits the environment: the page reports `[devicePixelRatio, innerWidth, innerHeight] = [2,1600,1000]`.
- Worst meet: 0.44 (1600, list), 0.44 (1600, hidden), 0.82 (1237, hidden), 0.53 (1237, list). All are under 1 device px.
- **Helper defect:** at scale 2, `click --x11` lands at half the right position. Clicking vOn.ts opened `docs/removed.md`. I opened the file with `xdotool` at doubled coordinates instead.

**Step 3: toolbar — pass**
- The buttons, in order: Mark resolved, Previous change, Next change, Collapse unchanged fragments (`aria-pressed=true`), then the two apply buttons. The toggle is third after the two arrows.
- The waves sit at 25|83 in local and the middle, 22|80 in remote.

**Step 4: clicks, second file, toggle off and on — pass**
- Two clicks on the middle wave gave 25|83 → 29|79 → 37|71.
- With App.vue open as the second file, toggling off gave `pressed:false`, 0 `.fold-wave`, 0 `[data-fold-run]` anywhere in the page, and continuous gutters in both files.
- Toggling on brought vOn.ts back to 25|83 / 22|80. App.vue's runs were the same as at open: 13|19, 43|55, 77|80 / 7|13, 33|45, 63|66 / 7|13, 35|47, 65|68.

**Step 5: cursor and selection — partial**
- Cursor case passes: with collapsing off, I clicked line 50 and toggled on. The cursor sat at the start of the wave line (cursorTop 394, wave at 393, left 750, no line number) and the run stayed hidden.
- **Selection case is a finding:** with a selection from line 50 to line 86, toggling on left only a cursor, but on line 86 where I had clicked (left 806). Plan #68 says the cursor moves to the start of the wave line before the selection is dropped.

**Step 6: first visible line across a toggle — pass**
- In App.vue the middle's first visible line was 6 at y=94 when off, on, and off again.
- The sides matched it at once: 15/8 when off; 20 when on, and 13 at y=114 under the wave.
- Earlier readings where the top line changed came from the collapsed document scrolling to its bottom limit (scrollTop 305 of 325), not from a fault.

**Step 7: undo after a toggle — pass**
I typed "ZQX", toggled on, then pressed Ctrl+Z. The text was gone and the waves were unchanged.

**Step 8: toolbar menu — pass**
- The menu has seven items: Previous change, Next change, Collapse unchanged fragments, Apply from the left, Apply from the right (all checked), Undo and Redo (unchecked).
- Hiding the toggle removed the button and the waves stayed (15 strips). Showing it again brought it back with `aria-pressed=true`.

**Step 9: stored choice across a restart — pass**
- The helper always starts with a new HOME, so I couldn't restart through it.
- Instead I ended the WebDriver session and started a new one on the same tauri-driver, which kept the same HOME, so the storage carried over.
- After the restart the toggle read `pressed:false` with 0 waves. Toggling on gave 25|83 / 22|80.

**Step 10: after a toggle — partial**
- Hover passes: hovering one wave gave `fold-wave-hover` on 3 pane waves and 2 strip waves.
- Find passes: Ctrl+F for `__SSR__` showed the hidden lines (middle 33|45 became 37|41) and reported "2 of 2".
- **Delete is a finding:** with the cursor on the top wave line of App.vue (no line number, line start), Delete joined the hidden line 12 to line 13, giving `window.addEventListener('resize', setVH)setVH()`. The run shrank from 7|13 to 7|12, later line numbers moved up by one, and no step was shown. Ctrl+Z restored the text.

**Step 11: theme colours — pass**
- Light: pane waves `rgb(208,208,208)`, strip `.strip-wave-line` stroke `rgb(208,208,208)`, which is #d0d0d0.
- Dark: both `rgb(85,85,85)`, which is #555555.

**Step 12: scroll timing — pass**
- Setup: vOn.ts at 1600×1000, every visible run expanded by clicking, 200 frames, three runs per build. A "late" frame is one longer than 25 ms.

| build | late | mean (ms) | p95 (ms) | max (ms) |
|---|---|---|---|---|
| HEAD | 0/0/0 | 16.5–16.7 | 17–18 | 18–20 |
| `a040da6` | 0/0/0 | 16.6–16.7 | 17–18 | 18–21 |

- Collapsed at the minimum window height of 600 there was only 45 px to scroll, and both builds had 0 late frames.
- With collapsing off on HEAD (3185 px to scroll) there were 6–7 late frames and a max of 42 ms. The old build can't turn collapsing off, so this has nothing to compare against.

## Environment
- rustc 1.99.0, node v24.21.0, pnpm 12.0.0
- WebKit via tauri-driver on Xvfb. No Samsung screen was used.
- All sessions are stopped.
- `git status` still shows `.omp/run/findings.jsonl` as modified, along with the other planning session's files. I didn't write any of them.

Checks for you: send the two findings (Delete on the wave line, selection 50→86) to the slice that owns the toggle, and the scale-2 `--x11` click offset to whoever owns `app-session`.