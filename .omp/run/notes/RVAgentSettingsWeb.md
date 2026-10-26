I added the `agent` settings path for the window: `setAgent` on every settings source, the setter in `ui/settings.ts`, and `ui/commandWords.ts`. Typecheck and lint show only the expected `ui/problemText.ts` error; tests and `fmt:check` pass. The Stryker run did not show that my tests kill the mutants: it marked all 331 mutants as timeouts, not kills, so SP5 is not shown yet.

**summary**
- `SettingsSource.setAgent(current, agent)` is in `ipc/ChunkSource.ts` (on `ChunkSource` and in the `SettingsSource` Pick). The Tauri side is in `createTauriSettings`, which the merge, compare and range sources already spread, and the fixture side is in `fixtureSettings.ts` (copies the stored entry).
- `ui/commandWords.ts` is the one split rule: split at runs of spaces, no quoting. `serverSetup.ts` `parseAddedServer` now uses it.
- `ui/settings.ts` now carries `agent` in the settings in use. It starts as `{ command: null, firstMessage: null }`, is sent back in `current`, and a load whose agent entry differs is adopted. `setAgent` sits beside the other setters and passes nulls through.
- The `SettingsStore` seam (`ui/settingsStore.ts`) now includes `setAgent`, as you asked. All three roots already spread `settingsActions`, so `store.ts`, `compareStore.ts` and `rangeStore.ts` needed no change.

**files_changed**
- `frontend/src/ipc/ChunkSource.ts`, `domain.ts` (`AgentSettings` alias), `tauri.ts`, `tauri.test.ts`, `fixtureSettings.ts`, `fixtureSettings.test.ts`
- `frontend/src/ui/commandWords.ts` (new), `commandWords.test.ts` (new), `serverSetup.ts`, `settings.ts`, `settings.test.ts`, `settingsStore.ts`, `settingsStore.test.ts`, `store.test.ts`, `listing.test.ts`, `saving.test.ts`, `stops.test.ts`

**tests_added**
- `commandWords.test.ts`:
  - "a command splits at each run of spaces, leading and trailing spaces dropped"
  - "an empty or all-space command has no words"
  - "only spaces split: quotes and tabs stay inside the words"
- `serverSetup.test.ts` is unchanged and passes through `commandWords`.
- `fixtureSettings.test.ts`:
  - "setAgent replaces the agent entry, keeps the rest, and the next load reads it" (round trip and back to nulls)
  - "an agent command in a reply and the sent one are copies: changing them changes nothing stored"
- `settings.test.ts`:
  - "before any read the agent entry is all defaults (null), sent so by the first load"
  - "setAgent sends the settings in use and the entry as given, nulls included, and adopts the reply" (also: the agent goes back in `current` on a theme change)
  - "a failed setAgent is reported as a settings problem and keeps the settings"
  - a 6-case table "a load whose only difference is %s is adopted" (command null↔list, a different word, a longer command, first message)
  - a 2-case table "a load of the same agent entry (%s) keeps the settings in use"
- `tauri.test.ts`: "setAgent sends the settings in use and the agent entry, and returns the read or the error"

**smoke_evidence**
- `pnpm -C frontend typecheck` → only `src/ui/problemText.ts(120,64): error TS2366: Function lacks ending return statement…` (expected).
- `pnpm -C frontend lint` → only `src/ui/problemText.ts:122:11: error typescript(switch-exhaustiveness-check): Switch is not exhaustive. Cases not matched: "AiOff" | …` (expected). That error stops the script before its ESLint step, so I ran it on its own: `eslint --max-warnings 0 "src/**/*.vue"` → `ESLINT_OK`.
- `pnpm -C frontend test` → `Test Files 168 passed (168)`, `Tests 2145 passed (2145)`.
- `pnpm -C frontend fmt:check` → `All matched files use the correct format.`
- `stryker run --mutate` on my lines in `commandWords.ts`, `settings.ts`, `fixtureSettings.ts`, `tauri.ts` and `serverSetup.ts` → `All files | 331 timeout | 0 survived | 0 no cov | 0 killed`. A timeout is not a kill, so SP5 is not met yet (see open_risks).
- `pnpm -C frontend unused` (knip) → fails, but only on `RangeSideLabel` in `src/ipc/index.ts:92` and `src/ipc/rangeDomain.ts:6`. Neither file is in this slice.

**deviations_from_brief**
- You granted `ui/{listing,saving,stops,settingsStore}.test.ts`. Each source or store literal there gained one `setAgent` line, because `setAgent` is a required method.
- `setAgent` is on the `SettingsStore` seam, as you asked. No root needed a change.
- I added a `setAgent` test to `tauri.test.ts`, beyond the brief's "literal only", so the new `tauri.ts` lines are tested.
- `ipc/index.ts` is outside my files, so it does not export `AgentSettings`. `ui/settings.ts` and `settings.test.ts` use a private alias `StoredSettings["agent"]` instead. C7's `AgentSettings.vue` will need either that alias or an export added to `ipc/index.ts`.
- The brief left tabs open ("tabs?"). I followed the Contract wording "runs of spaces" and kept the old `parseAddedServer` behaviour: a tab stays inside a word, and a test pins that.

**open_risks**
- **Stryker:** all 331 mutants counted as timeout, none as killed, even trivial ones like `commandWords.ts:2`'s `!==`. That looks like a problem in how the runner ran in this tree, not real results. `just mutants` should be rerun on these files, because SP5 is not shown until then.
- **knip:** `pnpm -C frontend unused` fails on `RangeSideLabel` (`src/ipc/rangeDomain.ts:6`), which is outside this slice.
- **`sameAgent`** (`frontend/src/ui/settings.ts:142-148`) treats a `null` command and `[]` as different. Rust's `set_agent` is the only writer of the file, so `[]` should only come from a hand edit.