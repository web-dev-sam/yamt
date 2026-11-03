# CiJobLogPageR2

Agent output (`agent://CiJobLogPageR2`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-03T09-27-39-945Z_01a1a0bc-56a9-713f-aaa0-50b9506e4465/CiJobLogPageR2.md), collected 2026-11-03T12:16:10.137Z.

{
  "summary": "Both items are fixed and checked in WebKit. 1. Stale highlight marks: the log box now registers one Highlight object for `job-log-match` and one for `job-log-current` when it mounts. Every rebuild clears and refills those same objects instead of replacing them with `CSS.highlights.set(new Highlight)`. On WebKitGTK 2.54 a replaced Highlight's marks stayed on screen; clearing the registered one repaints them. 2. The job whose log is open no longer shows its hover tip, so the tip cannot cover the log's header or match count. `ui/AGENTS.md` describes both.",
  "files_changed": [
    "frontend/src/ui/CiStatusJobLog.vue",
    "frontend/src/ui/CiStatusBox.vue",
    "frontend/src/ui/AGENTS.md"
  ],
  "tests_added": [],
  "smoke_evidence": [
    {
      "command": "BEFORE, fixture (`start-fixture --name cl --diff --mr list --size 1600x1000`), yamt Light, lint:docs, Shift, type e,r,r,o,r; `read` CSS.highlights; shot /tmp/r2-before-light.png",
      "observed": "[[\"job-log-match\",6,[\"error\",\"Error\",\"error\",\"error\",\"ERROR\",\"ERROR\"]],[\"job-log-current\",1,[\"ERROR\"]]]. The shot shows leftover single-letter purple marks under e/r in 'Executing', 'step', 'resolved', 'reused', 'Fenced', 'specified', 'directory', … Finding 2191 reproduced."
    },
    {
      "command": "AFTER, Dark: same steps after the fix (page reloaded); shot /tmp/r2-after-dark.png",
      "observed": "CSS.highlights: [[\"job-log-match\",6,[\"error\",\"Error\",\"error\",\"error\",\"ERROR\",\"ERROR\"]],[\"job-log-current\",1,[\"ERROR\"]]]. Only 'errors', 'Error', 'error' ×2 and 'ERROR' ×2 are marked; the last ERROR is the current hit. No single-letter marks."
    },
    {
      "command": "AFTER, Light (Settings → yamt Light), same steps; shot /tmp/r2-after-light.png",
      "observed": "Same highlight contents (6 match, 1 current); the count reads '6 of 6'. No stale e/r marks anywhere in the visible log."
    },
    {
      "command": "AFTER, Light: Ctrl+A, type s,t,a,t,u,s; read highlights; shot /tmp/r2-after-light-status.png",
      "observed": "[[\"job-log-match\",0,[]],[\"job-log-current\",0,[]]]. Count 'No results'. The shot shows no marks: no s/st marks in 'system', 'stage', 'blocks', 'since'."
    },
    {
      "command": "AFTER, Light: Ctrl+A, type e,r,r,o,r, then scroller.scrollTop -= 40; shot /tmp/r2-after-light-scrolled.png",
      "observed": "scrollTop [193,153]. Highlights: 6 match, 1 current. After the scroll only the 'error' hits are marked; no stale marks move with the text."
    },
    {
      "command": "Fixture, Dark: hover the CI icon, hover lint:docs, wait 0.8 s, read the .hover-tooltip; press Shift; read again; shots /tmp/r2-tip-before-shift.png, /tmp/r2-tip-after-shift.png",
      "observed": "Before: 'false|Open the log of lint:docs on GitLab. Shift: show the log here|1219px|219px' (tip shown). After Shift: 'true|… / Log of lint:docs' (tip hidden, log open). After Escape closes the log, the li's aria-description is 'Open the log of lint:docs on GitLab. Shift: show the log here' again."
    },
    {
      "command": "Real app (`cargo tauri build --debug --no-bundle`; `start-app --name r2app --diff --dir /tmp/cjf/cl --glab ci-job-log`), !71: hover CI icon, hover phpunit, `press Shift --x11`, `type fail --x11`; shot /tmp/r2-app-302.png --display",
      "observed": "Before Shift the tip was shown at top 164.2 px (over the header row): 'false|Open the log of phpunit on GitLab. Shift: show the log here|1214px|164px'. After Shift: 'true|… / Log of phpunit / 6 of 6'. The shot shows the header 'Log of phpunit', field 'fail', '6 of 6' uncovered."
    },
    {
      "command": "Real app: hover e2e (its tip shows, top 191.7), then back onto phpunit, wait 0.8 s; shot /tmp/r2-app-302-rehover.png --display",
      "observed": "Tip state 'true|Open the log of e2e …' (hidden), count '6 of 6'. Pointing at the open job again shows no tip; the header is clear in the shot."
    },
    {
      "command": "pnpm -C frontend lint; typecheck; test; fmt:check",
      "observed": "lint: oxlint + eslint printed nothing past their command lines, exit 0. typecheck: `vue-tsc -b` exit 0. test: 'Test Files 268 passed (268), Tests 4012 passed (4012)'. That run followed one fix: the first run failed palette.test.ts on the literal '#2191' in my comment (reworded to 'finding 2191'). fmt:check: 'All matched files use the correct format.'"
    }
  ],
  "mutation": {
    "command": "just mutants HEAD → 'mutants: no Rust changes since HEAD' / 'mutants: no TypeScript changes since HEAD' (only .vue and .md changed; .vue is not mutated)",
    "survivors": []
  },
  "acceptance_not_run": [],
  "deviations_from_brief": [
    "CiStatusJobLog.vue: two Highlight objects per log instance (`matches`, `currentMatch`), registered in onMounted and cleared/refilled in paintMatches and showCurrent. A three-line CP1 comment names the WebKitGTK 2.54 behaviour (finding 2191) so nobody brings back `set(new Highlight)`. The brief's 'CSS.highlights.set(... new Highlight(...))' per search is now set once per mount.",
    "CiStatusBox.vue: `tipOf(job)` returns null for the job whose log is shown, so vTooltip hides its tip at once (its `updated` → `show` with null → `hide`). While that log is open, the job's li also has no aria-description; the dialog's aria-label names the log. Other jobs' tips are unchanged.",
    "No vitest added: both changes are in .vue components, which have no component-test harness here, and mutants skips .vue. The evidence is the WebKit fixture and real-app runs above.",
    "AGENTS.md job-log paragraph: added the hidden tip and the one-Highlight-per-name rule with its WebKit reason."
  ],
  "open_risks": [
    {
      "location": "frontend/src/ui/CiStatusJobLog.vue:53-54",
      "risk": "The fix depends on WebKit repainting a registered Highlight on clear(). Observed on webkitgtk-6.0 2.54.2, not checked in a WebKit source or bug report. A later WebKit may fix set-replacement, which would not harm this code."
    },
    {
      "location": "frontend/src/ui/CiStatusBox.vue:94-96",
      "risk": "Only the open job's tip is hidden. Another job's tip clamped left near the viewport edge can still reach the log header's lower edge: e2e's tip top was 191.7 px against a header ending ≈203 px. It did not cover the count in the shots."
    }
  ]
}
