I ran the gate and the mutation run. **The gate passes, but #1044 is not closed.** Stryker still reports the mutant run 2 promoted as **Survived**, so I can't confirm that the new test kills it. The tree was at `a5babf6` with a clean `git status`, and `pwd` was the repo root.

## gate: `pass`
`just check 2>&1; echo EXIT=$?` → `EXIT=0` in 21.27 s. Last lines of each recipe:
- **fmt-check:** `All matched files use the correct format. Finished in 667ms on 298 files using 24 threads.` `cargo fmt --all --check` printed nothing.
- **clippy:** `Finished \`dev\` profile [unoptimized + debuginfo] target(s) in 0.28s`, no warnings.
- **test:** `Summary [ 4.235s] 449 tests run: 449 passed, 1 skipped`
- **deny:** `advisories ok, bans ok, licenses ok, sources ok`. It also warned about duplicate crates, `license-not-encountered` and the unmaintained `proc-macro-error` (RUSTSEC-2024-0370).
- **bindings-check, fixtures-check:** every `diff` printed nothing.
- **web-lint / web-typecheck:** printed nothing.
- **web-test:** `Test Files 100 passed (100)` / `Tests 1336 passed (1336)` (run 2 had 1335; the extra one is the new test).
- **web-unused:** printed nothing.
- **arch-check / map-check:** `arch-check: ok` / `map-check: ok`
- **golden:** 10 × `ok …`, ending `ok vueuse-use-magic-keys`
- **sfc-order:** printed nothing.
- **hooks-test:** `ℹ tests 16`, `ℹ pass 16`, `ℹ fail 0`

## failures
`[]`

## smoke
**1. `just mutants c74c92e`** → `EXIT=0`. **pass: false**, because the check the brief asks for did not come out as expected.
- **Rust:** `16 mutants tested in 66s: 9 caught, 7 unviable`, none missed.
- **TypeScript:** `All files 72.53 | 76.16 | killed 1686 | timeout 1 | survived 528 | no cov 111 | errors 0`. Run 2 had 1685 killed, 2 timeouts and 528 survived.
- **#1044 is still listed:**
  ```
  [Survived] Regex
  src/lsp/internal/uri.ts:3:23
  -   const SLASHED_DRIVE = /^\/([A-Za-z]:)/;
  +   const SLASHED_DRIVE = /\/([A-Za-z]:)/;
  Ran all tests for this mutant.
  ```
  The new test (`uri.test.ts:60`, "only a leading /X: is a drive…") shows as `~ … (covered 24)`: it ran against mutants but killed none of them.
- **The test's input does tell the two regexes apart.** I checked this with `node -e`, without touching the repository:
  - Original regex: `/home/u/x:/src` stays `/home/u/x:/src`.
  - Mutant: it becomes `/home/ux:/src`.

  So the assertion at `uri.test.ts:62` would fail if the mutant were really in the code. `SLASHED_DRIVE` is a module-level constant, so the likely reason it still survives is the #732 load-time effect: the regex is built once at load, before Stryker switches mutants in. That is `[INFERENCE]`; I did not prove it by changing the code and changing it back, because VF6 forbids that.
- **What to decide:** under VF7 the orchestrator could drop this survivor as (b), caught by `web-test` at `uri.test.ts:62`, the same way run 2 treated other load-time constants. But the Stryker report itself does not show #1044 closed.
- **No other new survivors, as far as I can tell.** The survivor total is unchanged at 528 and the only change since run 2 is a test. The survivors on changed lines that I saw match run 2's judged and dropped lists:
  - the findings: `added.ts:10:26`, `state.ts:70:14` (plus no coverage on `:71:11`), and `serverText.ts:26:30` / `:28:35`
  - the dropped load-time tables in `choices.ts`, `ecosystems.ts`, `integrations.ts`, `install.ts`, `languageIds.ts`, `packageManager.ts` and `presets.ts`
  - the equivalent mutant `detect.ts:71:44`

  The other `uri.ts` survivors (`:1`, `:2`, `:4`, `:5` and `:3`'s `[^A-Za-z]`) were already judged in run 2. I did not compare the two runs survivor by survivor.

**2. Real app:** not run; the brief only names recipes 1 and 2, and no product code has changed.

## Environment (VF5)
`rustc 1.99.0 (b940084d7 2026-09-28)`, `node v24.22.0`, `pnpm 12.0.0`, `cargo-mutants 27.1.0`, StrykerJS with the vitest runner and "perTest" coverage. I did not start WebKit, a browser or the app.