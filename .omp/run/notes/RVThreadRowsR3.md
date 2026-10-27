# RVThreadRowsR3 — thread rows fix round 3 (web-impl, 5m38s)

Verbatim output of agent://RVThreadRowsR3:

Both failing tests were wrong; the product was right in both cases. I changed only `frontend/src/editor/rangeThreads.browser.test.ts`. All 13 browser tests now pass twice in a row in the private WebKit, each fixed test fails under its hand mutation, and the four frontend commands pass.

**summary**
- **Block 1 (#1632), sideways scroll:** the test scrolled the column in the same task that built it, before the first frame. At that moment `ThreadHosts.#placeColumns` had not run yet, because it runs from the ResizeObserver, which reports at the next frame. With `--thread-left`/`--thread-width` unset, the row falls back to `width: 100%`. That makes it as wide as `.cm-content`, so sticky has no room to hold it. A person cannot scroll before the first frame, and the fixture page in MiniBrowser shows the box staying put. The test now first waits until the box fits inside its column, then scrolls.
- **Block 2 (#1633), pure deletion:** the brief's guess is confirmed. `lineTop` was read before CodeMirror had measured the lines, so it used the estimated line height of 14 px instead of 20 px. The test scrolled to about line 195, and the row at line 301 was never drawn. The test now waits for the measurement (new helper `measured(host)`) before reading `defaultLineHeight` and `lineTop`.

**files_changed**
- `frontend/src/editor/rangeThreads.browser.test.ts`

**tests_added**
- Renamed: "horizontal scroll leaves the box in place" → "a box fits inside its column and horizontal scroll leaves it in place". It waits for `host.right ≤ scrollDOM.right` and the host's 40 px height, then checks that `left` is the same after `scrollLeft = 300`. It fails when `position: sticky` is removed.
- Fixed: "a removed line's row in a pure deletion is inside the band in both columns…". Its expected values now come from measured heights. It still fails under M4.

**smoke_evidence**
- **Cause of block 1, observed.** Temporary diagnostics in the test, since removed.
  - Scrolled right after the box reached 40 px: `"varLeft": ""`, `"varWidth": ""`, `"width": "3252.8125px"` (the row as wide as `.cm-content`, `contentCs: "none visible 3252.8125px"`), `"rowLeft": -253.59375`, `"before": 46.40625`.
  - Host style before any frame: `"varBefore": "min-width: 0px; min-height: 0px; height: 500px;"`.
  - After two `requestAnimationFrame`s: `"varEarly": "…--thread-left: 46.40625px; --thread-width: 533.59375px;"`.
  - Scrolled after those frames: `"hostLeft": 46.40625`, `"rowWidth": 533.59375`, `"pos": "sticky"`. The row sticks.
- **Cause of block 2, observed.**
  - Before the first frame: `"diagEarly": { "lineHeight": 14, "top": 4200, "scrollTop": 3899 }`.
  - Two frames later: `"late": { "lineHeight": 20, "top": 6000, "firstVisible": 195, "rows": 0, "viewport": { from: 3731, to: 5326 } }`.
- **Browser tests, twice in a row.** `PLAYWRIGHT_BROWSERS_PATH=/tmp/yamt-pw pnpm -C frontend exec vitest run --config /tmp/rv3/vitest.config.mts --project browser src/editor/range.browser.test.ts src/editor/rangeThreads.browser.test.ts`. The config is a scratch copy of the probe config pointing at this worktree.
  ```
   Test Files  2 passed (2)
        Tests  13 passed (13)
   Test Files  2 passed (2)
        Tests  13 passed (13)
  ```
- **Mutation 1: `position: sticky` removed from `.cm-thread-row`** (restored afterwards).
  ```
   × a box fits inside its column and horizontal scroll leaves it in place
  AssertionError: expected -253.59375 to be 46.40625 // Object.is equality
   ❯ src/editor/rangeThreads.browser.test.ts:294:45
        Tests  1 failed | 7 passed (8)
  ```
- **Mutation M4: `columnSpan` always takes the `rangeSpan` branch.** It was applied in memory by a Vite `load` plugin in `/tmp/rv3/vitest.m4.config.mts`, because the ownership hook blocks edits to `compareFrame.ts`.
  ```
  M4 applied to /home/wds/.omp/wt/tdf2491ad0/m/frontend/src/editor/internal/compareFrame.ts
   × a removed line's row in a pure deletion is inside the band in both columns and keeps the lines above in step
  AssertionError: expected +0 to be close to 200, received difference is 200, but expected 0.5
   ❯ src/editor/rangeThreads.browser.test.ts:337:50   (band.right.bottom - band.right.top)
        Tests  1 failed | 7 passed (8)
  ```
- **MiniBrowser, fixture page.** Session `pnpm -C frontend exec tsx scripts/app-session.ts start-fixture --name rv3 --size 1200x800 --range-case review --threads seeded`; page `?range=review&threads=seeded`, WebKit UA `AppleWebKit/605.1.15`.
  - Opened `src/board/board.ts` and opened the thread on line 6 through its count. The box (`thread-2`) read `left 300.40625, width 402.59375`; the left column read `clientWidth 449, scrollWidth 671, scrollLeft 0`.
  - Then `scrollLeft = 200`, set from a timer (MiniBrowser undoes scroll writes made during a WebDriver command). It read `{"hostLeft":300.40625,"hostWidth":402.59375,"scrollLeft":200,"firstLineLeft":100.40625,"row":"sticky"}`: the code moved 200 px and the box did not move.
  - Screenshots: `/tmp/rv3/shots/before.png` and `/tmp/rv3/shots/after.png`. The after shot shows the line starts cut off ("abel, type NewCard…") with the box still inside the column. Session stopped (webdriver and vite stopped, folder removed).
- **Frontend commands:**
  - `pnpm -C frontend typecheck` → `vue-tsc -b`, exit 0.
  - `pnpm -C frontend lint` → exit 0.
  - `pnpm -C frontend test` → `Test Files 197 passed (197)`, `Tests 2675 passed (2675)`.
  - `pnpm -C frontend fmt:check` → `All matched files use the correct format.`

**deviations_from_brief**
- The M4 mutation could not be made in `frontend/src/editor/internal/compareFrame.ts` (the ownership hook blocked it, SP1). I applied it in memory through a Vite plugin in my scratch config under `/tmp/rv3`. No repository file outside `Owned` was touched.
- I renamed the sideways test, because it now also checks that the box fits inside its column.
- `frontend/src/editor/AGENTS.md` is unchanged, since no rule changed. `.omp/run/slices.json` shows as modified in this worktree; I did not edit it.
- I ran `pnpm -C frontend install --offline --frozen-lockfile` because the worktree had no `node_modules`.

**open_risks**
- `frontend/src/editor/internal/threadHosts.ts:188-199`: the column variables are set only from ResizeObserver reports. Until the first report, a row is as wide as `.cm-content`. This is not visible because the report comes before the first paint (seen in the test and MiniBrowser), but anything that measures or scrolls in the same task as `showThreads` sees the wide row.
- The `measured` helper in `rangeThreads.browser.test.ts` treats "measured" as "`defaultLineHeight` equals a rendered line's height". If a theme ever made CodeMirror's 14 px estimate equal the real line height, the wait would pass before measurement, and the test would still only work because its numbers happen to match.