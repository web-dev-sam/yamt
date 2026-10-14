# UnchangedPanesR2 — 3.U-panes rework 2 (board "Unchanged lines" row 2)

Brief `docs/slices/briefs/3.U-panes-rework-2.md`; base `e25a8ee`. Verbatim implementer report below.

---

#848 is fixed in `folds.ts` for delete-line, but in WebKit an empty-cursor Ctrl+X on a wave line still loses one hidden line. That comes from the separate double-`cut` bug you are logging, so I made no change outside my two files. The node tests and the five frontend recipes pass.

**summary**
- A delete from an empty cursor is now blocked if it would remove any character of the middle's displayed hidden range `[from, to)`. Before, it was blocked only when it removed the whole range.
- A blocked delete changes no text and shows that run's next step. This covers Delete and Backspace at the wave, delete-line (Ctrl+Shift+K) and a line cut on the wave line.
- A delete that only removes the line break just before `from` or just after `to` still goes through.
- The check is `removesHidden` in `folds.ts`, which replaces `removesWhole`.

**files_changed**
- `frontend/src/editor/internal/folds.ts`
- `frontend/src/editor/internal/folds.test.ts`

**tests_added** (both in `folds.test.ts`)
- **"delete-line or a line cut on a wave line deletes nothing and shows the next step":**
  - `delete.line` over `[from−1, line.to)`, and `delete.cut` over `[from, line.to+1)`, on run 1.
  - In both cases the text is unchanged and the outer level is gone: `["41-62", "49-54"]`.
- **"a delete of only the line break before a wave still joins the lines":** `delete.backward` over `[from−1, from)` removes one line.
- Backspace at `to + 1` (the existing `beside` case) and rework 1's #836 tests still pass unchanged.
- I broke the rule by hand twice, ran the tests, then restored the fix:
  - **Whole-range check put back:** `FAIL … delete-line or a line cut on a wave line deletes nothing and shows the next step` with `AssertionError: expected false to be true`, `Tests 1 failed | 18 passed (19)`.
  - **`<=` instead of `<` at the range edge:** `FAIL … a delete of only the line break before a wave still joins the lines` and `FAIL … a selection deleted across a wave and a delete beside one still delete`, both `expected 101 to be 100`.

**smoke_evidence**
I used the fixture page in WebKit (MiniBrowser through `app-session start-fixture --name foldr2 --size 1600x950`), file `language-tools-script-setup.ts`, with the middle cursor at 2922 (the wave line, line 94).

- **Before the fix, Ctrl+Shift+K:** one hidden line was lost.
  `{"lost":["\t}"],"lines":619,"firstDiffLine":94,"len":19182}`
- **Before the fix, Ctrl+X:** two hidden lines were lost.
  `{"lost":["\t}","\tif (options.templateAndStyleTypes.has(names.InheritedAttrs)) {"],"lines":618,"firstDiffLine":94}`
- **After the fix, Ctrl+Shift+K:** the text is unchanged and the next step shows in all three panes.
  - `{"lines":620,"unchanged":true,"len":19185,"sel":2922,"panes":["1-1 96-96 118-118 379-379","1-1 98-98 122-122 385-385","1-1 98-98 122-122"]}`
  - The wave starts moved from L 92 / C 94 / R 94 to 96 / 98 / 98.
  - Screenshot: `/tmp/yamt-fold-r2/after-delete-line.png`.
- **After the fix, Ctrl+X:** one line, `["\t}"]`, is still lost (`{"lines":619,"panes":["1 96 118 379","1 97 121 384","1 98 122"]}`).
  - One key press sent two trusted `cut` events: `[[true,2922,620],[true,2922,620]]`.
  - The first is blocked and shows the step; the second cuts the line that step just revealed.
  - Screenshot: `/tmp/yamt-fold-r2/after-cut.png`.
- **Same in the real app:** the main repo's existing `target/debug/yamt` (built without this fix), `--fresh-repo`, `vOn.ts`, a real X11 key, cursor on the wave at line 26.
  - `cuts:[[true,184],[true,183]]`, `lines:182`, two lines lost.
  - With a 3-character selection there was only one event: `cuts:[[true,182]]`.
- **Layer recipes** (in `frontend`):
  - `lint` exit=0
  - `typecheck` exit=0 (`vue-tsc -b`)
  - `test` exit=0, `Tests 740 passed (740)`
  - `unused` exit=0 (`knip --include exports,types`)
  - `fmt:check` exit=0, `All matched files use the correct format.`

**deviations_from_brief**
- I renamed `removesWhole` to `removesHidden`. Its check is `max(fromA, from) < min(toA, to)`, so an empty removal never counts.
- To confirm the double `cut` with real keys, I started the real app with the main repo's existing debug binary, because fixture sessions cannot send X11 keys.

**open_risks**
- **Pre-existing double `cut` (you are logging it separately):** with nothing selected, one Ctrl+X makes WebKitGTK send two `cut` events, and CodeMirror handles both (`@codemirror/view` `handlers.cut`).
  - Anywhere in the app, an empty-cursor Ctrl+X cuts two lines (real app: `cuts:[[true,184],[true,183]]`, 184 → 182 lines).
  - On a wave line, the second cut removes the line the blocked first cut just revealed (fixture: `["\t}"]` lost, 620 → 619 lines). So the Ctrl+X part of #848 is only closed once that bug is fixed at pane level.
- `frontend/src/editor/internal/folds.ts:178`: the "after" checks ran on the fixture dev server only. The real-app run used a binary without this fix, so it shows only how many `cut` events arrive.
- Still to run: `just check` and `pnpm -C frontend test:browser`; I ran neither.