# MrDiffStatsVerify

Agent output (`agent://MrDiffStatsVerify`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-10-30T21-21-14-771Z_01a18eb0-3413-7251-ad3d-5e4e0123ce8e/MrDiffStatsVerify.md), collected 2026-10-31T07:34:19.854Z.

{
  "gate": "fail",
  "failures": [
    {
      "step": "map-check",
      "excerpt": "scripts/map-check.sh\nmap-check: missing:\n  scripts/gitlab-playground.sh (not in skill://project-map)\nerror: recipe `map-check` failed on line 63 with exit code 1\n(just check exit 1; golden, sfc-order, hooks-test not run)"
    }
  ],
  "smoke": [
    {
      "recipe": "just check stage summaries",
      "observed": "fmt-check: 'All matched files use the correct format. Finished in 1056ms on 686 files'; cargo fmt no output. clippy: 'Finished dev profile in 2.24s', no warnings. test: 'Summary [11.798s] 1124 tests run: 1124 passed, 24 skipped'. deny: warnings only, 'advisories ok, bans ok, licenses ok, sources ok'. bindings-check: empty diff. fixtures-check: empty diffs. web-lint, web-typecheck: no output. web-test: 'Test Files 244 passed (244) / Tests 3411 passed (3411)'. web-unused: no output. arch-check: 'arch-check: ok'. map-check: FAILED. golden, sfc-order, hooks-test: not run.",
      "pass": false
    }
  ],
  "environment": "rustc 1.99.0 (b940084d7 2026-09-28); node v26.13.0; pnpm 12.0.0; Linux 7.2.11-arch1-1 x64; run from the repo root; wall time 51.6s."
}
