I've built the slice, but it isn't ready to merge: on this patch's build, scrolling is clearly slower than on the commit before it, and I haven't found the cause. Everything else in the brief works and was observed in WebKit and the real app.

```
summary
  - ResizeDots.vue: three 3 px dots, pointer-events none. Colours: bg-handle at rest, bg-handle-active 300 ms after hover, at once while dragging.
  - MergeView builds its grid from paneColumns(paneSplit, "strip"). The header cells above the strips are now separators with dots. The strip wrappers are col-resize and use the same usePaneDividers listeners. This covers the deleted-side view too.
  - ChoiceView uses the same split with 1 px gutters at columns 1/3/5. Each gutter has a 5 px hit box at z-10 with dots.
  - FileList uses useColumnDrag; its width comes from createFileListWidth and is remembered. A double-click resets it to 240 px.
  - style.css: the two handle tokens in both themes and the :root.col-resizing rule. theme.css: bands take no pointer events. New strips.browser.test.ts.
  - app-session: drag, click --double, start-app --home. CSS queries now reach elements inside aria-hidden. Label names (asked by Main).
  - fileListWidth.ts: FILE_LIST_BOUNDS (#1273).

files_changed
  frontend/src/ui/ResizeDots.vue (new), frontend/src/ui/MergeView.vue, frontend/src/ui/ChoiceView.vue, frontend/src/ui/FileList.vue,
  frontend/src/ui/fileListWidth.ts, frontend/src/ui/fileListWidth.test.ts, frontend/src/style.css, frontend/src/editor/theme.css,
  frontend/src/editor/strips.browser.test.ts (new), frontend/scripts/app-session.ts, frontend/scripts/app-session/{args.ts,args.test.ts,argv.ts,drive.ts,start.ts,find.ts,find.test.ts}

tests_added
  strips.browser.test.ts (WebKit):
    - "a press on a band below its icon row reaches the strip's svg". Hand mutation: band rule removed → "expected SVGPathElement{} to be SVGSVGElement{}".
    - "a press on an icon's hit area, off its glyph, reaches the icon". Hand mutation: pointer-events none on `.chunk-action rect` → "expected null not to be null".
    - "a press on a wave join reaches its fold run". Hand mutation: `.strip-wave-hit` set to pointer-events none → "expected null not to be null".
    All three restored; restored run: 3 passed.
  args.test.ts:
    - start-app home null by default and --home read.
    - "--home needs a folder": no value refused; start-fixture refuses --home.
    - click --double parsed.
    - drag: name or css, signed --dx, optional --dy, --nth. Refused: missing --dx, 1.5, "right", "-", no target, --double.
  find.test.ts:
    - a CSS match inside aria-hidden is picked when painted; a name never picks it.
    - an input is named by its labels (wrapping or for=), after aria-label and before title.
  fileListWidth.test.ts:
    - "the CSS bounds are the clamp's: 160 px and half the window".

smoke_evidence
  1. Recipes, run in frontend/:
     - fmt:check exit 0 "All matched files use the correct format."
     - lint exit 0
     - typecheck exit 0
     - test exit 0 "Tests 1530 passed (1530)"
     - unused exit 0
     - sfc-order exit 0
     - test:browser: strips.browser.test.ts "Tests 3 passed (3)". The whole project gives "Test Files 2 failed | 2 passed (4), Tests 4 failed | 8 passed (12)". The same 4 tests fail on a copy of HEAD b22bd67: problems/removals screenshot "Access denied to /tmp/yamt-…png (server.fs)", and the two removal tests that follow it.
     - Playwright WebKit had never launched on this host. I ran it with PLAYWRIGHT_BROWSERS_PATH=/tmp/h-pw (a copy of webkit-2370 plus the Ubuntu noble libicu74, libxml2 2.9.14 and libflite1 .so files in minibrowser-wpe/sys/lib) and the same LD_LIBRARY_PATH. The repo and ~/.cache were not touched.
  2. WebKit, MiniBrowser through `app-session start-fixture --name h-fx` (dev server and `just webdriver` on free ports, not 4448), 1600x964 inner:
     W1 dots:
       - dark tokens #565362/#aba9b6; all three dots rgb(86, 83, 98), 3x3, centre offset 0.0, cursor col-resize.
       - hover on "Local and Result widths": delay 0.3s, first read still rgb(86, 83, 98), next read rgb(171, 169, 182).
       - hover on an apply icon: all handles rest.
       - light: rgb(174, 179, 194); the hovered one rgb(118, 122, 138), delay 0.3s.
       - screenshots: /tmp/h-shots/dark-handles.png, light-handles.png.
     W2 drag left header +120:
       - hosts [254,418.984] [712.984,419.016] [1172,419] → [254,538.984] [832.984,299.016] [1172,418.984]. Remote changed by 1/64 px (one WebKit layout unit).
       - strip 672.984 → 792.984, width 40.
       - band d unchanged.
       - fixed left scroll gives scrollTops [101,181,181] before and after.
       - Result --fold-wave-x/period 3.9296875px/19.578125px → 3.8359375px/19.421875px.
       - zoomed join: /tmp/h-shots/join-after-drag.png, the wave unbroken.
     W3 strip as handle:
       - drag from the right strip's background -60: Remote 418.984 → 479, Result 299.016 → 239.016, Local unchanged.
       - drag ".chunk-action-apply rect" --dx 0: "3 changes · 1 conflict" → "2 changes · 1 conflict", split unchanged.
       - same with --dy 330: covers 3, giving "1 conflict".
       - drag on ".strip-wave-hit" --dx 0: centre lines 54 → 62.
       - Ctrl+click in the left pane (raw W3C actions): icon rows 5 → 4. The Ctrl+Z after it did not bring the row back; not looked into.
     W4 minimum: dx -680 gives Local 220 (Remote 419 kept); after a reset, +890 gives Result 220.
     W5 double-click: on the divider the panes are 418.984/419.016/419; file list 340 → 240, key removed.
     W6 keyboard and cursor:
       - while held: root class col-resizing, cursor col-resize on body and on .cm-line, getSelection "" , activeElement still the left pane's cm-content, split follows the pointer.
       - document.hasFocus() is false in this MiniBrowser, so focus outlines could not be compared.
       - W3C "release actions" does not deliver pointerup in WebKitWebDriver (the class stayed until an explicit pointerUp).
     W7 narrow windows:
       - 1100: Result 220, Local:Remote 296.859:240.141 = the stored ratio.
       - 1000: 219/219/219.
       - 700: 119 x3.
       - back to 1600: 518/320/419.
       - the stored value was unchanged at every size.
     W8 reload: split the same; vue-core-playground-app.vue shows the same hosts.
     W9 garbage {"local":0.9,"remote":0.5}: 418.984/419.016/419.
     W10 minimap and find bar:
       - Alt held after a drag: minimap display block, right edge 1591 = right scroller's right edge.
       - Ctrl+F in Result: the bar sits pane right −16 px and is capped at pane width −32 (287 of 319). At thirds it is 318 wide in a 419 pane.
  3. Real app (target/debug/yamt, scripts/conflict-repo.sh /tmp/h-repo, sessions h-split / h-narrow / h-light):
     - drag left divider +150 on docs/removed.md (deleted-side view): 418.984 → 568.984, Remote 419 kept.
     - assets/logo.bin (choice view): columns 607.906/287.422/447.656 = 0.4527/0.3333, the same as the merge views.
     - choice view gutter drag -50: Remote +50.03, Local unchanged. Deleted-side view and src/added.ts then show 568.969/222.219/465.813, the same split.
     - click --double on each handle: file list back to 240; panes 418.984/419.016/419.
     - restart with --home /tmp/h-home: before stop fileList 300, hosts [314,541.813] [895.813,256.188] [1192,399]; after a new start-app, identical.
     - drag ".chunk-action-apply rect" --dx 0 on vOn.ts: "2 changes · 1 conflict" → "2 changes", split unchanged.
     - --size 1000x800: panes 199 x3, stored split unchanged.
     - h-light: dots rgb(174, 179, 194); screenshots /tmp/h-shots/app-light.png, app-light-choice.png.
  4. Scroll timing (.omp/run/scroll-timing.py, private Xvfb :93, same HOME for both builds), frames over 20 ms of 200:
     - before (b22bd67 build): 16/14/30/25/21/12/30/15; a second run 14/13/18/25/25/16/38/29.
     - this patch after one drag: 90/100/97/104/124/100/128/98, mean 20–23 ms.
     - this patch at equal thirds: 92/102/99/105/125/99/133/101.
     - so it is slower, and the dragged width is not the cause. See open_risks.
  5. All sessions stopped (h-fx, h-split, h-narrow, h-light, h-tdrag, the timing tauri-driver and Xvfb).

deviations_from_brief
  - #1273: FILE_LIST_BOUNDS {minWidth "160px", maxWidth "50vw"} exported from fileListWidth.ts and built from the same constants as the clamp. FileList binds it and drops min-w-40 max-w-[50vw]. createFileListWidth's signature is unchanged.
  - app-session label names: find.ts collects `element.labels` text (wrapping <label> and <label for>). nameOf goes aria-label → labels → title → content (HTML-AAM).
  - app-session find.ts: CSS queries pick painted elements even inside aria-hidden. The strip svg is aria-hidden, so `drag ".chunk-action-apply"` could not find anything before. Name queries still skip aria-hidden.
  - No component was split out: oxlint max-lines counts only MergeView's script block, and lint passes (the file is 313 lines in total).
  - FileList's press measures the list's width once and each move calls setWidth(width at press + dx, innerWidth).
  - The fixture session used free ports from start-fixture instead of 4448.
  - Lines wanted in ui/AGENTS.md (row 7 owns it):
    "ResizeDots.vue: the three dots of every resize handle (DotsState from useColumnDrag). MergeView's header cells above the strips and the strip wrappers are the pane dividers (usePaneDividers); ChoiceView's 1 px gutters carry the same dividers with a 5 px hit box; FileList's handle uses useColumnDrag and FILE_LIST_BOUNDS."
  - Also needed outside my files: the project map tree must name ui/ResizeDots.vue and editor strips.browser.test.ts (map-check); architecture and CHANGELOG.
  - frontend/.vitest/attachments/ was left by test:browser; bash-guard refused to delete it, so it needs removing.

open_risks
  - Scroll timing regression, cause not found. Lab builds of b22bd67 with one piece added each:
    - the col-resizing rule alone: 11/13 frames late;
    - the inline paneColumns grid alone: 21/29 frames late.
    Neither explains ~100 late frames. Untested suspects: the v-on pointer listeners and cursor-col-resize on the will-change strip wrappers (MergeView.vue strip wrappers) and the separator header cells. This needs to be bisected before merge.
  - Remote keeps its width to within 1/64 px, not exactly (WebKit layout unit), in both WebKit and the app.
  - WebKitWebDriver "release actions" sends no pointerup, so an automated drag that fails part-way leaves col-resizing set until the next real pointerup. A real mouse is unaffected.
```