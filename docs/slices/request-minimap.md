# Owner request — a minimap of the Result while Alt is held (2026-10-18, replaces plan §2 #80's scrollbar marks)

For the orchestrator. Intent captured with the owner in the main session; the product questions below are answered.
What is left open is design (designer) or marked as an orchestrator default the owner may veto.

## The owner's words

> "the merged feature isnt what im looking for, im looking more like a vscode minimap of the code and its
> conflicts/errors. With the twist that it shows errors on the left of minimap and conflicts on the right of minimap."

> (on the Alt scrollbar marks merged in `7141a81`) "remove them, the new minimap is still only visible on alt modifier"

Answers to the questions asked (owner's choice in bold, the other options in brackets):

| question                       | answer                                                                                                                                                                                |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Which panes get a minimap?     | **One minimap of the Result, at the window's right edge** (Result only, beside its text; one per pane)                                                                                |
| What does the right edge mark? | **Every change still waiting in the Result, conflicts in the conflict colour, others in their band colour; gone once decided** (conflicts only; every change with decided ones faded) |
| What does the left edge mark?  | **The Result's errors and warnings, errors over warnings** (errors only; every severity)                                                                                              |
| A file taller than the window? | **Fixed size per line; the minimap scrolls along with the code (VS Code's "proportional")** (whole file always fits)                                                                  |
| The Alt scrollbar marks (#80)? | **Remove them; the minimap is the thing that shows while Alt is held** (keep both)                                                                                                    |
| Where does it get its space?   | **It floats over the right pane's right edge while Alt is held; the layout never moves** (panes shrink while held; a column always reserved)                                          |
| What does a click do?          | **Scroll only, like VS Code: the clicked line to the middle, the slider drags; the cursor and keyboard stay** (a mark click also moves the Result's cursor, as #80's jump did)        |

## Rules (product terms)

1. **Shown while Alt is held**, exactly the hold #80 settled and `ui/altHold.ts` implements (`heldAfter`): Alt's own key
   press (`key` "Alt", Option on macOS, never AltGr's "AltGraph"); hidden on its release, on any other key pressed
   meanwhile, on window blur or the page hidden, on any key or pointer event reporting Alt up; back in the window with Alt
   still held shows nothing until Alt is pressed again. Only the shown file gets it (hidden files compute nothing, #51).
   Shown for every file in the three-pane view (editable or read-only); never for a choice view (#36/#47).
2. **One minimap, of the Result, at the window's right edge.** It floats over the right pane's right edge, the height of
   the panes' row (not over the column headers or the toolbar). Nothing in the layout moves when it appears; it covers
   that strip of the right pane's text and scrollbar while shown. Opaque background in the editor's colour, separated
   from the text under it (border or shadow) — the design picks which.
3. **The code, as VS Code draws it** (`editor.minimap` defaults, `editorOptions.ts:3484-3499`: `renderCharacters: true`,
   `maxColumn: 120`, `scale: 1`): each line a thin row (VS Code: 2 CSS px [INFERENCE from `editorOptions.ts:2810-2869`
   at device pixel ratio 1–2]), characters as tiny marks in the Result's syntax colours, text past 120 columns cut. It
   draws what the Result shows: a collapsed run of unchanged lines (#63) is one row, as it is one line in the pane, so
   the minimap and the pane agree at every scroll position. Width: VS Code's ~120 px for 120 columns, plus the two edges.
4. **Left edge — problems.** The Result's language-server errors and warnings, red and yellow, on the rows of the lines
   each problem spans; errors paint over warnings. Info and hints are not shown. A problem inside collapsed lines sits
   on that run's row (as #80). No language server, read-only file: an empty edge.
5. **Right edge — changes still waiting.** Every change the Result still tints (`tone.ts` `paneTone(chunk, status,
   "center")`, the one tint rule of bands, strips and #80's marks): conflicts in the conflict colour, the others in their
   band colour (added, changed, removed). Applying or ignoring the last waiting side removes it at once, also while Alt
   is held.
6. **Long files scroll along** (VS Code `size: 'proportional'`): rows keep their height; when the Result is taller than
   the minimap, the minimap's own window moves with the Result's scroll as VS Code's does. Marks far from the visible
   part are out of view — accepted by the owner.
7. **The visible area** shows as VS Code's slider box over the rows the Result shows on screen.
8. **Click and drag — scroll only** (VS Code `minimap.ts:1259-1269`, `revealLineNumber` → `VerticalRevealType.Center`,
   `:1130-1140`; slider drag `getDesiredScrollTopFromDelta`, `:252`, `:1345`): a press on a row puts that Result line in
   the middle of the Result; a press on the slider drags it and the Result follows; a wheel over the minimap scrolls the
   Result. The side panes follow through the locked scroll (`ScrollSync.follow`). The cursor, the selection, collapsed
   lines and which pane has the keyboard do not change; a press on an edge mark does the same as a press on its row.
   The press never reaches the right pane's text underneath (no selection, no side focus, no drag of an icon).
9. **Hidden costs nothing**: while Alt is up nothing is drawn or measured and nothing takes presses; scrolling is no
   slower than today (#51; measure as #80's final run did: late frames over 200 scroll frames, Alt up and held).
10. **Dark and light**: every colour from the theme's tokens.

## What goes (clean cutover of #80's scrollbar marks)

The owner's call is new information under DR4: `docs/plan.md` §2 #80 gets a replacement row (#81) below it; #80's
"Rejected" column records why. #80's Hold part carries over unchanged.

| piece (from `7141a81`)                                                                                                                                                                                | fate                                                                               |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `ui/altHold.ts` + test, `App.vue`'s single `useAltHold()`                                                                                                                                             | **kept**, now shows the minimap; rename `marks` (prop/option) to what it now means |
| `editor/internal/markLanes.ts`, `.change-marks`/`.change-mark*` in `editor/theme.css`                                                                                                                 | removed                                                                            |
| `marks.ts` `laneBox`, `ticks`, `tickAt`, `PICK_DISTANCE_PX`, `LANE_MIN_WIDTH_PX`, stripe tests                                                                                                        | removed                                                                            |
| `marks.ts` `changePlaces`, `problemPlaces` (document-space spans from `Frame`'s rows and line blocks)                                                                                                 | reuse if the design wants them; otherwise removed                                  |
| `markJump.ts` (`jumpTo`, `revealSteps`, `scrollToThird`), `viewport.ts` `thirdScrollTop`, `sideFocus.ts` `focusChange`, their tests (`folds.test.ts:31,329-333`, `viewport.test.ts:40-52`)            | removed: scroll-only clicks leave them without a caller                            |
| `tone.ts` `paneTone`, `geometry.ts` `PANE_TINT`, `problems.ts` `linted`                                                                                                                               | kept (bands, strips and `serverDoc.ts` use them)                                   |
| `--color-mark-*` tokens in `style.css` (WebStorm stripe colours)                                                                                                                                      | design decides: reuse for the edges or replace                                     |
| `MergeOptions.marks`, `showMarks`, `Frame`'s `jump` part                                                                                                                                              | replaced by the minimap's equivalents                                              |
| Docs: `CHANGELOG.md` Unreleased "Holding Alt …" entry (never released), `docs/architecture.md:559-560,573,576,623-632,848`, `editor/AGENTS.md:9`, project map lines, `SLICES.md` change-marks section | rewritten for the minimap                                                          |

## Facts for the design (sourced)

- **No room to the right**: the merge grid is pane | 40 px strip | Result | 40 px strip | right pane, then 4 px padding
  (`ui/MergeView.vue:180`, hosts `:222-241`). Hence the overlay over the right pane (owner's choice).
- **Scrollbars are native**: overlay on WebKitGTK and macOS, classic on Windows' WebView2 (`briefs/3.O-alt-marks-design.md:41-42`).
  The minimap covers the right pane's scrollbar while shown.
- **One geometry cache**: `Frame` (`editor/internal/frame.ts`) caches rows/anchors/waves, recomputes only on document,
  measured heights, statuses or folds, never per scroll (#51); it owns `ScrollSync` and today `MarkLanes`. #80 rejected
  a per-pane ViewPlugin and Vue-drawn lanes for being a second geometry cache / metrics leaving the editor.
- **Collapsed runs** are an inline `Decoration.replace` (`foldView.ts:30-47,75-86`) on yamt's own fold field
  (`folds.ts`), one 20 px line in the height map; `@codemirror/language`'s `foldedRanges` does not see them.
- **Problems** exist only in the Result, only when editable with a server running (`serverDoc.ts:102-111`); severities
  error/warning/info/hint; `@codemirror/lint`'s state via `forEachDiagnostic`; `linted()` flags new ones.
- **Syntax colours** are CSS variables in a `HighlightStyle` (`pane.ts:112-136`): a canvas needs them resolved per
  theme. Font JetBrains Mono 13 px, `LINE_HEIGHT_PX` 20 (`pane.ts:60`).
- **Sizes**: files up to 8 MiB reach the window (`crates/session/src/decode.rs:6`); real files measured in
  `briefs/3.P-scroll-performance.md:20-32`: 7,277 lines with 186 conflicts. Draw only the rows in the minimap's window.
- **Line caps**: `editor/index.ts` is at 300/300 (oxlint `max-lines`); removing #80's wiring frees some, but the next
  editor feature moves code out first (`handoff-change-marks.md:49`). `ui/store.ts` is at 290.
- **Existing package checked and not a fit** — `@replit/codemirror-minimap` 0.5.2 (MIT, peer `@codemirror/*`):
  mounts inside one view's `scrollDOM` as a gutter (`dist/index.js:1019`), not over another pane; draws problems as
  full-line tints in hard-coded colours `#d11`/`orange`/`#999` (`:426-471`); gutters only on the left (`:954-963`);
  sees folds only through `foldedRanges`/`foldEffect` (`:307-367`), so yamt's collapsed runs would show expanded;
  re-renders the whole canvas with `fillText` on each update (`:1058-1105`). Vision 5 / DR3: a dependency needs a row;
  the canvas 2D API is enough [the designer confirms].
- **WebStorm (DR6)** has no built-in minimap; the owner chose VS Code's (precedents of copying VS Code where WebStorm
  has nothing: #44, #58, #61). VS Code's own twist differs: it puts source-control changes in an 8 px left gutter
  (2 px marks at x=2, `minimap.ts:48,1736-1739`, `MINIMAP_GUTTER_WIDTH` 8) and problems inline on the text; the owner
  wants problems left, changes right.

## Acceptance

In WebKit (fixture page, `just webdriver`) and in the real app with real Alt input, on a file with changes far apart,
conflicts and language-server problems (errors and warnings), long enough to scroll:

- No minimap without Alt; Alt shows it at the window's right edge over the right pane; release hides it; Alt+another key
  hides it; window blur with Alt held hides it and it stays hidden on return until Alt is pressed again.
- It shows the Result's code in syntax colours; collapsed runs are single rows; toggling collapsing redraws it.
- Left edge: one mark per error/warning line range, red over yellow; none for info/hints; none without a server.
- Right edge: every waiting change in its colour, conflicts purple; applying a change while Alt is held removes its mark.
- In a file taller than the window the minimap scrolls with the Result; the slider covers the Result's visible rows.
- A click on a row centres that Result line; dragging the slider scrolls; a wheel over it scrolls; the sides follow;
  cursor, selection, collapsed lines and keyboard focus unchanged; nothing selected or applied in the right pane.
- The old scrollbar marks are gone (no `.change-marks` in the DOM); `just check` passes, including `map-check`.
- Dark and light; scroll timing no worse than before, Alt up and Alt held.

## Non-goals

A minimap without Alt; a setting or toolbar button for it; a minimap for the side panes; find matches, selection or
cursor in the minimap; info/hint problems; hover text; VS Code's section headers; resizing it; keyboard access; a click
that moves the cursor or opens collapsed lines; Rust or IPC changes.

## Orchestrator defaults (boring choices; the owner may veto)

- **Slider always visible while shown** (VS Code's default is `showSlider: 'mouseover'`): the map is on screen only while
  Alt is held, so a box that waits for the pointer would hide "where am I" most of the time. A deviation from VS Code —
  confirm with the owner at the smoke screenshot.
- **Releasing Alt mid-drag hides the minimap and ends the drag where it is** (the hold's existing rule: any event
  reporting Alt up hides).
- **Mark sizes**: VS Code's 2 px rows would make a one-line error a 2×2 px dot; the design proposes a minimum mark size
  (#80 used 2 px tall within a 14 px lane) and the smoke shows it on screen.

## Risks and owner checks

- **Alt+drag on Linux desktops** that move windows with Alt+drag (Xfce, KDE Plasma 5) take the press before yamt sees
  it, so the slider drag cannot work there; Plasma 6 defaults to Meta [INFERENCE, from `handoff-change-marks.md`].
  One Alt+drag on the owner's desktop settles it.
- **Windows**: Alt alone must not enter menu mode (WebView2 hands it to the page, #80); unchanged, still unverified.
- **#1219** (locked scroll landing wrong at a side's very end) is still open; the minimap scrolls through the same
  `follow`, so a drag to the end may show it.
- **Covering the right pane**: anything the user needs there while Alt is held (e.g. its scrollbar) is under the minimap.

## Suggested order (refine at slice mapping)

1. Designer: two or three options for who owns and draws the minimap (inside the editor beside `Frame`, its geometry
   and scroll lock; where its element lives so it floats over the right pane; canvas drawing of only the visible window;
   resolving syntax colours per theme; edge mark sizes), how `editor/index.ts` gets under its cap, and the plan §2 row.
2. One web slice: remove #80's scrollbar marks and the jump (the cutover table above) and make room in `editor/index.ts`.
3. One web slice: the minimap (code, slider, click/drag/wheel, both edges), shown by the existing Alt hold. Split
   drawing and edges into two slices only if the design shows it exceeds one slice's size.
4. Final run: `just check`, `just mutants <commit before the feature>`, WebKit and the real app per the acceptance,
   scroll timing.
