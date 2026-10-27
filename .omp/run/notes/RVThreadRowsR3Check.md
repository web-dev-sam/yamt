# RVThreadRowsR3Check — correctness re-check of a93c774 (1m48s)

Verbatim output of agent://RVThreadRowsR3Check:

```json
{
  "verdict": "pass",
  "items": [
    {
      "id": "#1632",
      "status": "fixed",
      "evidence": "The cause is in the test, not the product. ThreadHosts sets --thread-left/--thread-width only in #placeColumns (frontend/src/editor/internal/threadHosts.ts:188-199). It runs from the ResizeObserver, which watches both scrollers and both gutters from the constructor (threadHosts.ts:37-48). When those variables are unset, the row falls back to `width: var(--thread-width, 100%)` (theme.css:492), so it is as wide as .cm-content and has no room to stick. The old test's `waitFor(height === 40)` passed on its first, synchronous try, so it scrolled in the same task that built the view. The implementer's observed values agree: varLeft/varWidth were \"\" and the row was 3252.8 px wide; after two frames the variables were set and the row was sticky. …
    },
    {
      "id": "#1633",
      "status": "fixed",
      "evidence": "The `measured` helper (rangeThreads.browser.test.ts:130-137) is sound. view.defaultLineHeight is heightOracle.lineHeight. It starts at the estimate of 14 (@codemirror/view dist/index.js:5406) and is set from docView.measureTextSize() in the same viewState.measure pass that refreshes the height map (index.js:6425-6427). So once the wait sees 20, lineBlockAt already uses measured heights. It cannot pass before the measure: the line height is fixed at LINE_HEIGHT_PX = 20 (pane.ts:64, :91), which is not 14. Page zoom leaves CSS px unchanged. The range columns do not wrap; the sideways test depends on that. The probed first .cm-line is the 400-character LONG_LINE (rangeThreads.browser.test.ts:36-40), which stays on one 20 px line. If wrapping o…
    }
  ],
  "findings": [],
  "checked": [
    "Commit a93c774 changes only rangeThreads.browser.test.ts plus the run note. No product file changed, so this round cannot have changed behaviour or harmed growth (RV8).",
    "All acceptance lines in docs/slices/briefs/3.RV-thread-rows-rework-3.md have evidence in .omp/run/notes/RVThreadRowsR3.md: 13/13 tests passed twice, both mutation failures are pasted, the MiniBrowser before/after values and screenshot are given, and typecheck/lint/test/fmt:check pass.",
    "/tmp/rv3/shots/after.png exists and shows the box staying put with the code scrolled 200 px.",
    "The column variables are written only by ThreadHosts.#placeColumns and removed in destroy (threadHosts.ts:120-123), so there is still one writer.",
    "theme.css:488-497 `.cm-thread-row` is sticky with a left/width fallback, which explains the content-wide row before the first report.",
    "Accepted deviation: M4 was applied in memory through a Vite load plugin because compareFrame.ts is read-only. The check is still valid because the transformed module is the one the test imports.",
    "Accepted open risk: the variables are unset until the first ResizeObserver report. This is invisible because the report comes before the first paint. Only code that measures in the same task as showThreads sees the wide row, and no user can do that.",
    "I did not run any test myself: no block depended on one."
  ]
}
```

[Some lines truncated to 768 chars. Use agent://RVThreadRowsR3Check:raw:8-8 to read line 8 whole; cut lines run to line 13, each read the same way]