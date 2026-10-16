# AltMarksEditor — build output (3.O-editor, board "Change marks" row 3)

I built the Alt-held scrollbar ticks and the jump on click as the brief describes. All four acceptance items were observed, with one caveat on the WebKit fixture page: the side-tick and Result-tick click checks were run with synthetic clicks, not WebDriver pointer clicks (explained under smoke_evidence item 3).

**summary**
- **Tint rule:** `paneTone(chunk, status, pane)` in `tone.ts` is now the one rule; side and Result bands and the ticks all use it.
- **Ticks:** pure `marks.ts` computes where ticks go and how they look (the lane box and the 2 px floor), their paint order, and which tick a click picks (`tickAt`, within 4 px). `MarkLanes` (owned by `Frame`) adds one `.change-marks` lane to each pane's `view.dom`. It is `hidden` while Alt is up and repaints only while shown and dirty, never on scroll.
- **Click:** in `markJump.ts`. A side tick outlines its change and gives that side the keyboard (`SideFocus.focusChange`). A Result tick moves the cursor to the line's end, then to the place's start, which opens collapsed lines. Both scroll the line a third of the way down (`viewport.ts` `thirdScrollTop`).
- **Wiring:** `MergeOptions.marks`, `MergeController.showMarks`, the `useMergeController` `marks` option and watch, the `MergeView` `marks` prop (`props.shown && props.marks`), and seven colour tokens per theme.

**files_changed**
- New: `frontend/src/editor/internal/marks.ts`, `marks.test.ts`, `markLanes.ts`, `markJump.ts`
- Editor changes: `frontend/src/editor/index.ts`, `AGENTS.md`, `theme.css`
- In `frontend/src/editor/internal/`: `frame.ts`, `tone.ts`, `tone.test.ts`, `decorations.ts`, `chunkField.ts`, `chunkField.test.ts`, `problems.ts`, `serverDoc.ts`, `sideFocus.ts`, `viewport.ts`, `viewport.test.ts`
- Browser tests (only `marks: false` added): `frontend/src/editor/problems.browser.test.ts`, `removals.browser.test.ts`
- `frontend/src/style.css`, `frontend/src/ui/useMergeController.ts`, `useMergeController.test.ts`, `MergeView.vue`

**tests_added**
- `marks.test.ts`, 11 tests:
  - "rule 4: a place's top over the scrollable height, scaled to the track" (4000/800 → 400)
  - "rule 4: never thinner than 2 px; an insertion point is 2 px"
  - "rule 4: a document no taller than its pane maps 1:1" (also with Windows arrows)
  - "rule 4: the find space moves ticks by its share"
  - "rule 4: an overlay scrollbar gets the 14 px lane, a classic one its width; on Windows the track leaves out both arrows"
  - "rule 4: a tick at the end stays in the track"
  - "rule 4: a problem inside collapsed lines takes the wave line's place"
  - "rule 3: a side marks exactly what it tints: waiting there, in its tone; applied, ignored and other-side changes none"
  - "rule 3: the Result marks each change with a side waiting, none once resolved, one per problem, hint as info"
  - "rule 3: errors above changes above warnings above info"
  - "rule 5: within 4 px picks the tick, the nearest top wins among overlaps, farther picks none"
- `tone.test.ts`:
  - "paneTone: a side tints a change still waiting there, …"
  - "paneTone: the Result tints a change while any side still waits, …"
- `viewport.test.ts`:
  - "a tick's jump puts the line a third of the way down, also when it is already on screen"
  - "a tick's jump never scrolls above 0 nor past the end"
- `useMergeController.test.ts`:
  - "an editor is built showing marks as the view says, and follows a change without a rebuild"
  - "marks shown before the file loaded reach no editor, and the editor built later shows them"

**smoke_evidence**

