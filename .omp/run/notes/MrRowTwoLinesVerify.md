# MrRowTwoLinesVerify

Agent output (`agent://MrRowTwoLinesVerify`, /home/wds/.omp/agent/sessions/-Projects-yamt/2026-10-30T21-21-14-771Z_01a18eb0-3413-7251-ad3d-5e4e0123ce8e/MrRowTwoLinesVerify.md), collected 2026-10-31T08:47:31.340Z.

{
  "gate": "pass",
  "failures": [],
  "smoke": [
    {
      "recipe": "just check (exit code 0, ran once from the repo root at HEAD 1171a3c1)",
      "observed": "fmt-check: \"All matched files use the correct format.\" (oxfmt, 686 files); cargo fmt --check printed nothing. clippy: \"Finished `dev` profile\" with no warnings. test: \"Summary [ 11.775s] 1124 tests run: 1124 passed, 24 skipped\". deny: \"advisories ok, bans ok, licenses ok, sources ok\" (warnings only: duplicate crates, unmaintained paste and proc-macro-error). bindings-check and fixtures-check: their diff commands printed nothing.",
      "pass": true
    },
    {
      "recipe": "just check, the frontend and checker stages",
      "observed": "web-lint: oxlint and eslint printed nothing. web-typecheck: vue-tsc -b printed nothing. web-test: \"Test Files  244 passed (244)\" / \"Tests  3411 passed (3411)\". web-unused: knip printed nothing. \"arch-check: ok\". \"map-check: ok\". golden: every case printed as \"ok <case>\". sfc-order: printed nothing. hooks-test: \"ℹ tests 18 ... ℹ pass 18 ℹ fail 0\". Then EXIT=0.",
      "pass": true
    }
  ],
  "environment": "rustc 1.99.0 (b940084d7 2026-09-28); node v26.13.0; pnpm 12.0.0; Linux x64 (Arch). HEAD 1171a3c1. `git status --short` listed 4 entries (uncommitted changes or new files). No WebKit or browser steps were run because none were asked for."
}
