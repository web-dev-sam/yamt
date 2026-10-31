# MrRowPointerVerify

Agent output (`agent://MrRowPointerVerify`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-10-30T21-21-14-771Z_01a18eb0-3413-7251-ad3d-5e4e0123ce8e/MrRowPointerVerify.md), collected 2026-10-31T08:29:25.291Z.

{
  "gate": "pass",
  "failures": [],
  "smoke": [
    {
      "recipe": "just check (repo root, run once)",
      "observed": "EXIT=0, wall 40.35s. web-fmt: All matched files use the correct format. | fmt-check: no output | clippy: Finished dev profile in 0.21s | test: Summary [11.781s] 1124 tests run: 1124 passed, 24 skipped | deny: advisories ok, bans ok, licenses ok, sources ok (warnings only) | bindings-check: diff empty | fixtures-check: diffs empty | web-lint: no output | web-typecheck: no output | web-test: Test Files 244 passed (244), Tests 3411 passed (3411) | web-unused: no output | arch-check: ok | map-check: ok | golden: 10 ok lines | sfc-order: no output | hooks-test: tests 18, all passed",
      "pass": true
    }
  ],
  "environment": "HEAD 324e6109; rustc 1.99.0 (b940084d7 2026-09-28); node v26.13.0; pnpm 12.0.0; Linux 7.2.11-arch1-1 x64. Gate-only pass, no WebKit/smoke run."
}
