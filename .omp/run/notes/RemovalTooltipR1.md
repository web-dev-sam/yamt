# RemovalTooltipR1 (row 2 fix round 1, brief `docs/slices/briefs/3.R-removal-tooltip-rework-1.md`)

summary: #1070 empty line drops the trailing `\n` first; #1071 `.removal-tooltip::after { content: "\200b" }` draws a
kept final break (not copied); #1064 ligatures and colour copied from the pane's computed style (code tooltips only, so
whitespace marks stay muted); #1065 one frame rule for lint and removal tooltips; #1066 `REMOVAL_BAR_CLASS` in words.ts;
#1067 `editor/paneHarness.ts` shared by both browser tests (`data-pane-harness`, `unmountAll`); #1069 beside probes
1 px (`BESIDE_PX`). New browser test: kept final break 2 line heights, colour/ligatures equal the pane's (not run).
smoke_evidence: fix 2 broken two ways → test fails, restored 1349 passed; lint/typecheck/unused/fmt/sfc-order 0;
test:browser exit 134 (host libs). MiniBrowser: `:hover` check replaced by `pos` → x=583 and x=589 (1 px beside a
584.2–588.2 box) open; restored → none, on bar opens. `pre` heights: with ::after "f() {}\n" 48 px vs 28 px without.
Tooltip colour/ligatures/font equal the pane's; frame values unchanged (lint frame checked on a synthetic element).
open_risks: browser tests never ran here; colour/font copied at open (theme switch while open keeps old values);
lint frame not seen on a real problem; final-break display measured on a page-built `pre`.
