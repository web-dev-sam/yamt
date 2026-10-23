# OperationTooltipVerify (3.I final run, row 2)

HEAD `4e4bb65`, clean tree. Gate **pass**.

1. `just check` exit 0 (map-check ok, 10 goldens, hooks 16/16).
2. `just mutants 99a44e9`: no Rust changes; Stryker `operationTooltip.ts` 8 killed, 0 survived.
3. WebKit fixture, dark and light, `?operation=rebase`: none before; one move, no wait → visible, transition 0s,
   pointer-events none, z 500; text = `#operation-tooltip`; bottom 925.02 = tag top 929.02 − 4, left 17 = word left;
   no ancestor stacking context; on top at its corners; off → gone; Ctrl+B → gone (still 200 ms later); Ctrl+B again →
   open in dark (accepted WebKit `mouseenter`), closed in light; no `title`; role status, label the line,
   `aria-describedby`. Merge: one line, 246.67 px = text + padding + border. 1400×150: top 0, end cut, first line
   kept. Scroll probe: tag 0 / word 0 calls (Result scrolls only 621 px in the fixture, #1584). Styles of tag,
   problem and removal tooltips identical, dark and light.
4. Real app (debug build, private X display, `operations-repo.sh rebase`): no tooltip before; 0.2 s after the X
   pointer moved onto `REBASE` → "Rebasing feature onto main · 1 of 3" + the commit message; top-level windows identical
   before and after a 3 s rest (no GTK tooltip); resolve, Continue → "· 2 of 3".

Screenshots `/tmp/yamt-op-tooltip/verify/` (`v-rebase-dark.png`, `v-rebase-light.png`, `v-merge-dark.png`,
`v-150-short.png`, `v-app-rebase-x11-rest3s.png`, `v-app-rebase-2of3.png`).
