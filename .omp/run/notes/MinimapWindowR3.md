The far-jump pull-back (#1240) is fixed. The minimap's own compositing layer (#1241) gave no reliable drop in late frames, so I took it out.

**The cause (acceptance 1).** This is WebKit timing, not yamt logic. Captured in the real app, fresh session, `vOn.ts`, collapsing off, all panes at 0, writing `center.scrollDOM.scrollTop = 2552`:
- No script writes the scroll position after the 2552. I wrapped the `Element.prototype.scrollTop` setter and it logged only my write and the locked scroll's follower writes. Yet the first `scroll` event already reads 1385.
- Order of events inside CodeMirror's scroll handler (`onScroll` → `onScrollChanged` → `EditorView.measure`, run synchronously):
  1. The first `ViewState.measure` reads `.cm-content` and `.cm-scroller` at 2552.
  2. CodeMirror moves its viewport and rebuilds the DOM: 69 old lines removed, 82 new lines inserted.
  3. The next read, a `getBoundingClientRect` on `.cm-content` in `ViewState.measure`, already sees 1385, with `scrollHeight` still 3688.
- The DOM just before that read: before the jump it was 70 lines plus a 2280 px gap. After the swap it is line 1, a 2020 px gap and 82 lines (3688 px). During the swap CodeMirror locks `.cm-content` at `height: 3688px`.
- CodeMirror's own source describes the same browser behaviour (`DocView.updateInner`: "Chrome sometimes messes with the scroll position during DOM mutation (though no relayout is triggered …)").
- Two other explanations ruled out: `* { overflow-anchor: none !important }` still gave 1385, and so did a test with the editor blurred and the selection cleared.
- Sweep of single writes from 0, without the fix: 1452 and 1552 land; 1652 → 1645; 1752 → 1545; 1852 → 1445; 1952, 2152, 2352, 2552 and 2785 → 1385.
- Follower writes suffer too. With the middle pane landed, the sides were pulled back to [1385, 1325]. From 1385 to 500 the sides went to [125, 125].
- `[INFERENCE]` Why WebKit picks those exact numbers is inside WebKit; the fix does not depend on it.

**The fix (`scrollSync.ts`, one extension in all three panes).** When a scroll event shows none of CodeMirror's rendered lines, yamt turns it into a CodeMirror scroll request before CodeMirror measures. CodeMirror then draws the target lines first, and a `scrollHandler` writes the exact `scrollTop`. Because the fix sits on the scroll event of every pane, it covers the minimap press, the follower writes, the side reveal, scripts and native jumps. A press still lands at `centredScrollTop`. During a 200-step × 40 px scroll of `renderer.ts` it fired 0 times; it fired once per pane for each far jump.

summary
- `exactScroll` in `editor/internal/scrollSync.ts`, carried by every pane: a scroll position that shows none of CodeMirror's rendered lines becomes a CodeMirror scroll request whose handler writes that exact `scrollTop`. Far jumps now land and the sides follow.
- `paneViews.ts`: `bodyTooltips()` became `everyPane()` (body tooltips plus `exactScroll`).
- `editor/AGENTS.md` describes it.
- The `.minimap` layer was measured and removed.

files_changed
- `frontend/src/editor/internal/scrollSync.ts`
- `frontend/src/editor/internal/paneViews.ts`
- `frontend/src/editor/AGENTS.md`

tests_added
- None. The cause is WebKit and CodeMirror timing, so the proof is the real-app before/after numbers with the fix removed once (acceptance 3, below). Existing `scrollSync.test.ts` and `minimapPointer.test.ts` pass unchanged.

smoke_evidence
Real app on a private Xvfb, a fresh `m-r3-…` session per run, `vOn.ts`, collapsing off. Clicks are real `xdotool` clicks with Alt held; the probe records [left, center, right] `scrollTop` at the first frame, the second frame and 1 s after the `pointerdown`. Before each press the minimap was shown: `{"value":true}`.

**2. Minimap presses from the top (fixed build):**

| row | expected | first frame | after 2 frames | after 1 s |
|---|---|---|---|---|
| 101 | 1552.5 | [0,1552,0] | [1552,1552,1492] | [1552,1552,1492] |
| 106 | 1652.5 | [0,1652,0] | [1652,1652,1592] | [1652,1652,1592] |
| 111 | 1752.5 | [0,1752,0] | [1752,1752,1692] | [1752,1752,1692] |
| 116 | 1852.5 | [0,1852,0] | [1852,1852,1792] | [1852,1852,1792] |
| 151 | 2552.5 | [0,2552,0] | [2552,2552,2492] | [2552,2552,2492] |

- **Row 151 from mid-file (1405):** [1405,2552,1345] → [2552,2552,2492], same after 1 s.
- **Scripted D1 write, middle pane:** read back 2552; after 2 frames [2552,2552,2492]; after 1 s [2552,2552,2492].
- **Scripted D1 write, left pane:** after 2 frames [2552,2552,2492]; after 1 s the same.
- **More scripted writes from 0:** 1652, 1752, 1852 and 2785 all land; 2785 gives [2785,2785,2725].
- **Writes from 2785 up to 0, 500, 1000, 1552, 1900 and 2300:** all land, for example 500 gives [500,500,440].
- **Slider drag, wheel and end, the same with and without the fix:**
  - Drag 100 px gives [1002,1002,942].
  - 30 px more gives [1303,1303,1243].
  - Three wheel clicks give [1600,1600,1540].
  - Drag to the very end (scrollTop, max): `[[2785,2785],[2785,2785],[2725,2725]]` right after and 1 s later.
- **Toolbar "Next change":** `vOn.ts` never scrolled, and `renderer.ts` moved only to [723,603,603] within 6 steps, with the same numbers with and without the fix. Neither file had a far change within reach, so a far arrow jump was not exercised.

**3. The fix removed once (same `paneViews.ts` without `exactScroll`):**

| row | first frame | after 2 frames / 1 s |
|---|---|---|
| 101 | [0,1552,0] | [1552,1552,1492] (lands) |
| 106 | [0,1645,0] | [1645,1645,1585] |
| 111 | [0,1545,0] | [1545,1545,1485] |
| 116 | [0,1445,0] | [1445,1445,1385] |
| 151 | [0,1385,0] | [1385,1385,1325] |

- Scripted D1 2552 without the fix: [1385,1385,1325]. The failure is back.

**4. Scroll timing** (`.omp/run/scroll-timing.py` through a wrapper, `renderer.ts`, all files opened, middle pane, private Xvfb `:93`, scratch `HOME`). Late frames out of 200, mean frame time in brackets:

| run | Alt up | Alt held, no layer | Alt held, layer |
|---|---|---|---|
| 1 | 16 (16.5) | 17 (16.5) | 11 (16.5) |
| 2 | 11 (16.5) | 16 (16.5) | 15 (16.6) |
| 3 | 21 (16.6) | 20 (16.5) | 9 (16.5) |
| 4 | 15 (16.5) | 13 (16.6) | 14 (16.5) |
| 5 | 14 (16.5) | 15 (16.6) | 14 (16.5) |
| 6 | 21 (16.5) | 13 (16.5) | 16 (16.5) |
| median | 15.5 | 15.5 | 14 |

- Runs 1–3 favoured the layer; runs 4–6 did not. No reliable drop, so the layer is removed.
- With the minimap shown, the late-frame median now equals the Alt-up median (15.5 each).
- Alt up with the fix removed vs with the fix, three runs each: 12/14/12 vs 20/14/12. That fix build was an earlier version that also pinned partly covered positions (7–15 times per pane in a 200-step scroll); the final fix pins none there.

**5. Recipes:**
- `pnpm -C frontend lint`: exit 0.
- `pnpm -C frontend typecheck`: `vue-tsc -b`, exit 0.
- `pnpm -C frontend test`: `Test Files 108 passed (108)`, `Tests 1439 passed (1439)`, exit 0.
- `pnpm -C frontend unused`: `knip --include exports,types`, exit 0.
- `pnpm -C frontend fmt:check`: `All matched files use the correct format.`, exit 0.
- `just sfc-order`: `tsx scripts/check-sfc-order.ts`, exit 0.
- Cleanup: every `m-r3-…` session, `tauri-driver` and Xvfb stopped. Only the owner's `target/debug/yamt --repo /tmp/yamt-conflict-project` (pid 61860) is still running, untouched.

deviations_from_brief
- `.omp/run/notes/MinimapVerifyDiagnostics.md` is a byte-identical copy of `MinimapVerify.md` and has no D1–D4. I used the brief's Facts and reproduced D1 myself.
- The brief suggested routing the press and the follower writes. I first did that, but a raw scripted write still failed. So the fix sits on every pane's scroll event instead, and `minimapPointer.ts`, `frame.ts`, `sideFocus.ts` and `ScrollSync` are unchanged.
- The `scroll` observer reads `scrollTop` and `clientHeight` synchronously, against CM13 ("no synchronous layout reads in scroll handlers"). It runs inside CodeMirror's own scroll handler right before CodeMirror's `measure`, which reads layout anyway, so it adds no layout pass.
- `paneViews.ts` beyond the minimap files: `bodyTooltips()` became `everyPane()`. Adding the extension otherwise pushed `createPaneViews` to 41 lines (over the 40-line limit), and `pane.ts` is already at its 300-line cap.
- No new file, so `just map-check` is unaffected. The project map and `docs/architecture.md` (not mine to edit) could mention that `editor/scrollSync` also holds `exactScroll`.
- I used `git checkout <file>` to throw away my own intermediate edits and to restore `.omp/run/__pycache__/scroll-timing.cpython-314.pyc`, a tracked file that my timing wrapper regenerated.
- `target/debug/yamt` was rebuilt in the worktree only. Scratch binaries are in `/tmp/yamt-m/r3/` (`yamt-fixed`, `yamt-nofix`, `yamt-layer`), and the timing repo is a copy at `/tmp/yamt-m/r3/vue`.

open_risks
- `frontend/src/editor/internal/scrollSync.ts:84-97`: the rule "pin only when none of the rendered lines is visible" comes from the sweep. Without the fix, partly covered jumps (900–1400 from 0) landed, and failures started at 1652, where no rendered line is visible. A partly covered jump that is still large was only tried on `vOn.ts` and `renderer.ts`.
- `scrollSync.ts:71-82,108-122`: the `placed` field keeps the last request, matched by its `range` object. If the document changes between the request and CodeMirror's measure, CodeMirror maps the range and the handler steps aside. CodeMirror's default "start" scroll then applies, which was 1 px off in a test (2553 for 2552).
- The far jump comes from WebKitGTK 2.54. Another engine or version may differ, though the fix only uses CodeMirror's own scroll request.
- Timing noise is large on this machine: Alt up ranged 11–21 late frames across runs.
- No far toolbar-arrow or Ctrl/Cmd+wheel jump was exercised. The side reveal goes through the same pin, but that is not shown in a run.
- `pnpm -C frontend test:browser` cannot launch here (#1242), so the WebKit browser probes did not run.