# AltMarksEditorR1 — fix round 1 output (3.O-editor)

All seven findings are fixed (#1204–#1208, #1210, #1211), and all three acceptance items were observed. Two things to know first:
- **Side jump to a far change:** clicking the left conflict tick (it needs scrolling to 781) ends with the pane at 261 and no outline. 502e997 does exactly the same in this browser, so this is not new, and it doesn't match round 1's result (781, outlined).
- **Wheel and Alt:** the driver's wheel events report Alt as up, so the separate Alt-hold code hides the ticks right after each driven wheel.

**summary**
- **#1204:** `Frame` now takes a `jump` callback built by the controller, which calls `jumpTo` with its own views, spans and focus. `Frame` no longer imports `SideFocus` or `markJump`. `editor/index.ts` is 295 lines.
- **#1205:** the 4 px pick distance is one exported constant, `PICK_DISTANCE_PX`. Each lane passes it to the CSS as `--mark-pick`, and the tick's hit band uses `inset: calc(-1 * var(--mark-pick)) 0`.
- **#1210:** a Result tick click now selects the whole line first, then puts the cursor at the problem's start (`revealSteps` in `markJump.ts`). This also shows the hidden lines for a zero-length problem at the end of the last hidden line.
- **#1211:** each lane has a passive `wheel` listener that scrolls its pane's `scrollDOM`. Line-mode deltas are multiplied by `LINE_HEIGHT_PX` and page-mode deltas by the pane height.
- **#1206 / #1207 / #1208:** one pane→side table, `PANE_TINT` in `geometry.ts`, used by `marks.ts` and `markJump.ts`. `Frame.changed` stores `marksDirty` in a `const` before the condition. The strip bands use `paneTone`.

**files_changed**
- `frontend/src/editor/index.ts`
- `frontend/src/editor/AGENTS.md`
- `frontend/src/editor/theme.css`
- `frontend/src/editor/internal/frame.ts`
- `frontend/src/editor/internal/geometry.ts`
- `frontend/src/editor/internal/gap.ts`
- `frontend/src/editor/internal/markJump.ts`
- `frontend/src/editor/internal/markLanes.ts`
- `frontend/src/editor/internal/marks.ts`
- `frontend/src/editor/internal/folds.test.ts`

**tests_added**
- `folds.test.ts` "a problem tick's jump to a zero-length problem at a hidden range's first or last position shows it with the cursor there". It runs `revealSteps` as two separate transactions on the middle's fold state, with no DOM. The first hidden level shows (`["41-62","49-54"]` left), and the cursor ends at the problem's position. Both the range's first and last positions are checked.

**smoke_evidence**

1. **Node tests, failing path first.**
   - With `revealSteps` set back to 502e997's rule (cursor at line end, then start), the new test failed:
     `AssertionError: 518: expected [ '37-66', '41-62', '49-54' ] to deeply equal [ '41-62', '49-54' ]`
   - After restoring the fix: `pnpm -C frontend test` → `Test Files 103 passed (103)`, `Tests 1387 passed (1387)`.

2. **Frontend recipes, all exit 0.**
   - `lint`: `$ oxlint --type-aware && eslint --max-warnings 0 "src/**/*.vue"`, exit 0
   - `typecheck`: `$ vue-tsc -b`, exit 0
   - `test`: as above, exit 0
   - `unused`: `$ knip --include exports,types`, exit 0
   - `fmt:check`: "All matched files use the correct format.", exit 0 (run again after the AGENTS.md edit)
   - `just sfc-order`: `$ tsx scripts/check-sfc-order.ts`, exit 0

3. **WebKit fixture page** (dev server on port 5291, `just webdriver 4446` on the Samsung screen, file `vueuse-use-magic-keys.ts`, Alt held with a WebDriver `keyDown`).
   - **Ticks:** the same three lanes as round 1 (left 6, Result 9, right 4).
   - **Hit band:** each lane has `--mark-pick` = `"4px"`. The first tick's `::before` computes to `top "-4px"`, `bottom "-4px"`, `left "0px"`, `right "0px"` in all three panes.
   - **Wheel, real driver gesture:** `elementFromPoint(666,117)` → `"change-mark change-mark-modified"`. A WebDriver wheel `deltaY 300` there reached the lane (`[0,300,0,false]`: pane 0, delta 300, pixel mode, altKey false). The panes went 0,0,0 → **300, 300, 320**, and were still there a second later.
   - **Wheel, with the ticks still shown:** a timer-dispatched `WheelEvent` with Alt down, `deltaY 5` in line mode, on a Result tick (hit `change-mark change-mark-modified`). Panes went `[400,400,600]` → `[500,500,700]`: 5 lines × 20 px in the Result, the others followed. Lanes stayed shown. Screenshot `/tmp/yamt-b-ws/r1-wheel-shown.png`.
   - **Result tick click (chunk 6):** Result focused, cursor on line 110, 291 px down the pane. Same as round 1. 502e997 gives line 110 at 290 px.
   - **Side tick click (left change 3):** left focused, `outlined: ["   * @see https://developer.mo"]`, no selection, all panes at 155.
   - **Side tick click (left conflict):** the jump writes 781, then a scroll event sets it to 261, with no outline. A plain `scrollTop = 781` from a timer, with no click, also ends at 261. Served from a `git archive 502e997` copy, the same click gives the same trace (`after click 781` → `scroll event 261`).

   **Real app**: session `b-marks-r1`, repository from `scripts/lsp-repo.sh --servers /tmp/yamt-b-ws/lsp-r1`, started with `PATH=~/.cache/yamt/servers-path:…`.
   - **Setup:** rust-analyzer could not load the project inside the session's private home ("rustup could not choose a version of cargo"). I restarted with `RUSTUP_HOME`/`CARGO_HOME` pointing at the real ones.
   - **Seeded problem:** the server I used is rust-analyzer. In the scratch copy of `rs/core/src/lib.rs` I made the last line `pub const MAX: i32 = 3` with no final newline, so it is the last collapsed line. I also fixed `add(n)` → `add(n, n)` so only this one problem is left.
   - **Alt held** (`xdotool keydown alt`): Result ticks `conflict at 1125,146` and `error at 1125,246` (the error sits on the wave line).
   - **`xdotool mousemove 1125 246 click 1`:** `waves: 0` (the lines show), Result focused, active line 11 `pub const MAX: i32 = 3`, empty selection. The cursor's left edge is at x 918, the line text ends at 919, and the `cm-lintPoint-error` starts at 919, so the cursor is on the problem. Hover text: "Syntax Error: expected SEMICOLON rust-analyzer syntax-error". Screenshot `/tmp/yamt-b-ws/r1-app-problem-click.png`.
   - **`keyup alt`:** lanes `[true,true,true]` (hidden).

   **Stopped:** the app (`{"stopped":"b-marks-r1", … tauri-driver stopped, xvfb stopped, folder removed}`), the WebDriver session, `b-marks-r1-webdriver`, `b-marks-r1-vite` and `b-marks-r1-vite-r0`. `pgrep` shows only processes I did not start: VS Code's rust-analyzer and a `target/debug/yamt --repo /tmp/yamt-conflict-project` from before.

**deviations_from_brief**
- **`PANE_TINT` type:** it is declared `as const satisfies Readonly<Record<Pane, Side | "center">>`, so `PANE_TINT[pane]` comes out as `Side` in `markJump.ts` once `pane` is narrowed to a side pane.
- **Where the reveal lives:** the two selections are in an exported `revealSteps(doc, start)` in `markJump.ts`, so the test can run them on the fold state without a DOM. I dropped the old WebStorm comment, because the line-end-first order it described is gone.
- **Test location:** the #1210 test is in `folds.test.ts`, where the fold-state test setup already lives.
- **`editor/AGENTS.md`:** I rewrote the change-marks paragraph for the new `jump` part, the wheel forwarding, `--mark-pick` and `revealSteps`.
- **Doc outside my ownership:** `docs/architecture.md:624-626` still says "a Result place by moving the cursor through the line's end to its start (`foldField` shows hidden lines)". Suggested replacement: "a Result place by selecting its whole line, then putting the cursor at its start (`revealSteps`: `foldField` shows hidden lines holding a non-empty selection, also for a zero-length problem at their end)". It could also say `Frame` gets the jump as a `jump` part built by the controller.
- **Scratch:** `/tmp/yamt-b-ws/r0` (the 502e997 copy, with `node_modules` symlinked to this tree's) and `/tmp/yamt-b-ws/lsp-r1` are left in place.

**open_risks**
- **Empty last line (`frontend/src/editor/internal/markJump.ts:51-54`):** if the last hidden line is empty (`line.from === line.to`), the first step is an empty selection at the range's end, so the lines stay hidden. The usual case is a file's trailing newline at the end of a collapsed tail. Only a problem placed on that empty line would hit this.
- **Side jumps to far changes:** in MiniBrowser a programmatic `scrollTop = 781` from 0 on the left pane settles at 261, with or without a click, and 502e997 does the same. So I could not observe a far side jump with its outline on the fixture page.
- **Wheel over the lane (`frontend/src/editor/internal/markLanes.ts:90-97`):** the forwarding ignores Ctrl/Cmd+wheel and does nothing special for it. A pinch zoom or Ctrl+wheel over a tick scrolls instead.
- **Wheel and the Alt-hold code:** this only matters where a wheel event reports Alt up (the WebDriver case). A real mouse wheel while Alt is physically held was not tried.

Checks for you to run: `just check`, `just mutants 090debf` (only `editor/` changed, which is not mutated), and the `docs/architecture.md` line above.