The `--glab` round 2 fix is in. `parseCommand` now checks only the form of the scenario name and never reads the disk. Whether the scenario folder exists is checked when the app is started. Stryker's dry run passes and the frontend checks pass.

**summary**
- `startArgs.ts`: `glabScenario` (no longer exported) checks only that `--glab` comes with `--range` and that the name matches `^[a-z0-9-]+$`.
- `glabFolder(scenario, isFolder)` now does the existence check. It builds `tests/glab/<scenario>`, asks the passed-in lookup about it, and throws `--glab <s>: no scenario folder <path>` if the lookup says no. `startArgs.ts` no longer imports `existsSync`.
- `start.ts` calls `glabFolder(command.glab, existsSync)` as the first step of `prepareApp`. An unknown scenario is refused before anything is created or launched.
- No node test reads the repository's files any more: `args.test.ts` stays off the disk, and `startArgs.test.ts` uses its own lookup.

**files_changed**
- `frontend/scripts/app-session/startArgs.ts`
- `frontend/scripts/app-session/start.ts`
- `frontend/scripts/app-session/args.test.ts`
- `frontend/scripts/app-session/startArgs.test.ts`

**tests_added**
- `args.test.ts` "start-app --glab names a tests/glab scenario by its form, only with --range":
  - `nosuch` is now accepted at parse time (`{ glab: "nosuch" }`), which pins that parsing never looks at the disk.
  - The form refusals are unchanged, including `lined-up/../moved` (round 1's first promise).
- `startArgs.test.ts` "a scenario whose folder exists is its folder under tests/glab; the lookup is asked about it": the returned folder ends in `/tests/glab/lined-up`, and the lookup was asked about exactly that folder.
- `startArgs.test.ts` "an unknown scenario is refused at start, naming the folder it looked for" (round 1's second promise): with the lookup answering false, the error matches `^--glab nosuch: no scenario folder /…/tests/glab/nosuch$`. The lookup is asked once, and the error names the path it was asked about.

**smoke_evidence**
- `pnpm -C frontend test` → `Test Files  194 passed (194)` / `Tests  2599 passed (2599)`
- The brief's Stryker command → `DryRunExecutor Initial test run succeeded. Ran 26 tests in 1 second`; summary row `startArgs.ts |  96.12 |  96.12 | 198 | 0 | 8 | 0 | 0`. None of the 8 survivors is on a line I changed: they are at lines 42–43 (`size`), 126 (`recording`), 139 and 141 (`settingsText`), and 161 (`noPositionals`).
- `pnpm -C frontend typecheck` → `$ vue-tsc -b`, no output
- `pnpm -C frontend lint` → `EXIT=0`
- `pnpm -C frontend fmt:check` → `All matched files use the correct format.` (564 files)
- `pnpm -C frontend unused` → `$ knip --include exports,types`, `EXIT=0`

**deviations_from_brief**
1. `glabFolder` changed signature: from `(scenario)` to `(scenario, isFolder)`, and it now does the existence check. `glabScenario` is no longer exported and no longer takes a lookup.
2. In `start.ts`, `fakeGlab`'s parameter is renamed `scenarioFolder`, because it now receives the folder that was checked.
3. The existence check moved to the top of `prepareApp`, ahead of the binary check. This way an unknown scenario is refused before a `--home` folder is created.

**open_risks**
- `frontend/scripts/app-session/startArgs.ts:42-43,126,139,141,161`: the 8 surviving mutants above are in old code outside this slice, and I left them as they are.
- The scenario-folder check in `frontend/scripts/app-session/start.ts:71` was not run in the real app (`just app-session start-app --glab …`); only the unit tests cover it.