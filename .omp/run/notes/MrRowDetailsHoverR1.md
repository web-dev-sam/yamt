# MrRowDetailsHoverR1

Agent output (`agent://MrRowDetailsHoverR1`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-02T19-44-30-486Z_01a19dca-b716-72dc-ab4f-c92917fdd42d/MrRowDetailsHoverR1.md), collected 2026-11-02T20:35:23.635Z.

{
  "summary": "`dismiss` now gives focus back to the opener only when focus is inside the menu. A focus on <body> stays where it is. A menu opened by `open` that closes on window blur uses the same rule. useDropdownMenu now keeps one state, `opened: {which, focus: \"kept\"|\"moved\"} | null`, and `openFor` is computed from it. This removes useHoverMenu's hand-synced `byHover`. tooltip.ts uses `useEventListener` stop handles and one `useTimeoutFn`, and holds the tip element in one place. `TIP_CLASSES` is exported and bound in OperationLabel.vue.",
  "files_changed": [
    "frontend/src/ui/useDropdownMenu.ts",
    "frontend/src/ui/useDropdownMenu.test.ts",
    "frontend/src/ui/useHoverMenu.ts",
    "frontend/src/ui/useHoverMenu.test.ts",
    "frontend/src/ui/tooltip.ts",
    "frontend/src/ui/tooltip.test.ts",
    "frontend/src/ui/OperationLabel.vue"
  ],
  "tests_added": [
    {
      "name": "useDropdownMenu.test.ts: dismiss with focus on the page body leaves it there (+ outside / in the menu / menu not drawn)",
      "proves": "#2108/#2115: dismiss's inside-only focus rule, including with no menu element"
    },
    {
      "name": "useHoverMenu.test.ts: leaving with focus on the page body leaves it there",
      "proves": "#2108/#2115: hovering an opener and leaving it, with nothing focused, moves no focus after HOVER_CLOSE_MS"
    },
    {
      "name": "useHoverMenu.test.ts / useDropdownMenu.test.ts: window blur closes a hover-opened menu (a menu opened without focus) and leaves focus where it was",
      "proves": "#2116"
    },
    {
      "name": "useDropdownMenu.test.ts: window blur closes a toggled menu and returns focus to its opener; blur with no menu open…, focus coming back leaves a new menu open",
      "proves": "a toggled menu still closes on blur as before; the !focused guard and the ?. on line 119"
    },
    {
      "name": "useHoverMenu.test.ts: a menu toggled open after a hover-opened one closed elsewhere stays when hover leaves",
      "proves": "#2109: 'opened by hover' does not outlive its menu"
    },
    {
      "name": "useDropdownMenu.test.ts: right click elsewhere ×3 (body / outside / inside focus), right click inside keeps it open",
      "proves": "closeAfterClick keeps its old rule (body counts as inside) and is now built on dismiss"
    },
    {
      "name": "useDropdownMenu.test.ts: a click elsewhere closes the menu; a click on its opener is left to the opener; a click with no menu open moves no focus",
      "proves": "the rewritten onClickOutside `ignore` (lines 131-134) and its handler"
    },
    {
      "name": "useDropdownMenu.test.ts: closing when the opener is gone / with nothing open moves no focus",
      "proves": "close's `was !== null` check and the `?.focus` on line 43"
    },
    {
      "name": "useDropdownMenu.test.ts: toggle cases (second toggle closes, another opener switches, opens above, pinning does not place again, kept→moved)",
      "proves": "toggle's isOpen/focus branches, lines 77-91"
    },
    {
      "name": "tooltip.test.ts: entering an element inside one whose tip shows switches to its tip at once",
      "proves": "entered() hides the shown tip first (kills the survivor at line 115)"
    }
  ],
  "smoke_evidence": [
    {
      "command": "pnpm -C frontend exec vitest run --project node src/ui/useDropdownMenu.test.ts src/ui/useHoverMenu.test.ts src/ui/tooltip.test.ts src/ui/operationTooltip.test.ts src/ui/useHoverBox.test.ts",
      "observed": "Test Files  5 passed (5)\n      Tests  91 passed (91)"
    },
    {
      "command": "pnpm -C frontend test",
      "observed": "Test Files  2 failed | 251 passed (253); Tests  13 failed | 3637 passed (3650). All 13 failures are in src/ui/mergeRequestFilters.test.ts and src/ui/mergeRequests.test.ts (later slices, expected)"
    },
    {
      "command": "pnpm -C frontend lint",
      "observed": "$ oxlint --type-aware && eslint --max-warnings 0 \"src/**/*.vue\" (exit 0, no diagnostics)"
    },
    {
      "command": "pnpm -C frontend typecheck",
      "observed": "errors only in src/ui/mergeRequests.ts (10), src/ui/mergeRequestFilters.test.ts (3), src/ui/MergeRequestFilter.vue (2: 'checked' on Choice<Value>), src/ui/mergeRequests.test.ts (1). None in owned files"
    },
    {
      "command": "pnpm -C frontend fmt:check; pnpm -C frontend unused; pnpm -C frontend sfc-order",
      "observed": "All matched files use the correct format. knip: no findings. sfc-order: clean"
    },
    {
      "command": "vite dev on :5791; curl /src/style.css?direct | grep tip classes",
      "observed": ".hover-tooltip .pointer-events-none .tooltip-text .whitespace-pre-wrap .w-max .wrap-break-word .z-500 are all emitted now that OperationLabel.vue binds :class=\"TIP_CLASSES\" instead of a literal"
    }
  ],
  "mutation": {
    "command": "just mutants HEAD (no dry-run stop; scope tooltip.ts, useDropdownMenu.ts, useHoverMenu.ts): 282 killed / 24 survived / 17 no-cov / 2 errors; useHoverMenu 21/0, tooltip 154/8, useDropdownMenu 107/16",
    "survivors": [
      "frontend/src/ui/tooltip.ts:35 `phase !== null`→true — equivalent: the timer fires only while a phase waits; hide() stops it and start() clears any earlier one",
      "frontend/src/ui/tooltip.ts:93 `waiting.stop()` removed — equivalent: a stale fire finds no phase (line 35) or re-shows the same shown tip; start() clears it otherwise",
      "frontend/src/ui/tooltip.ts:40 `{immediate:false}`→{}/true — equivalent: an import-time fire finds no phase (line 35) and does nothing",
      "frontend/src/ui/tooltip.ts:123 kind \"waiting\"→\"\" — gate-covered: vue-tsc rejects \"\" for kind \"waiting\"|\"shown\"",
      "frontend/src/ui/tooltip.ts:161,175 `bound === undefined`→false (+no-cov block) — gate-covered: tsc needs the narrowing, and Vue never calls updated/beforeUnmount before mounted",
      "frontend/src/ui/tooltip.ts:12 UNMEASURED→{} — equivalent: only .maxWidth of that call is read, and it does not depend on the tip's size",
      "frontend/src/ui/useDropdownMenu.ts:62 `opened !== null`→true — equivalent: with nothing open, close() and dismiss() are no-ops",
      "frontend/src/ui/useDropdownMenu.ts:134 `opener === null`→false — equivalent: onClickOutside skips null ignore entries (`el && …`)",
      "frontend/src/ui/useDropdownMenu.ts:124 above shallowRef(true) — equivalent: open() writes `above` before any menu shows",
      "frontend/src/ui/useDropdownMenu.ts:144 contextmenu {capture:true}→{}/false — wiring: a capture flag; the fake window has no tree to tell phases apart",
      "unchanged lines, not used by dismiss: 30 (visibleBottom loop), 61:44 (contextmenu ?.), 94-101 (menuKey items/findIndex/preventDefault); no-cov on 30-31 and 94-110"
    ]
  },
  "acceptance_not_run": [],
  "deviations_from_brief": [
    "DropdownMenu<T> gains `opened: Readonly<ShallowRef<{which, focus: \"kept\"|\"moved\"} | null>>` (add-only). `openFor` is now a computed over it; its type is unchanged and existing users compile unchanged. This is the one source #2109 asks for.",
    "`toggle` on a menu opened by `open` (focus \"kept\") now moves focus to the first item and marks it \"moved\" instead of closing. No existing user calls `open`. `openerClicked` is now: stop the pending close, then toggle. The pin is that toggle.",
    "Window blur closes a menu opened by `open` through the `dismiss` rule, and a toggled menu through `close` as before (#2116). closeAfterClick is rewritten as `body ? close : dismiss`; its behaviour is the same.",
    "useHoverMenu.test.ts: the FakeElements now get a `name`. Structural `toEqual` treated item, opener and row as equal, which hid identity bugs.",
    "For the docs keeper (ui/AGENTS.md, architecture): useDropdownMenu's `opened` state with kept/moved focus, and `dismiss`'s inside-only focus rule; TIP_CLASSES now comes from tooltip.ts and OperationLabel.vue binds it."
  ],
  "open_risks": [
    {
      "location": "frontend/src/ui/tooltip.ts:147-153",
      "risk": "Each bound element registers its pointerenter/pointerleave through useEventListener, which costs a computed and a watcher per element. That is a few hundred on a long merge-request page. They stop at beforeUnmount."
    },
    {
      "location": "frontend/src/ui/OperationLabel.vue:8",
      "risk": "Importing TIP_CLASSES evaluates tooltip.ts in the merge window: one module-level useTimeoutFn (a shallowRef, no timer started). Harmless as far as I can see, but it is new module state loaded in that window."
    }
  ]
}
