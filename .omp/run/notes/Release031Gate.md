**Gate: pass.** `just check` passed (exit 0), and `cargo test -q -p yamt-lsp-host --test run` passed all 10 runs, with no failures. Both ran at HEAD `7d52482` with a clean tree (`git status --short | wc -l` → `0`). I didn't run `just mutants`: this assignment listed only these two steps and named no base.

```
gate      "pass"
failures  []
smoke     [
  { recipe: "just check",
    observed: "EXIT=0 (wall time 29.00 s); per-recipe tails below",
    pass: true },
  { recipe: "for i in $(seq 1 10); do cargo test -q -p yamt-lsp-host --test run || echo FAIL; done",
    observed: "pass=10 fail=0 (no FAIL lines). Run 10 tail: `running 18 tests` … `test result: ok. 18 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 2.02s`. Interleaved stderr seen during the run: `kill: sending signal to 899225 failed: No such process` (8 such lines in run 10).",
    pass: true }
]
```

**Tail of each `just check` recipe, verbatim:**

| Recipe | Tail |
|---|---|
| fmt-check | `All matched files use the correct format.` / `Finished in 668ms on 298 files using 24 threads.`; `cargo fmt --all --check` printed nothing |
| clippy | `Finished \`dev\` profile [unoptimized + debuginfo] target(s) in 0.90s` |
| test (nextest) | `Summary [   4.242s] 449 tests run: 449 passed, 1 skipped` |
| deny | `advisories ok, bans ok, licenses ok, sources ok` (warnings only: duplicate crates such as base64 and thiserror, and unmaintained `proc-macro-error` RUSTSEC-2024-0370) |
| bindings-check | `diff -u frontend/src/ipc/bindings.ts target/bindings-check.ts` printed nothing |
| fixtures-check | `diff -ru frontend/fixtures/golden …` and `diff -ru frontend/fixtures/showcase …` printed nothing |
| web-lint | `$ oxlint --type-aware && eslint --max-warnings 0 "src/**/*.vue"` printed nothing |
| web-typecheck | `$ vue-tsc -b` printed nothing |
| web-test | `Test Files  100 passed (100)` / `Tests  1336 passed (1336)` |
| web-unused | `$ knip --include exports,types` printed nothing |
| arch-check | `arch-check: ok` |
| map-check | `map-check: ok` |
| golden | 10 `ok` lines, from `ok language-tools-script-setup` to `ok vueuse-use-magic-keys` |
| sfc-order | `$ tsx scripts/check-sfc-order.ts` printed nothing |
| hooks-test | `ℹ tests 16` / `ℹ pass 16` / `ℹ fail 0` |

**Things to note:**
- **Skipped test:** nextest skipped 1 test, and the output doesn't say which one.
- **`kill … No such process` lines:** this stderr appeared during the lsp-host loop, but all 18 tests passed in every run. It looks like test teardown trying to stop processes that had already exited. That is an inference; I didn't check the test code.

**Environment:** rustc 1.99.0 (b940084d7 2026-09-28), node v24.22.0, pnpm 12.0.0. WebKit wasn't needed for these steps.

The full `just check` log is at `artifact://628`.