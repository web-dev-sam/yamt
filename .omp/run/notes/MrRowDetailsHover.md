# MrRowDetailsHover

Agent output (`agent://MrRowDetailsHover`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-02T19-44-30-486Z_01a19dca-b716-72dc-ab4f-c92917fdd42d/MrRowDetailsHover.md), collected 2026-11-02T20:14:30.351Z.

{
  "summary": "New `v-tooltip` directive (`ui/tooltip.ts`): one tip element per window, 400 ms delay, shows at once within 300 ms of the last tip closing, hides on leave, a press, Escape, a scroll or unmount, and mirrors its text into `aria-description`. `tooltipPlacement` puts the tip above the element, or below when it does not fit. New `useHoverBox` (the CI box's open/close logic, made generic). New `useHoverMenu`: hover opens, 300 ms close, a click pins. `useDropdownMenu` gains `open` and `dismiss`. Nothing uses them yet; the page slice wires them.",
  "files_changed": [
    "frontend/src/ui/operationTooltip.ts",
    "frontend/src/ui/operationTooltip.test.ts",
    "frontend/src/ui/tooltip.ts",
    "frontend/src/ui/tooltip.test.ts",
    "frontend/src/ui/useHoverBox.ts",
    "frontend/src/ui/useHoverBox.test.ts",
    "frontend/src/ui/useHoverMenu.ts",
    "frontend/src/ui/useHoverMenu.test.ts",
    "frontend/src/ui/useDropdownMenu.ts"
  ],
  "tests_added": [
    {
      "name": "operationTooltip.test.ts: the three named placement tests (fits above / does not fit above / near the right edge)",
      "proves": "Tip sits above at the element's left edge (top ≥ 0 is the boundary), otherwise below at bottom+4; moved left to stay inside the viewport, never below 0; maxWidth = min(480, viewport)."
    },
    {
      "name": "tooltip.test.ts: the_first_tip_waits_400_ms / a_tip_within_300_ms_of_the_last_shows_at_once / a_tip_after_the_warm_window_waits_again",
      "proves": "Timing, through `delayBefore` and through the directive with fake timers: 399 ms shows nothing, 400 shows; 300 ms after a close shows at once; 301 ms waits again."
    },
    {
      "name": "tooltip.test.ts: leave/Escape/scroll/press hide; window listeners captured while waiting or shown",
      "proves": "Each way of hiding works and cancels a waiting tip. Escape is not prevented. pointerdown (capture, passive), keydown (capture), scroll (capture, passive) are registered only while a tip waits or shows."
    },
    {
      "name": "tooltip.test.ts: one tip element made at the first show / measured after its text / placement",
      "proves": "A single reused `div` with `aria-hidden` and OperationLabel's classes. It is measured after its text and max-width are set, then placed."
    },
    {
      "name": "tooltip.test.ts: new values, cancelled waits, unmount, aria-description mirror",
      "proves": "Text updates while shown; null or \"\" shows nothing; a waiting tip shows its new text; a second element cancels the first's wait; unmount hides and removes listeners; aria-description skipped when equal to aria-label."
    },
    {
      "name": "useHoverMenu.test.ts: the six named tests (hover_opens_without_moving_focus … escape_closes_a_pinned_menu)",
      "proves": "All six behaviours the brief names: hover opens without moving focus, a new opener closes the first at once, the 300 ms close and its cancel, pinning, a second click closes, Escape closes."
    },
    {
      "name": "useHoverMenu.test.ts: toggle-opened menu stays on leave; menu with no items or not drawn; above/below; dismiss focus rule",
      "proves": "`open` places the menu without moving focus; `dismiss` returns focus to the opener only when focus was in the menu; the close timer never starts on its own."
    },
    {
      "name": "useHoverBox.test.ts (16 tests)",
      "proves": "Opens on pointer or focus; stays while either is inside; closes when both left; Escape closes and returns focus; scroll outside closes and re-checks focus; close(); captured+passive scroll listener; no area or opener."
    }
  ],
  "smoke_evidence": [
    {
      "command": "pnpm -C frontend exec vitest run --project node src/ui/tooltip.test.ts src/ui/operationTooltip.test.ts src/ui/useHoverBox.test.ts src/ui/useHoverMenu.test.ts",
      "observed": "Test Files  4 passed (4)\n      Tests  67 passed (67)"
    },
    {
      "command": "pnpm -C frontend test",
      "observed": "Test Files  2 failed | 250 passed (252); Tests  13 failed | 3613 passed (3626). The failures are only in src/ui/mergeRequestFilters.test.ts (10) and src/ui/mergeRequests.test.ts (3), owned by the state slice; the core changed at ad68f51b."
    },
    {
      "command": "pnpm -C frontend lint",
      "observed": "$ oxlint --type-aware && eslint --max-warnings 0 \"src/**/*.vue\" — exit 0, no diagnostics"
    },
    {
      "command": "pnpm -C frontend typecheck",
      "observed": "Errors only in files of mr-row-details-state/-page: src/ui/mergeRequests.ts (10), src/ui/mergeRequestFilters.test.ts (3), src/ui/MergeRequestFilter.vue (2), src/ui/mergeRequests.test.ts (1); none in this slice's files"
    },
    {
      "command": "pnpm -C frontend unused && pnpm -C frontend exec oxfmt --check <the 9 files>",
      "observed": "knip: no findings; oxfmt: All matched files use the correct format."
    }
  ],
  "mutation": {
    "command": "just mutants HEAD (completed; no dry-run stop): 349 killed/23 survived/49 no-cov; operationTooltip 21/0, tooltip 161/3, useHoverBox 88/1, useHoverMenu 35/0, useDropdownMenu 44/19",
    "survivors": [
      "frontend/src/ui/tooltip.ts:157 `bound === undefined`→false (updated) — gate-covered: tsc requires the narrowing, and Vue never calls `updated` before `mounted`",
      "frontend/src/ui/tooltip.ts:170 `bound === undefined`→false (beforeUnmount) — gate-covered: same reason, never called before `mounted`",
      "frontend/src/ui/tooltip.ts:11 UNMEASURED {}→{} — equivalent: only `.maxWidth` of that call is read, and it does not depend on the tip's size",
      "frontend/src/ui/useHoverBox.ts:104 initial `at` {x:0,y:0}→{} — equivalent: placement is shown only while open, and `show` always writes `at` before opening",
      "useDropdownMenu.ts: all 19 survivors and 47 no-cov are on unchanged lines (27-56, 82-129). My changed lines (20, 22, 61-70, 76, 78, 137, 139) have none."
    ]
  },
  "acceptance_not_run": [],
  "deviations_from_brief": [
    "ts-conventions TS15: `tooltip.ts` holds mutable module state (`tip` = element, phase, closedAt; plus a WeakMap of bound elements). This is the singleton the design calls for (§1.5). The docs keeper should add it to TS15's exception list, plus a state.md row (writer `ui/tooltip.ts`).",
    "operationTooltip.ts: the private parameter type of `tooltipBox` is renamed `Anchor`→`TagAnchor`, so the contract's exported `Anchor` can use that name. `tooltipBox`'s behaviour and tests are unchanged.",
    "`HoverMenu<T>` and `HoverBox` members are `readonly` arrow properties (the house style of `DropdownMenu`), not method syntax. Callers see the same shape. `HoverBox` is exported so tests can name it.",
    "useDropdownMenu `toggle`: the placement step moved into a shared `open`. After the second `nextTick` it now reads `menu()` again instead of the element captured before. Observable behaviour is unchanged.",
    "Proposed ui/AGENTS.md line: \"Hover (plan §2 #154, #155): `tooltip.ts` `vTooltip` is the page's only hover text (one tip per window, `tooltipPlacement`, 400 ms, at once within 300 ms); `useHoverBox` is a box the pointer enters (CI, people, labels); `useHoverMenu` is one `useDropdownMenu` for several hover-opened openers (300 ms close, a click pins).\"",
    "useHoverMenu.test.ts stubs `window` and `document` in `vi.hoisted` so vueuse's `isClient` is true. That lets the test kill a `useTimeoutFn({immediate})` mutant, which vueuse skips when not on a client. Pattern copied from altHold.test.ts.",
    "tooltip.test.ts uses `vi.resetModules()` and a dynamic `import(\"./tooltip\")` in `beforeEach` to give each test a fresh singleton."
  ],
  "open_risks": [
    {
      "location": "frontend/src/ui/useDropdownMenu.ts:139 (dismiss = closeAfterClick)",
      "risk": "The brief names closeAfterClick's rule, which also treats focus on `<body>` as inside the menu. So a hover-only open-and-leave with nothing focused (for example right after load) moves focus to the opener. If unwanted, `dismiss` should check only `menu().contains(activeElement)`."
    },
    {
      "location": "frontend/src/ui/tooltip.ts:134 (describe)",
      "risk": "[INFERENCE] WebKitGTK exposes `aria-description` to screen readers. Not checked in WebKit in this slice; there is no page user yet."
    },
    {
      "location": "frontend/src/ui/tooltip.ts:9 (TIP_CLASSES)",
      "risk": "The tip's classes live in a TS string. Tailwind v4 scans .ts files, and every class is already used by OperationLabel.vue:70, so the CSS exists. Not observed in a built bundle here."
    }
  ]
}
