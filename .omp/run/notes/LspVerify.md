# LspVerify (final run, board row 10)

The gate passes and almost every real-app check passed, but four items fail or were not run.

- **Gate:** `just check` passed (exit 0).
- **Mutation run:** `just mutants 16bc7f8` finished (exit 0). All but four survivors on changed lines are already judged or equivalent. The four left are `useMergeController.ts:132-135` (below).
- **WebKit browser tests:** `pnpm -C frontend test:browser` failed because Playwright WebKit cannot launch on this machine.
- **Not run:** 4.2 (status area in the choice view and read-only headers) and part of 4.6 (a formatter edit that would touch a waiting conflict).

All checks ran against HEAD `71896bd` with base `16bc7f8`. I changed no files.

```
gate      pass
failures  []
```

## Recipe 1: `just check`
Exit 0. I kept only the last 80 lines of output, so the fmt-check, clippy and test lines aren't in my capture. The tail I have:
- deny: `advisories ok, bans ok, licenses ok, sources ok`
- bindings-check and fixtures-check: the `diff -u` / `diff -ru` lines printed no differences.
- web-lint, web-typecheck and web-unused printed no errors.
- web-test: `Test Files 96 passed (96)`, `Tests 1215 passed (1215)`
- `arch-check: ok`, `map-check: ok`
- golden: `ok` for all 10 cases.
- sfc-order printed nothing.
- hooks-test: `ℹ tests 16 … ℹ pass 16 ℹ fail 0`

## Recipe 2: `just mutants 16bc7f8`
Exit 0. The run's output was cut off by my `tail`, so I ran the same Stryker command again only to capture the full list in `/tmp/yz-stryker.txt`. It gave the same totals: score 85.09 %, 3485 killed, 551 survived (most on lines unchanged since the base).

**Rust** (`target/mutants/mutants.out/missed.txt`, 11 survivors):

