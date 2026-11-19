# RangeReviewedSmoke

Agent output (`agent://RangeReviewedSmoke`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-19T08-36-51-995Z_01a1f2f3-949b-76c1-ae63-bdcb627ac0da/RangeReviewedSmoke.md), collected 2026-11-19T10:14:42.584Z.

{
  "gate": "not-run",
  "failures": [
    {
      "step": "C (real app): cargo tauri build --debug --no-bundle at HEAD 2eda3f90 (= 7ed49572 + a docs-only commit; frontend tree clean)",
      "excerpt": "Running beforeBuildCommand `pnpm build --mode tauri`\n$ vue-tsc -b && vite build --mode tauri\nsrc/ui/useRangeController.test.ts(580,7): error TS2353: Object literal may only specify known properties, and 'forget' does not exist in type 'ReviewedWindow'.\n[ELIFECYCLE] Command failed with exit code 2.\n       Error beforeBuildCommand `pnpm build --mode tauri` failed with exit code 2\n(the test passes `createRangeReviewed(source, { start, show, forget: () => {}, problems })`. The view slice's committed test does not typecheck, so web-typecheck in `just check` will fail too [INFERENCE]. No debug binary was built, so steps C1–C8 did not run. Owner: range-reviewed-view.)"
    },
    {
      "step": "Browser tests range.browser.test.ts + rangeThreads.browser.test.ts",
      "excerpt": "Ran `pnpm exec vitest run --project browser src/editor/range.browser.test.ts src/editor/rangeThreads.browser.test.ts`: Playwright WebKit does not start on this host: \"Host system is missing dependencies to run browsers. Please install them with: sudo pnpm exec playwright install-deps … libicu74 libxml2 libflite1\" (#1242). They cannot run through MiniBrowser either: vite.config.ts only has the playwright provider, node_modules/@vitest has only `browser` and `browser-playwright` (no webdriverio or preview provider), and the tests call provider commands (userEvent.click/keyboard/dragAndDrop/hover, page.viewport, page.screenshot). Writing a custom WebDriver provider would be the throwaway WebDriver helper the rules forbid. Neither file ran, so the drag test a_number_drag_starts_no_thread_when_starts_threads_is_false is still unproven."
    },
    {
      "step": "B6 brief wording",
      "excerpt": "The brief says Ctrl/Cmd+Shift+F. That key did nothing in the fixture (no panel opened). ipc/keys.ts:209 binds \"toggle-search\": keyList(\"Mod-Shift-s\"), and Ctrl+Shift+S opened Search. This is an error in the brief, not in the code."
    }
  ],
  "smoke": [
    {
      "recipe": "B1 open (start-fixture --name rv --range-case review --threads seeded --reviewed seeded --size 1600x1000), dark+light",
      "observed": "URL ?range=review&threads=seeded&reviewed=seeded. Header \"Reviewed / config / 1 of 13 reviewed / Send to GitLab (2)\"; Reviewed is the first header button, aria-pressed=false, outlined. Row titles: docs/keys.md \"renamed,reviewed\" (muted name, green check); logo.png and board.ts \"changed since reviewed\" (yellow refresh-dot icon, plainly different). Rows in the brief's order. Shots: /tmp/yamt-rv/verify/b1-dark.png, b1-light.png",
      "pass": true
    },
    {
      "recipe": "B2 rule 2: marks and next file; unmark a seeded mark",
      "observed": "Two clicks on config: config and data/big.txt reviewed, docs/current.md open, \"3 of 13 reviewed\" (did not read \"2 of 13\" between the clicks). A stray third click marked current.md, and docs/legacy.txt opened (reviewed keys.md skipped): \"4 of 13\". On docs/keys.md the button reads aria-pressed=true, bg rgb(119,76,213). Click: unmarked, the window stays on \"docs/shortcuts.md → docs/keys.md\", \"3 of 13 reviewed\".",
      "pass": true
    },
    {
      "recipe": "Flash check: does the filled Reviewed button show its disabled look on a click (fixture)",
      "observed": "A requestAnimationFrame sampler on the button during the unmark click on keys.md logged two states: [17ms, disabled=false, pressed=true, bg rgb(119,76,213)] then [354ms, disabled=false, pressed=false, bg rgba(233,228,254,0.08)]. No frame had disabled=true, so no flash in the fixture. The real app was not checked because C could not build.",
      "pass": true
    },
    {
      "recipe": "B3 wrap + binary",
      "observed": "vendor/ui (last), Reviewed: reviewed, and the window wrapped to docs/keys.md, \"4 of 13\". That was the first file not reviewed from the top: B2 had unmarked keys.md and marked current.md, so the brief's docs/current.md does not apply here. Rule held. public/logo.png, Reviewed: row \"reviewed\", src/api/mockBoards.ts opens, \"5 of 13\".",
      "pass": true
    },
    {
      "recipe": "B4 rule 5 since view (after reload)",
      "observed": "board.ts header \"Changed since you reviewed it / Review from start / 1 of 13 reviewed\"; left \"As you reviewed it\". Only change: inserted right 41–43. Collapsed 10/13 lines; the toggle shows 69/69, then back. Previous/Next keep the active line on it. No thread boxes. Drags over line numbers (both sides): 0 textareas, 0 tint. logo.png shows the SINCE_NO_TEXT sentence verbatim plus Review from start. Shots: b4-dark.png, b4-light.png, b4-expanded-dark.png, b4-logo-dark.png",
      "pass": true
    },
    {
      "recipe": "B5 rule 6 Review from start",
      "observed": "Header \"Reviewed / src/board/board.ts / 1 of 13 reviewed\"; no row mark; left heading back to merge base. Whole change (69 lines, seeded thread markers; I did not count the 7 differences). Reviewed: board.ts \"reviewed\", reminders.ts opens, \"2 of 13\". Back on board.ts: aria-pressed=true, whole change. Shots: b5-dark.png, b5-light.png",
      "pass": true
    },
    {
      "recipe": "B6 search on a changed-since file (reload; Ctrl+Shift+S, see failures)",
      "observed": "\"randomUUID\": \"1 result in 1 file\". Clicking it focuses the right pane, active line \"id: crypto.randomUUID(),\". From config, left-only \"duplicateBoard\": board.ts opens in the since view. Neither pane focused, scrollTop 0/0, nothing moved. Shots: b6-search.png, b6-right-hit.png, b6-left-hit.png, b6-left-hit-light.png",
      "pass": true
    },
    {
      "recipe": "B log lines",
      "observed": "Console hook while marking and unmarking tools/deploy.sh: \"[info] range.fixture_reviewed {kind: \\\"mark\\\", file: 10}\" and \"[info] range.fixture_reviewed {kind: \\\"unmark\\\", file: 10}\".",
      "pass": true
    },
    {
      "recipe": "B7 merge page and ?diff",
      "observed": "/ (merge): 0 Reviewed buttons, 3 panes, file list shown. ?diff: 0 Reviewed buttons, 2 panes, \"Tabs / Compare 1 …\". I checked only that each page loads and has no Reviewed button, not every other behaviour. Shots: b7-merge.png, b7-diff.png. Session stopped (webdriver and vite stopped, folder removed).",
      "pass": true
    },
    {
      "recipe": "C1–C8 real app",
      "observed": "Not run: the build fails in beforeBuildCommand with vue-tsc TS2353 at src/ui/useRangeController.test.ts(580,7) ('forget' not in ReviewedWindow). No binary.",
      "pass": false
    },
    {
      "recipe": "range.browser.test.ts / rangeThreads.browser.test.ts via MiniBrowser",
      "observed": "Not run. Playwright WebKit is missing host deps, and the repo has no vitest provider that can drive MiniBrowser (see failures).",
      "pass": false
    }
  ],
  "environment": "rustc 1.99.0; node v26.13.1; pnpm 12.0.0; HEAD 2eda3f90 (7ed49572 + docs-only). Fixture engine MiniBrowser via just app-session (private Xvfb). Playwright WebKit cannot launch (missing libicu74/libxml2/libflite1). Scratch /tmp/yamt-rv/verify. No processes of mine left running."
}
