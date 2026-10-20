**verdict: fail.** One `block`: a double-click whose first click lands on an icon or a wave join resets the remembered split. Two `should`s.

```json
{
  "verdict": "fail",
  "findings": [
    {
      "severity": "block",
      "file": "frontend/src/ui/MergeView.vue",
      "line": 273,
      "rule_id": "plan §2 #84 (icons and wave joins keep their own presses)",
      "problem": "A quick double-click on an apply or ignore icon, or on a strip wave join, resets the stored split to thirds. The first click applies the change, so its icon row goes away, or it opens one step of the run, so the join moves. The second press then lands on the svg root, which the band rule makes the target even where a band is painted. The browser sends the `dblclick` to that second target, `dividerHandle.accepts` sees the svg root, and `useColumnDrag.doubleClicked` (useColumnDrag.ts:114) calls `resetPaneSplit`. The same happens on the right strip wrapper (MergeView.vue:285). No test or smoke step covers a double-click that starts on an icon or a wave (W3 uses single presses and drags only; W5 double-clicks the divider itself).",
      "fix": "In `useColumnDrag`, which is row 4's file (route it through `deviations_from_brief`), remember whether each of the last two `pointerdown`s the handle saw was accepted, and reset on `dblclick` only when both were. Add a node test: a rejected pointerdown, then an accepted one, then `dblclick` gives no reset; two accepted ones still reset."
    },
    {
      "severity": "should",
      "file": "frontend/src/ui/useColumnDrag.ts",
      "line": 96,
      "rule_id": "design option A §2 'When the dots brighten'",
      "problem": "[INFERENCE, not observed] During an icon drag (#45), `IconDrag.start` captures the pointer on the strip svg. Pointer Events then fire `pointerover` at the capture target, so `hovered` sees the svg root, accepts it, and the header dots brighten after 300 ms while the user covers icons. That breaks the design's rule 'over an icon the dots stay at rest'. Nothing gets harder as the app grows. If W3's `--dy 330` drag shows `bg-handle-active` on the dots, this is a user-visible bug and should be graded `block`.",
      "fix": "In `hovered`, set `rest` whenever `event.buttons !== 0`, so only a pointer with no button held brightens the dots, and add a node case for it."
    },
    {
      "severity": "should",
      "file": "frontend/scripts/app-session/args.test.ts",
      "line": 163,
      "rule_id": "VF7",
      "problem": "Mutation survivor `args.ts:201:22` (`offsetPx(dx, \"--dx\")` → `\"\"`) lives because the `--dx 1.5` and `--dx right` cases match only `/whole number/`. A bad `--dx` could report an error without the option's name and the test would still pass. Nothing gets harder as the app grows.",
      "fix": "Assert `/--dx 1\\.5: expected a whole number/`, as the `--dy -` case already does for `--dy`."
    }
  ],
  "checked": [
    "Read the commit's own diff with `git show d989b9a -- frontend/`. The patch file also carries the ServerSwitch R1 notes and patches, which are not part of this review.",
    "MergeView grid: `:style gridTemplateColumns = paneColumns(paneSplit, \"strip\")` replaces the `grid-cols-[…]` class. Column starts are unchanged (1 to 5) and the deleted-side cells use `column.gridColumn` col-start-1/5. The deleted-side view is the same component, and its `invisible` host stays in the grid, so it is still measured.",
    "MergeView press measure: `paneWidths` returns the `left`, `center` and `right` host widths. Each host is a `min-w-0` grid item that stretches to its track, so their sum equals the grid's content width minus 2 × 2.5rem (the section's `px-1` is outside `100%`). That matches `dragged`'s `total` and `least = min(220, total/3)` and `paneColumns`' `min(220px, calc((100% - 2 * 2.5rem) / 3))`.",
    "ChoiceView: `paneColumns(paneSplit, \"gap\")`; sides at col-start-1/5, Result at col-start-3; 1 px gutters at col 2/4 across both rows with no background, so the section's `bg-separator` shows as `gap-x-px` did. Hit box is `absolute -inset-x-[2px] z-10` (5 px wide, inside the cells' 12 px padding), dots centred vertically. Measure: local = localGutter.left − section.left, center = remoteGutter.left − localGutter.right, remote = section.right − remoteGutter.right. The section has no padding or border, so these are the track widths.",
    "Accept rule with the real DOM: the header cells' `ResizeDots` is `pointer-events-none`, so a press targets the cell. Each strip svg is a direct child of its wrapper, so `target.parentNode === currentTarget` holds. Icon presses (`stripIcons.ts:81` group listener, then `IconDrag` capture on the svg) and wave presses (`.strip-wave-hit`, `folding.ts` mousedown and click) are refused by `dividerHandle.accepts` (`usePaneDividers.test.ts:67`).",
    "Ctrl/Cmd+click is untouched: `modClick.ts:50` is a pane `domEventHandlers` mousedown and never sees the strips.",
    "Band rule: `path.chunk-band { pointer-events: none }` is scoped to the svg path. The CM line decorations `.cm-line.chunk-band` are divs and unaffected. Nothing in `editor/internal` listens to band presses (grep of chunk-band and event.target). `sideFocus` listens only on pane scrollDOMs.",
    "Cursors: `.chunk-action { cursor: pointer }` and `.strip-wave-hit { cursor: pointer }` override the wrapper's inherited `cursor-col-resize`; bands show col-resize, which matches a press there.",
    "`:root.col-resizing *` sits in `@layer base` with `!important`, and a layered `!important` beats unlayered normal declarations (CodeMirror, theme.css). The class literal is pinned against `COLUMN_RESIZING_CLASS` by `useColumnDrag.test.ts:139`. W6: col-resize on body and `.cm-line`, `getSelection` empty, `activeElement` kept.",
    "ResizeDots: three dots, 3 px each, 3 px apart, `pointer-events-none`, `aria-hidden`. rest = `bg-handle delay-0`, hover = `bg-handle-active delay-300`, drag = `bg-handle-active delay-0` under `transition-colors`, so there is a 300 ms delay going in and none going out or on drag. A hover cancelled within 300 ms returns to rest without a flash.",
    "Tokens: dark #565362 / #aba9b6, light #aeb3c2 / #767a8a in both theme blocks. W1 read rgb(86,83,98) → rgb(171,169,182) in dark and rgb(174,179,194) → rgb(118,122,138) in light, both after 0.3 s.",
    "The dots share one `DotsState` between the header cell and the strip wrapper. Moving from the strip to the header gives leave then over, so the dots end on hover. While a drag runs, over and leave are ignored (row 4's test at `useColumnDrag.test.ts:281`).",
    "FileList: `accepts` is target === currentTarget. The press measures the aside once and each move calls `setWidth(pressWidth + dx, innerWidth)`, so there is no drift and no dead zone past the cap: a width stored above 50vw is replaced by the visible width at the next press. `FILE_LIST_BOUNDS` (160px / 50vw) equals the old `min-w-40 max-w-[50vw]` at a 16 px root, and `fileListWidth.test.ts`' new case ties it to the clamp (it fails if either side changes alone). A double-click gives `resetWidth` → `w-60` = 240 px (W5: 340 → 240, key removed). The dots sit in the 5 px `w-island` gap.",
    "WebKit `strips.browser.test.ts`: test 1 fails without the band rule, and tests 2 and 3 fail with pointer-events none on `.chunk-action rect` or on `.strip-wave-hit`; the report shows all three hand mutations failing. Test 1's point lies between the icon row's bottom and the band's bottom, inside the band fill, which the mutation's `SVGPathElement` result proves. None of the three would pass with its rule deleted.",
    "Rule 7 and the risk register: RK4 locked scroll (W2 follower scrollTops [101,181,181] before and after), RK9 bands (W2 band `d` unchanged), #64 waves (W2 Result `--fold-wave-x/period` rewritten after the drag, zoomed join unbroken), minimap #81 (W10 right edge 1591 = scroller edge), find bar (W10). No editor line beyond the band rule changed, so CM1–CM9 are not affected.",
    "W3 'Ctrl+Z after Ctrl+click did not bring the row back' is not caused by the changed lines: the keyboard path (historyKey, pane keymap, modClick) is untouched, and the new listeners cancel mousedown only on accepted handle presses. [INFERENCE] It is a raw-W3C-actions artifact or a pre-existing behaviour; check it on the base build if it matters.",
    "test:browser: the strips file passes 3 of 3. The other 4 failures (server.fs denying /tmp screenshot paths) reproduce on the earlier HEAD b22bd67 per the report, so they are environment failures, not this patch. Accepted as reported; the verifier reruns it.",
    "app-session args: `drag` takes a name or CSS target, a signed `--dx` (required), `--dy` (default 0), `--role` and `--nth`, and refuses 1.5, 'right', '-', a missing target and `--double`. `click --double` parses. `--home` with no value is refused, and start-fixture refuses `--home`. All covered in args.test.ts.",
    "app-session start/stop: with `--home`, home = `fromRoot(dir)` and `.config` is created recursively (created when missing). The owner-config clash check still runs. HOME and XDG_CONFIG_HOME are set and the derived XDG variables removed, so WebKit's localStorage lives under the given home. stop.ts:29 removes only `state.folder`, so the home is kept. The restart check gave identical hosts and file list width.",
    "find.ts: CSS queries use `isPainted` (aria-hidden allowed) and name queries still use `isVisible`. Hidden MergeViews are `invisible`, so they are still filtered by computed visibility. `find.test.ts` kills both an unpainted pick and a reverted filter. Label names are tested for wrapping and for= labels, ordered after aria-label and before title.",
    "Mutation survivors: app-session.ts:22 (`drag` case) dropped under VF7 (c), wiring observed in the W3 and real-app drags. drive.ts drag body (83–105) dropped under VF7 (c), thin driver per the project map: the end point and sign were observed in W2 (+120 exact), W3 (−60) and `--dy 330` (covers 3). drive.ts 68–77 (W3C double) dropped under VF7 (c), observed in the W5 double-clicks. drive.ts 60–62 (`xdotool click --repeat 2 1`) matches xdotool's `click [--repeat N] button` syntax on reading, but no `--x11 --double` run was reported [INFERENCE]; thin driver. start.ts 52/70 dropped under VF7 (c), observed at every start and in the `--home` restart. start.ts:73 (`recursive`) is needed only for `--settings` on a reused home, which was not observed [INFERENCE]; thin driver. args.ts:201 is kept as a finding.",
    "No .vue component test passes a value through (brief Tests); the `.vue` and `editor/` files are not mutated (VF7).",
    "No targeted test was run; the block rests on reading `doubleClicked` and `dividerHandle.accepts`, plus `dblclick` being sent to the second click's target in WebKit and Chromium."
  ]
}
```