1. **Node tests and failing-path proofs.** Each rule was broken, the tests run, and the files restored from `/tmp/yamt-b-ws/orig/` (`cmp` confirmed identical). All 15 editor tests failed under at least one break:

   | Batch | Breaks | Failing lines observed |
   |---|---|---|
   | 1 | pick distance 0; error layer 0; hint→warning; left tinted as center; problem bottom = block top; padding dropped; paneTone side rule; third→half | `marks.test.ts:88` (`expected 400 to be close to 405.8`), `:153`, `:162`, `:193` (`'problem','warning'` vs `'info'`), `:211` (`['error','info',…]`), `:232` (`expected null to be 100`), `tone.test.ts:99` (`expected 'modified' to be null`), `viewport.test.ts:41` (`expected 1700 to be 1800`) |
   | 2 | floor 0; no 1:1 branch; paneTone center rule; no clamp at 0 | `marks.test.ts:68` (`height: 1`), `:80` (`top: 303.75`), `:115`, `:183`, `tone.test.ts:109`, `viewport.test.ts:49` (`expected -140 to be +0`) |
   | 3 | no 14 px floor; no end clamp | `marks.test.ts:94` (`width: +0`), `:115` (`top: 799`) |
   | 4 | no arrow inset; no scaling | `marks.test.ts:62` (`top: 780` vs 400), `:100` (`track: { top: 15 … }` expected) |

   After restoring: `Tests 27 passed (27)`.

2. **Frontend recipes.** `pnpm -C frontend lint` exit 0; `typecheck` (`vue-tsc -b`) exit 0; `test`: `Test Files 103 passed (103)`, `Tests 1386 passed (1386)`; `unused` (`knip`) exit 0; `fmt:check`: "All matched files use the correct format." exit 0; `just sfc-order` exit 0.

3. **WebKit fixture page.** `pnpm -C frontend dev --port 5291`, `just webdriver 4446` (MiniBrowser on the Samsung screen), 1600×1000, file `vueuse-use-magic-keys.ts`, Alt held by a WebDriver `keyDown "\uE00A"` with no keyUp.
   - **Before Alt:** every lane `hidden`; `elementFromPoint` at a pane's right edge → `cm-scroller`.
   - **With Alt:** lanes 14×867 in all three panes. Left 6 ticks (5 LocalOnly + conflict), Result 9, Right 4 (3 RemoteOnly + conflict) — exactly the changes each pane tints.
   - **Ticks vs thumb:** after scrolling each place to the top, diff between tick top and thumb top was `4.6e-7`, `4.8e-7`, `3.4e-7` px.
   - **Collapsing:** ticks below a run sit higher with collapsing on. Left chunk 5: 496.6 (on) vs 523.1 (off). Result inserted: 423.2 vs 486.6. Right: 278.1 vs 398.8.
   - **Apply while Alt held:** `center text changed @frame 202`, then `left lane: 5 ticks @frame 203` and `center lane: 8 ticks @frame 203`. The lanes update in the first animation frame after the edit, so the same painted frame.
   - **Side tick click:** left focused, the conflict's lines outlined, `selectedText [0,0,0]`, `domSelection ""`, left scrollTop 781 (clamped at the end). After Alt up, Enter applied it: left conflict tick gone, Result conflict tick kept (the remote side still waits).
   - **Result tick click (chunk 6):** cursor on line 110, 291 px down a 867 px pane (a third is 289); Result focused.
   - **Alt + press on text:** cursor to line 5, no selection, lanes still shown.
   - **Release:** lanes hidden.
   - **Colours** (`getComputedStyle`, all seven kinds):
     - dark: `rgb(68,113,82)`, `(67,105,141)`, `(101,110,118)`, `(129,80,190)`, `(214,77,91)`, `(194,158,74)`, `(117,109,86)`
     - light (via Settings): `(170,222,170)`, `(182,210,242)`, `(200,200,200)`, `(198,187,245)`, `(207,91,86)`, `(242,191,87)`, `(217,207,173)`
   - **Screenshots:** `/tmp/yamt-b-ws/marks-shown-dark.png`, `marks-collapse-off.png`, `marks-side-click.png`, `marks-result-click.png`, `marks-light.png`.
   - **Click caveat:** in MiniBrowser, any `scrollTop` written during a running WebDriver command (an execute script or a pointer action) was undone. The same write from a timer stuck. So for these two clicks I dispatched mousedown/mouseup/click on the tick from a timer; the real-app check below uses real X clicks.

