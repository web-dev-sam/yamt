# V0ScrollSmooth

## summary
Scrolling no longer slows with opened files and stays under target on the owner's screen: inactive MergeViews skip render (content-visibility:hidden + invisible), both strips are updated in place by a keyed Strips class (measure-all-then-write), chunk rows are cached until doc/height/status change (anchors memoized by rows identity), and each strip sits in a bordered, own-layer (will-change-transform) wrapper which removed ~5 ms/frame of window-layer repaint. All 8 after rows: mean 14.5-16.1 ms, <=26 late of 200, all-opened within 1.3 ms of 1-opened.

## deviations_from_brief
[
  "Inactive files: MergeView root gets 'invisible [content-visibility:hidden]' when not shown. content-visibility skips layout/paint; invisible is kept because content-visibility hides only the contents — the root's own box still sits over the active file in the shared grid cell (col-start-1 row-start-1) and would take hit tests. CodeMirror's IntersectionObserver/ResizeObserver re-measure on reveal; no new MergeController method was needed.",
  "Strips: strips.ts now exports a Strips class (two GapStrips). Each strip holds a band layer <g> and an icon layer <g>; band <path>s and icon rows are kept in Maps keyed by chunk id; per frame both strips are measured (getBoundingClientRect/clientWidth/clientHeight/documentTop) before any DOM write, then only 'd' / 'transform' attributes change and the covered class is toggled. A row is rebuilt only when its look (apply mode, button x positions, line height) changes; nodes are added/removed when entering/leaving the strip or when the side closes; insertion keeps document order. keepEditorFocus mousedown and read-only (no icons) moved into Strips; controller destroy calls strips.destroy() (strips left empty, CM14).",
  "Rows: MergeController caches chunkRows in #rowsCache; the shared #repaint update listener (all three panes) clears it when rowsChanged(update, field) — geometryChanged (includes docChanged and height measurements, so find-space padding too) or the chunk field value changed (statuses). Find space itself only changes documentPadding/documentTop, which are still read per frame. ScrollSync memoizes anchorsOf(rows, ends) by rows identity; targets/0.5 anchor/echo handling unchanged.",
  "Further cost found (step 4): the strip border repainting inside the window's layer cost ~5 ms/frame on pnpm-lock.yaml even after in-place updates (JS was only ~0.5-1 ms/frame). Fix: each <svg> strip is now wrapped in a div carrying the grid placement, border-x and will-change-transform (own compositing layer); the svg is 'block h-full w-full' (clientWidth stays 38 px, top unchanged). A template comment cites the measurement (CP1).",
  "To keep strips.ts under 300 lines without a new file (a new file would need a project-map entry, PM6, outside my globs), crossesStrip, gapArrows and bandPaints moved from strips.ts to geometry.ts; drag.ts, apply.test.ts, sides.test.ts, drag.test.ts imports updated (clean cutover).",
  "Visible differences found by pixel compare (not in brief's 'no behaviour change'): (1) on showing a file again, the middle pane's overlay scrollbars flash briefly as after a scroll (content-visibility reveal); (2) the right strip's left 1px separator is now drawn — before, the middle pane's layer covered it.",
  "Docs outside my globs now stale; needed edits: .omp/skills/project-map/SKILL.md state row 'connector geometry | derived per frame, never stored' -> 'chunk rows: cached in MergeController, dropped on doc/height/status change (rowsChanged); strip positions written per frame'; docs/architecture.md:463-464 '(buttons are repainted every frame)' -> '(buttons persist; positions updated per frame)'; docs/architecture.md:488-491 'draws the bands into the two <svg> strips once per animation frame' -> 'updates band paths and icon rows in place once per animation frame; each strip is its own compositing layer'.",
  "Measured on the owner's real display (wayland-0) while the machine was also running other work (load ~3.4, other agents); repeated identical baselines varied 20-27 ms, so the after rows include that noise."
]

