# MrRowDetailsHoverR2

Agent output (`agent://MrRowDetailsHoverR2`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-02T19-44-30-486Z_01a19dca-b716-72dc-ab4f-c92917fdd42d/MrRowDetailsHoverR2.md), collected 2026-11-02T20:43:22.091Z.

{
  "summary": "#2121: closeAfterClick now calls close (focus back to the opener) only when the menu was opened by toggle (focus \"moved\") and focus is on body. Otherwise it calls dismiss, so a click or right click elsewhere with a hover-opened menu leaves focus where it was. #2122: new tests for menuKey (arrow stepping and wrap, preventDefault, Escape closes and refocuses, other keys and an undrawn menu left alone), visibleBottom (a scrolled ancestor wins over the window), and a right click while the menu is not drawn. The remaining survivors are listed with reasons.",
  "files_changed": [
    "frontend/src/ui/useDropdownMenu.ts",
    "frontend/src/ui/useDropdownMenu.test.ts"
  ],
  "tests_added": [
    {
      "name": "a click elsewhere with focus on the page body closes a menu opened without focus and leaves focus there",
      "proves": "#2121 click path: a hover-opened menu closes on an outside click and does not focus its opener"
    },
    {
      "name": "a right click elsewhere with focus on the page body closes a menu opened without focus and leaves focus there",
      "proves": "#2121 contextmenu path: same, for a right click"
    },
    {
      "name": "a right click while the open menu is not drawn yet closes it",
      "proves": "contextMenuElsewhere tolerates menu() === null (kills 63:44 ?. removal)"
    },
    {
      "name": "a menu that overflows its scrolled box opens above, though the window has room",
      "proves": "visibleBottom walks parents past an overflow:visible box and uses the first scrolling ancestor's bottom, not the window"
    },
    {
      "name": "a menu that fits its scrolled box opens below",
      "proves": "visibleBottom: a menu that fits inside its scrolling ancestor is not flipped"
    },
    {
      "name": "arrow keys step through the items, wrapping at both ends, and keep the key from scrolling",
      "proves": "menuKey: ArrowDown/ArrowUp move focus by the target's index, wrap at both ends, call preventDefault, and keep the menu open"
    },
    {
      "name": "Escape closes the menu, returns focus to the opener and is consumed",
      "proves": "menuKey close step: preventDefault, menu closed, focus on the opener (unchanged behaviour)"
    },
    {
      "name": "other keys are left to the page",
      "proves": "menuKey ignore step: no preventDefault, menu and focus unchanged"
    },
    {
      "name": "an arrow key with no menu drawn is left to the page",
      "proves": "menuKey with menu() null: no items, nothing prevented, no throw (kills the `?? []` mutant)"
    }
  ],
  "smoke_evidence": [
    {
      "command": "pnpm -C frontend exec vitest run --project node src/ui/useDropdownMenu.test.ts src/ui/useHoverMenu.test.ts",
      "observed": "Test Files  2 passed (2) / Tests  52 passed (52)"
    },
    {
      "command": "pnpm -C frontend test",
      "observed": "Test Files  2 failed | 251 passed (253); Tests 13 failed | 3645 passed. Every failure is in src/ui/mergeRequestFilters.test.ts or src/ui/mergeRequests.test.ts, from another slice that is mid-flight. This was the run before the last test was added; the targeted run after it passed 52/52."
    },
    {
      "command": "pnpm -C frontend lint",
      "observed": "exit 0 (oxlint --type-aware && eslint --max-warnings 0)"
    },
    {
      "command": "pnpm -C frontend typecheck",
      "observed": "Fails only in fixtureMergeRequests.ts, mergeRequestDomain.test.ts, tauriMergeRequests.test.ts, MergeRequestFilter.vue, MergeRequestRow.vue, mergeRequestFilters.test.ts, mergeRequests.test.ts and mergeRequests.ts (state/page slice). `grep -c useDropdownMenu` on the output gives 0."
    },
    {
      "command": "pnpm -C frontend exec oxfmt --check src/ui/useDropdownMenu.ts src/ui/useDropdownMenu.test.ts",
      "observed": "All matched files use the correct format."
    }
  ],
  "mutation": {
    "command": "just mutants HEAD (no dry-run stop; mutated useDropdownMenu.ts only): 133 killed / 8 survived / 2 no-cov / 3 errors, score 93.01",
    "survivors": [
      "useDropdownMenu.ts:64:7 `opened.value !== null`→true — equivalent: with nothing open, close() and dismiss() only set null, and close moves no focus when `was` is null",
      "useDropdownMenu.ts:108:7 `items[i]?.focus()`→`.focus()` — gate-covered: noUncheckedIndexedAccess makes vue-tsc reject it; the index is always < items.length",
      "useDropdownMenu.ts:110:10 case \"ignore\"→\"\" — gate-covered: vue-tsc rejects \"\" against MenuStep kind; at runtime the default arm returns step to a void caller",
      "useDropdownMenu.ts:110:5 `return` removed in case \"ignore\" — equivalent: falls into default, which only returns step to a void caller",
      "useDropdownMenu.ts:112:5,112:14 default arm (no-cov) — gate-covered: `never` exhaustiveness, unreachable by type",
      "useDropdownMenu.ts:136:16 `opener === null`→false — equivalent: onClickOutside skips null ignore entries (`el && …`)",
      "useDropdownMenu.ts:126:89 above shallowRef(false)→true — equivalent: open() sets above=false before any menu is drawn",
      "useDropdownMenu.ts:146 {capture:true}→{}/false — wiring, pre-slice gap (84ec8fa7): the fake EventTarget has no tree to tell capture from bubble; needs a browser test"
    ]
  },
  "acceptance_not_run": [],
  "deviations_from_brief": [
    "FakeElement in useDropdownMenu.test.ts gained a writable parentElement and overflowY, plus stubbed getComputedStyle and KeyboardEvent (FakeKeyboardEvent, same pattern as useHoverMenu.test.ts), so visibleBottom and menuKey can be tested in node.",
    "Brief Acceptance has no WebKit line. The fix is node-tested only, so no app session was run."
  ],
  "open_risks": [
    {
      "location": "frontend/src/ui/useDropdownMenu.ts:146",
      "risk": "The capture flag on the contextmenu listener has no test (pre-slice, 84ec8fa7). A handler that stops propagation would hide a regression from bubble phase."
    },
    {
      "location": "frontend/src/ui/useDropdownMenu.ts:55-59",
      "risk": "In WebKit, a click on non-focusable text with focus in a toggled menu leaves activeElement = body, which is the case that still refocuses the opener. This is assumed from the existing tests, not seen in WebKit."
    }
  ]
}
