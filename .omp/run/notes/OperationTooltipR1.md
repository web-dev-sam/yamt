# OperationTooltipR1 (3.I-tooltip, fix round 1: #1580–#1582)

Brief `docs/slices/briefs/3.I-operation-tooltip-rework-1.md`. Base `8e0d3fe` (product as `2dd377d`).

## Summary

- #1580: `useElementBounding(…, { windowScroll: false })` for the tag and its word.
- #1582: `style.css` `@utility hover-tooltip` (1 px control border, 4 px radius, panel background) and
  `@utility tooltip-text` (fg colour, UI font, 13 px); the tag tooltip uses both; `editor/theme.css` has
  `@reference "../style.css"` and `@apply`s them in the problem and removal tooltip rules.
- #1581: `ui/AGENTS.md` states the no-containing-block / no-stacking-context condition and the Teleport move;
  both AGENTS.md files name where the look lives.

## Evidence

- Scroll probe, 2000 px Result scroll, tooltip closed: `2dd377d` tag 58 / word 58 `getBoundingClientRect` calls → 0 / 0.
- Computed border, radius, background, colour, font family and size of the tag, problem (hand-built `.cm-tooltip-lint`
  in `<body>`: no language servers on the fixture page) and removal tooltips, dark and light: identical before/after;
  the served stylesheet shows `@apply` expanded.
- Round-1 WebKit checks pass (first check after one move, 4 px above, left on text, cut at 1400×150, no `title`,
  label/description). `pnpm -C frontend typecheck/test (1952)/lint/unused/fmt:check` exit 0.
- Editor browser tests not runnable on this host (#1445, `libicudata.so.74`).

## Deviations

- Accepted (orchestrator): after Ctrl+B, Ctrl+B with the pointer resting on the tag, WebKit may send `mouseenter` when
  the list reappears under the pointer, and the tooltip opens (also before this round, 5 of 6 runs). The pointer is on
  the tag, so that is a hover under #100; the round-1 brief's "stays closed until the pointer enters again" was the
  orchestrator's over-specification, not #100's rule. Verify brief amended.
- Utility names `hover-tooltip`, `tooltip-text` chosen by the implementer.

## Open risks

- `theme.css` now needs Tailwind's processing: proven for the app and fixture page (served stylesheet); the browser
  test project goes through the same `vite.config.ts` plugins but could not launch here.