4. **Real app.** `scripts/lsp-repo.sh /tmp/yamt-b-ws/lsp`, `cargo tauri build --debug --no-bundle`, `just app-session start-app --name b-marks --repo /tmp/yamt-b-ws/lsp`, Start servers, opened `web/src/math.ts`.
   - **Seeding (my edit to the scratch repo):** TypeScript showed "Not installed" (no `--servers`) and math.ts's only oxlint problem was on a visible line, so I put `debugger;` on line 18 of `web/src/math.ts`, inside the collapsed tail. After focus-away/back the file reloaded: `2` errors.
   - **Before Alt:** lanes hidden.
   - **`DISPLAY=:2 xdotool keydown alt`:** Result ticks `conflict rgb(129, 80, 190)`, `error rgb(214, 77, 91) at 1125,286`, `error rgb(214, 77, 91) at 1125,326` — the last one on the wave line.
   - **`xdotool mousemove 1125 326 click 1`:** waves 0 (the collapsed lines are shown), Result focused, active line 14 (`debugger;`), selection `""`. Screenshot `marks-app-problem-click.png`.
   - **Left tick click:** left focused, `"export const LIMIT = \"local\";"` outlined.
   - **`keyup alt`:** all lanes hidden.
   - **`xdotool key Return`:** Result line 5 became `"local"`, focus moved to the right pane.
   - **Focus loss:** `keydown alt` → `["0 ticks","3 ticks","1 ticks"]`; `focus-away` → all hidden; `focus-back` → still hidden; then `keyup alt`.
   - **Cleanup:** `stop` → `{"stopped":"b-marks", … tauri-driver stopped, xvfb stopped, folder removed}`. The `b-marks-webdriver` and `b-marks-vite` services were killed. `pgrep` shows only other sessions' processes (`../yamt`, `/tmp/a-*`).

**deviations_from_brief**
- `Frame` owns `MarkLanes` (its parts gain `focus` and `marks`; new `Frame.showMarks`), so `editor/index.ts` only gains the option and `showMarks`. Final `editor/index.ts`: **292 lines**.
- The click logic is in a new file, `internal/markJump.ts`, not named in the brief.
- `marks.ts` exposes `changePlaces(rows, pane)` and `problemPlaces(state, blockAt)` instead of the design's `sidePlaces`/`centerPlaces`. A problem spans from `blockAt(from).top` to `blockAt(to).bottom`.
- `ChunkSpan.tone` removed: `paneTone` made it dead. One `toMatchObject` line in `chunkField.test.ts` dropped.
- `linted(transactions)` moved into `problems.ts`; used by `serverDoc.ts` and `markLanes.ts`.
- `useMergeController` hit the 40-line cap, so its preferences/collapsed/marks watches moved into `followWithoutRebuild`.
- `tickAt` reading: candidates are ticks within 4 px of their extent (top − 4 to bottom + 4); the nearest top wins; a tie goes to the tick painted on top.
- "1:1" means `scrollHeight ≤ clientHeight`; in that case the Windows arrow inset is kept and the tick is offset by the arrow.
- WebStorm behaviour not copied: a mark ending at the top of its last line, and the `maxStripeSize` 4 cap. Plan rule 4 says ticks span the change's height.
- Docs outside my slice still need entries for `marks.ts`, `markLanes.ts` and `markJump.ts`: `docs/architecture.md` and the project map in `.omp/skills/project-map/SKILL.md`. `just map-check` currently reports only `frontend/src/ui/altHold.ts` (the hold slice's file), but these three should be named too.
- `.omp/run/slices.json` shows as modified in this tree; I did not edit it.

**open_risks**
- `scrollToThird` writes `scrollTop` (`frontend/src/editor/internal/markJump.ts:42-49`). In MiniBrowser, writes made during a running WebDriver command were undone. Real X clicks worked, but the smoke repository's files are shorter than a pane, so a real-app jump that scrolls a long file was not observed.
- In MiniBrowser, writing the Result's `scrollTop` from 0 to 795 left the other panes at 261 and 0 even though sync wrote 795 and 1035, and it happens the same with lanes hidden. Not caused by this slice, but it may affect how panes follow after a far jump.
- An apply repaints the lanes twice, in two consecutive frames (the second from CodeMirror's measure); only while shown. `frontend/src/editor/internal/markLanes.ts:38-44`.
- Two things checked on Linux only:
  - the Windows arrow inset assumes square arrow buttons as wide as the scrollbar (`marks.ts:92-102`);
  - the lane painting above an overlay scrollbar was seen on WebKitGTK only.
- After a doc edit that changes no line heights, problem ticks keep their old places until the next repaint trigger (`markLanes.ts:38`).

Checks for you to run: `just check`, `just mutants e5cd4cf` (`ui/useMergeController.ts` is mutated), and `just map-check` once the project-map entries are added.