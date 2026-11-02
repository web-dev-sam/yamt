# MrRowDetailsHoverBoundary

Agent output (`agent://MrRowDetailsHoverBoundary`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-02T19-44-30-486Z_01a19dca-b716-72dc-ab4f-c92917fdd42d/MrRowDetailsHoverBoundary.md), collected 2026-11-02T20:17:56.015Z.

{
  "verdict": "fail",
  "checked": [
    "Ownership: all 9 changed files are under Owned; no page, OperationLabel, style.css or docs edits. New import edges stay within ui/ (vue types, vueuse, menuPosition, useMenuPlacement): PM2/PM3/PM10 hold.",
    "Contract matches the brief (tooltipPlacement, timing consts, vTooltip, useHoverBox, open/dismiss, HoverMenu). Accepted: readonly arrow members, Anchor→TagAnchor, exported HoverBox, toggle re-reading menu().",
    "useDropdownMenu: toggle now runs through open, existing callers unchanged. useHoverMenu is one useDropdownMenu, so one open by construction (§1.6). useHoverBox reuses belowLeft and useMenuPlacement.",
    "Accepted TS15 deviation: the tooltip.ts singleton is what design §1.5 and #154 ask for; the docs keeper adds the TS15 exception and a state.md row (none yet). CiStatusBox/useHoverBox copy is temporary: the page slice moves it.",
    "No comments in the new files (comment-policy). Directive: no title/aria-label writes; aria-description mirror; aria-hidden div with no role; measures, then places; Escape not prevented.",
    "Open risks: aria-description in WebKit accepted as [INFERENCE] for the page fixture; Tailwind scan accepted (classes already in OperationLabel.vue:70); dismiss-on-body risk is finding 1."
  ],
  "findings": [
    {
      "file": "frontend/src/ui/useDropdownMenu.ts",
      "line": 139,
      "severity": "block",
      "rule_id": "design-§1.6",
      "problem": "`dismiss` is closeAfterClick, which counts focus on <body> as 'in the menu'. So when nothing is focused, hovering a filter and leaving moves keyboard focus to its button, after which Space/Enter act on it. Design §1.6 and the brief say focus returns only if it was inside the menu (implementer open risk).",
      "fix": "Make `dismiss` restore focus only when `menu()?.contains(document.activeElement)`, else just clear openFor. Add a useHoverMenu test where leaving with focus on body leaves focus on body."
    },
    {
      "file": "frontend/src/ui/useHoverMenu.ts",
      "line": 19,
      "severity": "should",
      "rule_id": "principles-§1",
      "problem": "`byHover` is synced by hand next to `openFor` and stays true after a hover-opened menu closes by Escape, outside click or blur. A later `hover.toggle`/`hover.open` (both exposed through DropdownMenu<T>) then opens a menu that closes when the pointer leaves. The page slice gets a trap when it wires keyboard opens.",
      "fix": "Clear `byHover` whenever `openFor` becomes null (a watch on `dropdown.openFor`), or wrap the exposed `toggle`/`open` to clear it, so 'opened by hover' cannot outlive its menu."
    },
    {
      "file": "frontend/src/ui/tooltip.ts",
      "line": 68,
      "severity": "should",
      "rule_id": "VU12",
      "problem": "tooltip.ts hand-rolls three window add/removeEventListener pairs with matching capture flags, plus element listeners and a raw setTimeout. VU12 asks for @vueuse/core in ui/. Each new hide trigger adds another pair whose flags must match by hand.",
      "fix": "Keep the stop functions returned by `useEventListener(window, [...], …, { capture: true, passive: true })` (it works outside a scope) and use `useTimeoutFn` for the wait. Call the stops in `hide`/`beforeUnmount`."
    },
    {
      "file": "frontend/src/ui/tooltip.ts",
      "line": 55,
      "severity": "should",
      "problem": "`place` calls tooltipPlacement with a fake `UNMEASURED` size only to read `maxWidth`. A reader has to work out that maxWidth ignores the tip size, and mutants already flag the call as equivalent. The measure-then-place step gets harder to follow.",
      "fix": "Add `export function tooltipMaxWidth(viewport: Size): number` in operationTooltip.ts (add-only; tooltipPlacement uses it too). Call it in `place` and delete `UNMEASURED`."
    },
    {
      "file": "frontend/src/ui/tooltip.ts",
      "line": 10,
      "severity": "should",
      "problem": "TIP_CLASSES copies OperationLabel.vue:70's class list, and tooltip.test.ts:285 copies it a third time. The brief asked for this and kept OperationLabel read-only. Still, padding, z-index or wrapping now live in two places that can drift apart.",
      "fix": "Route to the page slice or a follow-up: export TIP_CLASSES from tooltip.ts and bind it in OperationLabel.vue (`:class`). The test can then assert against the constant."
    },
    {
      "file": ".omp/skills/project-map/tree.md",
      "line": 220,
      "severity": "should",
      "rule_id": "PM6",
      "problem": "The implementer's doc lines omit tree.md rows for the new tooltip.ts, useHoverBox.ts and useHoverMenu.ts, and the useDropdownMenu row still lists only PresetPicker, KeymapList, ServerGroup. `just map-check` fails until the docs keeper writes them unprompted.",
      "fix": "Pass the docs keeper tree.md lines: tooltip.ts (vTooltip, singleton tip), useHoverBox.ts, useHoverMenu.ts beside useDropdownMenu.ts, and `open`/`dismiss` plus the hover menu as a user."
    },
    {
      "file": "frontend/src/ui/tooltip.ts",
      "line": 26,
      "severity": "nit",
      "problem": "The tip element is held twice, as `tip.element` and `phase.tip`, and `tip` names both the state object and the element field. Nothing gets harder beyond reading.",
      "fix": "Drop `tip` from the shown phase and hide `tip.element`. Or rename the module object to `tooltipState`."
    }
  ]
}
