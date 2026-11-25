# FolderSumsShiftFinal

Agent output (`agent://FolderSumsShiftFinal`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-24T18-08-56-664Z_01a20ebf-2158-737c-a297-40c7dc81d1b2/FolderSumsShiftFinal.md), collected 2026-11-25T11:03:24.459Z.

{
  "gate": "pass",
  "failures": [
    {
      "step": "B: real window blur (just app-session focus-away / focus-back)",
      "excerpt": "The recipe cannot run on this machine: `which xdotool` → not found.\nfocus-away (first call): error: recipe `app-session` failed on line 89 with exit code 1. It had started xmessage and then failed at `xdotool search`. Later calls: `app-session: focus is already away; run focus-back first`.\nfocus-back: `app-session: xdotool search --onlyvisible --name yamt$ failed: ` (empty message).\n`click --x11` fails the same way: `app-session: xdotool mousemove --sync 303 66 click 1 failed: `.\ndocument.hasFocus() stayed true, so the real OS-level blur was never tested. In place of it, the blur step used `window.dispatchEvent(new Event(\"blur\"))`, a synthetic event (results under smoke)."
    },
    {
      "step": "B: light theme, Shift with focus in the search field",
      "excerpt": "Not shown in light. Ctrl+P toggles the search panel: the first press closed the panel that was already open, and the second left activeElement as BODY, not the INPUT. The app session was then stopped, so this was not retried. Shift down/up in that light state still gave visible→hidden, but with BODY focused. Rule 3 is shown only in dark (activeElement INPUT)."
    }
  ],
  "smoke": [
    {
      "recipe": "just check (repo root, HEAD 3ab9ab14)",
      "observed": "EXIT=0. The tree had only the orchestrator's .omp/run/slices.json change. nextest: \"Summary [14.343s] 1588 tests run: 1588 passed, 65 skipped\". vitest: \"Test Files 316 passed (316) Tests 4790 passed (4790)\". golden: 10 cases, all `ok …`. hooks-test: \"ℹ tests 18 ℹ pass 18 ℹ fail 0\". Wall time 49.62 s.",
      "pass": true
    },
    {
      "recipe": "setup: range-repo.sh; tauri build --debug; app-session start-app --range main...feature; View as tree; vendor/ui Reviewed",
      "observed": "\"Built application at: target/debug/yamt\". Session on display :3, size 1280x800. After the Reviewed click the vendor folder has the check (span role=img, \"every file reviewed\") at box 217,547,14,14. Side note: the first Reviewed click, with data/big.txt shown, marked `config` instead (\"1 of 13 reviewed\"). app-session reported 2 Reviewed buttons at the same rect (pressed true/false). Possible issue in the stacked views, outside this slice.",
      "pass": true
    },
    {
      "recipe": "dark: WebDriver actions keyDown/keyUp \\uE008; computed visibility of folder RangeCounts",
      "observed": "Before: focus true, active BODY, folders data/docs/src/api/board/tools/vendor all \"hidden\" (public has no counts: null, binary only). keyDown: all \"visible\", counts equal the sums of the file rows below: data +1−0, docs +4−1, src +55−64, api +0−43, board +55−21, tools +2−0, vendor +1−1. keyUp: all \"hidden\". File rows: [\"visible\", null (no counts)] in every state. Shots: /tmp/vf-dark-up.png, /tmp/vf-dark-held.png.",
      "pass": true
    },
    {
      "recipe": "dark+light: folder name and check bounding boxes, every state vs held",
      "observed": "Dark: \"boxes up0 == held\", \"boxes up == held\", \"boxes held2 == held\", \"boxes blurred == held\", \"boxes back == held\". data name 65,49,28,20; vendor check 217,547,14,14. Light (search panel open, 113 px lower): the same \"== held\" lines; data name 65,162,28,20; vendor check 217,659,14,14.",
      "pass": true
    },
    {
      "recipe": "dark+light: keyDown \\uE008, synthetic window blur event, keyUp",
      "observed": "Dark: after keyDown, folderVis all \"visible\"; after dispatchEvent(new Event(\"blur\")), all \"hidden\"; it stays hidden after keyUp. Light: the same, visible → hidden. File rows visible throughout. A real OS blur could not run (xdotool missing; see failures).",
      "pass": true
    },
    {
      "recipe": "light: Settings → Light → Back; keyDown/keyUp \\uE008",
      "observed": "theme \"light\", active BODY. up0: all hidden. held: all visible with the same counts as dark. up: all hidden. File rows visible. Shots: /tmp/vf-light-up.png, /tmp/vf-light-held.png.",
      "pass": true
    },
    {
      "recipe": "rule 3, dark: Ctrl+P focuses Search input; keyDown/keyUp \\uE008",
      "observed": "active \"INPUT\". Before: all hidden. keyDown: all \"visible\". keyUp: all \"hidden\". Shot /tmp/vf-dark-search-held.png shows the Search panel with a focused field and the folder sums shown.",
      "pass": true
    },
    {
      "recipe": "just app-session stop --name vf",
      "observed": "{\"stopped\":\"vf\",\"session\":\"ended\"}: focus-window, tauri-driver and xvfb stopped; session folder removed.",
      "pass": true
    }
  ],
  "environment": "rustc 1.99.0 (b940084d7 2026-09-28); node v26.13.1; pnpm 12.0.0; real app target/debug/yamt (debug build without bundle) on private Xvfb :3 via tauri-driver; xdotool not installed (so focus-away/focus-back and --x11 cannot run); screenshots are WebDriver page shots in /tmp/vf-*.png."
}
