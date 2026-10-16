# AltMarksDesign — design output (3.O, board "Change marks" row 1)

Chosen: option A (orchestrator, plan §2 #80), two builds in parallel with the split changed: the editor build also owns `ui/MergeView.vue` (prop `marks`), the hold build owns `ui/altHold.ts`, its test and `ui/App.vue`. Open questions decided as owner: (1) a tick click places the line a third down, always (WebStorm CENTER, DR6); (2) info and hint problems keep their ticks (the owner asked for language-server problems), drawn lowest. Board rules 3 and 5 corrected from WebStorm (order errors > changes > warnings > info; acts on click; nearest top within 4 px).

---

# 3.O design: change marks in the scrollbars while Alt is held

I recommend **option A**, built as two parallel `web-impl` builds. Everything stays inside `frontend/src/**`; no Rust or IPC change is needed. Tree facts were read at `2dd0c71`, a docs-only commit on top of `407ec81` (`.git/logs/HEAD`), so the source line numbers are those of `407ec81`.

Reading WebStorm's source turned up corrections to rule 3 and rule 5. They are listed with sources under open risks, and rule 5's placement is also open question 1.

## WebStorm, as read from intellij-community master

**Which changes get a mark, and in what colour**
- A side editor gets a highlighter only when `change.isChange(side)` is true (`platform/diff-impl/.../tools/simple/DiffViewerHighlighters.kt`, `installHighlighters`).
- `createHighlighter` passes `.withResolved(change.isResolved(side))`. In `DiffDrawUtil.java` `LineHighlighterBuilder.done`, the stripe mark is dropped when the background is NONE, and `PaintMode.RESOLVED = new PaintMode(BackgroundType.NONE, …)`. So a change applied or ignored on a side loses its mark there. This matches rule 3 for the sides.
- `TextMergeChange.kt` `isResolved(side)` and `setResolved` hold that state.
- The same call passes `.withHideStripeMarkers(side == ThreeSide.BASE)`: **WebStorm's Result shows no change marks at all.** The owner's request asks for them, so this deviation is already the owner's.
- The mark colour is the `ERROR_STRIPE_COLOR` of `DIFF_INSERTED`, `DIFF_DELETED`, `DIFF_MODIFIED` or `DIFF_CONFLICT` (`DiffStripeMarkerTextAttributes.getErrorStripeColor` → `TextDiffTypeFactory.TextDiffTypeImpl.getMarkerColor`).
- WebStorm uses one diff type per change for all editors (`ThreesideDiffChangeBase.kt` `diffType`). yamt colours each side by its own `chunkTone`, and a tick must match its pane's band (rule 3).

**Which mark is drawn on top**
- Change marks sit at `STRIPE_LAYER = HighlighterLayer.ERROR - 1` (`DiffDrawUtil.java`).
- Problems: `UpdateHighlightersUtil.java` `getLayer` maps ERROR→5000, WARNING→4000, WEAK_WARNING→3750 (`HighlighterLayer.java`).
- `EditorMarkupModelImpl.kt` `drawErrorStripeMarkers` keeps stripes sorted by layer, highest on top.
- So the order is **errors > changes > warnings > weak warnings**, not the board's errors > warnings > changes.

**Where a mark sits and how tall it is** (`platform/platform-impl/.../editor/impl/EditorMarkupModelImpl.kt`)
- `offsetsToYPositions`: y is the y of the offset's visual line, so a collapsed region counts as one line (`offsetToLine` → `editor.offsetToVisualLine`).
- The track is the scrollbar's height minus its arrow buttons (`recalcEditorDimensions`: `getDecScrollButtonHeight`/`getIncScrollButtonHeight`). The source height is `editor.preferredHeight`.
- Positions are 1:1 when the content is shorter than the track, otherwise scaled.
- The mark ends at the top of the line holding the end offset, so it is one line short of the change.
- A mark is never thinner than `errorStripeMarkMinHeight` = 2 (`DaemonCodeAnalyzerSettings.java`), capped at `maxStripeSize` = 4.
- Marks are `Editor.scrollBarWidth` = 14 px wide (`SCROLLBAR_WIDTH`, `drawSpot`).

**What a click does**
- It acts on `mouseClicked` (press and release), not on the press.
- `doMouseClicked` gives the editor the keyboard (`requestFocus(editor.contentComponent)`).
- `getNearestRangeHighlighter`/`addNearestHighlighters`: candidates are marks within ±2 × the minimum height of their range; the one whose top is nearest wins.
- `doClick` first puts the caret at the line's end ("Necessary to expand folded block"), then at the mark's start. It removes the selection, turns animation off and calls `scrollToCaret(ScrollType.CENTER)`.
- `ScrollPositionCalculatorImpl.kt` `getVerticalOffset`: CENTER always scrolls, putting the caret line a third of the way down (`oneThirdPosition`, clamped). It never checks whether the line is already visible.

**Stripe colours** (WebStorm-262.10968.77, `lib/intellij.platform.ide.impl.jar`, read in place)

| kind | Islands Dark | source | Light | source |
|---|---|---|---|---|
| scheme used | Islands Dark, parent Darcula | `ManyIslandsDark.theme.json:6`, `IslandSchemeDark.xml:1` (overrides no `DIFF_*`) | Light, parent Default | `ManyIslandsLight.theme.json:6`, `expUI_lightScheme.xml:1` |
| inserted | `447152` | `DefaultColorSchemesManager.xml:2267` | `AADEAA` | `:507` |
| modified | `43698d` | `:2273` | `b6d2f2` | `expUI_lightScheme.xml:260–263` |
| deleted | `656e76` | `:2261` | `C8C8C8` | `:498` |
| conflict | `8f5247` | `:2255` | `ffc8bd` | `:489` |
| error | `d64d5b` | `IslandSchemeDark.xml:409–412` | `cf5b56` | `:390` |
| warning | `c29e4a` | `IslandSchemeDark.xml:802–805` | `f2bf57` | `expUI_lightScheme.xml:474–477` |
| weak warning | none: `INFO_ATTRIBUTES` (`IslandSchemeDark.xml:487–492`) has no stripe colour; Darcula has `756D56` (`:2520`) | | `d9cfad` | `:479` |

## Tree facts (`407ec81`)

**The tick rule is the band rule**
- Side bands: `isSideOpen` + `chunkTone(chunk, side)` (`decorations.ts:53,57`).
- Result bands: `!isResolved` with `span.tone` (`decorations.ts:106`; `chunkField.ts:97`).
- `status.ts:18–24` defines both predicates. Rule 3's side and Result change sets equal these.

**Geometry**
- One per-frame cache: `Frame` (`frame.ts:42–54` `changed`, `:68–80` `request`).
- `chunkRows` gives each pane's span in document px (`geometry.ts`).
- Panes do not wrap lines and have no block widgets: the one `Decoration.widget` is the inline removal bar (`words.ts:68`) and folds are inline replaces (`foldView.ts:80–82`). `LINE_HEIGHT_PX` is 20 (`pane.ts:58,85`).
- CodeMirror estimates lines it never drew at the measured line height when nothing wraps (`@codemirror/view` `index.js:5417–5419`).
- Fold decorations are static (`foldView.ts` `EditorView.decorations.compute`), so the height map counts every collapsed run as one line, also off screen (`index.js:6320`).
- So estimated heights are exact (error 0 px).

**Geometry flags and scrolling**
- Padding (the find space, `find.ts:48`), width and height changes raise `geometryChanged` (`index.js:6379–6390, 6417–6420`). The find bar is 16 px in from the right edge (`find.ts` `FIND_BAR_INSET_PX`).
- A `scrollTop` written right after a dispatch wins: `measure` drops the scroll anchor when the offset moved (`index.js:8186–8189`).

**Events**
- CodeMirror listens on `contentDOM` (`index.js:4605–4616`).
- `SideFocus` listens for presses in the capture phase on `scrollDOM` (`sideFocus.ts:55`).
- `Folding` listens on the hosts (`folding.ts:44`).
- `.cm-editor` is `position: relative` (`index.js:6838–6840`).
- So an element appended to `view.dom` is outside both `contentDOM` and `scrollDOM`.

**Reuse points**
- `SideFocus.#focusOn` / `#reveal`.
- `viewport.ts` `revealScrollTop`, `visibleArea`.
- The centre's `foldField` already shows hidden lines when a selection lands strictly inside them (`folds.ts` `update`, `foldSelection.ts` `holds`/`revealKeep`).
- `serverDoc.ts:66–68` already detects `setDiagnosticsEffect`.

**Size caps**
- `.oxlintrc.json:49–53`: 300 lines per file, 40 per function.
- `editor/index.ts` is at 285, `ui/store.ts` at about 300 (`fileListKey` is `:283–293`), `ipc/keys.ts` at about 288.

**Precedent for a held modifier**
- `modClick.ts:20–23` `isModHeld`: what Ctrl/Cmd means with the mouse lives with its feature, not in `keys.ts`.

## Common to all options: the Alt state

**Data structure.** One pure transition function and one composable, in a new file `ui/altHold.ts`:

```ts
type HoldEvent =
  | { kind: "keydown"; key: string; repeat: boolean; altKey: boolean }
  | { kind: "keyup"; key: string; altKey: boolean }
  | { kind: "pointer"; altKey: boolean }
  | { kind: "left" };                                   // window blur or page hidden
function heldAfter(held: boolean, e: HoldEvent): boolean
//   keydown:  key "Alt" → repeat ? held : true; any other key, "AltGraph" included → false
//   keyup:    key "Alt" or !altKey → false, else held
//   pointer:  altKey && held        (never shows; hides on a missed release)
//   left:     false
function useAltHold(): Readonly<ShallowRef<boolean>>
```

**Listeners.** `useAltHold` uses VueUse `useEventListener`:
- window `keydown` and `keyup` in the capture phase, so a find box that stops propagation is still seen;
- `pointerdown`, `pointermove`, `pointerup` and `wheel` with `{ capture, passive }`, registered through a reactive target only while held, so nothing listens while Alt is up;
- window `blur`, and `useDocumentVisibility` → `"left"`.

**One owner (vision 2).** App.vue calls `useAltHold()` once, beside its existing window listeners (`App.vue:37–40`), and passes `:marks="altHeld"` to each MergeView. MergeView passes `marks: () => props.shown && props.marks` to `useMergeController`, so the controllers of hidden files always get false.

**A file opened or shown while Alt is held** draws its ticks at once. The hold belongs to the window, not to a file. Coming back to the window with Alt still held stays hidden, because `"left"` cleared the hold and a repeat does not set it again.

**Where "Alt shows the marks" lives.** In `ui/altHold.ts`, not in `ipc/keys.ts`:
- `keys.ts` maps presses to rebindable actions. A held modifier is neither, and making it rebindable is a non-goal.
- Plan #61 rejected an *action* key outside the Keymap.
- `modClick.ts` is the precedent for a held modifier living with its feature.
- `keys.ts` has about 12 lines of room left.

**Rejected owners for the hold:**
- `store.ts`: at its 300-line cap.
- The editor: one hold per controller means N copies of the fact, plus a "shown" signal anyway.

## Option A (recommended): the controller paints lanes from the Frame's one geometry cache

Serves visions 2 (one geometry cache, one tint rule), 5 (one new method) and 1.

**Data structures**, all pure, in a new file `editor/internal/marks.ts`:

```ts
type MarkKind = Tone | "error" | "warning" | "info";      // info covers info and hint
const PAINT_ORDER: Readonly<Record<MarkKind, number>>     // info 0 < warning 1 < tones 2 < error 3 (WebStorm's layers)
type MarkTarget =
  | { kind: "change"; id: Chunk["id"] }
  | { kind: "problem"; diagnostic: Diagnostic };           // positions found at click time (CM9)
type MarkPlace = Span & { kind: MarkKind; target: MarkTarget };   // document px
type LaneBox = { width: number; height: number; track: Span; docTop: number; scrollHeight: number };
type Tick = { top: number; height: number; kind: MarkKind; target: MarkTarget };   // lane px
function sidePlaces(rows: readonly ChunkRow[], side: Side): MarkPlace[]
function problemPlaces(state: EditorState, blockAt: (pos: number) => Span): ProblemPlace[]
function centerPlaces(rows: readonly ChunkRow[], problems: readonly ProblemPlace[]): MarkPlace[]
function laneBox(m: { scrollHeight; clientHeight; offsetWidth; clientWidth; paddingTop }, arrows: boolean): LaneBox
function ticks(places: readonly MarkPlace[], lane: LaneBox): Tick[]   // sorted by PAINT_ORDER, then top
function tickAt(ticks: readonly Tick[], y: number): Tick | null
```

In `tone.ts`, one new function `paneTone(chunk, status, pane): Tone | null` becomes the single tint rule. `sideDecorations`, `centerDecorations` and the marks all use it.

**1. Alt state.** As in the common section. The controller gets `MergeOptions.marks: boolean` at build, copying how `collapsed` works today (`useMergeController.test.ts:64` fakes `setCollapsed`), and `showMarks(on)` for later changes.

**2. The lane.**
- A new file `editor/internal/markLanes.ts` holds a `MarkLanes` class. It appends one `<div class="change-marks" aria-hidden="true" hidden>` to each `view.dom`: outside `scrollDOM` and `contentDOM`, so CodeMirror, `SideFocus` and `modClick` never see its presses.
- The lane is `position:absolute; right:0; top:0`, with its height set to `scrollDOM.clientHeight`, which leaves out a horizontal scrollbar.
- Width is `max(offsetWidth − clientWidth, 14)`: 14 px over a scrollbar that takes no room (WebKitGTK and macOS overlay), the scrollbar's own width over a classic one.
- The track leaves out both arrow buttons only on Windows (`arrows = /^Win/.test(platform)`, arrow height taken as the scrollbar width; WebStorm subtracts its dec/inc button heights the same way).
- The lane itself has `pointer-events:none`; ticks have `pointer-events:auto` and a `::before` hit area 4 px above and below. Presses between ticks still reach the scrollbar.
- While hidden, the `hidden` attribute makes it `display:none`: no hit testing, no layout (rule 7).
- It survives a resize or the file list hiding (anchored right, width/height flags → repaint), the find bar (padding flag → repaint, ticks shift by its share) and theme switches (CSS variables, no repaint).

**3. Ticks.**
- y = trackTop + (paddingTop + place.top) / scrollHeight × trackLength.
- height = max(2, span × the same scale), clamped inside the track.
- Places come from the cached `Frame.layout().rows`. Problems come from `forEachDiagnostic` with `blockAt = view.lineBlockAt`, so a problem in hidden lines sits on the wave line's block.
- Recompute triggers, only while shown: `MarkLanes.changed(update)` marks the lanes dirty on `geometryChanged` (which includes doc changes), `rowsChanged(update, [spans, folds.center, folds.sides])` (statuses, folds) or `setDiagnosticsEffect`. `Frame.request` calls `marks.paint(rows)`, which redraws only when dirty.
- Scrolling never recomputes, because tick positions do not depend on `scrollTop`.
- While hidden, `changed` returns at its first line.
- DOM order is paint order, so the order on overlap is right. Minimum height is 2 px.

**4. Click.**
- Lane `mousedown` with button 0 on a tick calls `preventDefault`: no focus move, no selection, no drag.
- Lane `click`: `tickAt(ticks, clientY − lane.top)` copies WebStorm's nearest-top match within 4 px.
- Side tick: new public `SideFocus.focusChange(side, id)` wraps the existing `#focusOn` (outline + keyboard, as #54). Then that side's `scrollTop` is written.
- Result tick: the position is the change's `span.from` from `chunkField`, or the diagnostic's mapped `from`.
  - Dispatch a cursor at the line's end, then a cursor at the position (WebStorm `doClick`). The existing `foldField` reveal shows the hidden lines, as find does.
  - Then `center.focus()` and a `scrollTop` write.
- Placement: a new `viewport.ts` `thirdScrollTop` (WebStorm CENTER). If rule 5 stays as written, the existing `revealScrollTop` is used instead; no second copy either way.
- After the jump, the written pane is the scroll source and the others follow through `scrollSync`. A reveal's pushed fold counts drop the rows, so the anchors are rebuilt the same frame.

**5. Tests.** See the test section after option C.

**6. Size and surface.** About 1,390 lines over 25 files across both builds (lists below). `editor/index.ts` grows by about 12 lines to about 297. New public surface: `showMarks(on)` and `MergeOptions.marks`.

## Option B: one CodeMirror ViewPlugin per pane owns its lane

Serves visions 5 (idiomatic CodeMirror, `Frame` untouched) and 1. Costs vision 2.

**Data.**
- Each pane gets a `marksShown: StateField<boolean>` with a `showMarks` effect.
- A `markLane(pane)` ViewPlugin appends its lane to `view.dom` and redraws through `view.requestMeasure`.
- Clicks go through a `markJump` Facet whose callback the controller provides.
- `marks.ts` is the same pure core as in A.

**Points 1–6.**
1. The Alt state is the same, but `showMarks` dispatches into all three views on every press and release: three transactions running every update listener.
2. Same lane.
3. Each plugin recomputes its own pane's spans (side: `chunk[side]` + its status mirror; Result: `chunkField` + diagnostics). That is a second geometry cache beside `Frame`'s, against architecture §5.1 "one cache".
4. Same click.
5. Same tests.
6. Fewer `index.ts` lines (about +6), but "shown" is held three times. Plan #63 rejected exactly "three copies of one fact".

## Option C: Vue renders the lanes; the controller exports ticks

Serves vision 1 for Vue readers. Costs visions 5 and 2.

**Data.**
- `MergeController.marks(): Readonly<Record<Pane, readonly TickView[]>>`, where `TickView = { top, height, kind, index }`.
- `onMarksChange`, and `clickMark(pane, index)`.
- Lanes are `<div>`s in MergeView's grid over each pane host.

**Points 1–6.**
1. Same Alt state.
2. Lane geometry needs CodeMirror's scroller metrics, so the controller must still measure and export them.
3. Ticks cross into Vue state on every change.
4. Clicks go back through an index.
5. Same tests, plus Vue rendering.
6. Three methods and two types more. Likely a sixth component (VU15). The geometry's owner splits across two layers.

## Tests (option A)

**Node: `editor/internal/marks.test.ts`**
- "rule 4: a place's top over the scrollable height, scaled to the track" (4000 / 800 → y 2000 maps to 400).
- "rule 4: never thinner than 2 px; an insertion point is 2 px".
- "rule 4: a document no taller than its pane maps 1:1".
- "rule 4: the find space moves ticks by its share".
- "rule 4: an overlay scrollbar gets the 14 px lane, a classic one its width; on Windows the track leaves out both arrows".
- "rule 4: a tick at the end stays in the track".
- "rule 4: a problem inside collapsed lines takes the wave line's place" (a fake `blockAt` that folds lines).
- "rule 3: a side marks exactly what it tints: waiting there, in its tone; applied, ignored and other-side changes none".
- "rule 3: the Result marks each change with a side waiting, none once resolved, one per problem, hint as info".
- "rule 3: errors above changes above warnings above info".
- "rule 5: within 4 px picks the tick, the nearest top wins among overlaps, farther picks none".

**Node: other files**
- `tone.test.ts`: `paneTone` rules.
- `viewport.test.ts`: "CENTER: a third down also when on screen, never above 0".
- `ui/altHold.test.ts`:
  - "rule 1: Alt's press shows; AltGraph never";
  - "rule 2: release hides";
  - "rule 2: another key hides and Alt's repeat keeps it hidden";
  - "rule 2: a key or pointer event with Alt up hides; with Alt down keeps";
  - "rule 2: leaving or hiding the page hides; back with Alt held, nothing until a fresh press".
- `ui/useMergeController.test.ts`: "built with `marks` as the view says, follows without a rebuild; none before the file loads".

**WebKit: new `editor/marks.browser.test.ts`** (paneHarness, `pnpm test:browser`)
- Hidden lane: `elementFromPoint` at the right edge hits the scroller.
- Shown: each tick top equals the thumb top within 1 px when its place is scrolled to the top.
- Collapsing on puts ticks below a run higher than off.
- Applying a change removes its side and Result ticks within one frame.
- A side tick outlines its change, the side gets the keyboard, Enter applies it, no selection.
- A Result tick on a problem in hidden lines shows them and puts the cursor at the problem's start.
- `{Alt>}` + a press on text behaves like a plain press.

**Fixture page** (`just app-session start-fixture --name b-marks-fx`, or MiniBrowser through `just webdriver 4446`)
- `read` dispatches synthetic Alt `keydown`/`keyup`, another key and `blur`, then checks `.change-marks:not([hidden])` and the tick count per host.
- Colours via `getComputedStyle`, dark and then Light through Settings.
- `shot` to `/tmp/yamt-b-ws/`.

**Real app** (`just app-session start-app --name b-marks --repo <scripts/lsp-repo.sh --servers /tmp/yamt-b-ws/lsp>`, `D=$(jq -r .display /tmp/yamt-app-session/b-marks.json)`)
1. No ticks without Alt.
2. `DISPLAY=:$D xdotool keydown alt` → three lanes with the expected counts; `keyup alt` → none.
3. Alt held + `xdotool mousemove X Y click 1` on a side tick (rect from `read`) → outline, side focused, selection collapsed; `keyup alt`; `press --x11 Enter` → applied, tick gone.
4. A Result tick on a problem in a collapsed run → the lines show, the cursor is on the problem's line.
5. `keydown alt`, `focus-away`, `focus-back` → hidden; still hidden until a fresh `keydown alt`.
6. `keydown alt` + `xdotool key Down` → hidden.
7. Alt + click on text → plain press, nothing applied.
8. Scrollbar drag without Alt works as before.
9. Scroll timing with the 3.P method (200 × 40 px, mean / p95 / late), Alt up vs `main`, and Alt held.

## Recommendation: option A, two parallel builds

What it costs:
- `editor/index.ts` reaches about 297 of 300 lines; the next feature must move code out first.
- `Frame` gains one part.
- There is a second consumer of the tint rule, so `paneTone` is extracted, with small edits in `decorations.ts`.

**Build E (editor), about 1,150 lines over 20 files.**
- New: `editor/internal/marks.ts` (~140), `marks.test.ts` (~260), `markLanes.ts` (~180), `editor/marks.browser.test.ts` (~220).
- Changed:
  - `editor/index.ts` (+12)
  - `internal/frame.ts` (+7)
  - `internal/sideFocus.ts` (+6)
  - `internal/viewport.ts` and `viewport.test.ts` (+37)
  - `internal/tone.ts` and `tone.test.ts` (+47)
  - `internal/decorations.ts` (±10)
  - `editor/theme.css` (+40)
  - `src/style.css` (+16: 7 tokens per theme)
  - `editor/problems.browser.test.ts`, `editor/removals.browser.test.ts` (+1 each: `marks: false`)
  - `ui/useMergeController.ts` (+8) and its test (+40)
  - `docs/architecture.md` (§5.1 row, §5.2 method and internals) and `frontend/src/editor/AGENTS.md`.

**Build U (ui), about 240 lines over 5 files.**
- New: `ui/altHold.ts` (~85), `ui/altHold.test.ts` (~130).
- Changed: `ui/App.vue` (+3), `ui/MergeView.vue` (+4: prop `marks`, option), `CHANGELOG.md` `[Unreleased]` "Added".

**Fixed contract between them.** `useMergeController(data, hosts, { readOnly, preferences, collapsed, marks: MaybeRefOrGetter<boolean>, servers })`. Build E owns it, the fake controller in its test, and `docs/architecture.md`, including this §5.1 row text from U: "change marks shown | `ui/altHold.ts` `useAltHold()`, one instance in App.vue; the shown file's controller through `marks` → `MergeOptions.marks`/`showMarks`".

The two builds can run in parallel. The typecheck passes only once both land; the main agent verifies after both: `just check`, `pnpm test`, `pnpm test:browser`, then the fixture-page and real-app steps above.

**Proposed tokens for `style.css`:**

| kind | dark | light |
|---|---|---|
| inserted | `#447152` | `#aadeaa` |
| modified | `#43698d` | `#b6d2f2` |
| deleted | `#656e76` | `#c8c8c8` |
| conflict | `#8150be` (plan #32's Purple6) | `#c6bbf5` |
| error | `#d64d5b` | `#cf5b56` |
| warning | `#c29e4a` | `#f2bf57` |
| info | `#756d56` (Darcula) | `#d9cfad` |

Light conflict `#c6bbf5` is derived: yamt's light conflict band (`#967bef6b` over white ≈ `#d3c8f8`) taken one step darker, the way Light/Default stripes relate to their bands (`c2d8f2→b6d2f2`, `BEE6BE→AADEAA`).

## Open questions (product)

1. **Placement on a tick click.** WebStorm puts the clicked place a third of the way down every time, even when it is already on screen. Rule 5's keyboard placement leaves the view still when the change is fully visible, and starts a tall change two lines from the top. With WebStorm's, clicking a tick for a change already in view still moves the view. I recommend WebStorm's (DR6).
2. **Ticks for info and hint problems.** Islands Dark draws no weak-warning marks; Light does. Rule 3 gives every underlined problem a tick, so a server that sends many hints (TypeScript's "unused") can fill the Result's lane with grey ticks drawn under the changes. Keep them, or drop info/hint ticks in both themes?

## Open risks

- **Rule 3 correction (overlap order):** errors > changes > warnings > info. Source: `HighlighterLayer.java`, `DiffDrawUtil.STRIPE_LAYER`, `UpdateHighlightersUtil.getLayer`, `EditorMarkupModelImpl.drawErrorStripeMarkers`. The side and Result change sets themselves are correct.
- **Rule 3 note:** WebStorm's Result has no change marks (`DiffViewerHighlighters.createHighlighter` `.withHideStripeMarkers(side == ThreeSide.BASE)`). The owner's request overrides this; record it in row #80.
- **Rule 5 correction:**
  - WebStorm acts on click, not press.
  - It matches the nearest top within ±2 × the minimum height.
  - It moves the caret to the line's end first, which opens a fold; then to the start, with no selection.
  - It gives the editor the keyboard and uses `scrollToCaret(CENTER)`, which always places the line a third down.
  - Source: `EditorMarkupModelImpl.kt` `doMouseClicked`/`doClick`/`getNearestRangeHighlighter`, `ScrollPositionCalculatorImpl.getVerticalOffset`. The placement part is open question 1.
- **Rule 4 note:** WebStorm's mark stops at the top of its last line and is 1:1 for short files. yamt spans the whole change as rule 4 says. The difference shows only in files without a scrollbar.
- **Window managers taking Alt+press:** desktops whose window manager uses Alt+drag to move windows (Plasma 5, Xfce) may never deliver the tick press [INFERENCE about their defaults]. Check the owner's KWin setting.
- **Windows arrow inset** assumes square arrow buttons as wide as the scrollbar [INFERENCE]. Owner check on Windows, next to rule 8's.
- **Overlay scrollbar paint order:** that the lane paints above WebKitGTK's overlay scrollbar is [INFERENCE]; the WebKit step checks it.
- **Anchor correction edge case:** a `scrollTop` written within 1 px of the current one after a reveal above CodeMirror's scroll anchor lets CodeMirror's anchor correction shift it (`index.js:8186–8189`). Rare and minor.
- **Proposed plan row #80 (DR5):** "Change marks while Alt is held (owner 2026-10-16, #1200; 3.O option A): hold in `ui/altHold.ts` (one App instance); lanes in each `view.dom`, painted from `Frame`'s rows by `MarkLanes`; WebStorm's error-stripe geometry, order, matching and click. | Rejected: the hold in the store (300-line cap) or in `keys.ts` (not an action; `modClick` precedent); per-pane plugins (three copies of 'shown', a second geometry cache); Vue lanes (larger surface, metrics leave the editor) | 2, 5, 1".

## Deviations from the brief

- Nothing was extracted to `/tmp/yamt-b-ws/`. With read-only tools, the jar members were read in place with archive paths.
- The tree was read at `2dd0c71`. Its parent is `407ec81` and the commit message says docs only, so I took `frontend/src` to be unchanged [INFERENCE].