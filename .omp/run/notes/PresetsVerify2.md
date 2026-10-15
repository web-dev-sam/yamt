**Result:** the gate passes (`gate: pass`). The mutation run found 4 untested spots on changed TypeScript lines (3 lines of logic, 1 pair of words). Nothing failed and no step was rerun. Tree at `e2d1ba6`, `pwd` is the repo root.

## gate: `pass`
`just check 2>&1; echo EXIT=$?` → `EXIT=0`, 21.4 s. Last lines of each recipe:
- **fmt-check:** `All matched files use the correct format. Finished in 702ms on 298 files`; `cargo fmt --all --check` printed nothing.
- **clippy:** `Finished \`dev\` profile … in 0.26s`, no warnings.
- **test:** `Summary [ 4.198s] 449 tests run: 449 passed, 1 skipped`
- **deny:** `advisories ok, bans ok, licenses ok, sources ok` (it prints warnings for duplicate crates, `license-not-encountered` ISC and unmaintained `paste`/`proc-macro-error`).
- **bindings-check, fixtures-check:** both `diff`s printed nothing.
- **web-lint / web-typecheck:** `oxlint --type-aware && eslint …` and `vue-tsc -b` printed nothing.
- **web-test:** `Test Files 100 passed (100)` / `Tests 1335 passed (1335)`
- **web-unused:** `knip --include exports,types` printed nothing.
- **arch-check / map-check:** `arch-check: ok` / `map-check: ok`
- **golden:** 10 × `ok …`, ending `ok vueuse-use-magic-keys`
- **sfc-order:** printed nothing.
- **hooks-test:** 11 × `✔`, ending `✔ task-fanout: implementer spawns are registered and never reuse a name`

## failures
`[]`

## smoke
**1. `just mutants c74c92e`** → `EXIT=0`. `pass: false` because of the 4 gaps below.
- **Rust:** `16 mutants tested in 66s: 9 caught, 7 unviable`, none missed.
- **TypeScript:** `All files 72.53 | killed 1685 | timeout 2 | survived 528 | no cov 111`.
- I checked every survivor against the lines changed since `c74c92e` (`git diff -U0`). Survivors on unchanged lines are out of VF7's scope: `ipc/{domain,index,tauri}.ts`, `lsp/index.ts:46,162,163`, older lines of `languageIds.ts`, `packageManager.ts:13-29`, `presets.ts`, `uri.ts:1,2,4,5`, `serverSetup.ts:44-68`, `serverText.ts:8-24` and the no-coverage ones.

**Real gaps on changed lines (findings for the owning slice; the grades are my guess):**

| Survivor | Why it matters |
|---|---|
| `lsp/internal/state.ts:70:14` `reason.code === null` → `false`, plus no coverage on `:71:11` | Nothing tests the log line for an exit without a code while starting. The mutant would log "exited with code null". `index.test.ts:1837` covers only code 2. (`ui/serverText.ts:48-50` has the same sentence and is tested at `serverText.test.ts:61`, but that is a different function.) Suggested: should. |
| `lsp/internal/added.ts:10:26` `/\.(exe\|cmd\|bat)$/i` → no `$` | Nothing tests a name with `.exe`, `.cmd` or `.bat` in the middle. `rust.exe-analyzer` would match rust-analyzer. The `ruff.exe.old` test gives no match either way. Suggested: nit. |
| `lsp/internal/uri.ts:3:23` `/^\/([A-Za-z]:)/` → no `^` | A POSIX path with a folder like `/a:` would lose its slash. `uri.test.ts:38-58` has no such case. (The other mutant on this line, `[^A-Za-z]`, is covered: `uri.test.ts:45` fails.) Suggested: nit. |
| `ui/serverText.ts:26:30` `FROM_THE_LIST` → `""`, `:28:35` `FROM_THE_LIST_HINT` → `` `` `` | No test checks these words; they were only seen in the app (run 1, item 4.7). Suggested: nit. |

**Dropped, (b) caught by `web-test`:** these are module-level tables and functions that only run at load time, the known #732 effect; each mutant fails a test if applied by hand.
- `choices.ts:20-40`: `serversOf` runs only inside `PRESET_SERVERS = PRESETS.flatMap(serversOf)`. Caught by `choices.test.ts:5-35` (commands in order, file types) and `added.test.ts:126-137` (help with `folder: ""`).
- `presets.ts`, every changed line: `presets.test.ts` (names, formats, file types, settings, start options, looks, recipes), `choices.test.ts`, `detect.test.ts` (ruff/ty/pyright files, clangd, Biome).
- `ecosystems.ts:14-69`: `ecosystems.test.ts:27-36, 81-128, 143-155`.
- `integrations.ts:5-28`: `detect.test.ts:1089-1100, 1147-1151, 1238`.
- `languageIds.ts`, changed lines: the full map in `languageIds.test.ts`.
- `packageManager.ts:43-46`: `packageManager.test.ts:44-46`.
- `install.ts:14-18`: `detect.test.ts:1193-1225, 1237` (`rust.fileCalls` second read `[]`).
- `server.ts:30` (`DISPLAY_ONLY`): `index.test.ts:721`.
- `detect.ts:41` (`PYTHON`): `detect.test.ts:1176`.
- `vue.ts:10-13`: `detect.test.ts:927, 959-962, 1194`.

**Dropped, (a) equivalent:** no observable difference.
- `detect.ts:71:44` `<` → `<=`: the keys come from a Map, so two are never equal.
- `detect.ts:118` `{kind:"plugins"}` → `{kind:""}` / `{}`: the only reader checks `run.kind === "noPlugins"` (`vue.ts:24`).
- `project.ts:38`: a non-Text file then throws inside `try` and still gives null. `project.ts:44` (undefined instead of null): both callers treat it the same (`?? ""` in `detect.ts:102`, and `packageManager`).
- `project.ts:52`: the shape of the `NotFound` value is never read past `kind === "Found"`. `project.ts:61`: `NotFound` has no `place`.
- `tool.ts:31` `["Stryker was here"]`: a string's `.formats` is undefined, so it reads as false.
- `server.ts:241` `?.` removed: past the guard the run is always `running`, because idle has `attempt: null`.
- `serverSetup.ts:143`: `storedAnswer(setup, null)` falls to `?? null`, as judged before.
- `installText.ts:56, 120, 147` (no coverage): the exhaustive `never` defaults, which cannot run.

**Already judged in the brief:** the 36 no-coverage mutants in `useDropdownMenu.ts` (DOM only, seen in the app in run 1, item 4.7).

**2. Real app:** not rerun, as the brief says (no product code changed since run 1). Run 1's evidence stands.

## Environment (VF5)
`rustc 1.99.0 (b940084d7 2026-09-28)`, `node v24.22.0`, `pnpm 12.0.0`, `cargo-mutants 27.1.0`, StrykerJS with the vitest runner and `--ignoreStatic`. I did not start a browser, WebKit or the app.