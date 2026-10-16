# AltMarksEditorR2 — fix round 2 output (3.O-editor)

Fixed #1215: clicking a Result tick at the very end of a file that ends with a line break now shows the collapsed tail and puts the cursor on the problem. The brief's three acceptance items were all observed: the tests fail on `3615586`'s rule and pass now, the frontend recipes all exit 0, and the real-app check passed.

**summary**
- `revealSteps(state, folds, start)` in `markJump.ts` first selects the innermost hidden middle range that holds `start`, counting both ends. It reads the ranges from `paneFolds(folds, "center", state)`. Then it puts the cursor at `start`. If no hidden range holds `start`, it only places the cursor.
- The selection is never empty, so `foldField` shows the range even when the problem's line is empty at its edge: a file's end after the last line break, or an empty first hidden line.
- To get there, `JumpParts` now carries `folds: FoldFields`, and the controller passes `this.#folds.fields`.

**files_changed**
- `frontend/src/editor/internal/markJump.ts`
- `frontend/src/editor/index.ts`
- `frontend/src/editor/internal/folds.test.ts`
- `frontend/src/editor/AGENTS.md`

**tests_added** (in `folds.test.ts`; each step runs as its own `state.update`, like `jumpInResult`'s two dispatches)
- "a problem tick's jump to the end of a file ending with a line break shows the collapsed tail": `twoChanges`' run 2 (lines 76–101, line 101 empty, level 0 ends at `doc.length`). After the jump at `doc.length` nothing in run 2 is hidden, and the cursor is at `doc.length`.
- "a problem tick's jump to an empty first hidden line shows the range holding it": the test empties run 1 level 0's first line (line 37). After the jump at its `from`, `["41-62","49-54"]` are still hidden and the cursor is at `from`.
- The round-1 case now calls the new signature through a shared `jumpAt` helper. It stays green.

**smoke_evidence**
1. **Failing path on `3615586`'s rule.** I put the old line-select body back in `revealSteps` for one run, then restored the fix:
   - `AssertionError: expected [ '76-101', '80-101', '88-101' ] to deeply equal []` (end of file)
   - `AssertionError: expected [ '37-66', '41-62', '49-54' ] to deeply equal [ '41-62', '49-54' ]` (empty first line)
   - `Tests  2 failed | 30 passed (32)`
   - With the fix restored: `Tests  32 passed (32)`.
2. **Frontend recipes**, all exit 0:
   - `pnpm -C frontend lint`: `$ oxlint --type-aware && eslint --max-warnings 0 "src/**/*.vue"`
   - `typecheck`: `$ vue-tsc -b`
   - `test`: `Test Files  103 passed (103)`, `Tests  1389 passed (1389)`
   - `unused`: `$ knip --include exports,types`
   - `fmt:check`: `All matched files use the correct format.`
   - `just sfc-order`: `$ tsx scripts/check-sfc-order.ts`
3. **Real app**, session `b-marks-r2`: `cargo tauri build --debug --no-bundle`, then `scripts/lsp-repo.sh --servers /tmp/yamt-b-ws/lsp-r2`, started with `PATH=~/.cache/yamt/servers-path:$PATH`, servers started with "Start".
   - **Setup:** in the scratch repo's `web/src/math.ts` I replaced the last line with `export function unclosed(): void {`. The file still ends with `{\n`.
   - **Before the click:** the Result's tail is collapsed after line 9 (wave visible, `/tmp/yamt-b-ws/r2-math.png`).
   - **Alt held** (`xdotool keydown alt`): Result ticks are `conflict @1125,226`, and `info`, `error`, `error` all `@1125,326` (the wave line).
   - **`xdotool mousemove 1125 326 click 1`:** `waves: 0` (the tail shows), Result focused, active line 15 (the empty last line), no selection, cursor at 742,417. The `cm-lintPoint-error` sits at 743,417, so the cursor is on the problem at `doc.length`. Screenshot `/tmp/yamt-b-ws/r2-app-tail-click.png`.
   - **`keyup alt`:** lanes are `[true,true,true]` (hidden).
   - **Which problem it was:** oxlint's parse error at the end of the file. Hovering its "Opened here" range at the `{` showed the tooltip `Opened hereoxlint`. After I stopped oxlint, the end-of-file point was gone and only TypeScript's error stayed, `cm-lintPoint-error @994,397`, at the end of line 14.
   - **Stopped:** `{"stopped":"b-marks-r2","session":"ended",…tauri-driver stopped, xvfb stopped, folder removed}`. Alt is released. `pgrep` still shows `target/debug/yamt --repo /tmp/yamt-conflict-project`, which was running before round 1 and which I didn't start.

**deviations_from_brief**
- **Same rule for every line:** the reviewer suggested the range selection only when the line is empty. I use it for every place: select the innermost hidden range holding `start`, or only place the cursor when nothing hides it. That is one pure rule with no empty-line special case. The round-1 cases (lines with text) still pass.
- **Signature:** `revealSteps` changed from `(doc, start)` to `(state, folds, start)`, and `JumpParts` gained `folds: FoldFields`. `editor/index.ts` builds that part from `this.#folds.fields` and is now exactly 300 lines, the cap.
- **AGENTS.md:** I rewrote the `revealSteps` clause in `editor/AGENTS.md` to describe the new rule.
- **Doc outside my ownership:** `docs/architecture.md:626-628` still says "selecting its whole line … also for a zero-length problem at their end". Suggested text: "first selecting the innermost hidden middle range holding the place, both ends counted (`revealSteps`: `foldField` shows hidden lines holding a non-empty selection, so also an empty line at a range's edge, such as a file's end after its last line break), then putting the cursor at its start".
- **Scratch:** `/tmp/yamt-b-ws/lsp-r2`, with the edited `math.ts`, and the two screenshots are left in place.

**open_risks**
- **No tooltip at the very end of the file:** neither a real xdotool pointer nor a WebDriver pointer moved to the exact spot opened a hover tooltip there (`.cm-tooltip` stayed empty). That is why I identified the server by stopping oxlint instead of reading the message. `[INFERENCE]` It probably comes from `@codemirror/lint`'s hover rule or from the session's pointer setup, not from this patch.
- **Which error the click picked:** the two errors' ticks sit on the same pixel row (326). The click picked oxlint's end-of-file error, as the cursor at `doc.length` shows. The `tickAt` tie-break between equal tops is unchanged (`frontend/src/editor/internal/marks.ts`).

Checks for you to run: `just check`, and the `docs/architecture.md` line above.