# MrReviewModePageR1

Agent output (`agent://MrReviewModePageR1`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-03T17-39-00-632Z_01a1a27e-2d98-762d-8985-51a9589317bb/MrReviewModePageR1.md), collected 2026-11-03T19:03:11.975Z.

{
  "summary": "New generic `ui/MenuNarrowing.vue` now holds the narrowing box in one place: the menu container and its classes, the input, `typed` and its reset on opening, `narrows`, and `shown` passed to a scoped slot. `MergeRequestFilter.vue` and `MergeRequestReviewMode.vue` both use it and still expose `opener`/`menu`/`narrowBox`, so `MergeRequestsView.vue` is unchanged. A new `MergeRequestFilter.test.ts` fails if the two menus stop resetting or narrowing alike. `ui/AGENTS.md` is updated.",
  "files_changed": [
    "frontend/src/ui/MenuNarrowing.vue",
    "frontend/src/ui/MergeRequestFilter.vue",
    "frontend/src/ui/MergeRequestReviewMode.vue",
    "frontend/src/ui/MergeRequestFilter.test.ts",
    "frontend/src/ui/AGENTS.md"
  ],
  "tests_added": [
    {
      "name": "MergeRequestFilter.test.ts: above NARROW_FROM choices both menus open the same narrowing box (above: false/true)",
      "proves": "SSR markup of the Reviewer filter and the picker give a byte-identical container plus search input (\"Narrow the Reviewer list\", top-full/bottom-full)"
    },
    {
      "name": "MergeRequestFilter.test.ts: at NARROW_FROM choices neither menu has a narrowing box, and both list every choice",
      "proves": "same threshold in both menus; both list every choice in order"
    },
    {
      "name": "MergeRequestFilter.test.ts: closed, neither menu renders its box or its choices",
      "proves": "both pass `open` through to the shared box"
    },
    {
      "name": "MergeRequestFilter.test.ts: both menus leave typing, narrowing and its reset on opening to MenuNarrowing",
      "proves": "each source mounts <MenuNarrowing … :open=\"open\"> and holds no own typed/narrowed(/NARROW_FROM/search input, so a menu cannot narrow or reset differently"
    }
  ],
  "smoke_evidence": [
    {
      "command": "pnpm -C frontend lint; typecheck; test; sfc-order; fmt:check; unused",
      "observed": "oxlint+eslint: no output (exit 0); vue-tsc -b: clean; Test Files 274 passed (274), Tests 4138 passed (4138); check-sfc-order clean; \"All matched files use the correct format.\"; knip: clean"
    },
    {
      "command": "just app-session start-fixture --name rmr1 --diff --mr list; hover \"Review mode\"; read menu",
      "observed": "{label:\"Review mode\", items:[Me8,Anna Berg8,Ben Okafor7,Chiara Rossi7,Dmitri Volkov7], box:false, cls:\"absolute left-0 z-10 flex max-h-[60vh] min-w-56 flex-col rounded border border-control-border bg-panel-inline p-1 shadow-lg top-full\"}; Reviewer filter: Me8,None13,Anna Berg8,… (same order, no None in picker)"
    },
    {
      "command": "rmr1: click \"Review mode\" --role button, then ArrowDown ×4, ArrowUp",
      "observed": "focus Me8 → Anna Berg8 → Ben Okafor7 → Chiara Rossi7 → Dmitri Volkov7 → (Up) Chiara Rossi7"
    },
    {
      "command": "rmr3 (?mr=list): open the picker, add 4 choices into its instance props through __vue_app__ (9 > NARROW_FROM), click the box, type \"o\", ArrowDown ×2",
      "observed": "input {label:\"Narrow the Reviewer list\", ph:\"Find reviewer…\"}; typed \"o\" → [Ben Okafor7,Chiara Rossi7,Dmitri Volkov7,Fay Wong1,Gus Moe1,Hana Ito1]; ArrowDown → Ben Okafor7, Chiara Rossi7"
    },
    {
      "command": "rmr3: Escape (list closes, page stays), reopen picker, inject again, read box",
      "observed": "before close {input:{value:\"o\"},n:6}; after reopen {input:{value:\"\"},n:9}: reset on opening"
    },
    {
      "command": "rmr3: open Label filter, inject 6 labels (11 choices), click box, type \"ta\", ArrowDown, Escape, reopen",
      "observed": "{label:\"Narrow the Label list\", ph:\"Find label…\"}; \"ta\" → [beta1,delta3,zeta5]; ArrowDown → beta1; after reopen value \"\" and all 11 listed"
    },
    {
      "command": "rmr3: through MergeRequestsView refs: bars.find(label).menu / .narrowBox, picker.menu",
      "observed": "{menu:\"DIV:true\", box:\"Narrow the Label list\", focused after .focus():\"Narrow the Label list\", picker menu/box null while closed}"
    },
    {
      "command": "start-fixture --name rmp --diff --mr list + brief's due dates; hover Review mode; click, Enter on Me",
      "observed": "tooltip element \"Review mode|visible|1\"; after pick focus \"Review mode\", border-primary true, openers [Assignee, Reviewer: Me, Label], Draft Ready=true, rows 618 633 623 622 638 603 608, icon \"Sorted for your review: due with your turn first, then fewest waiting on the author\"; search \"Card\" kept through a pick"
    },
    {
      "command": "just map-check",
      "observed": "missing: mergeRequests/internal/reviewOrder.ts, ui/MergeRequestReviewMode.vue, ui/MergeRequestReviewSort.vue, ui/mergeRequestRowReplyText.ts (all from earlier slices; MenuNarrowing.vue was not reported)"
    }
  ],
  "mutation": {
    "command": "just mutants HEAD → \"mutants: no Rust changes since HEAD\" / \"mutants: no TypeScript changes since HEAD\" (only .vue and a test changed)",
    "survivors": []
  },
  "acceptance_not_run": [
    "No fixture menu has more than NARROW_FROM=8 values (picker 5, filters 6), so the box never appears on its own. Narrowing and reset were seen after adding choices to instance props via __vue_app__. Box focus on an opener click with a long list at open: seen only via .focus()."
  ],
  "deviations_from_brief": [
    "New component MenuNarrowing.vue (VU15 sixth component): it is the one shared menu box the finding asks for; a composable alone could not hold the input and the container classes.",
    "MergeRequestReviewMode's exposed `menu`/`narrowBox` are now computed from the box's refs instead of its own template refs. Names and types are unchanged (Contract `defineExpose({ opener, menu, narrowBox })` kept); MergeRequestsView.vue is unchanged.",
    "The reset on opening stays a watch on `open` inside MenuNarrowing; the box's v-if on `open` moved into it.",
    "Test file MergeRequestFilter.test.ts renders both menus with vue/server-renderer (the node project has no DOM) and stubs window/document for useShiftHeld.",
    "Docs keeper: add `frontend/src/ui/MenuNarrowing.vue` to skill://project-map/tree.md (map-check did not flag it, but it is a new source file).",
    "Fence PM10 (scripts/windowFence.ts) covers `MergeRequest*`/`mergeRequest*`/`CiStatus*`; MenuNarrowing.vue is used only by the page but falls outside that glob. Widening the glob or renaming it is outside Owned.",
    "Step 2 note: after a pick the wider 'Reviewer: Me' chip shifts Label under the pointer, so a hover-open Label menu appeared; the pointer had stayed where it clicked. The opener classes are unchanged, so the layout is the same as before."
  ],
  "open_risks": [
    {
      "location": "frontend/src/ui/MergeRequestFilter.test.ts:96",
      "risk": "The 'does not hold its own typed text' check is a source regex. It catches a menu copying the box back, but it is structural, not behavioural; reset and narrowing as typed were seen only in WebKit."
    },
    {
      "location": "frontend/src/ui/MenuNarrowing.vue:1",
      "risk": "Not matched by the PM10 window-root fence glob (MergeRequest*), nor by mergeRequestTitles.test.ts's glob; today it imports only mergeRequests/ and mergeRequestsText.ts and has no title attribute."
    }
  ]
}
