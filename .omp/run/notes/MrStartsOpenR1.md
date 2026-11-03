# MrStartsOpenR1

Agent output (`agent://MrStartsOpenR1`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-11-03T19-24-34-084Z_01a1a2de-d1a4-7647-bda9-8034bb7125ef/MrStartsOpenR1.md), collected 2026-11-03T19:55:39.834Z.

{
  "summary": "Finding #2237 is fixed. The internal `show(state, entry)` in `frontend/src/ui/rangeStore.ts` is now called `markShown`, and both callers use the new name: `showPath` at line 240 and `startUp` at line 275. The name now says it only marks the file shown and mounted. `showPath` is still the user's 'show a file' and still sets the screen back to files. No behaviour changed. The test file never named the internal `show`, and no doc refers to `rangeStore`'s `show`.",
  "files_changed": [
    "frontend/src/ui/rangeStore.ts"
  ],
  "tests_added": [],
  "smoke_evidence": [
    {
      "command": "pnpm -C frontend lint",
      "observed": "$ oxlint --type-aware && eslint --max-warnings 0 \"src/**/*.vue\" — no errors or warnings shown in the last lines of output"
    },
    {
      "command": "pnpm -C frontend typecheck",
      "observed": "$ vue-tsc -b — no errors shown in the last lines of output"
    },
    {
      "command": "pnpm -C frontend test",
      "observed": "Test Files  275 passed (275); Tests  4158 passed (4158)"
    }
  ],
  "mutation": {
    "command": "just mutants HEAD — rangeStore.ts: 154 killed, 6 survived, 0 timeout, 0 no-cov, 0 errors (96.25%)",
    "survivors": []
  },
  "acceptance_not_run": [],
  "deviations_from_brief": [
    "Left alone: the 6 surviving mutants are on lines 117, 133, 136, 139, 152 and 233, none of which this rename touched (it changed only 240, 244 and 275), so none are listed under mutation survivors."
  ],
  "open_risks": []
}
