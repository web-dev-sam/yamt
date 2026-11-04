# MrDescriptionPageR1

Agent output (`agent://MrDescriptionPageR1`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-03T21-08-17-015Z_01a1a33d-c5f7-7658-b66f-85ea275269a1/MrDescriptionPageR1.md), collected 2026-11-04T01:13:43.937Z.

{
  "summary": "Fixed all six findings. `isLinkedPage` now sits in `ipc/domain.ts` next to `isWebPage`. To make room under domain.ts's 300-line cap, `toSettingsRead` moved, unchanged, into a new file `ipc/settingsRead.ts`. The panel's Escape listener now runs in the bubble phase. The page's Escape handler still closes an open filter menu first; otherwise, while a description is open, it leaves Escape to the panel. `ui/AGENTS.md` names the `data-refreshes-list` exemption. A test now checks the literal address `yamt-picture://localhost/upload~…`.",
  "files_changed": [
    "frontend/src/ipc/domain.ts",
    "frontend/src/ipc/settingsRead.ts",
    "frontend/src/ipc/descriptionDomain.ts",
    "frontend/src/ipc/tauri.ts",
    "frontend/src/ipc/tauriMergeRequests.test.ts",
    "frontend/src/ui/MergeRequestDescription.vue",
    "frontend/src/ui/MergeRequestsView.vue",
    "frontend/src/ui/AGENTS.md"
  ],
  "tests_added": [
    {
      "name": "tauriMergeRequests.test: uploadedImage_is_the_picture_scheme_address_of_the_key (changed)",
      "proves": "#2299: the upload's address is literally `yamt-picture://localhost/upload~000…001`, so a wrong PICTURE_SCHEME now fails"
    }
  ],
  "smoke_evidence": [
    {
      "command": "pnpm -C frontend typecheck && lint && sfc-order && unused && fmt:check",
      "observed": "vue-tsc -b: no output; oxlint --type-aware && eslint: no diagnostics; check-sfc-order: no output; knip: no output; 'All matched files use the correct format. Finished in 1101ms on 791 files'"
    },
    {
      "command": "pnpm -C frontend test",
      "observed": "Test Files  286 passed (286)  Tests  4292 passed (4292)"
    },
    {
      "command": "just app-session start-fixture --name mdr1 --diff --mr list --open-mr; click [data-description-opener=\"640\"]; focus() the search field via read; type 'snooze'",
      "observed": "open panel: [true,\"dialog\"]; after typing: [true,\"INPUT\",\"snooze\"] (panel open, field focused, field holds the text)"
    },
    {
      "command": "press Escape (1st)",
      "observed": "[true,\"INPUT\",\"\"]: the field is cleared and the panel stays open"
    },
    {
      "command": "press Escape (2nd)",
      "observed": "[false,\"640\",true]: panel closed, focus back on opener 640, page still shown"
    },
    {
      "command": "reopen panel 640; hover 'Assignee' (hover-opened filter menu); Escape ×3",
      "observed": "before: [true,\"true\",2] (panel open, menu expanded). Escape 1: [true,\"false\",\"dialog\"] (menu closed, panel stays). Escape 2: [false,true,\"640\"] (panel closed, page stays). Escape 3: false (page left)"
    }
  ],
  "mutation": {
    "command": "just mutants HEAD: stryker on descriptionDomain/domain/settingsRead/tauri.ts, 244 mutants: 240 killed, 3 survived, 1 no coverage; descriptionDomain.ts and settingsRead.ts 100%",
    "survivors": []
  },
  "acceptance_not_run": [],
  "deviations_from_brief": [
    "Kept the panel's `asking` prop. A modal question <dialog> closes through `cancel`, which is the keydown's default action, so its Escape reaches the window keydown with defaultPrevented false. Without `asking`, the panel would close behind a question. The view already guards the same case with `props.asking`.",
    "WebKit check: a click into the search field is a press outside the panel and closes it by design. So I gave the field focus with focus() through `app-session read`, which stands in for reaching it by Shift+Tab. The text was then typed with the keyboard.",
    "Split ipc/domain.ts by moving `toSettingsRead` (its SettingsRead type stays in domain.ts) into the new `ipc/settingsRead.ts`. MrDescriptionDocs has added it to project-map tree.md.",
    "The 4 mutants that were not killed are all on unchanged lines. Three are on domain.ts:156 ABSOLUTE_PATH, a module-level regex that the vitest runner does not re-evaluate (#732, static); a test I tried did not kill them. The fourth is tauri.ts:157 readClipboard, which has no coverage: a one-line pass-through to its command (wiring)."
  ],
  "open_risks": [
    {
      "location": "frontend/src/ui/MergeRequestDescription.vue:36",
      "risk": "The page's Escape must act before the panel's, and that holds only because both listeners are on window and the page registers its listener in setup, before the panel mounts. ui/AGENTS.md states this order; no test pins it."
    },
    {
      "location": "frontend/src/ui/MergeRequestDescription.vue:33",
      "risk": "Unchanged: any other click outside the panel closes it, keyboard clicks included. The exceptions are the openers and the elements marked `data-refreshes-list`."
    }
  ]
}