| Survivor | Reading |
|---|---|
| `program.rs:102:5` (×2), `:112:5` (×2), `:113:65` | Windows-only code, already accepted. |
| `program.rs:48:30` `\|\|`→`&&` | (a) equivalent here: on Unix `MAIN_SEPARATOR` is `/`, so both checks are the same. |
| `lsp-echo.rs:144:5` `close_stderr`→`Ok(())` | The non-Unix test-server body, Windows only. |
| `lsp-echo.rs:114:58` `/`→`%` | (a) test-server only: the split test still splits the frame (first part 0–1 bytes); the app is unaffected. |
| `run.rs:205:74`, `:228:26` `<`→`<=` | (a) exact-instant boundaries, already judged in `LspHostR1.md`. |
| `run.rs:90:9` `is_finished`→false | (a) only stops finished runs being pruned from memory; nothing visible (implementer's open risk). |

**TypeScript, already judged:**
- Module-level constants, #732: all of `presets.ts`, `languageIds.ts`, `protocol.ts` and `timers.ts`; `messages.ts` 3-41; `answers.ts`; `attempt.ts`; `run.ts` 27-31; `uri.ts` 1-4; `problems.ts:28`; `packageManager.ts` 13-21; `detect.ts` 23/24; `serverText.ts` (the constants); `serverSetup.ts` 42-44; `keyText.ts` 26/45/63; `fixtureSettings.ts:16`; `fixture.ts` 92-100 (#882).
- Already judged: `settings.ts` 111/128, `logFollow.ts:5`, `lsp/index.ts` 152-153 (`#retired`), `serverSetup.ts` 51/59/69/87.

**TypeScript, my readings (a = equivalent):**

| Survivor | Reading |
|---|---|
| `detect.ts:43` | (a) every `files.get` is filled by `readFiles`, so the file is never undefined. |
| `detect.ts:47` (×2) | (a) without the guard, `JSON.parse(undefined)` throws and the catch still returns null. |
| `detect.ts:53` (empty catch) | (a) callers treat the resulting undefined the same as null. |
| `detect.ts:72` (×3), `:77` | (a) only `found.kind === "Found" && place === "Project"` is read, and it is false either way. |
| `detect.ts:96` (×2), `:97` | (a) the extra lookup path changes nothing; the `typescript` case falls through to an identical return. |
| `detect.ts:147`, `:148` | (a) a null version still gives no major, so the function still returns null. |
| `handshake.ts:20`, `:22` | (a) `server.ts:142` treats every kind other than `ready` as failed. |
| `packageManager.ts:25` (×2), `:29` | (a) the result is undefined instead of null, and the caller's `?? lock` handles both. |
| `problems.ts:117` | (a) `version < null` is false for versions ≥ 0. |
| `lsp/index.ts:40` `#startOnOpen = true` | (a) no servers exist until `setSpecs`, which overwrites the field. |
| `servers.ts:22` | (a) `shownLog` is only shown in the log view. |
| `serverText.ts:204` | (a) the `en-GB` time format is 24-hour by default. |
| `useMergeController.ts:103` | (a) the immediate `reloaded` sets `unsaved` to false straight away. |
| `useMergeController.ts:181` `() => undefined` | (a) handled by `?.`. |
| `useMergeController.ts:169` `flush` | Not on a `+`/`-` line of the diff; already noted in #619. |
| `useMergeController.ts:132`, `:133` | (c) wiring, seen on the fixture page: "Apply non-conflicting changes from the left" changed the summary from "3 changes · 1 conflict" to "1 conflict", and "Next change" moved focus into the editor (`cm-content`). |
| **`useMergeController.ts:134` `undo`→`undefined`, `:135` `redo`→`undefined`** | **Real gap.** These forward the toolbar's optional Undo/Redo buttons. No test covers them, and I could not exercise them because they only appear after adding them via the toolbar's right-click menu, which the session helper can't do. This goes to the owning slice. |

## Recipe 3: `pnpm -C frontend test:browser`
Failed: Playwright WebKit does not launch. It asks for missing system libraries (`sudo pnpm exec playwright install-deps` … `libicu74 libxml2 libflite1`) and ends with `[ELIFECYCLE] Command failed with exit code 1.` The probe did not run; item 4 relies on MiniBrowser instead.

## Real app checks (items 4 and 5)
**Setup:** I built `cargo tauri build --debug --no-bundle`, made the repository with `scripts/lsp-repo.sh /tmp/yamt-yz`, and drove it with `just app-session start-app --repo` (tauri-driver and MiniBrowser on Xvfb `:2`).
- Each session kept its storage and settings under `/tmp/yamt-app-session-<name>-*/home/.config/yamt/settings.json`; the owner's own settings were not touched.
- The pre-existing `oxlint`/`oxfmt --lsp` processes 8789/8820 (started 06:16, parent 4973) are not from this run.
- To close windows for items 4.10 and 4.14 I started `kwin_x11` on `:2` with a throwaway HOME and no D-Bus, then used `wmctrl -c`.

| # | Result | What I saw |
|---|---|---|
| 4.1 | pass | The question read "Start this project's language servers? … oxfmt, oxlint, TypeScript (not installed) — web/". Escape closed it, the settings file still held only `antialiasing` and `theme`, and the servers were Stopped. On the next start it asked again; Start stored `"/tmp/yamt-yz": "start"` and launched child processes oxfmt 3103121 and oxlint 3103127. |
| 4.2 | partial | In the merge toolbar, left of the gear: oxfmt and oxlint "Running" (`bg-success-signal`), TypeScript "Not installed" (`bg-problem-warning`), counts ⓧ0 ⚠0 shown for the `.ts` file, no eslint. **Not checked:** the choice view's header and the read-only header. |
| 4.3 | pass | Typing `debugger;` gave a wavy underline and the counts became ⓧ1. Hovering showed "`debugger` statement is not allowed / help: Remove the debugger statement / oxlint eslint(no-debugger)", fully visible (box 743–1001 by 223–294). No underline in the side panes. |
| 4.4 | pass | The menu read "oxlint / Running / Stop Restart Show log". Stop gave Stopped and the underline count went to 0; Start brought it back to 1; Restart left it Running. Show log listed lines such as "20:54:44 yamt Starting oxlint --lsp in web" and "Exited with code 0". Back and Escape both returned to the merge view. A second click on the oxlint button closed its menu (1 menu → 0). |
| 4.5 | pass | The text matched the brief: "This project uses TypeScript 5.9.3, which needs the separate package typescript-language-server. / In web/: / pnpm add -D typescript-language-server / Copy / Or for all projects: / pnpm add -g … / Or install it any other way … / yamt finds it when you come back to this window." After Copy, `xclip -o -selection clipboard` on `:2` printed `pnpm add -D typescript-language-server` and the button read "Copied". |
| 4.6 | pass, one part not run | Typing `export const   other={c:3,d:4}` lit the dot. Ctrl+S wrote `export const other = { c: 3, d: 4 };` and `export const spaced = { a: 1, b: 2 };`, with the conflict written as `<<<<<<< HEAD / ======= / >>>>>>> remote` (7-character markers). There was no base section because this repository's merge has none. `git ls-files -u` still listed stages 1/2/3, there was no "changed on disk" notice, and the conflict's arrows stayed. One Ctrl+Z brought back the unformatted text and the dot. **Not run:** a formatter edit that would touch a waiting conflict (this repository's conflict line is already formatted). |
| 4.7 | pass | On `notes/crlf.txt` (from a `scripts/conflict-repo.sh` repository, since `lsp-repo.sh` has no CRLF file), typing and Ctrl+S gave `\r\n` on every line in `od -c`, marker lines and the typed line included; stages were kept. |
| 4.8 | pass | With oxfmt stopped, Ctrl+S showed "Not formatted: oxfmt is not running" and wrote the unformatted text. After starting oxfmt, the next save formatted the text and the note was gone. |
| 4.9 | pass | Reset (no question asked): `cmp` against the copy taken at start said identical, and stages 1/2/3 were listed. |
| 4.10 | pass | Closing with unsaved work showed "Unsaved Changes … web/src/math.ts / Exit Without Saving / Cancel". Cancel closed the dialog; Ctrl+S, then close: the app exited with no question. |
| 4.11 | pass | Started again with the stored settings: no question, all servers Running. The file reopened with "1 conflict" and the saved `// unsaved` line, plus a notice "web/src/math.ts differs on disk from git's merge — 1 conflict left". |
| 4.12 | pass | I installed `typescript-language-server` 6.0.2 into `/tmp/yz-tsls` and linked it into `web/node_modules` and its `.bin`. After focus-away and focus-back, TypeScript showed Running with no Restart (process 3138763 `cli.mjs --stdio`). Typing `export const bad: number = "x";` underlined `bad`. |
| 4.13 | pass | The settings showed "This repository /tmp/yamt-yz — Start / Don't start", and the found servers oxfmt, oxlint and TypeScript, each with its folder and command. Don't start stored `"dontStart"` and left no server child processes; Start stored `"start"` and launched three (3142215, 3142221, 3142228). Adding `cat` with file type `txt` saved it to `added` (I focused the input with JS, then typed and clicked for real); "Remove cat" emptied the list again. |
| 4.14 | pass | After Exit Without Saving, `pgrep -af "oxlint --lsp\|oxfmt --lsp\|typescript-language-server"` found only the pre-existing 8789/8820; nothing from this run. |
| 5 | pass | On the fixture page there is no status area (no server buttons). Typing lit the dot; Ctrl+S logged `[info] fixture.save {path: "language-tools-script-setup.ts", text: "import { camelize } …"}` (captured by wrapping `console.info`) and the dot cleared. |

Screenshots are page captures from WebDriver: `/tmp/yz-shots/01-question.png` through `20-fixture-saved.png`. Smoke repositories are left at `/tmp/yamt-yz`, `/tmp/yamt-test-yzcrlf` and `/tmp/yz-tsls`. No driver, Xvfb, kwin or app process is left running.

## Environment
- rustc 1.99.0 (b940084d7 2026-09-28), node v24.22.0, pnpm 12.0.0
- Playwright WebKit cannot run here (missing system libraries). MiniBrowser through tauri-driver works.
- No window manager on the private display unless one is started.

## Follow-up: the three gaps (4.2 headers, 4.6 edge lines, Undo/Redo)

The gate passes and almost every real-app check passed, but four items fail or were not run.

- **Gate:** `just check` passed (exit 0).
- **Mutation run:** `just mutants 16bc7f8` finished (exit 0). All but four survivors on changed lines are already judged or equivalent. The four left are `useMergeController.ts:132-135` (below).
- **WebKit browser tests:** `pnpm -C frontend test:browser` failed because Playwright WebKit cannot launch on this machine.
- **Not run:** 4.2 (status area in the choice view and read-only headers) and part of 4.6 (a formatter edit that would touch a waiting conflict).

All checks ran against HEAD `71896bd` with base `16bc7f8`. I changed no files.

```
gate      pass
failures  []
```

## Recipe 1: `just check`
Exit 0. I kept only the last 80 lines of output, so the fmt-check, clippy and test lines aren't in my capture. The tail I have:
- deny: `advisories ok, bans ok, licenses ok, sources ok`
- bindings-check and fixtures-check: the `diff -u` / `diff -ru` lines printed no differences.
- web-lint, web-typecheck and web-unused printed no errors.
- web-test: `Test Files 96 passed (96)`, `Tests 1215 passed (1215)`
- `arch-check: ok`, `map-check: ok`
- golden: `ok` for all 10 cases.
- sfc-order printed nothing.
- hooks-test: `ℹ tests 16 … ℹ pass 16 ℹ fail 0`

## Recipe 2: `just mutants 16bc7f8`
Exit 0. The run's output was cut off by my `tail`, so I ran the same Stryker command again only to capture the full list in `/tmp/yz-stryker.txt`. It gave the same totals: score 85.09 %, 3485 killed, 551 survived (most on lines unchanged since the base).

**Rust** (`target/mutants/mutants.out/missed.txt`, 11 survivors):

| Survivor | Reading |
|---|---|
| `program.rs:102:5` (×2), `:112:5` (×2), `:113:65` | Windows-only code, already accepted. |
| `program.rs:48:30` `\|\|`→`&&` | (a) equivalent here: on Unix `MAIN_SEPARATOR` is `/`, so both checks are the same. |
| `lsp-echo.rs:144:5` `close_stderr`→`Ok(())` | The non-Unix test-server body, Windows only. |
| `lsp-echo.rs:114:58` `/`→`%` | (a) test-server only: the split test still splits the frame (first part 0–1 bytes); the app is unaffected. |
| `run.rs:205:74`, `:228:26` `<`→`<=` | (a) exact-instant boundaries, already judged in `LspHostR1.md`. |
| `run.rs:90:9` `is_finished`→false | (a) only stops finished runs being pruned from memory; nothing visible (implementer's open risk). |

**TypeScript, already judged:**
- Module-level constants, #732: all of `presets.ts`, `languageIds.ts`, `protocol.ts` and `timers.ts`; `messages.ts` 3-41; `answers.ts`; `attempt.ts`; `run.ts` 27-31; `uri.ts` 1-4; `problems.ts:28`; `packageManager.ts` 13-21; `detect.ts` 23/24; `serverText.ts` (the constants); `serverSetup.ts` 42-44; `keyText.ts` 26/45/63; `fixtureSettings.ts:16`; `fixture.ts` 92-100 (#882).
- Already judged: `settings.ts` 111/128, `logFollow.ts:5`, `lsp/index.ts` 152-153 (`#retired`), `serverSetup.ts` 51/59/69/87.

**TypeScript, my readings (a = equivalent):**

| Survivor | Reading |
|---|---|
| `detect.ts:43` | (a) every `files.get` is filled by `readFiles`, so the file is never undefined. |
| `detect.ts:47` (×2) | (a) without the guard, `JSON.parse(undefined)` throws and the catch still returns null. |
| `detect.ts:53` (empty catch) | (a) callers treat the resulting undefined the same as null. |
| `detect.ts:72` (×3), `:77` | (a) only `found.kind === "Found" && place === "Project"` is read, and it is false either way. |
| `detect.ts:96` (×2), `:97` | (a) the extra lookup path changes nothing; the `typescript` case falls through to an identical return. |
| `detect.ts:147`, `:148` | (a) a null version still gives no major, so the function still returns null. |
| `handshake.ts:20`, `:22` | (a) `server.ts:142` treats every kind other than `ready` as failed. |
| `packageManager.ts:25` (×2), `:29` | (a) the result is undefined instead of null, and the caller's `?? lock` handles both. |
| `problems.ts:117` | (a) `version < null` is false for versions ≥ 0. |
| `lsp/index.ts:40` `#startOnOpen = true` | (a) no servers exist until `setSpecs`, which overwrites the field. |
| `servers.ts:22` | (a) `shownLog` is only shown in the log view. |
| `serverText.ts:204` | (a) the `en-GB` time format is 24-hour by default. |
| `useMergeController.ts:103` | (a) the immediate `reloaded` sets `unsaved` to false straight away. |
| `useMergeController.ts:181` `() => undefined` | (a) handled by `?.`. |
| `useMergeController.ts:169` `flush` | Not on a `+`/`-` line of the diff; already noted in #619. |
| `useMergeController.ts:132`, `:133` | (c) wiring, seen on the fixture page: "Apply non-conflicting changes from the left" changed the summary from "3 changes · 1 conflict" to "1 conflict", and "Next change" moved focus into the editor (`cm-content`). |
| **`useMergeController.ts:134` `undo`→`undefined`, `:135` `redo`→`undefined`** | **Real gap.** These forward the toolbar's optional Undo/Redo buttons. No test covers them, and I could not exercise them because they only appear after adding them via the toolbar's right-click menu, which the session helper can't do. This goes to the owning slice. |

## Recipe 3: `pnpm -C frontend test:browser`
Failed: Playwright WebKit does not launch. It asks for missing system libraries (`sudo pnpm exec playwright install-deps` … `libicu74 libxml2 libflite1`) and ends with `[ELIFECYCLE] Command failed with exit code 1.` The probe did not run; item 4 relies on MiniBrowser instead.

## Real app checks (items 4 and 5)
**Setup:** I built `cargo tauri build --debug --no-bundle`, made the repository with `scripts/lsp-repo.sh /tmp/yamt-yz`, and drove it with `just app-session start-app --repo` (tauri-driver and MiniBrowser on Xvfb `:2`).
- Each session kept its storage and settings under `/tmp/yamt-app-session-<name>-*/home/.config/yamt/settings.json`; the owner's own settings were not touched.
- The pre-existing `oxlint`/`oxfmt --lsp` processes 8789/8820 (started 06:16, parent 4973) are not from this run.
- To close windows for items 4.10 and 4.14 I started `kwin_x11` on `:2` with a throwaway HOME and no D-Bus, then used `wmctrl -c`.

| # | Result | What I saw |
|---|---|---|
| 4.1 | pass | The question read "Start this project's language servers? … oxfmt, oxlint, TypeScript (not installed) — web/". Escape closed it, the settings file still held only `antialiasing` and `theme`, and the servers were Stopped. On the next start it asked again; Start stored `"/tmp/yamt-yz": "start"` and launched child processes oxfmt 3103121 and oxlint 3103127. |
| 4.2 | partial | In the merge toolbar, left of the gear: oxfmt and oxlint "Running" (`bg-success-signal`), TypeScript "Not installed" (`bg-problem-warning`), counts ⓧ0 ⚠0 shown for the `.ts` file, no eslint. **Not checked:** the choice view's header and the read-only header. |
| 4.3 | pass | Typing `debugger;` gave a wavy underline and the counts became ⓧ1. Hovering showed "`debugger` statement is not allowed / help: Remove the debugger statement / oxlint eslint(no-debugger)", fully visible (box 743–1001 by 223–294). No underline in the side panes. |
| 4.4 | pass | The menu read "oxlint / Running / Stop Restart Show log". Stop gave Stopped and the underline count went to 0; Start brought it back to 1; Restart left it Running. Show log listed lines such as "20:54:44 yamt Starting oxlint --lsp in web" and "Exited with code 0". Back and Escape both returned to the merge view. A second click on the oxlint button closed its menu (1 menu → 0). |
| 4.5 | pass | The text matched the brief: "This project uses TypeScript 5.9.3, which needs the separate package typescript-language-server. / In web/: / pnpm add -D typescript-language-server / Copy / Or for all projects: / pnpm add -g … / Or install it any other way … / yamt finds it when you come back to this window." After Copy, `xclip -o -selection clipboard` on `:2` printed `pnpm add -D typescript-language-server` and the button read "Copied". |
| 4.6 | pass, one part not run | Typing `export const   other={c:3,d:4}` lit the dot. Ctrl+S wrote `export const other = { c: 3, d: 4 };` and `export const spaced = { a: 1, b: 2 };`, with the conflict written as `<<<<<<< HEAD / ======= / >>>>>>> remote` (7-character markers). There was no base section because this repository's merge has none. `git ls-files -u` still listed stages 1/2/3, there was no "changed on disk" notice, and the conflict's arrows stayed. One Ctrl+Z brought back the unformatted text and the dot. **Not run:** a formatter edit that would touch a waiting conflict (this repository's conflict line is already formatted). |
| 4.7 | pass | On `notes/crlf.txt` (from a `scripts/conflict-repo.sh` repository, since `lsp-repo.sh` has no CRLF file), typing and Ctrl+S gave `\r\n` on every line in `od -c`, marker lines and the typed line included; stages were kept. |
| 4.8 | pass | With oxfmt stopped, Ctrl+S showed "Not formatted: oxfmt is not running" and wrote the unformatted text. After starting oxfmt, the next save formatted the text and the note was gone. |
| 4.9 | pass | Reset (no question asked): `cmp` against the copy taken at start said identical, and stages 1/2/3 were listed. |
| 4.10 | pass | Closing with unsaved work showed "Unsaved Changes … web/src/math.ts / Exit Without Saving / Cancel". Cancel closed the dialog; Ctrl+S, then close: the app exited with no question. |
| 4.11 | pass | Started again with the stored settings: no question, all servers Running. The file reopened with "1 conflict" and the saved `// unsaved` line, plus a notice "web/src/math.ts differs on disk from git's merge — 1 conflict left". |
| 4.12 | pass | I installed `typescript-language-server` 6.0.2 into `/tmp/yz-tsls` and linked it into `web/node_modules` and its `.bin`. After focus-away and focus-back, TypeScript showed Running with no Restart (process 3138763 `cli.mjs --stdio`). Typing `export const bad: number = "x";` underlined `bad`. |
| 4.13 | pass | The settings showed "This repository /tmp/yamt-yz — Start / Don't start", and the found servers oxfmt, oxlint and TypeScript, each with its folder and command. Don't start stored `"dontStart"` and left no server child processes; Start stored `"start"` and launched three (3142215, 3142221, 3142228). Adding `cat` with file type `txt` saved it to `added` (I focused the input with JS, then typed and clicked for real); "Remove cat" emptied the list again. |
| 4.14 | pass | After Exit Without Saving, `pgrep -af "oxlint --lsp\|oxfmt --lsp\|typescript-language-server"` found only the pre-existing 8789/8820; nothing from this run. |
| 5 | pass | On the fixture page there is no status area (no server buttons). Typing lit the dot; Ctrl+S logged `[info] fixture.save {path: "language-tools-script-setup.ts", text: "import { camelize } …"}` (captured by wrapping `console.info`) and the dot cleared. |

Screenshots are page captures from WebDriver: `/tmp/yz-shots/01-question.png` through `20-fixture-saved.png`. Smoke repositories are left at `/tmp/yamt-yz`, `/tmp/yamt-test-yzcrlf` and `/tmp/yz-tsls`. No driver, Xvfb, kwin or app process is left running.

## Environment
- rustc 1.99.0 (b940084d7 2026-09-28), node v24.22.0, pnpm 12.0.0
- Playwright WebKit cannot run here (missing system libraries). MiniBrowser through tauri-driver works.
- No window manager on the private display unless one is started.