# MrDescriptionFinal

Agent output (`agent://MrDescriptionFinal`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-03T21-08-17-015Z_01a1a33d-c5f7-7658-b66f-85ea275269a1/MrDescriptionFinal.md), collected 2026-11-04T01:26:06.829Z.

{
  "gate": "pass",
  "failures": [],
  "smoke": [
    {
      "recipe": "A. just check (worktree @188cbdb7)",
      "observed": "Every recipe ran through to the last one. End of output: vitest `Test Files 286 passed (286) / Tests 4292 passed (4292)`; `arch-check: ok`; `map-check: ok`; golden: ok for all 10 cases; hooks-test `ℹ tests 18 ℹ pass 18 ℹ fail 0`; `Wall time: 178.71 seconds`. Caveat: output was piped through tail, so the exit status shown is tail's. just stops at the first failing recipe, and the last recipe finished.",
      "pass": true
    },
    {
      "recipe": "B.5 Escape, search field focused with text (fixture --diff --mr list)",
      "observed": "Clicking the field is an outside press and closed the panel, so I opened !640 and focused the field with .focus(). Typed snooze: {dialogs:1,search:\"snooze\",active:\"Search merge requests\"}. Escape: {dialogs:1,search:\"\"}, so the field took it and the panel stayed. Escape: {dialogs:0,active:\"Show description\"}.",
      "pass": true
    },
    {
      "recipe": "B.5 Escape with hover-opened filter menu",
      "observed": "!640 open, hovered Assignee: menus [Tabs, \"Assignee:Me6None10Anna Berg6…\"]. Escape: Assignee menu gone, dialog still open. Escape: dialogs [], focus on \"Show description\".",
      "pass": true
    },
    {
      "recipe": "B.5 other closings",
      "observed": "Close button: dialogs 1→0. Press on the page-header h2 \"Merge requests\": 1→0. Second click on !640's button: 1→0. Refresh kept the panel open (1→1).",
      "pass": true
    },
    {
      "recipe": "B.4 fixture links !640",
      "observed": "#12 logged `mergeRequests.fixture_page {page: \"https://gitlab.example/taskboard/taskboard/-/issues/12\"}`. `the docs` logged `fixture_page {page: \"https://docs.example/x\"}`. Clicking mail Anna and planted logged nothing. Their tooltips read `mailto:anna@example.com` and `javascript:window.yamtPlanted=true`. location.href unchanged, panel open, yamtPlanted undefined, 0 [href] in the panel. The fixture has no http:// link (covered in C.3). Shots: /tmp/mdv-final/b-tooltip-mailto.png, b-tooltip-js.png",
      "pass": true
    },
    {
      "recipe": "B.12 four fixture windows dark/light shots",
      "observed": "diff and range-case review dark: panel bg rgb(33,31,39). diff and range light: bg rgb(247,248,249), fg rgb(0,0,0). Header \"!640Snooze a reminder\" in all four. Files: /tmp/mdv-final/b-640-{diff-dark,diff-light,range-dark,range-light}.png and b-rows-*.png. start-fixture has no --settings (`app-session: unknown option --settings`), so I switched to Light through Settings → Light.",
      "pass": true
    },
    {
      "recipe": "C.2 real app !52 uploads (--glab mr-description)",
      "observed": "img shot → yamt-picture://localhost/upload~0a1b…e8f9 (naturalWidth 32), old → upload~f9e8…1b0a (16). Captions \"gone cat evil plain\". The list argv has description, no descriptionHtml. Log: `argv: api projects/7/uploads/0a1b2c3d4e5f60718293a4b5c6d7e8f9/shot.png`, `argv: api projects/7/uploads/f9e8d7c6b5a4938271605f4e3d2c1b0a/old.png`, then `argv: api https://gitlab.com/-/project/7/uploads/f9e8…/old.png`. No image/evil/plain.example lines, 0 stdin:/-X lines. App log: `description_shown fields=blocks=17 iid=52 kind=\"shown\" ms=45`.",
      "pass": true
    },
    {
      "recipe": "C.3 real app links !52",
      "observed": "opened.log: `argv: https://docs.example/x`, `argv: http://plain.example/`, `argv: https://gitlab.com/taskboard/taskboard/-/issues/12`. Clicking mail, file and script added nothing. Hovering file showed the tooltip `file:///etc/passwd`. location tauri://localhost, panel open, no problem bar. App log: `opening a GitLab page page=\"https://docs.example/x\"`, then the same for `http://plain.example/`. Shot: /tmp/mdv-final/c-52-file-tooltip.png",
      "pass": true
    },
    {
      "recipe": "C.6 real app !52 dark/light shots",
      "observed": "/tmp/mdv-final/c-52-dark.png and /tmp/mdv-final/c-52-light.png. Light: bg rgb(247,248,249), images naturalWidth [32,16]. Shows the headings, coloured Label.colour(:red), the list from 3, task boxes, the Left/Centre/Right table, the quote, the closed More, links (mail/file/script muted), and images A and B.",
      "pass": true
    }
  ],
  "environment": "rustc 1.99.0; node v26.13.0; pnpm 12.0.0; WebKitWebDriver/MiniBrowser on xvfb. In the worktree, `cargo tauri build --debug --no-bundle` failed: `Command \"build\" not found` (pnpm build ran at the root). Built with `pnpm -C frontend build --mode tauri` + `--config '{\"build\":{\"beforeBuildCommand\":\"\"}}'`. Worktree removed."
}
