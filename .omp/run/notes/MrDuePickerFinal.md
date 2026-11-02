# MrDuePickerFinal

Agent output (`agent://MrDuePickerFinal`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-02T19-44-30-486Z_01a19dca-b716-72dc-ab4f-c92917fdd42d/MrDuePickerFinal.md), collected 2026-11-02T22:56:32.810Z.

{
  "gate": "pass",
  "failures": [],
  "smoke": [
    {
      "recipe": "A: just check (repo root, e476c454)",
      "observed": "Ran all the way through: golden `ok …` for 10 cases, `tsx scripts/check-sfc-order.ts`, hooks-test `ℹ tests 18 ℹ pass 18 ℹ fail 0`, then `EXIT 0` (40.7 s wall; earlier steps were already built).",
      "pass": true
    },
    {
      "recipe": "B start: just app-session start-fixture --name due --diff --mr list --size 1600x1000",
      "observed": "{\"url\":\"http://localhost:43025/\",…} Page at ?diff&mr=list. Opened with the \"Merge requests\" button. Starting theme data-theme=\"dark\".",
      "pass": true
    },
    {
      "recipe": "B dark: open the picker on !630, screenshot",
      "observed": "/tmp/yamt-due-dark-open.png. dialog aria-label \"Choose a due date\". Field placeholder DD.MM.YYYY, ‹ November 2026 ›, Mo..Su, 42 days (Oct 26–Dec 6, the other months' days muted), \"Today\" footer. Focus went to \"Monday, 2 November 2026\" (today, tabIndex 0).",
      "pass": true
    },
    {
      "recipe": "B dark: pick a day by click",
      "observed": "Clicked \"Tuesday, 10 November 2026\". Box closed. !630 moved to the first row: \"…5 files ui … 10.11.2026 8 days left\". Button: \"Due 10.11.2026, 8 days left. Change the due date\".",
      "pass": true
    },
    {
      "recipe": "B dark: reopen, keyboard ArrowRight ArrowDown PageDown Enter",
      "observed": "Opening focused \"Tuesday, 10 November 2026\". After the keys, focus was on \"Friday, 18 December 2026\" and the caption had turned to December 2026. Enter → \"Due 18.12.2026, 46 days left…\", the box closed and focus returned to the opener. The chosen cell has aria-selected=true (on the gridcell).",
      "pass": true
    },
    {
      "recipe": "B dark: type 05.12.2026 + Enter",
      "observed": "The field opens filled with the current date, so I pressed Ctrl+A before typing (without it the field read \"18.12.202605.12.2026\", which was correctly marked invalid). After Ctrl+A, typing and Enter: \"Due 05.12.2026, 33 days left. Change the due date\", box closed.",
      "pass": true
    },
    {
      "recipe": "B dark + light: type 31.02.2026 + Enter",
      "observed": "The field kept \"31.02.2026\", aria-invalid=\"true\", class includes border-problem-error, and the box stayed open. Storage was unchanged: {\"/home/sam/taskboard/.git\":{\"630\":\"2026-12-05\"}}. The button still read \"Due 05.12.2026…\". Screenshots: /tmp/yamt-due-dark-invalid.png and /tmp/yamt-due-light-invalid.png",
      "pass": true
    },
    {
      "recipe": "B dark + light: chevrons, Escape",
      "observed": "Dark: Next month → \"January 2027\", Previous ×2 → \"November 2026\". Light: Next → \"January 2027\". Escape closed the box both times; activeElement was \"Due 05.12.2026, 33 days left. Change the due date\".",
      "pass": true
    },
    {
      "recipe": "B dark + light: Today, reload",
      "observed": "Today → row \"02.11.2026 Due today\", button label \"Due 02.11.2026, Due today. Change the due date\" (\"Due\" appears twice). After location.reload() and reopening Merge requests, !630 still showed 02.11.2026 Due today. Side note: the theme went back to dark after the reload in the light run.",
      "pass": true
    },
    {
      "recipe": "B dark + light: list scroll closes the box; Clear",
      "observed": "Scrolling \"Open merge requests\" by 300 px (dark) or 200 px (light) with the box open: dialog gone. Clear → !630 back at li index 11 (between !631 and !629), button \"Set a due date\" with the calendar icon, storage \"{}\".",
      "pass": true
    },
    {
      "recipe": "B light: open the picker on !630, screenshots",
      "observed": "After choosing Settings → Light (data-theme=light): /tmp/yamt-due-light-open.png, same layout as dark, today has a grey background. /tmp/yamt-due-light-selected.png: the chosen 12 is filled blue (primary), today grey, footer \"Today\" + \"Clear\", the row reads 12.11.2026 over \"10 days left\". Click pick → 12.11.2026, 10 days left. Keyboard ArrowLeft ArrowUp PageDown Enter → 04.12.2026, 32 days left. Typed 05.12.2026 → saved.",
      "pass": true
    },
    {
      "recipe": "B: no input[type=date], no [title] on the page",
      "observed": "document.querySelectorAll(\"input[type=date]\").length = 0. [title] inside the \"Open merge requests\" list = 0. The whole document has 7 [title], all in the compare window's own buttons, outside this slice: New tab, Close tab, Format covers JSON and XML only, Language, Previous change, Next change, Settings.",
      "pass": true
    },
    {
      "recipe": "Hover !630 \"created 4 weeks ago\"",
      "observed": "span aria-description=\"05.10.2026, 11:00\". Hovering showed the tip \"05.10.2026, 11:00\" (day first, 24-hour) above the row. Screenshot: /tmp/yamt-due-created-tip.png",
      "pass": true
    }
  ],
  "environment": "rustc 1.99.0 (b940084d7 2026-09-28); node v26.13.0; pnpm 12.0.0. Fixture on a private display via app-session: WebKitWebDriver + MiniBrowser, 1600x1000, today 02.11.2026. The session is stopped (webdriver + vite, folder removed). Screenshots in /tmp/yamt-due-*.png."
}
