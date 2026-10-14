# UnchangedCut — 3.U-cut (board "Unchanged lines" row 2b)

Brief `docs/slices/briefs/3.U-cut.md`; base `d6ea368`. Verbatim implementer report below.

---

A single Ctrl+X in the middle pane now removes exactly one line. I tested this in the real app (debug binary built from this tree, real X11 keys) and all five acceptance cases behave as the brief asks.

**Cause:** WebKitGTK 2.54.1 runs its own Cut command twice for one Ctrl+X when nothing is selected. The page receives two trusted `beforecut`+`cut` pairs inside the handling of that one `keydown`, 5–8 ms apart. They are in the same task: a 0 ms timer queued at the first `cut` had not run when the second arrived, and the `keyup` events queued behind them. With a selection only one pair arrives. No native menu is involved (`src-tauri` has none). Exactly which C++ path inside WebKit runs the command twice I did not trace `[INFERENCE]`.

**Rule:** each pane takes one `cut` per task. A `cut` that arrives before a 0 ms timer queued at the last taken cut is refused before CodeMirror's handler sees it. This fits the measurement, needs no `keydown`, and lets separate presses cut again, since each press is its own task.

---

**summary**
- New `frontend/src/editor/internal/cutOnce.ts`. `cutGate(reopen)` is the pure decision: take the first cut, refuse later ones until the next task reopens the gate. `cutOnce()` puts it in every pane as a `cut` DOM handler, which CodeMirror runs before its own `handlers.cut`.
- `pane.ts` adds `cutOnce()` to `paneState`, so all three panes have it.
- Cause and gap measured in the app (`vOn.ts`, cursor on line 14): `cut@87446` (184 lines) then `cut@87454` (183 lines); 0 ms timer not run between them.

**files_changed**
- `frontend/src/editor/internal/cutOnce.ts` (new)
- `frontend/src/editor/internal/cutOnce.test.ts` (new)
- `frontend/src/editor/internal/pane.ts` (one import, `cutOnce()` in `paneState`'s extensions)

**tests_added** (`cutOnce.test.ts`)
- "one key press's second cut, in the same task, is refused": `[takes(), takes(), takes()]` → `[true, false, false]`.
- "two presses, each in its own task, cut twice": after a fake next task, the gate takes again, then refuses until the next one.
- Hand failing-path proof, each break restored afterwards:
  - Gate never closes (`open = true` after taking): `FAIL … one key press's second cut … expected [ true, true, true ] to deeply equal [ true, false, false ]` and `FAIL … two presses … expected true to be false`, `Tests 2 failed (2)`.
  - Gate never reopens (`open = false` in the reopen callback): `FAIL … two presses, each in its own task, cut twice … expected false to be true`, `Tests 1 failed | 1 passed (2)`.

**smoke_evidence**
Setup: `cargo tauri build --debug --no-bundle` in this tree, then `pnpm exec tsx scripts/app-session.ts start-app --name cut2 --fresh-repo`. I clicked `packages/compiler-core/src/transforms/vOn.ts` and pressed keys with `press --name cut2 "Ctrl+X" --x11` (xdotool). The cursor was placed and the middle pane focused through `read`, and a capture-phase probe logged the key and clipboard events.

- **Before the fix** (same binary type, without `cutOnce`): `keydown x 87446 | beforecut 87446 | cut 87446 184 prevented=true | beforecut 87454 183 | cut 87454 183 prevented=true`, result 182 lines. With a 3-character selection: one `beforecut`/`cut` only.
- **1. Empty cursor, one Ctrl+X:** both events still arrive (`cut 18089 184`, `cut 18096 183 prevented=true`), but only one line is gone: `183 lines`, `clipboard: import { processExpression } from './transformExpression'`. New line 14 is `import { validateBrowserExpression } …`.
- **5. Ctrl+Z after 1:** `184 lines`, and line 14 is `import { processExpression } from './transformExpression'` again.
- **2. Two separate Ctrl+X presses:** `182 lines`. Lines 14 and 15 are gone (new 14: `import { hasScopeRef, isMemberExpression } …`). Clipboard holds the second one, `import { validateBrowserExpression } from '../validateExpression'`.
  - Also two presses about 25 ms apart in one xdotool call: `182 keydown@96184 … cut@96190:183 keydown@96209 … cut@96218:182`, so two lines.
- **3. 3-character selection, Ctrl+X:** one event (`cut 53770 184 prevented=true`), `184 lines`, `clipboard: imp`, and line 14 is `ort { processExpression } …`.
- **4. Cursor on the top wave (position 0), Ctrl+X:**
  - Before, all three panes show `1~,12,13,14,15,16` (doc lines 184/184/181).
  - After: `184 lines`, nothing gone, and all three panes show `1~,8,9,10,11,12` — the run moved to its next step.
  - Two events arrived: `cut 75625 184`, then `cut 75632 184 prevented=true`.
  - Screenshot `/tmp/yamt-cut/after-wave-cut.png` shows lines 8–11 shown under the top wave in Local, Result and Remote.
- **`pnpm -C frontend` recipes** (after the last edit): `lint` exit=0; `typecheck` (`vue-tsc -b`) exit=0; `test` `Tests 743 passed (743)` exit=0; `unused` (`knip --include exports,types`) exit=0; `fmt:check` `All matched files use the correct format.` exit=0. `bash scripts/map-check.sh` → `map-check: ok`.

**deviations_from_brief**
- The rule went into a new module, `cutOnce.ts`, as the brief allows. No `Prec` is needed: CodeMirror runs extension `domEventHandlers` before its built-in handlers (`@codemirror/view` `computeHandlers`).
- The code comment cites `docs/slices/briefs/3.U-cut.md` instead of "#849", because `palette.test.ts` flags `#849` as a hex colour literal.
- The app smoke ran before I changed that comment; the change after it was comment-only.
- Not owned, suggested for Main: the project map's `editor/internal` list does not name `cutOnce` (one Cut per task, WebKitGTK's double Cut). `map-check` passes anyway.
- I had to run `pnpm install --offline` in the worktree, and `target/` was built here.

**open_risks**
- `frontend/src/editor/internal/cutOnce.ts:21`: the gate reopens on a 0 ms timer. I saw queued input events run before a pending 0 ms timer (`keyup` ahead of it). So if the main thread stalls longer than the gap between two real presses, the second press's cut could be refused. This did not happen with presses 25 ms apart.
- On a wave line, the blocked cut still puts the hidden line 1 on the clipboard (`clipboard: import type { DirectiveTransform, … }`), because CodeMirror writes the clipboard even when `folds.ts` blocks the delete. This was already the case; clipboard contents are a non-goal here.
- Empty-cursor Ctrl+C probably also fires twice; harmless, and copy is a non-goal. Not measured.
- macOS (WKWebView) was not run; the rule needs no `keydown`.
- I did not run `just check` or `pnpm test:browser`.