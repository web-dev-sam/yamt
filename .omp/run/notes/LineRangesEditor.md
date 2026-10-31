# LineRangesEditor

Agent output (`agent://LineRangesEditor`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-10-31T11-08-11-230Z_01a191a5-4a5e-76c4-84d2-9d529607b1b1/LineRangesEditor.md), collected 2026-10-31T12:28:26.847Z.

{
  "summary": "Range threads can now cover a range of lines. Pressing a line number starts a drag (`threadDrag.ts`), and the thread starts on release. GitLab's one-column order is in the pure `diffOrder.ts`. Each column has a tint field (`threadTint.ts` plus `theme.css`) that shows the drag, every draft and the thread whose box the pointer is over; the hover comes from the hosts' own pointerenter/pointerleave. Rows and count badges sit on `place.end`. Under collapse, a range's unchanged lines are kept shown as run edges, and overlapping ranges are merged. `editor/AGENTS.md` is updated.",
  "files_changed": [
    "frontend/src/editor/internal/diffOrder.ts",
    "frontend/src/editor/internal/diffOrder.test.ts",
    "frontend/src/editor/internal/threadDrag.ts",
    "frontend/src/editor/internal/threadTint.ts",
    "frontend/src/editor/internal/threadTint.test.ts",
    "frontend/src/editor/internal/threadNumbers.ts",
    "frontend/src/editor/internal/threadNumbers.test.ts",
    "frontend/src/editor/internal/threadRows.ts",
    "frontend/src/editor/internal/threadRows.test.ts",
    "frontend/src/editor/internal/columnFolds.ts",
    "frontend/src/editor/internal/columnFolds.test.ts",
    "frontend/src/editor/internal/foldRuns.ts",
    "frontend/src/editor/internal/threadHosts.ts",
    "frontend/src/editor/range.ts",
    "frontend/src/editor/theme.css",
    "frontend/src/editor/rangeThreads.browser.test.ts",
    "frontend/src/editor/AGENTS.md"
  ],
  "tests_added": [
    {
      "name": "diffOrder: with %s, the order lists an unchanged line once and a change's removed lines before its added ones, to the last line (×2)",
      "proves": "Catches added lines placed before removed ones and off-by-one errors with additions or removals at the first and last line (both fixtures)."
    },
    {
      "name": "diffOrder: with %s, lineAtIndex inverts orderIndex for every line (×2); board.ts numbers lines as GitLab's one column does",
      "proves": "The inverse holds for every line, and the brief's board.ts values come out: 201, 203, 204, 205."
    },
    {
      "name": "diffOrder: a drag gives one place dragged down or up…; the end keeps the column it was picked in",
      "proves": "Dragging up and down gives the same place; press = pointer gives onePlace(press), even across columns; unchangedOnLeft and unchangedOnRight ends are kept."
    },
    {
      "name": "diffOrder: a one-column drag from an unchanged line to an added line spans the change's removed lines",
      "proves": "Rule 2: the change's removed lines on the left are part of the place's tint."
    },
    {
      "name": "diffOrder: going down / going up the end stops…; a pointer on a hidden line clamps the same way",
      "proves": "shownEnd stops at the collapsed stretch in both directions, ignores hidden lines behind the press, and a clamped unchanged end takes the pointer's column (RK50)."
    },
    {
      "name": "diffOrder: a both-sides place… / an in-column place across a change… / a one-line place tints its own line only",
      "proves": "placeSpans and unchangedRuns split at every difference."
    },
    {
      "name": "threadTint: tinted lines and gutter cells carry the class, whatever the spans' order…; a new set replaces the old, an empty set clears…",
      "proves": "Lines and gutter cells get the class; unsorted spans work; a new set replaces the old one; an empty set clears it; positions follow a doc change."
    },
    {
      "name": "threadTint: places' lines are merged per column…; spans are the same only with…",
      "proves": "Overlapping, touching and nested spans merge; sameSpans checks length, start and len."
    },
    {
      "name": "columnFolds: every unchanged line of a range stays shown under collapse, split across a difference",
      "proves": "RK51: no line of a range hides, and its runs are split at d0."
    },
    {
      "name": "columnFolds: two overlapping ranges merge…; ranges touching on the right only, across a removal, are not joined",
      "proves": "RK51: overlapping or touching runs merge, but never across an insertion or a removal."
    },
    {
      "name": "columnFolds: the left column's hidden lines come as spans…",
      "proves": "hiddenLeft gives the hidden lines under each wave as spans, and none when collapse is off."
    },
    {
      "name": "threadRows: a range's row sits under its end line…; threadNumbers: a range is counted on its end line…",
      "proves": "The row and the count badge go by place.end, and two ranges ending on one line share a row."
    },
    {
      "name": "WebKit rangeThreads: press+release one-line; four-number drag; both-sides up/down; Escape; scroll; no text selected; wave; hover box; draft",
      "proves": "All acceptance probes from Change step 9; the selection probe fails if the gutter handler returns false (checked by hand)."
    }
  ],
  "smoke_evidence": [
    {
      "command": "pnpm -C frontend test src/editor",
      "observed": "Test Files  69 passed (69)\n      Tests  626 passed (626)"
    },
    {
      "command": "PLAYWRIGHT_BROWSERS_PATH=/tmp/le-pw pnpm -C frontend exec vitest run --config /tmp/le-pw/vitest.probe.config.mts --project browser src/editor/rangeThreads.browser.test.ts src/editor/range.browser.test.ts",
      "observed": "Test Files  2 passed (2)\n      Tests  21 passed (21). Each new test name above shows ✓ in the verbose run. Plain `pnpm test:browser` cannot launch WebKit: libicudata.so.74 missing (#1445). With the private copy but the repo config, only range.browser's screenshot fails: 'Access denied to /tmp/yamt-range/range-dark.png' (server.fs)."
    },
    {
      "command": "pnpm -C frontend typecheck | grep 'error TS' | grep -oE '^src/[a-z]+/' | sort | uniq -c",
      "observed": "14 src/ui/ (zero under src/editor/)"
    },
    {
      "command": "pnpm -C frontend exec oxlint --type-aware src/editor; oxfmt --check src/editor",
      "observed": "oxlint_exit=0, no diagnostics; 'All matched files use the correct format.'"
    },
    {
      "command": "grep @codemirror/view 6.43.14 dist/index.js:11698-11699",
      "observed": "`if (config.domEventHandlers[prop](view, line, event)) event.preventDefault();`, so the [INFERENCE] holds: a gutter handler that returns true prevents the default."
    },
    {
      "command": "hand mutation M1 diffOrder.ts: added before removed (removed index + right.len, added index − left.len)",
      "observed": "9 failed, incl. × with an addition at the first line, the order lists … removed lines before its added ones; × board.ts numbers lines as GitLab's one column does. Restored."
    },
    {
      "command": "hand mutation M2 unchanged formula: `index += difference.right.len` → `index += 0`",
      "observed": "9 failed, incl. × … lineAtIndex inverts orderIndex for every line; × an in-column place across a change splits…. Restored."
    },
    {
      "command": "hand mutation M3 removed formula: removed index → index + 1",
      "observed": "6 failed, incl. × board.ts numbers lines as GitLab's one column does; × going up, the end stops…. Restored."
    },
    {
      "command": "hand mutation M4 added formula: added index without d.left.len",
      "observed": "8 failed, incl. × a one-column drag from an unchanged line to an added line spans the change's removed lines. Restored (file hash back to #2B5B)."
    },
    {
      "command": "pnpm -C frontend unused",
      "observed": "Unused exports (1): isOneLine src/ipc/index.ts:142, which belongs to the window build. Nothing from editor."
    }
  ],
  "mutation": {
    "command": "just mutants HEAD: no Rust or TS changes (the recipe skips editor/). Stryker on 5 changed editor files, src/editor tests: 434 killed, 26 survived, 80 no coverage",
    "survivors": [
      "diffOrder.ts:29 `[]`→`[\"Stryker was here\"]`: equivalent. Filter, reduce and flatMap all skip the string.",
      "diffOrder.ts:61-62 filter removed or `true`: equivalent. A non-holding segment's coordinate is always followed by a holding one with the same coordinate.",
      "diffOrder.ts:84,87,97 column literal \"right\"/\"left\"→\"\": equivalent. changedThreadLine/unchangedThreadLine treat any non-\"left\" as right, and diffLineOf drops the column.",
      "diffOrder.ts:142 `to > from`→`>=`; :143 `first > from`→`>=`; :144 `last < from`→`<=`: equivalent. Equal indices clamp to `to`, and the pressed line is never hidden.",
      "threadTint.ts:28 create `[]`→`[\"…\"]`: equivalent. Destructuring the string gives NaN lengths, so no lines.",
      "threadTint.ts:89 `b[index]?.start`→`b[index].start`: equivalent after the length check.",
      "columnFolds.ts:62,157,158,162,163,181,189 and threadNumbers.ts:32,49, threadRows.ts:39: on lines this patch did not change."
    ]
  },
  "acceptance_not_run": [
    "Plain `pnpm test:browser` cannot launch Playwright WebKit here (libicudata.so.74, #1445). I ran the same two files on a private copy (/tmp/le-pw, with Ubuntu noble's ICU 74, libxml2 and flite libs) and a config allowing /tmp: 21/21 passed."
  ],
  "deviations_from_brief": [
    "foldRuns.ts (in Owned, not in the brief's list): ColumnChange is now `Readonly<Record<Column, LineSpan>>` instead of `Pick<Difference,…>`, because a computed run cannot be branded LeftLine/RightLine outside ipc. Differences still fit the type.",
    "pointedLine is not exported: nothing imports it (TS16). ThreadDrag takes `{ views, differences, events: DragEvents { moved, released, cancelled } }`, reads the hidden left lines itself in start(), and tints the pressed line on press.",
    "Added helpers: `hiddenLeft(left)` in columnFolds.ts; `placesTint`/`sameSpans`/`ColumnTint` in threadTint.ts, so the controller dispatches only when a column's spans change.",
    "placeBetween has no separate same-index branch: `from < to ? … : {diffLineOf(pointer), press}` gives onePlace(press) at the same index, and the branch was an equivalent mutant.",
    "RangeController: `#extensions(column)`, `#loadLanguage`, `#hover` and `#dragEvents` were split out to keep the constructor under 40 lines. A stale hovered key is cleared in showThreads.",
    "The tint decorations also recompute on a doc change (\"doc\" dependency) so positions stay right.",
    "rangeThreads.browser.test.ts `opened()` now waits for both columns to be measured: before that, the gutter cells' rects use the 14 px estimate, which put synthetic presses on the wrong line. The press test's title is extended (the badge check stays in it).",
    "Renamed threadRows' local ThreadPlace to RowPlace (Main's request)."
  ],
  "open_risks": [
    {
      "location": "frontend/src/editor/theme.css:503-506",
      "risk": "Some themes have an opaque --color-selection (atom-dark #3e4451, webstorm-dark #214283, light #a6d2ff), so the tint hides the difference colour there instead of laying over it."
    },
    {
      "location": "frontend/src/editor/internal/threadHosts.ts:159-166",
      "risk": "If CodeMirror detaches a host while the pointer is over it, pointerleave may not fire. The hover tint then stays until the next enter or leave, or until showThreads drops the key."
    },
    {
      "location": "frontend/src/editor/internal/diffOrder.ts:59-64",
      "risk": "orderIndex never fails, but a stored place that does not match the current differences gets an arbitrary index, so its tint and runs can be off."
    },
    {
      "location": "frontend/src/editor/internal/threadDrag.ts",
      "risk": "Not covered by node tests (it needs the DOM). Only the WebKit probes cover the listener removal at release, cancel and destroy, through the outcomes (nothing starts after Escape)."
    }
  ]
}
