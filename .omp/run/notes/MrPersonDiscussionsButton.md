# MrPersonDiscussionsButton

Agent output (`agent://MrPersonDiscussionsButton`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-05T12-42-41-688Z_01a1abbb-9c98-70e8-9233-da1eb0f2d2d5/MrPersonDiscussionsButton.md), collected 2026-11-05T16:39:08.273Z.

{
  "summary": "While pressed, the Discussions button on the merge-request page (`MergeRequestsView.vue:235`) now gets an outline in the primary colour (`aria-pressed:border-primary`) instead of the filled `aria-pressed:bg-row-selected`. It now looks like the active review-mode button. Hover, disabled and inactive looks are unchanged.",
  "files_changed": [
    "frontend/src/ui/MergeRequestsView.vue"
  ],
  "tests_added": [],
  "smoke_evidence": [
    {
      "command": "pnpm -C frontend fmt:check; pnpm -C frontend lint; pnpm -C frontend typecheck; pnpm -C frontend test",
      "observed": "All matched files use the correct format. lint and vue-tsc -b: no output, exit 0. Test Files 310 passed (310), Tests 4655 passed (4655)"
    },
    {
      "command": "just app-session start-fixture --name pdb --diff --mr list --open-mr --size 1600x1000; click Discussions; Review mode → [role=menuitemradio] nth 0 (Me); read computed borderColor/backgroundColor (dark, pointer away)",
      "observed": "[\"Back\",null,null,false,\"rgb(67, 64, 77)\",\"rgba(0, 0, 0, 0)\"],[\"Review mode\",null,\"false\",false,\"rgb(119, 76, 213)\",\"rgba(0, 0, 0, 0)\"],[\"Discussions\",\"true\",null,false,\"rgb(119, 76, 213)\",\"rgba(0, 0, 0, 0)\"]: Discussions border = active review-mode border, background = inactive button background"
    },
    {
      "command": "read: documentElement.dataset.theme='light'; same computed read",
      "observed": "[\"Back\",null,\"rgb(209, 211, 217)\",\"rgba(0, 0, 0, 0)\"],[\"Review mode\",null,\"rgb(56, 113, 225)\",\"rgba(0, 0, 0, 0)\"],[\"Discussions\",\"true\",\"rgb(56, 113, 225)\",\"rgba(0, 0, 0, 0)\"]"
    },
    {
      "command": "page Back, then Merge requests (page reopened); read Discussions/Label in light and dark",
      "observed": "light: Label rgb(209, 211, 217)/transparent, Discussions aria-pressed=false rgb(209, 211, 217)/rgba(0, 0, 0, 0); dark: Label rgb(67, 64, 77)/transparent, Discussions false rgb(67, 64, 77)/rgba(0, 0, 0, 0)"
    },
    {
      "command": "click Discussions twice (enter and leave the view), pointer away, dark read",
      "observed": "[\"Label\",null,\"rgb(67, 64, 77)\",\"rgba(0, 0, 0, 0)\"],[\"Discussions\",\"false\",\"rgb(67, 64, 77)\",\"rgba(0, 0, 0, 0)\"]: inactive look"
    },
    {
      "command": "just app-session shot --name pdb /tmp/pdb/{dark,light}-active.png; magick … -crop 500x80+800+40",
      "observed": "/tmp/pdb/dark-active-crop.png and /tmp/pdb/light-active-crop.png: review-mode button and Discussions button side by side, both active and both with the same outline (purple in dark, blue in light), neither filled. Also /tmp/pdb/dark-left-crop.png: Discussions inactive after leaving the view"
    }
  ],
  "mutation": {
    "command": "just mutants HEAD → \"mutants: no Rust changes since HEAD\" / \"mutants: no TypeScript changes since HEAD\" (the only change is in a .vue file, which is not mutated)",
    "survivors": []
  },
  "acceptance_not_run": [],
  "deviations_from_brief": [
    "I read \"Back\" two ways and observed both. (1) The page's Back button, which leaves the page; I then reopened it with Merge requests. (2) Pressing Discussions again to leave the view. Both left the button with the inactive look.",
    "I switched themes by setting `document.documentElement.dataset.theme = \"light\"` (dark is the default when no theme is set) instead of going through the settings UI.",
    "`MergeRequestPersonViewPage.test.ts` is unchanged: no test there asserts the active class."
  ],
  "open_risks": [
    {
      "location": "frontend/src/ui/MergeRequestsView.vue:235",
      "risk": "Hovering the pressed button still shows `hover:bg-hover`, as the review-mode button does. I read it in dark only, with the old classes, before the fix: rgba(233, 228, 254, 0.08). I did not re-check it after the fix."
    }
  ]
}
