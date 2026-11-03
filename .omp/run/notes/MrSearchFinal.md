# MrSearchFinal

Agent output (`agent://MrSearchFinal`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-03T08-37-08-403Z_01a1a08e-14b3-70d2-9e68-44d830b6bbca/MrSearchFinal.md), collected 2026-11-03T09:01:05.393Z.

{
  "gate": "pass",
  "failures": [],
  "smoke": [
    {
      "recipe": "just check (HEAD a6abde4c)",
      "observed": "Ran once from the repo root, wall 40.30 s, no recipe failed. Tail: `vitest run --project node` → Test Files 260 passed (260), Tests 3821 passed (3821); `arch-check: ok`; `map-check: ok`; golden: 10 cases `ok`; sfc-order ran clean; hooks-test: tests 18, pass 18, fail 0. Nextest started 1231 tests across 94 binaries (30 skipped). The earlier steps (fmt, clippy -D warnings, deny, bindings, fixtures, lint, typecheck, knip) also completed.",
      "pass": true
    },
    {
      "recipe": "just app-session start-fixture --name mrs --diff --mr list --size 1600x1000; click 'Merge requests'",
      "observed": "{\"url\":\"http://localhost:42273/\",...}; page ?diff&mr=list; read: `sum=40 of 40 merge requests | field= | ids=!640..!601 (40) | theme=dark`",
      "pass": true
    },
    {
      "recipe": "dark: click field, type '!630'",
      "observed": "`sum=1 of 40 merge requests | field=!630 | focus=Search merge requests | ids=!630`; filter-bar children tops 60,60,60,60,60 (one line). Screenshot /tmp/verify-mrsearch-dark-630.png (page): one row 'Snooze a reminder !630'",
      "pass": true
    },
    {
      "recipe": "dark: click 'Clear search' (x)",
      "observed": "`sum=40 of 40 | field= | focus=Search merge requests`",
      "pass": true
    },
    {
      "recipe": "dark: type 'SNOOZE' (title in other case)",
      "observed": "`sum=4 of 40 | field=SNOOZE | ids=!640,!630,!620,!610`; titles 'Snooze a reminder' ×3 and 'Draft: Snooze a reminder' (!620)",
      "pass": true
    },
    {
      "recipe": "dark: Escape, Escape",
      "observed": "First Escape: `sum=40 of 40 | field= | focus=Search merge requests`. Second Escape: MR page gone (field not in the DOM), the compare view shows ('Tabs / Compare 1 / … Left / Right')",
      "pass": true
    },
    {
      "recipe": "dark: reopen, type 'https://gitlab.example.com/g/p/-/merge_requests/620' (sent with the `type` command, not a clipboard paste)",
      "observed": "`sum=1 of 40 | field=https://gitlab.example.com/g/p/-/merge_requests/620 | ids=!620`",
      "pass": true
    },
    {
      "recipe": "dark: type 'overdue !635 !640', then Label → menuitemcheckbox 'frontend8', Escape",
      "observed": "Before the label: `sum=2 of 40 | ids=!640,!635`. After: `sum=1 of 40 | ids=!635 | rows=!635:frontend=true`; bar tops 60,60,60,60,61,60 (one line, Clear filters included). Screenshot /tmp/verify-mrsearch-dark-label.png",
      "pass": true
    },
    {
      "recipe": "dark: Clear filters; Refresh (wait 4 s); Back + reopen",
      "observed": "After Clear filters: `sum=2 of 40 | field=overdue !635 !640 | ids=!640,!635`. After Refresh: same text, `sum=2 of 40`. After reopening: `sum=40 of 40 | field=`, full list",
      "pass": true
    },
    {
      "recipe": "no [title] on the page",
      "observed": "Inside the MR panel: `mrPanelTitleAttrs=0`. The document has 7 [title] elements, all in the compare window/sidebar chrome outside the MR page: New tab, Close tab, Format covers JSON and XML only, Language, Previous change, Next change, Settings. Of these, only the sidebar's '+' (New tab) shows in the screenshot.",
      "pass": true
    },
    {
      "recipe": "light (html data-theme=light set via app-session read, as the implementer did): '!630', 'snooze', URL 620",
      "observed": "`sum=1 of 40 | ids=!630 | theme=light | bar=60,60,60,60,60` (screenshot /tmp/verify-mrsearch-light-630.png); x → `sum=40 of 40 | field= | focus=Search merge requests`; 'snooze' → `sum=4 of 40 | ids=!640,!630,!620,!610`; URL → `sum=1 of 40 | ids=!620`",
      "pass": true
    },
    {
      "recipe": "light: 'overdue !635 !640' + Label frontend; Clear filters; Refresh; Escape ×2; reopen",
      "observed": "`sum=1 of 40 | ids=!635 | bar=60,60,60,60,61,60` (screenshot /tmp/verify-mrsearch-light-label.png: one row !635 with the frontend label, bar on one line); Clear filters → `sum=2 of 40 | field=overdue !635 !640`; Refresh → same; Escape → `sum=40 of 40 | field= | focus=Search merge requests`; second Escape → `onPage=false`; reopen → `sum=40 of 40 | field=`",
      "pass": true
    },
    {
      "recipe": "just app-session stop --name mrs",
      "observed": "{\"stopped\":\"mrs\",\"session\":\"ended\", webdriver + vite stopped, folder removed}",
      "pass": true
    }
  ],
  "environment": "rustc 1.99.0 (b940084d7 2026-09-28); node v26.13.0; pnpm 12.0.0; WebKit MiniBrowser via app-session (WebKitWebDriver) on a private display; Linux 7.2.11-arch1-1 x64."
}
