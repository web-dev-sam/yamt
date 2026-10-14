# UnchangedPanesR1 — 3.U-panes rework 1 (board "Unchanged lines" row 2)

Brief `docs/slices/briefs/3.U-panes-rework-1.md` plus strips findings #839/#840 (sent by the orchestrator); base `e58e941`+docs. Verbatim implementer report below.

---

All eight brief findings and Main's two strips findings (A and B) are fixed inside `frontend/src/editor/**`. Lint, typecheck, unused, sfc-order and fmt:check exit 0, and tests pass 738/738. The WebKit smoke matched round 1's numbers at every step it repeated (some were skipped, listed below). `index.ts` is 285 lines, down from 298; that is under 300 but only by 15, so whether it counts as "well under" is your call.

**summary**
- Each side pane now holds only a count per run (`readonly number[]`). It works out its levels from the fixed runs through one helper, `innermost`, which the middle's step code also uses (#828/#829).
- Delete, Backspace or any other delete from an empty cursor that would remove a whole hidden range now changes no text and shows that run's next step. Deleting a selection that crosses a wave still deletes (#836).
- All fold wiring sits behind one class, `Folds`, in `foldView.ts`. `index.ts` adds one entry per pane, and `Frame` reads every pane's wave starts through one reader, `waveStarts` (#831, A).
- `Strips` gets the hover getter when it is built, as `foldView` does. Tests build documents through `paneDocs`, the same path as the app (#830, B). The stroke widths come from `connectors` (#832), and the CP1 comment explains why the hidden lines use an inline replace rather than `block: true` (#834).

**files_changed**
- `frontend/src/editor/index.ts`
- `frontend/src/editor/internal/folds.ts`, `foldView.ts`, `frame.ts`, `pane.ts`, `paneDocs.ts`, `strips.ts`, `stripWaves.ts`
- Tests: `frontend/src/editor/internal/folds.test.ts`, `apply.test.ts`, `chunkField.test.ts`, `decorations.test.ts`, `geometry.test.ts`, `pane.test.ts`, `sides.test.ts`, `words.test.ts`

**tests_added** (all in `folds.test.ts`; `open()` and `sidePane()` build states through the real `centerFolds` and `sideFolds`)
- "Delete at a wave's start or Backspace at its end deletes nothing and shows the next step": `delete.forward` at `from`, `delete.backward` at `to`, `delete.line`, and Delete at position 0 on run 0. The text is unchanged and the outer level is gone (#836).
- "a selection deleted across a wave and a delete beside one still delete": 32 lines go; Backspace just after a wave removes 1 line (#836).
- "a selection with both ends exactly on a range's edges shows it" (#837).
- "a side's reveal reads its own ranges and shows what the middle shows for the same line": uses run 2, where the left position lies outside the centre's range (`revealKeep(centre ranges, left selection)` is null). The middle's fold field after the side's reveal equals the field after the matching centre selection (#838).
- "the sides are told the counts only when they differ, and mirror them" (rewritten): the counts are `[3, 2, 3]` and the side's levels equal `runs[1].hidden.slice(1)` (#828).
- "each pane's wave starts are where that pane draws its waves": `waveStarts` per pane equals that pane's drawn fold decorations, and left differs from centre (A).
- The old side/middle `revealKeep` test with identical input was replaced, as #838 asked.

Each rule was broken by hand, run, then restored:
- **#828**, side ignores counts: `expected [ { …(3) }, { …(3) }, …(1) ] to deeply equal [ { …(3) }, { …(3) } ]`
- **A**, `displayed(fold, "center")` used for every pane: `expected [ +0, 311, 591 ] to deeply equal [ +0, 319, 599 ]`
- **#836**, filter returns `tr`: `expected false to be true`
- **#836**, empty-cursor check dropped: `expected 101 to be 69`
- **#836**, overlap instead of whole-range check: `expected 101 to be 100`
- **#837**, `selection.from > from`: `expected [ '37-66', '41-62', '49-54' ] to deeply equal [ '41-62', '49-54' ]`
- **#838**, side reveal reads `"center"`: `expected [ Array(3) ] to deeply equal [ Array(3) ]`
- **#829**, swapped `sideFoldPush` arguments: `folds.ts(214,33): error TS2345: Argument of type 'readonly Fold[]' is not assignable to parameter of type 'readonly number[]'.`

**smoke_evidence**
Fixture page through `just app-session start-fixture --name fold --size 1600x950` (MiniBrowser through `just webdriver`), file `language-tools-script-setup.ts`. Keys went through `app-session press`, pointer actions through WebDriver `/actions`. Screenshots are in `/tmp/yamt-fold-r1/`.
- **Start:** `L … 999[~0]83 91[~1]103 117[~3]359 378[~4]`, `C len=19185 lines=620 sel=0-0 999[~0]83 93[~1]105 121[~3]363 384[~4]`, `R … 999[~0]83 93[~1]105 121[~3]363`. This matches round 1.
- **Delete at position 0 in the middle:** `C len=19185 lines=620 … 999[~0]79`, and L and R also show `[~0]79`. No text was removed and the next step shows in all three panes (`s1-delete-top.png`).
- **Backspace at the end of run 1's wave** (cursor at 3248): `C len=19185 … 97[~1]101`, `L … 95[~1]99`, `R … 97[~1]101` (`s2-backspace-end.png`).
- **Shift+Down twice, then Delete:** the selection ran from line 121 to line 363 (4010–11410). Delete gave `C len=11785 lines=378`. Ctrl+Z gave back `len=19185 lines=620` (`s3-selection-delete.png`).
- **Round-1 steps re-run:**
  - Hover on the right strip's run-3 join: `["DIV:3","g:3","DIV:3","g:3","DIV:3"]`, `strip-wave-hit`, `pointer`, strokes `["2px","2px"]`. Moving off gives `[]`.
  - Clicks on the middle's run-3 wave with the left pane on a change: `121/355 | 125/359 | 125/359`, then `129/347 | 133/351 | 133/351`, then run 3 gone in every pane. Focus stayed in the left content (`activeElement === left.contentDOM` true), the outline stayed on lines `[107,108,109]`, and the centre selection stayed `0-0`.
  - Click on the left pane's run-1 wave: `95/99 | 97/101 | 97/101`.
  - Arrow keys: from line 93 col 4, ArrowDown goes to `3248` (caret top 334), ArrowDown to line 105, ArrowUp to 3248, ArrowUp back to 93.
  - Find `__VLS_setup` in the left pane: selected at line 135, tops `[503,503,503]`, run 3 gone in all panes.
  - Horizontal scroll 300 in the middle: the wave stays `713/419`.
  - Apply chunk 0 from Local: `91[~1]103 119[~3]361 382[~4]` and `2 changes · 1 conflict`. Undo restores the start numbers; redo restores the after-apply numbers.
  - Wave strokes: `stroke-width='1'`, hovered `stroke-width='2'`, colour `rgb(85, 85, 85)`.
- **Strips' joins:** every join starts and ends exactly at its wave's centre, e.g. `strip0 run0 start 102.5 vs 102.5, end 102.5 vs 102.5` (level) and `strip0 run1 start 302.5 vs 302.5, end 342.5 vs 342.5` (S-curve). They followed after apply, undo and a click on a strip join (`strip1 run3 start 782.5 vs 782.5, end 782.5 vs 782.5`, `s6-strip-click.png`).
- **Not re-run:** the theme toggle and the scroll timing. The diff touches neither, apart from importing the same 1 px / 2 px constants.
- **Layer recipes:** lint, typecheck, unused, sfc-order and fmt:check each `exit=0` (`All matched files use the correct format.`). test `exit=0`, `Tests 738 passed (738)`. `wc -l src/editor/index.ts` gives `285`.

**deviations_from_brief**
- **Main's findings A and B taken in this round,** as asked.
  - A: new export `waveStarts(fields, views)` in `folds.ts`. `views` is typed `Record<Pane, Pick<EditorView, "state">>` so a node test can use it. Frame's private `waveStarts` and its inline `starts` record are deleted.
  - B: `Strips` now takes `hovered` as its third constructor argument, `StripWaves` takes it in its constructor, `paint` signatures are `paint(views, layout, covered)` and `StripWaves.paint(paints)`. `FrameParts.hovered` and `StripMarks` are dropped.
  - New private type `StripPair` keeps `strips.ts` at 299 lines (the cap is 300).
  - B has no node test, because `StripWaves` needs a DOM. It was proven only by the WebKit hover reading.
- **New exports:**
  - `folds.ts`: `FoldFields` (the one named type for the fold fields, next to `foldField`), `foldFields`, `paneFolds`, `waveStarts`, `waveDeletes`, `sideReveal`.
  - `foldView.ts`: `Folds`, a class holding the fields, the `Folding` listeners and the hover getter, with `center()`, `side(pane)`, `hovered`, `fields` and `destroy()`. Also `centerFolds(wiring)` and `sideFolds(wiring, pane)`.
  - `pane.ts`: `centerKind(readOnly)`.
- **Changed signatures:**
  - `pushFolds(fields, views)`, `sideReveals(fields, pane, center)`, `sideFoldPush(onSides: readonly number[], folds)`.
  - `paneState({ doc: Text, … })`.
  - `Frame`'s `folds` part is now `FoldFields`.
- **No longer exported:** `sideFoldField`, `foldView`, `paneDoc`, `middleText` (now inlined in `paneDocs`). `centerPane` and its `CenterPane` type are removed.
- **One class instead of two factory functions (#831).** The brief suggested `centerFolds({…})` / `sideFolds({…})`. Those exist, but `index.ts` reaches them through the `Folds` class, which also owns the `Folding` click and hover wiring. That is what removed `#folding`, the hover arrow and the fold imports from `index.ts`.
- **`centerKind` takes only `readOnly`.** The brief's example had `centerKind(middle, readOnly)`, but the kind never depended on `middle`.
- **Tests with no `FileMergeData`** (PHP and other inline strings in `pane.test.ts`) build their documents with `Text.of(text.split("\n"))`, since `paneDocs` needs file data. Every test that has data uses `paneDocs(data)`.
- **The delete filter treats `delete.cut` like any other delete:** a cut from an empty cursor over a wave line deletes nothing and shows the next step instead.
- **The removed side/middle `revealKeep` test** is replaced by the #838 test that goes through the side's real path.
- **For the map:** the editor internals line in the project map and `docs/architecture.md` need `Folds` (in `foldView.ts`), `waveStarts` and the counts-only side mirror. The state-table row should say the sides mirror counts in a `number[]` field. The plan §2 #63 text for #836 is the orchestrator's.

**open_risks**
- `frontend/src/editor/internal/folds.ts`, `deletedWaves`: if a run's outer level hides nothing in the middle and only hides side lines, the middle looks unchanged after the Delete, because the next step only drops that side-only level. This matches what a wave click does, but it was not seen in the fixture.
- `frontend/src/editor/internal/foldView.ts`, `foldView`: `atomicRanges` builds the decoration set on every call, and for a side pane it also rebuilds the side's levels from the counts. Round 1 already rebuilt on every call, so this adds a little work but nothing was measured.
- After deleting a selection that holds a whole hidden range, the middle's run is gone, but the sides still show their wave for it. This is round 1's behaviour (the middle's levels are mapped to empty while the count stays the same), seen in the smoke: L and R keep `[~3]`.
- `index.ts` is 285 lines. That is under the brief's 300, but it may not meet "well under" if you meant more room than that.
- Run these checks: `just check`, and `pnpm -C frontend test:browser` (the WebKit probe was not run in this slice).