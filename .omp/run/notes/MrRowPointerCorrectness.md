# MrRowPointerCorrectness

Agent output (`agent://MrRowPointerCorrectness`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-10-30T21-21-14-771Z_01a18eb0-3413-7251-ad3d-5e4e0123ce8e/MrRowPointerCorrectness.md), collected 2026-10-31T08:29:25.181Z.

{
  "verdict": "pass",
  "checked": [
    "Row rule (Row.vue:91) = li:hover:not(:has([data-row-control]:hover)). Title, meta, readiness and the CI gap tint the row; a marked control or its child does not. Matches the WebKit values in the notes",
    "Disabled action: pointer-events-none sends the pointer to the button-sized inner span. Span is :hover, so no row tint; arrow cursor; title kept. Outer @click.stop still swallows the click",
    "CI box: class and data attr fall through (one root, no inheritAttrs). The popover is a DOM child, so it never tints a row. Enabled job buttons match [&_button:enabled]; disabled ones get the UA arrow",
    "page===null (by reading): li gets no classes; enabled buttons get the hand via enabled:cursor-pointer and the CI rule. Diff only adds attributes and classes: click handlers, .stop and focus classes unchanged",
    "Evidence: four /tmp/mrrow-*.png exist. Zed-dark pair viewed: only open changes tinted, then only the row. Cursors reported for all 6 targets. No risk-register row owns this file (grep)",
    "Accepted: no browser test (that project only runs src/editor/**; VF bans class-string tests). VF7 mutates .ts only, so .vue has no mutants; no survivors kept. Both open risks pass by reading"
  ],
  "findings": []
}
