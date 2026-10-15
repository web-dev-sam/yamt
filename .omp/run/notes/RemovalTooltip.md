# RemovalTooltip (board "Removal tooltip" row 2, brief `docs/slices/briefs/3.R-removal-tooltip.md`), commit `cc6e2d6`

## summary
Bar carries its text (`RemovalPoint.text`, `eq` by tone+text, `removalAt(state, pos)` reads it back from the bar
decoration). `removalTooltip.ts`: CodeMirror `hoverTooltip` whose source answers only when `.chunk-removal:hover` is in
the pane (position from `posAtDOM` of that bar); `hideOn` closes when `removalAt` finds no bar; pane font copied from
computed style, `tabSize` from state, `paletteHighlight` + pane grammar. `removalText.ts` (pure): drop the one joining
`\n` (leading at a line end, trailing at column 0; an empty line counts as both, leading first); whitespace-only text
marked in full (`·`, `→`, `↵`, muted). `bodyTooltips()` for all three panes in paneViews.ts. Owner's room as
`padding-inline: 2px` in theme.css; `BACKGROUND_DARK` #27252e; theme.css/style.css oxfmt-clean. `app-session hover`.

## files_changed
editor/internal/{words.ts, words.test.ts, removalText.ts, removalText.test.ts, removalTooltip.ts, paneViews.ts},
editor/removals.browser.test.ts, editor/theme.css, style.css, editor/AGENTS.md, src-tauri/src/window.rs,
scripts/app-session.ts, scripts/app-session/{args.ts, drive.ts, args.test.ts}.

## tests_added
removalText.test.ts (7: place on the line, trailing join, leading join, empty line keeps an inner blank line, no join kept
as is, whitespace marks, visible text unmarked); words.test.ts (eq by text; removalAt and its side applied/undo);
removals.browser.test.ts (geometry 4 px, hover/beside/body/strip/bulk-apply close, whitespace marks) — NOT RUN (Playwright
WebKit host libs missing: libicu74, libxml2, libflite1; #5, #985, #1042); args.test.ts (hover parsing).

## smoke_evidence
Each node rule broken and restored → named test fails. Browser-test rules observed in MiniBrowser instead (geometry
rect 4 px with/without; beside left/right none, on bar "b, "; bulk apply closes, without hideOn stays; inPane false,
covers strip; whitespace marks colour #817e8d). pnpm lint/typecheck/test (1349 passed)/unused/fmt:check, sfc-order,
map-check: 0; test:browser exit 1 (host). Real app (golden-repo language-tools-script-setup): tooltip in body, text
`\tif (options.vueCompilerOptions.target >= 3.3) {` highlighted, JetBrains Mono 13px/20px tab 4 (01-dark-if-line.png);
beside: none (02); Enter applies → closed (03a/03b); light theme ok (04); pointer into tooltip keeps it. Screenshots
/tmp/yamt-removal-shots/.

## deviations_from_brief
1 hover mechanism `:hover` check in a hoverTooltip source; 2 box 640px × 20lh, theme.css `.removal-tooltip`; 3 font
copied at hover from computed style, no pane.ts export; 4 whitespace-only marks include the join; 5 empty line = start
and end, one break dropped; 6 `bodyTooltips()` serves all panes; 7 browser test closes via bulk apply, waits 600 ms real
clock; 8 doc names (applied by orchestrator); 9 ran pnpm install offline in worktree.

## open_risks
browser test never ran; removalTooltip.ts:58-62 CodeMirror keeps an open tooltip ~half a char beside the bar; opening
relies on WebKit `:hover` (synthetic events would not open it); app-session hover reveal can land under the sticky
gutter after a horizontal scroll; whitespace-only removal seen in fixture mode only.
