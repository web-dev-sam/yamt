# V0ScrollSmoothR1

## summary
All review findings are fixed and nothing changed for the user. The strip code (what a gap strip shows: crossesStrip, gapArrows, bandPaints, Arrow, BandPaint) moved from geometry.ts into a new editor/internal/gap.ts, and geometry.ts holds only chunk positions again. `Arrow` keeps document-space tops; a placed row `{ arrow, y }` carries the strip-space y. MergeController has one cache, `Layout = { rows, anchors }` (both readonly), dropped by rowsChanged. `ScrollSync.sync(anchors)` takes the anchors, and its own memo (#anchors/#anchorsOf) is gone. Arrow rows are rebuilt only when `sameShape` (mode + button layout) says their shape changed. Read-only is checked once, in measure. The MergeView.vue comment now cites plan §2 #51. gap.test.ts adds three bandPaints tests.

## deviations_from_brief
[
  "Placed rows (#492): strips.ts has `type PlacedArrow = { readonly arrow: Arrow; readonly y: number }`. GapStrip.measure builds it as `gapArrows(rows, side).map(arrow => ({ arrow, y: arrow.top + shift })).filter(({ y }) => crossesStrip(y, y + lineHeight, height))`, and #paintArrows writes `translate(0 ${y})`. `Arrow.top` is document space everywhere; drag.ts still reads it that way.",
  "Single cache (#493/#500): MergeController has `type Layout = { readonly rows: readonly ChunkRow[]; readonly anchors: readonly Anchor[] }` and `#layoutCache: Layout | null`, cleared in #repaint when `rowsChanged(update, field)`. `#layout()` fills it eagerly: rows = chunkRows(...), anchors = anchorsOf(rows, contentEnds(views)). The frame passes `anchors` to `ScrollSync.sync(anchors)` and `rows` to the strips and the covered check; the drag release uses `#layout().rows`. scrollSync.ts exports `contentEnds` (renamed from the private `ends`); #anchors/#anchorsOf are removed. I chose eager over lazy anchors: one pass over the rows per invalidation costs nothing measurable (timing table equals the previous round) and needs no mutable field.",
  "Read-only (#498): the check is only in GapStrip.measure. When there is no onPress it returns `{ bands, arrows: null }`; otherwise it returns `arrows: { placed, layout, onPress }` (type ArrowPaint). paint() branches on the measured `arrows`, not on the read-only flag again.",
  "sameShape (#497): ArrowRow stores `mode` and `layout: ButtonLayout` (renamed from `Buttons`: applyX, ignoreX, lineHeight). `sameShape(row, mode, layout)` decides whether a row is rebuilt.",
  "Extra beyond the brief: dropMissing now takes `keptIds: ReadonlySet<Chunk[\"id\"]>` instead of `{ chunk }[]`, because placed arrows no longer have `chunk` at the top level. Each caller builds the Set, so allocations are the same as before.",
  "Display: the screenshots this time are 1600×1000 (scale 1), while the first round's were 3200×2000. The window landed on the 2560×1440 DP-3 output at scale 1. It is the same real wayland-0 display kind, but a different scale. Because of that I also timed and smoked the previous round's binary in the same session: timing within noise, steps equal, pixel difference 0.",
  "Exact doc sentences for the orchestrator. (a) project map tree, editor/ line: replace `tone, lineSpan, geometry, strips, drag` with `tone, lineSpan, geometry (where each chunk sits in each pane, px), gap (what a strip shows: bands and icons in view, plan §2 #51), strips, drag`.",
  "Doc sentence (b): project map state table row `| connector geometry | derived per frame, never stored |` → `| chunk rows and scroll anchors | one cache in MergeController (rows + anchors), dropped by rowsChanged (doc, measured heights, statuses); strip positions are written per frame (plan §2 #51) |`.",
  "Doc sentence (c): docs/architecture.md:404, row `connector geometry | computed per frame from lineBlockAt, never stored | derived` → `chunk rows and scroll anchors | one cache in MergeController (rows from lineBlockAt + the sync's anchors), dropped by rowsChanged: doc change, measured heights (geometryChanged), statuses; strips move their kept nodes per frame | derived, cached (plan §2 #51)`.",
  "Doc sentence (d): docs/architecture.md:458, `- geometry.ts, strips.ts — bands and the apply/ignore buttons in the two <svg> strips` → `- geometry.ts (where each chunk sits in each pane), gap.ts (what a strip shows: bands and icons that cross it), strips.ts (keeps their nodes and moves them per frame) — bands and the apply/ignore buttons in the two <svg> strips`.",
  "Doc sentence (e): docs/architecture.md:464, `persistent <svg> strips (buttons are repainted every frame)` → `persistent <svg> strips (buttons persist while in view; only their positions change per frame)`.",
  "Doc sentence (f): docs/architecture.md:488-491 → `editor/internal/geometry.ts turns chunk ranges into Spans (via lineBlockAt, cached until rowsChanged); editor/internal/gap.ts picks the bands and icons that cross each strip; editor/internal/strips.ts updates their kept <path>/<g> nodes in place once per animation frame, after any pane scroll, center edit or geometry change. Each strip is its own compositing layer (plan §2 #51).`",
  "Doc sentence (g): docs/architecture.md:~496 (§5.4 MergeView): `one per opened file, inactive ones invisible` → `one per opened file, inactive ones invisible plus content-visibility: hidden (no layout or paint, state kept; plan §2 #51); each <svg> strip sits in a bordered will-change-transform wrapper (own layer, plan §2 #51)`."
]

## open_risks
[
  {
    "location": "frontend/src/editor/index.ts:215-221",
    "risk": "Anchors are now computed when rows are (eager), so their contentEnds come from the same moment. This is the same trust as before: contentEnds only change through doc or geometryChanged updates. A height change outside a ViewUpdate would leave both rows and anchors stale until the next measure."
  },
  {
    "location": "frontend/src/editor/internal/strips.ts:24-28",
    "risk": "oxfmt left the `ButtonLayout` type on four lines. This is purely cosmetic and passes fmt:check."
  }
]

## smoke_evidence
[
  {
    "command": "pnpm -C frontend lint && pnpm -C frontend typecheck && pnpm -C frontend test && pnpm -C frontend fmt:check && pnpm -C frontend unused && pnpm -C frontend sfc-order",
    "observed": "$ oxlint --type-aware && eslint --max-warnings 0 \"src/**/*.vue\"   (no findings)\n$ vue-tsc -b   (no output)\n Test Files  33 passed (33)\n      Tests  336 passed (336)\nAll matched files use the correct format.\nFinished in 472ms on 107 files using 24 threads.\n$ knip --include exports,types   (no findings)\n$ tsx scripts/check-sfc-order.ts   (no findings)\n(all exit 0)"
  },
  {
    "command": "cargo tauri build --debug --no-bundle; cp target/debug/yamt /tmp/yamt-3p/yamt-r1; tauri-driver --port 4754 --native-port 4755 on the owner's real display (wayland-0); python3 .omp/run/scroll-timing.py --driver http://127.0.0.1:4754 --app /tmp/yamt-3p/yamt-r1 --repo /tmp/yamt-3p/repo   (AFTER, this rework)",
    "observed": "| file | files opened | pane scrolled | mean ms | p50 | p95 | max | frames over 20 ms (of 200) | editors alive |\n|---|---|---|---|---|---|---|---|---|\n| renderer.ts | 1 opened | middle | 15.1 | 16 | 22 | 28 | 14 | 6 |\n| renderer.ts | 1 opened | left | 16.1 | 16 | 19 | 23 | 4 | 6 |\n| renderer.ts | all opened | middle | 15.7 | 16 | 24 | 30 | 21 | 21 |\n| renderer.ts | all opened | left | 16.1 | 16 | 21 | 27 | 10 | 21 |\n| pnpm-lock.yaml | 1 opened | middle | 14.6 | 16 | 24 | 39 | 14 | 6 |\n| pnpm-lock.yaml | 1 opened | left | 16.1 | 16 | 23 | 31 | 12 | 6 |\n| pnpm-lock.yaml | all opened | middle | 15.6 | 16 | 27 | 41 | 22 | 21 |\n| pnpm-lock.yaml | all opened | left | 16.1 | 16 | 25 | 32 | 12 | 21 |\nTargets: every mean ≤ 16.1 (≤ 18 ok); at most 22 late of 200 (≤ 45 ok); all opened vs 1 opened: renderer +0.6 / +0.0, pnpm-lock +1.0 / +0.0 (≤ 1.5 ok)."
  },
  {
    "command": "same harness, same session and conditions, against the previous round's binary /tmp/yamt-3p/yamt-after (373ab81) for an exact comparison",
    "observed": "| renderer.ts | 1 opened | middle | 15.4 | 16 | 23 | 28 | 15 | 6 |\n| renderer.ts | 1 opened | left | 16.1 | 16 | 19 | 28 | 4 | 6 |\n| renderer.ts | all opened | middle | 15.7 | 16 | 23 | 35 | 25 | 21 |\n| renderer.ts | all opened | left | 16.1 | 16 | 22 | 31 | 16 | 21 |\n| pnpm-lock.yaml | 1 opened | middle | 14.9 | 16 | 24 | 35 | 17 | 6 |\n| pnpm-lock.yaml | 1 opened | left | 16.1 | 16 | 23 | 30 | 14 | 6 |\n| pnpm-lock.yaml | all opened | middle | 14.8 | 16 | 26 | 38 | 20 | 21 |\n| pnpm-lock.yaml | all opened | left | 16.1 | 16 | 22 | 33 | 12 | 21 |\n→ the rework is within noise of the previous round (means differ by ≤ 0.8 ms)."
  },
  {
    "command": "python3 /tmp/yamt-3p/smoke.py r1 /tmp/yamt-3p/yamt-r1 /tmp/yamt-3p/repo > smoke-r1.jsonl; jq -c 'select(.step != \"screenshot\") | {step, value}' each run; cmp against smoke-before.jsonl (the before build, 1f7501b) and smoke-after.jsonl (first round)",
    "observed": "exit=0; \"before==r1 (18 steps)\" and \"after==r1\": every recorded step is byte-identical. This covers: renderer.scrolled; lock.find; renderer.back [23741, 23014, 23086], 51 lines in view each, same_scrollTop; window.rect; lock.after_resize [48649, 46049, 43884], 42 lines in view each, middle findBar \"vapor\"; lock.align; actions.start / apply_right_first / ignore_left_last / drag_icons; during_drag_covered {\"lines\":[8,0,0],\"icons\":3}; after_drag; after_one_undo; ctrl_click_left_block; align.after_scroll_pane_0/1/2."
  },
  {
    "command": "python3 /tmp/yamt-3p/smoke.py prev /tmp/yamt-3p/yamt-after ... (previous round, same session); compare -metric AE prev-<n>.png r1-<n>.png",
    "observed": "prev==r1 (all steps). Pixel difference 0 on all five page screenshots: lock-find, renderer-back, lock-after-resize, drag, after-actions."
  },
  {
    "command": "write proc://tauri-driver-r1/kill; pgrep -a -f 'tauri-driver|WebKitWebDriver|yamt-r1|yamt-after|yamt-before'",
    "observed": "Stopped tauri-driver-r1 [service] — exited; \"none running\". The scripts close app sessions themselves. No Xvfb was used."
  }
]

## tests_added
[
  {
    "name": "gap.test.ts: each strip joins its own pane pair, each edge moved by its own pane's shift",
    "proves": "Uses the conflict chunk 8 of vueuse-use-magic-keys with shifts left ≠ right. For local, d equals bandPath(left+shifts.left, center+shifts.right); for remote, d equals bandPath(center+shifts.left, right+shifts.right). This kills three mutants: swapped shifts, a wrong span pair, and testing only one side."
  },
  {
    "name": "gap.test.ts: a band is kept while one edge is still in the strip and the other has left it",
    "proves": "Left edge wholly above while the right edge starts at 0 → kept. Left edge inside while the right edge starts 1 px below the strip → kept. This kills both one-edge-only crossing checks."
  },
  {
    "name": "gap.test.ts: a band 1 px above or below the strip on both edges is dropped",
    "proves": "Both bottoms at -1 → no paint. Both tops at height+1 → no paint."
  },
  {
    "name": "gap.test.ts: crossesStrip edge tests (moved from geometry.test.ts, unchanged)",
    "proves": "The strip edges count as inside, and a shape 1 px outside is left out."
  }
]
