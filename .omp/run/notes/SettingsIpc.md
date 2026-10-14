# SettingsIpc (3.Y-settings-ipc, board row 6b) — committed e45ce97

The window's settings now carry the `languageServers` entry end to end: the file's entry is kept in `SettingsInUse` and sent back in every `current`. `setServerAnswer` and `setAddedServers` work through both the fixture source and the app. The tree typechecks again. Typecheck, lint, test, unused and fmt:check all exit 0, but the mutation run leaves three survivors (see open_risks).

```
summary
  SettingsSource/ChunkSource gain setServerAnswer and setAddedServers. The Tauri source maps them onto
  commands.setServerAnswer/setAddedServers the way setKeys is mapped; the fixture source keeps the
  answer under "/fixture/repository" and copies the entry deeply. ui/settings.ts holds the entry in
  SettingsInUse (empty at start), sends it back in every `current`, adopts a read that differs only in
  it, and has the two new actions on the existing `send` path. ipc/index.ts exports RepositoryAnswer,
  AddedServer and LanguageServerSettings.

files_changed
  frontend/src/ipc/ChunkSource.ts
  frontend/src/ipc/tauri.ts
  frontend/src/ipc/tauri.test.ts
  frontend/src/ipc/fixtureSettings.ts
  frontend/src/ipc/fixtureSettings.test.ts
  frontend/src/ipc/index.ts
  frontend/src/ui/settings.ts
  frontend/src/ui/settings.test.ts
  frontend/src/ui/store.test.ts            (test data only)

tests_added
  ipc/fixtureSettings.test.ts
    "an answer is stored under the repository, replaced by the next, forgotten with null": set, replace and
      forget come back in SettingsRead.stored, and a later load reads the same thing.
    "an answer keeps the other repositories' answers and the added servers"
    "added servers replace the list and keep the answers": the next load reads the new list.
    "a reply and the sent list are copies: changing them changes no stored server": checks the deep copy.
  ipc/tauri.test.ts
    "setServerAnswer and setAddedServers send their arguments and return the read": includes the null answer.
    "setServerAnswer and setAddedServers return the app's error"
  ui/settings.test.ts
    "before any read the servers entry is empty, and the first load sends it so"
    "a loaded servers entry is in use and survives a theme change, sent back in current"
    "setServerAnswer and setAddedServers send the settings in use and adopt the reply"
    "a failed server answer is reported as a settings problem and keeps the settings"
    "a load whose only difference is %s is adopted" (13 cases: answers, roots, server count, command and
      file-type lists that are shorter, longer, or the same length with different text)
    "a load of the same servers entry keeps the settings in use": the same object is kept.

smoke_evidence
  Acceptance 1 is covered by the tests above.
  pnpm -C frontend test         → "Test Files  79 passed (79)" / "Tests  971 passed (971)"
  pnpm -C frontend typecheck    → "$ vue-tsc -b" (no errors; it failed with 6 TS2741 errors before this slice's test data)
  pnpm -C frontend lint         → "$ oxlint --type-aware && eslint --max-warnings 0 "src/**/*.vue"" (no findings)
  pnpm -C frontend unused       → "$ knip --include exports,types" (no findings)
  pnpm -C frontend fmt:check    → "All matched files use the correct format."
  Mutation run (the `just mutants` stryker command, limited to the changed line ranges of fixtureSettings.ts,
  tauri.ts and settings.ts):
    fixtureSettings.ts 96.43 % (27 killed / 1 survived), tauri.ts 100 % (3/0), settings.ts 97.50 % (78/2);
    All files 97.30 %.

deviations_from_brief
  - The brief says ipc/index.ts exports "the domain types", but ipc/domain.ts has no such types and is not
    Owned. I derived them in ipc/ChunkSource.ts from the domain StoredSettings:
      LanguageServerSettings = StoredSettings["languageServers"]
      RepositoryAnswer = LanguageServerSettings["repositories"][string]
      AddedServer = LanguageServerSettings["added"][number]
    index.ts re-exports them from "./ChunkSource". The natural home is ipc/domain.ts, next to StoredSettings
    (`export type LanguageServerSettings = Generated.LanguageServerSettings;` and the same for
    RepositoryAnswer and AddedServer); moving them there is a three-line change in domain.ts plus the import
    source in index.ts.
  - ui/settings.ts: SettingsTarget.source is narrowed from ChunkSource to SettingsSource so settingsActions
    can be tested with a settings-only fake. store.ts still passes a ChunkSource, which fits.
  - ui/settings.ts: sameStored also compares languageServers (new sameServers). Without this, a load whose
    file changed only in the entry, e.g. edited by hand, would not be adopted.
  - fixtureSettings: setAddedServers stores a deep copy of the given list (copiedServers, also used by
    copied), so the caller's arrays never alias stored state.

open_risks
  - frontend/src/ipc/fixtureSettings.ts:9 — the survivor on the REPOSITORY constant is a module-level
    (static) mutant. The justfile says those survive under --ignoreStatic whatever the tests assert (#732),
    and the tests do assert the "/fixture/repository" key.
  - frontend/src/ui/settings.ts:104 — the survivor on `other !== undefined` cannot change behaviour: the
    length check before it means `other` is always defined. The guard is only there for
    noUncheckedIndexedAccess.
  - frontend/src/ui/settings.ts:115 — the survivor on `inUse.path !== read.path` is on a line this slice
    did not change; I left it.
```