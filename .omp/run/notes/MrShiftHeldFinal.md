# MrShiftHeldFinal

Agent output (`agent://MrShiftHeldFinal`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-02T19-44-30-486Z_01a19dca-b716-72dc-ab4f-c92917fdd42d/MrShiftHeldFinal.md), collected 2026-11-03T08:34:04.951Z.

{
  "gate": "pass",
  "failures": [],
  "smoke": [
    {
      "recipe": "A: just check at tree ce73ad38",
      "observed": "Every recipe passed, ending with golden (ok vueuse-use-magic-keys), sfc-order and hooks-test: tests 18, pass 18, fail 0; EXIT 0, wall 41.84 s. Only uncommitted change: .omp/run/slices.json.",
      "pass": true
    },
    {
      "recipe": "B1: start-fixture --diff --mr list on Xvfb :99, hover Assignee, xdotool keydown/keyup shift",
      "observed": "Counts are items/muted icons. Hovered: 6/0. Shift down: 6/6, all text-fg-muted (Me, None, Anna Berg, Ben Okafor, Chiara Rossi, Dmitri Volkov). Up, read at once: 6/0. 2 s later: 6/0. A first try read 0/0 because the hover menu had closed before Shift; I hovered again and repeated.",
      "pass": true
    },
    {
      "recipe": "B2: fixture, plain WebDriver click on Anna Berg",
      "observed": "6/0, Anna Berg checked, opener 'Assignee: anna'. So a plain click includes. Clicking it again took it off: opener 'Assignee'.",
      "pass": true
    },
    {
      "recipe": "B3: fixture, xdotool mousemove to Anna Berg, keydown shift, click 1, keyup shift",
      "observed": "Shift down: 6/6, all muted. After Shift+click: 6/6, Anna Berg text-problem-error, struck through and checked, opener 'Assignee: not anna'. After release: 6/1, only Anna Berg red. 2 s later: 6/1, same.",
      "pass": true
    },
    {
      "recipe": "C1: real app (debug build, EXIT 0) start-app --diff --dir range-repo --glab mr-row-details on :3, hover Assignee, xdotool shift down/up",
      "observed": "Items Me, None, Dmitri Volkov. Hovered: 3/0. Shift down: 3/3, all muted. Up, read at once: 3/0. 2 s later: 3/0.",
      "pass": true
    },
    {
      "recipe": "C2: app, xdotool keydown shift, app-session click --x11 on menuitemcheckbox nth 2 (Dmitri Volkov), keyup shift",
      "observed": "Shift down: 3/3. After the click: 3/3, Dmitri Volkov text-problem-error, struck through and checked, opener 'Assignee: not dmitri'. After release: 3/1, only Dmitri red. 2 s later: 3/1. The scenario has no anna.",
      "pass": true
    },
    {
      "recipe": "D: merge-window start-fixture on :99, xdotool keydown/keyup alt",
      "observed": "Before: one .minimap, 0 visible, page has focus. Alt down: 1 visible. Alt up: 0 visible. 2 s later: 0 visible.",
      "pass": true
    }
  ],
  "environment": "rustc 1.99.0; node v26.13.0; pnpm 12.0.0; xdotool 4.20260303.1. WebKit MiniBrowser (webkitgtk-6.0) on Xvfb :99; app target/debug/yamt with embedded frontend on Xvfb :3 via tauri-driver. Key input came from X11 (xdotool). All sessions were stopped and the temporary repo was removed."
}
