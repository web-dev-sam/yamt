# RawCompareTabsStore (3.C-tabs-store, board Raw compare row 9)

The compare window's store is built, with its tabs, close question, notices and problems, and the brief's acceptance tests pass. Of the five commands, `typecheck`, `test`, `lint` and `fmt:check` pass. `unused` (knip) fails, but only on ipc exports from row 7 that row 11 will import (details under smoke_evidence).

```
summary
- ui/compareStore.ts: the compare window's one store (createCompareStore/useCompareStore). The tab list, shown tab and
  column limit change only from replies. It also holds Auto's finding per tab, the close question, notices, problems,
  the screen and file-list flag, and its settings part through settingsActions; it registers itself with registerSettingsStore.
- ui/compareTabs.ts: languageLabel. ui/compareText.ts: the notice words and keys (compareNoticeRow), and tabName.
- New Question variant closeTab ("Close Compare 2? Its text is lost.", Yes/No) and new Problem actions
  tabs / loadTab / saveTab, each with words and a log line.
- Nothing in these files imports editor/, ui/store.ts, ui/App.vue or lsp/ directly.

files_changed
- frontend/src/ui/compareStore.ts (new)
- frontend/src/ui/compareTabs.ts (new)
- frontend/src/ui/compareText.ts (new)
- frontend/src/ui/compareStore.test.ts (new)
- frontend/src/ui/compareTabs.test.ts (new)
- frontend/src/ui/compareText.test.ts (new)
- frontend/src/ui/problem.test.ts (new)
- frontend/src/ui/problem.ts
- frontend/src/ui/problemText.ts
- frontend/src/ui/question.ts
- frontend/src/ui/question.test.ts
- frontend/src/ui/problemText.test.ts

tests_added
compareStore.test.ts (fake source = createFixtureCompareSource with methods overridden per test):
- "the window's components get no store before the root creates one": useCompareStore throws first.
- "start-up lists the stored tabs, sets the column limit and loads the settings": nothing listed and limit 0 before;
  after start-up the list, the 8 MiB limit, the settings path, and both useCompareStore and useSettingsStore give this store.
- "a failed start shows the problem and lists nothing": the tabs problem, its words, its log line.
- "add, show, rename and language write the mirror from each reply".
- "a rename shows only once its reply arrives": the mirror is unchanged while the reply is held.
- "a failed %s leaves the mirror as it was and shows the problem", for addTab, showTab, renameTab, setLanguage and
  closeTab: the same array is kept and the tabs problem is shown.
- "a tab closed in another call is shown with its words, nothing listed again": UnknownTab shows
  "Could not update the tabs: that tab was closed." and nothing is listed again.
- "a tab reply clears a tabs problem but not a column's".
- "closing a tab with text asks; No and Escape keep it, Yes closes it".
- "an empty tab closes at once, never asking".
- "a tab no longer listed is not closed again".
- "the mounted tab's holdsText wins over the stored entry's, both ways": also shows unsent() is never called on close.
- "a closed tab is no longer flushed; one that failed to close still is".
- "flushAll sends each unsent column once and resolves only when every reply came".
- "a failed flush is shown and logged, never thrown".
- "untracking removes only the handle it returned".
- "loadTab returns the stored texts, or null with the tab's problem": also the log line.
- "saveColumn writes the column and returns the comparison, or null naming the tab as it was called".
- "a refused edit and a Format failure show their words; a second one for the column replaces the first".
- "closing a notice removes only that notice".
- "Auto's finding is kept per tab".
- "the gear switches the screen, and the settings in use reach the preferences".
- "a shown problem closes on request".
compareText.test.ts: the Format-failure words, the refused-edit words with the limit in MiB, keys shared per tab and
  column whatever the notice says, tabName and its fallback.
compareTabs.test.ts: Auto with and without a finding; a picked language.
question.test.ts: the closeTab words, and endsWithStop is false for it.
problemText.test.ts: the words for tabs, loadTab and saveTab, and saveTab with UnknownTab.
problem.test.ts: the log lines for tabs, loadTab, saveTab and both kinds of settings cause.

smoke_evidence
- pnpm -C frontend typecheck → "$ vue-tsc -b", exit 0
- pnpm -C frontend test → "Test Files  137 passed (137)" / "Tests  1871 passed (1871)"
- pnpm -C frontend lint → exit 0
- pnpm -C frontend fmt:check → "All matched files use the correct format."
- pnpm -C frontend unused → exit 1. Every finding is in ipc/ from row 7, which I did not touch:
  "createTauriCompareSource src/ipc/index.ts:85"; types LeftLine/RightLine (compareDomain.ts:17),
  ColumnVersions/ColumnWrite/CompareStart/Difference/LeftLine/RightLine (index.ts:10-16).
  These are row 7 exports whose importers come with row 11. None of my exports is reported.
- Mutation run (my files plus my changed line ranges; the ranges first given for problem.ts and question.ts were wider than my edits):
  compareStore.ts 100 % (146 killed), compareText.ts 22 killed, compareTabs.ts 8 killed, problemText.ts 100 %.
  The only mutants not killed in these new files are the unreachable `never` default branches (no coverage).
  Rerun on only my changed problem.ts lines: 100 % (14 killed).
  The first run had survivors on older lines inside those wider ranges (problem.ts "stopped"/"reset";
  question.ts endsWithStop's "unprocessed"/"abort"/"clash"/"servers"); they are not my lines.

deviations_from_brief
- Added `loadSettings(): Promise<void>` to CompareStore. Design §6 has CompareApp re-read the settings on window focus,
  and the fixed contract had no way to do that.
- CompareStore.preferences is typed with `Preferences` imported as a type from ./useMergeController, as settings.ts
  does. It is type-only; there is no runtime import of editor/.
- To stay under the lint limits I moved existing code: logProblem's settings case into `settingsFields`
  (problem.ts, now ≤ 40 lines) and the closeTab words into `closeTabText` (question.ts). Behaviour is unchanged.
- Added frontend/src/ui/problem.test.ts (within my Owned globs) to kill the mutants on the changed logProblem lines.
- Decisions the brief left open:
  - The "tabs" problem says "Could not update the tabs: …"; loadTab says "Could not load <name>: …"; saveTab says
    "Could not save <name>: …". The question is titled "Close Tab".
  - The tab's name is taken when the call starts, so an UnknownTab after a close still names the tab.
  - A notice's key is `<tab>:<column>`; a new notice is added at the end and drops any older one with the same key.
    Its close label is "Close the notice about <name>, <column>".
  - Successful tab replies clear only a "tabs" problem.
  - closeTab on a tab not in the tab list does nothing and calls nothing.
  - A close untracks the tab only when the close succeeds.

open_risks
- frontend/src/ui/compareText.ts:47: a tab missing from the tab list when a call starts is named "Tab <id>". A component should
  not get there, but if it does those words show.
- frontend/src/ui/compareStore.ts:148: every TabList reply overwrites the tab list as it arrives ("the last reply"). If two
  tab calls answer out of order, the older state shows until the next reply. There is no ordering ticket, because the brief
  asked for none.
- Notices about a tab stay after it is closed until the user closes them, because only reportFormat, refused and
  dismissNotice write notices (Behaviour 1). A later successful Format does not clear an older failure notice for that
  column, because reportFormat receives only failures.
```