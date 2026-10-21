# RawCompareTabsStoreR1 (3.C-tabs-store rework 1, board Raw compare row 9)

All five blocks are fixed. `typecheck`, `test`, `lint` and `fmt:check` pass, and `compareStore.ts` is 283 lines. `pnpm -C frontend unused` (knip) still fails, on five exports in `src/ipc/index.ts`, a file this slice does not touch.

```
summary
  CompareStore now has fileListKey(event, platform), built as store.ts:224 does; both windows share ui/fileListKey.ts.
  The notice actions moved to the new ui/compareNotices.ts (createCompareNotices); the store keeps tabs, columns and chrome.
  columnLimitText(limit) in ui/compareText.ts holds the one BYTES_PER_MIB; compareText.ts and problemText.ts both use it.
  The saveTab problem now carries tab and column; that column's next successful save clears it.
  reportFormat is one Format's outcome: it drops that tab's earlier Format notices and keeps its refused-edit notices.

files_changed
  frontend/src/ui/compareStore.ts
  frontend/src/ui/compareNotices.ts (new)
  frontend/src/ui/compareText.ts
  frontend/src/ui/problem.ts
  frontend/src/ui/problemText.ts
  frontend/src/ui/compareStore.test.ts
  frontend/src/ui/problem.test.ts
  frontend/src/ui/problemText.test.ts

tests_added
  compareStore.test.ts "a successful save clears that column's save problem only (catches a stale 'Could not save' after the column saved)":
    a failed left save stays after the same tab's right column saves, and after the other tab's left column saves;
    the next successful left save of that tab clears it. This catches a clear that ignores the tab or the column.
  compareStore.test.ts "a Format on a tab replaces its earlier Format notices, keeping refused edits and other tabs' (catches a stale 'not valid JSON' after a good Format)":
    reportFormat(tab, []) removes that tab's "not valid JSON" notice. The tab's refused-edit notice and the other tab's
    Format notice stay. A later Format on the other tab replaces its left notice with a right one.
  compareStore.test.ts "the bound key toggles the tab panel through the shared rule, never while a question waits (catches a compare window that cannot hide its tabs)":
    Ctrl+B hides the panel and takes the press. While the closeTab question waits, the key does nothing. After the answer it shows the panel again.
  Updated: the flush-failure and saveColumn tests expect tab and column on the saveTab problem;
    problem.test.ts and problemText.test.ts build saveTab with a TabId from the fixture.

smoke_evidence
  pnpm -C frontend typecheck → "$ vue-tsc -b", no errors
  pnpm -C frontend test → "Test Files  142 passed (142)" / "Tests  1896 passed (1896)"
  pnpm -C frontend lint → "$ oxlint --type-aware && eslint --max-warnings 0 "src/**/*.vue"", no findings
  pnpm -C frontend fmt:check → "All matched files use the correct format."
  wc -l frontend/src/ui/compareStore.ts → "283 frontend/src/ui/compareStore.ts" (was 293, and fileListKey is now in it)
  pnpm -C frontend unused (not in this rework's acceptance) → fails on five exports this slice did not touch:
    createTauriCompareSource, ColumnWrite, CompareStart, LeftLine, RightLine (all in src/ipc/index.ts)

deviations_from_brief
  - The notice actions return their own type, CompareNotices (in compareNotices.ts), and CompareStore = SettingsStore & CompareNotices & {…}.
    The member signatures are unchanged.
  - ColumnFormatFailure now lives in compareNotices.ts and compareStore.ts re-exports it (`export type { ColumnFormatFailure } from "./compareNotices"`),
    so the Contract's import path still works without an import cycle.
  - Telling Format notices apart: a refused edit and a Format notice for the same column share one key, and the original
    contract says the newer replaces the older. So the store's internal notices ref holds ShownNotice = NoticeRow & { notice: CompareNotice },
    and reportFormat filters on notice.kind and notice.tab. The public type is still Readonly<ShallowRef<readonly NoticeRow[]>>.
  - setDetected, dismissProblem, fileListKey, answer and dismissQuestion now sit in a local chromeActions(state), to keep
    createCompareStore under the 40-line function limit.
  - The saveTab log line is unchanged ({name, …cause}). Splitting the log case to add the column pushed logProblem over 40 lines.
  - A /** */ line on CompareNotices.reportFormat records that it is called after every Format, with an empty list too (item 5's "contract comment").
  - Test names cannot carry the finding ids (#1524 etc.): scripts/palette.test.ts reads "#1527" as a colour literal. Each name states its bug instead.

open_risks
  - frontend/src/ui/compareNotices.ts:15: components get rows carrying an extra `notice` field. NoticeBar only reads key, text
    and closeLabel, so nothing breaks, but row 11 could in principle read `notice`.
  - frontend/src/ui/problemText.ts:73: the merge window's "TooLarge" reason still says "8 MiB" as a fixed literal.
    It is outside #1525's scope and was left as is.
  - pnpm unused fails on the five src/ipc/index.ts exports listed above; this slice did not touch that file.
```