## open_risks
[
  {
    "location": "frontend/src/ui/MergeView.vue:138-150",
    "risk": "The own-layer fix (will-change-transform on the bordered strip wrapper) depends on WebKitGTK 2.54 compositing behaviour; the cited evidence (slice 3.P) lives only in this report — a plan §2 row would make it durable. Another WebKit version may not need or may penalize the extra layers."
  },
  {
    "location": "frontend/src/editor/index.ts:107-109",
    "risk": "The row cache trusts that every lineBlockAt change arrives through a ViewUpdate with geometryChanged (CodeMirror 6.43 measure path). A height change outside that path would leave strips/sync on stale rows until the next edit or measure."
  },
  {
    "location": "frontend/src/ui/MergeView.vue:84-87",
    "risk": "content-visibility reveal makes the middle pane's GTK overlay scrollbars flash on every file switch (observed in screenshots); cosmetic, but it is a difference from the before build."
  },
  {
    "location": "frontend/src/ui/MergeView.vue:148",
    "risk": "The right strip's inner (left) 1px border is now visible where the middle pane's composited layer used to cover it at a fractional pixel boundary; owner may notice a new separator line."
  }
]

## smoke_evidence
[
  {
    "command": "python3 .omp/run/scroll-timing.py --driver http://127.0.0.1:4754 --app /tmp/yamt-3p/yamt-before --repo /tmp/yamt-3p/repo   (BEFORE, worktree base 1f7501b; owner's real display, tauri-driver on wayland-0, window 1600x1000)",
    "observed": "| file | files opened | pane scrolled | mean ms | p50 | p95 | max | frames over 20 ms (of 200) | editors alive |\n|---|---|---|---|---|---|---|---|---|\n| renderer.ts | 1 opened | middle | 20.3 | 19 | 35 | 47 | 67 | 6 |\n| renderer.ts | 1 opened | left | 19.7 | 19 | 30 | 47 | 62 | 6 |\n| renderer.ts | all opened | middle | 32.5 | 33 | 63 | 88 | 135 | 21 |\n| renderer.ts | all opened | left | 31.5 | 31 | 58 | 96 | 137 | 21 |\n| pnpm-lock.yaml | 1 opened | middle | 38.2 | 36 | 58 | 84 | 199 | 6 |\n| pnpm-lock.yaml | 1 opened | left | 33.8 | 32 | 50 | 71 | 199 | 6 |\n| pnpm-lock.yaml | all opened | middle | 50.0 | 47 | 84 | 122 | 199 | 21 |\n| pnpm-lock.yaml | all opened | left | 54.7 | 52 | 85 | 99 | 199 | 21 |"
  },
  {
    "command": "python3 .omp/run/scroll-timing.py --driver http://127.0.0.1:4754 --app /tmp/yamt-3p/yamt-after --repo /tmp/yamt-3p/repo   (AFTER, same display and repo)",
    "observed": "| file | files opened | pane scrolled | mean ms | p50 | p95 | max | frames over 20 ms (of 200) | editors alive |\n|---|---|---|---|---|---|---|---|---|\n| renderer.ts | 1 opened | middle | 14.5 | 16 | 19 | 25 | 5 | 6 |\n| renderer.ts | 1 opened | left | 16.1 | 16 | 19 | 25 | 1 | 6 |\n| renderer.ts | all opened | middle | 15.8 | 16 | 24 | 32 | 26 | 21 |\n| renderer.ts | all opened | left | 16.1 | 16 | 22 | 30 | 18 | 21 |\n| pnpm-lock.yaml | 1 opened | middle | 14.8 | 16 | 26 | 39 | 17 | 6 |\n| pnpm-lock.yaml | 1 opened | left | 16.1 | 16 | 24 | 32 | 13 | 6 |\n| pnpm-lock.yaml | all opened | middle | 15.1 | 16 | 24 | 40 | 17 | 21 |\n| pnpm-lock.yaml | all opened | left | 16.1 | 16 | 23 | 30 | 12 | 21 |\nTargets: all-opened vs 1-opened max delta 1.3 ms (renderer middle); every mean <= 18; max late 26 <= 45."
  },
  {
    "command": "(intermediate, causes 1-3 only, no own-layer strips) same harness",
    "observed": "pnpm-lock.yaml 1 opened middle 27.2 / left 21.6; all opened middle 24.3 / left 21.9; renderer.ts 16.6-18.2. Profiling in-page (/tmp/yamt-3p/profile.py, rAF JS ~0.5-1.1 ms/frame): interleaved runs baseline 20.5-23.8 ms vs strip border:none 17.0-17.4; bordered wrapper div + will-change:transform 16.1/16.1/16.1 (13-15 late) vs same wrapper without will-change 20.0-24.4; will-change on the bordered <svg> itself 23.4-24.9 (no help)."
  },
  {
    "command": "python3 /tmp/yamt-3p/smoke.py {before,after} <binary> /tmp/yamt-3p/repo  (real app via tauri-driver; page screenshots to /tmp/yamt-smoke-3p/); compared JSON step by step",
    "observed": "All 18 recorded steps EQUAL before vs after. after: renderer.scrolled scrollTops [23741, 23014, 23086], 51 lines in view each; lock.find middle findBar \"vapor\"; renderer.back [23741, 23014, 23086], 51 lines each, renderer.same_scrollTop true; window.rect 1300x820 while pnpm-lock hidden; lock.after_resize [48649, 46049, 43884], 42 lines in view each, middle findBar \"vapor\"; lock.align band runs near middle [[455.6,492],[454.8,491.2],null] and identical band path d strings / icon class+top+title strings. Actions on pnpm-lock.yaml: start a88f02c81f2d; apply (right strip) 8ce8a1299456; ignore (left strip, last) text unchanged, icon removed; during drag over 3 left apply icons {icons covered: 3, covered lines: [8,0,0]}; after drag 1363100f53b4 (6872 lines); one Ctrl+Z -> 8ce8a1299456; Ctrl+click on left tinted block 44b282bfd42c. align after scrolling pane 0/1/2 to 900: scrollTops [900,966,875] / [809,900,809] / [939,990,900], band runs e.g. [[473.8,619.3],[498.8,589.7],[498.8,589.8]] — identical to before."
  },
  {
    "command": "compare -metric AE before-<n>.png after-<n>.png (ImageMagick) on the smoke screenshots",
    "observed": "lock-find 0; renderer-back 649 px and lock-after-resize 142 px: center pane overlay scrollbar thumbs visible right after the switch in the after build only; drag/after-actions 201 px: a 2-device-px column at x=2267 (right strip's left border) is separator #393B40 after vs #212121 before (previously covered by the middle pane's layer)."
  },
  {
    "command": "pnpm -C frontend lint && pnpm -C frontend typecheck && pnpm -C frontend test && pnpm -C frontend fmt:check && pnpm -C frontend unused && pnpm -C frontend sfc-order",
    "observed": "$ oxlint --type-aware && eslint --max-warnings 0 \"src/**/*.vue\"   (no findings)\n$ vue-tsc -b   (no output)\n Test Files  32 passed (32)\n      Tests  333 passed (333)\nAll matched files use the correct format.\nFinished in 423ms on 105 files using 24 threads.\n$ knip --include exports,types   (no findings)\n$ tsx scripts/check-sfc-order.ts   (no findings)"
  },
  {
    "command": "stop: write proc://tauri-driver-3p/kill; pgrep -a -f 'tauri-driver|WebKitWebDriver|yamt-after|yamt-before'",
    "observed": "Stopped tauri-driver-3p [service] — exited; none running. App sessions were all closed by the scripts (DELETE /session). No Xvfb used."
  }
]

## tests_added
[
  {
    "name": "geometry.test.ts: chunk rows go stale on a status change, an edit or new measurements, not on a cursor move",
    "proves": "rowsChanged invalidates on setStatus, doc change and geometryChanged, keeps rows on a selection-only transaction, and for side panes (no chunk field) depends only on geometryChanged"
  },
  {
    "name": "geometry.test.ts: a shape is drawn while any part of it touches the strip, edges included",
    "proves": "crossesStrip boundaries are inclusive (bottom == 0, top == height) — kills < / <= mutants"
  },
  {
    "name": "geometry.test.ts: a shape wholly above or below the strip is left out",
    "proves": "crossesStrip excludes shapes 1px outside either edge"
  }
]
