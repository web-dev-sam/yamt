# Slice line-ranges-verify — the gate, the WebKit fixture and the real app for line-range threads

Design: `docs/slices/briefs/line-ranges-design.md`. Request acceptance: `docs/slices/request-line-ranges.md`
"Acceptance". Recipes: `skill://verification` (VF4–VF11); windows only on a private display (VF8), screenshots only from
the session or the private display (VF9).

## Target

**Owned:** none (read-only commands; your scratch folder only).

**Read-only:** the whole tree.

**Needs:** the rust, domain, editor and window builds committed. **Smoke pass** as soon as the editor and window builds
are both in (no `just check`); **final pass** once the docs keeper has added the project-map rows for
`editor/internal/diffOrder.ts`, `threadDrag.ts`, `threadTint.ts` (`just map-check`, PM6) and the doc updates of the
design §6: `just check` once, then every step below.

**Non-goals:** the owner's GitLab playground check (below, for the orchestrator to hand on); fixing anything (VF1).

## Contract

Display numbers on the review case's `src/board/board.ts` (0-based differences from
`frontend/fixtures/range/review.json` `files[7]`, the same as `scripts/range-repo.sh` `main...feature`):
`d0` L20 removed / R20–R21 added; `d2` L200 removed / R204 added, with L197–L199 = R201–R203 unchanged above it;
`d3` L255 removed / R259–R261 added; `d5` R404–R436 added, L401–L415 = R389–R403 unchanged above it. Seeded threads
(`?threads=seeded`, come back collapsed, plan §2 #120): 0–3 one-line (badges on L20, R21, L6, R102), 4 = R389–R406
in-column range (badge on R406), 5 = L255 → R260 both-sides range (badge on R260). Line height 20 px
(`LINE_HEIGHT_PX`, `editor/internal/pane.ts:64`). The tint class is `cm-thread-tint` on `.cm-line` and the gutter cell.

## Change (the steps)

**A. Gate (final pass only).** `just check` → pass, or the failing recipe and its first 30 lines.

**B. Editor WebKit probes.** `pnpm -C frontend test:browser src/editor/rangeThreads.browser.test.ts` → paste every test
name with its result; these alone prove "Escape mid-drag starts nothing", "a scroll during a drag moves the end" and
"a drag selects no text" (the session's `drag` cannot hold a press). Plain Playwright WebKit cannot launch on this host
(#1445, `libicudata.so.74`; smoke #2065/#2066): then run it as the editor build did, `PLAYWRIGHT_BROWSERS_PATH=/tmp/le-pw
pnpm -C frontend exec vitest run --config /tmp/le-pw/vitest.probe.config.mts --project browser
src/editor/rangeThreads.browser.test.ts src/editor/range.browser.test.ts`, and say so.

**C. WebKit fixture.** `just app-session start-fixture --name lr --range-case review --threads seeded --size 1600x1000`;
open `src/board/board.ts`; collapse off. To drag from a number cell, tag it first with `read` (e.g. set `data-probe`
on the right column's `.cm-gutterElement` whose text is `201`, after scrolling that column's `.cm-scroller` so the line
renders), then `drag --name lr '[data-probe=…]' --dy <px>` (3 lines = 60 px) or `--dx/--dy` from the two cells' rects.
Observe after each step with `read` (the tinted line numbers per column, the box headers, the focused element) and one
`shot`:

1. Drag right R201 → R204: right R201–R204 and left L197–L200 tinted; one new box under R204 headed
   `src/board/board.ts:201-204`.
2. Drag left L200 → right R204: a second box in the same row, headed `src/board/board.ts:-200 to +204`; L200 and R204
   tinted.
3. Drag right R204 → R201 (upwards): no new box; the first box's field has the focus (rule 7).
4. Click right number 210 (press-release): a box `src/board/board.ts:210`.
5. Click the badge on R406: thread 4's box opens; click it again: it collapses; no drag or box started.
6. Open thread 4, `hover` its box: right R389–R406 and left L401–L415 gain the tint (beyond the drafts' own); hover
   elsewhere: they lose it.
7. Collapse on: the left gutter shows every number L401–L415 (a wave ends at L396 or above), and R389–R406.
8. Collapse on: drag right R23 down 200 px (past the wave after `d0`): the box is headed `src/board/board.ts:23-25`.
9. `stop --name lr`.

**D. Real app.** `scripts/range-repo.sh <scratch>/rr`; `just app-session start-app --name lra --range main...feature
--repo <scratch>/rr --home <scratch>/home --settings '{"theme":"dark"}'`; open `src/board/board.ts`:

1. Drag R201 → R204, type "Range in one column", Comment; drag L200 → R204, type "Across both sides", Comment. `shot`
   (dark) with a box hovered (its lines tinted).
2. `stop`; `find <scratch>/home -name threads.json -exec cat {} \;` → `"format": 2` and two threads with
   `"place": { "start": { "kind": "unchanged", "left": 196, "right": 200 }, "end": { "kind": "added", "right": 203 } }`
   and `"place": { "start": { "kind": "removed", "left": 199 }, "end": { "kind": "added", "right": 203 } }`.
3. Start again with the same `--home` and `--settings '{"theme":"light"}'`: the badge on R204 reads 2; open both:
   headers `src/board/board.ts:201-204` and `src/board/board.ts:-200 to +204`; `shot` (light) with a box hovered.
4. `stop`.

## Acceptance

Every step of A (final pass), B, C and D with its command and the observed lines or the screenshot path (VF4), the
toolchain versions (VF5), and `pass` per step.

**For the orchestrator to hand to the owner (not run here):** on `scripts/gitlab-playground.sh`, queue and send the two
ranges of D.1; GitLab's diff shows "Comment on lines 201 to +204" (the unchanged start without a sign, as GitLab's own
form makes it — the request's "+a to +b" holds for a range of added lines only; plan §2 #147) and "Comment on
lines -200 to +204", each tinting R201–R204 / L200 and R204 on hover.

## Skills

`skill://verification`.
