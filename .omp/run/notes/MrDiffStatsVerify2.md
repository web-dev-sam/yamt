# MrDiffStatsVerify2

Agent output (`agent://MrDiffStatsVerify2`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-10-30T21-21-14-771Z_01a18eb0-3413-7251-ad3d-5e4e0123ce8e/MrDiffStatsVerify2.md), collected 2026-10-31T07:35:13.276Z.

{
  "gate": "pass",
  "failures": [],
  "smoke": [
    {
      "recipe": "just check (re-pass, repo root)",
      "observed": "EXIT=0. deny: 'advisories ok, bans ok, licenses ok, sources ok'; bindings-check and fixtures-check diffs empty; web-test: 'Test Files 244 passed (244) / Tests 3411 passed (3411)'; knip clean; 'arch-check: ok'; 'map-check: ok'; golden: all 'ok' (e.g. vue-core-playground-app, vueuse-use-magic-keys); sfc-order silent; hooks-test: 'tests 18 pass 18 fail 0'. Wall time 38.8s. Earlier stages (fmt-check, clippy, test) were scrolled out of the tail, but the gate exited 0, so they passed.",
      "pass": true
    }
  ],
  "environment": "rustc 1.99.0 (b940084d7 2026-09-28), node v26.13.0, pnpm 12.0.0, Linux 7.2.11-arch1-1 x64. No WebKit or app smoke steps were run (none asked for)."
}
