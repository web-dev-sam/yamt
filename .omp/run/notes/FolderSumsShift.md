# FolderSumsShift

Agent output (`agent://FolderSumsShift`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-24T18-08-56-664Z_01a20ebf-2158-737c-a297-40c7dc81d1b2/FolderSumsShift.md), collected 2026-11-25T10:56:50.316Z.

{
  "summary": "The range window's tree now shows each folder's `+a −r` only while Shift is held. `RangeApp.vue` calls `useShiftHeld()` once and adds `:class=\"{ invisible: !shift }\"` to the folder slot's `RangeCounts`, so the counts keep their place and nothing moves. File rows' counts and the folder's reviewed check are unchanged. Line 9 (\"Folder sums\") of `ui/AGENTS.md` now states the rule. No new component was needed.",
  "files_changed": [
    "frontend/src/ui/RangeApp.vue",
    "frontend/src/ui/AGENTS.md"
  ],
  "tests_added": [],
  "smoke_evidence": [
    {
      "command": "pnpm -C frontend typecheck; lint; fmt:check; test; just web-unused",
      "observed": "vue-tsc -b: no errors. oxlint --type-aware && eslint --max-warnings 0: no findings. fmt: \"All matched files use the correct format.\" (869 files). test: \"Test Files 316 passed (316) Tests 4790 passed (4790)\". knip --include exports,types: no findings."
    },
    {
      "command": "just app-session start-fixture --name fs --range-case review --reviewed seeded --size 1280x800; click \"View as tree\"; Reviewed on data/big.txt so a folder check exists; read of every folder li's .tabular-nums (dark)",
      "observed": "before: {hasFocus:true, theme:dark, vis:[null,\"hidden\"], files:[\"none\",\"visible\"]}. null = public/ (notCounted, no RangeCounts at base either); file rows \"none\" = binary files without counts."
    },
    {
      "command": "curl POST :<driverPort>/session/<id>/actions {type:key, actions:[{type:keyDown, value:\"\\uE008\"}]} then keyUp; dark",
      "observed": "keyDown → vis:[null,\"visible\"]; keyUp → vis:[null,\"hidden\"]; file rows [\"none\",\"visible\"] in every state. Held folder text: data +1−0, docs +4−1, public (none), src +55−64, api +0−43, board +55−21, tools +2−0, vendor +1−1."
    },
    {
      "command": "keyDown \\uE008, then read '(window.dispatchEvent(new Event(\"blur\")), \"blurred\")'; dark and light",
      "observed": "after keyDown [null,\"visible\"]; after blur [null,\"hidden\"]; files [\"none\",\"visible\"]."
    },
    {
      "command": "cmp of per-folder [name, counts text, bounding boxes of chevron/icon/name, check box] before/up/blur vs held, dark and light",
      "observed": "\"before: … == held\", \"up: … == held\", \"blur: … == held\" in both themes; \"light held == dark held\". The data/ check box is 217,52,14,14 in every state, and its name box is 65,49,27,20."
    },
    {
      "command": "Same sequence after Settings → Light (data-theme=light)",
      "observed": "before hidden; keyDown visible; keyUp hidden; keyDown+blur hidden; file rows visible throughout. Shots: /tmp/fs-dark-up.png, /tmp/fs-dark-held.png, /tmp/fs-light-up.png, /tmp/fs-light-held.png (page source). Up shots show no folder counts with the data/ check in place; held shots show them."
    },
    {
      "command": "Text at eb2c9f12: the template line set back to base (`class=\"ml-auto\"` only) through HMR, measured, then restored",
      "observed": "base, no Shift: vis [null,\"visible\"], folders [[data,+1−0],[docs,+4−1],[public,null],[src,+55−64],[api,+0−43],[board,+55−21],[tools,+2−0],[vendor,+1−1]]. It matches the held state with the change on name, text and boxes (\"base … == held with change\"). After restoring: all hidden."
    }
  ],
  "mutation": {
    "command": "just mutants HEAD → \"mutants: no Rust changes since HEAD\" / \"mutants: no TypeScript changes since HEAD\" (a .vue-only change mutates nothing)",
    "survivors": []
  },
  "acceptance_not_run": [],
  "deviations_from_brief": [
    "Fixture started with `--reviewed seeded` in addition to the brief's command, and `data/big.txt` marked Reviewed through the UI. Without both, no folder has a reviewed check, so the check's bounding box cannot be compared.",
    "The \"same text as at eb2c9f12\" reading came from setting RangeApp.vue's folder line back to its base form for one HMR reload, then restoring it. No second checkout or worktree (no git write commands).",
    "The request's other acceptance line (the real app on scripts/range-repo.sh) is not in the brief's Acceptance and was not run. The brief's `just check` is left to the verifier (SP3).",
    "The working tree also shows diffs in .omp/run/slices.json and docs/slices/SLICES.md; these were already there and are not mine."
  ],
  "open_risks": [
    {
      "location": "frontend/src/ui/RangeApp.vue:138",
      "risk": "No automated test pins the binding: the change is .vue-only, and the brief allows a test only with a new component. A regression would show only in WebKit or by eye."
    }
  ]
}
