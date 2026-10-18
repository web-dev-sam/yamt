I fixed #1244, #1245 and #1246 with no behaviour change. All five frontend recipes exit 0, and the round-3 repro in the real app lands where it was sent. One deviation: the comment can't contain `#1240` (details under deviations).

**summary**
- `editor/internal/exactScroll.ts` (new) now holds `Placed`, `placeTop`, `placed`, `placeFarScroll` and `exactScroll`. They sit beside `cutOnce.ts`, the other WebKitGTK quirk.
- The far-scroll decision is a pure exported function, `farTop({ scrollTop, clientHeight, paddingTop }, rendered: Span): number | null`, called by `placeFarScroll`. `exactScroll.test.ts` pins it in node.
- `scrollSync.ts` is back to the locked scroll only and imports `EditorView` with `import type`.
- The workaround comment is three lines and cites plan §2 #82 and the round-3 brief.
- `paneViews.ts` imports from `./exactScroll`, and each entry of `everyPane()` is on its own line with the tooltip comment above `tooltips(...)` (the #1249 allowance). `editor/AGENTS.md` names the new file and `farTop`.

**files_changed**
- `frontend/src/editor/internal/exactScroll.ts` (new)
- `frontend/src/editor/internal/exactScroll.test.ts` (new)
- `frontend/src/editor/internal/scrollSync.ts`
- `frontend/src/editor/internal/paneViews.ts`
- `frontend/src/editor/AGENTS.md`

**tests_added** (all in `exactScroll.test.ts`; a 600 px view, a 4 px top padding, rendered lines from 1000 to 2000)
- "a visible span that ends where the rendered lines start is far, measured below the padding": `at(404)` gives 400, so touching the top edge counts as far and the padding is subtracted.
- "one pixel of the rendered lines' top in view is not far": `at(405)` gives null.
- "a visible span that starts where the rendered lines end is far, measured below the padding": `at(2004)` gives 2000.
- "one pixel of the rendered lines' bottom in view is not far": `at(2003)` gives null; this also fails if the padding is dropped.
- "a visible span inside the rendered lines is not far": `at(1200)` gives null.
- "a jump fully above or fully below the rendered lines places its visible top": 100 gives 96, and 2552 gives 2548.

**smoke_evidence**

1. `pnpm -C frontend exec vitest run --project node src/editor/internal/exactScroll.test.ts`. The original passes (`Test Files 2 passed (2)`, `Tests 13 passed (13)` together with `scrollSync.test.ts`). Each hand mutation was run, then the original restored:

   | mutation | result | first failing assertion |
   |---|---|---|
   | top edge `>` → `>=` | `Tests 1 failed \| 5 passed (6)` | `ends where the rendered lines start … AssertionError: expected null to be 400` |
   | bottom edge `<` → `<=` | `Tests 1 failed \| 5 passed (6)` | `starts where the rendered lines end … AssertionError: expected null to be 2000` |
   | padding dropped (`visibleTop = scrollTop`) | `Tests 4 failed \| 2 passed (6)` | `expected null to be 400`, `expected 2004 to be 2000`, `expected 2003 to be null`, `expected 100 to be 96` |
   | top and bottom swapped | `Tests 3 failed \| 3 passed (6)` | `expected 401 to be null`, `expected 1999 to be null`, `expected 1196 to be null` |
   | return inverted | `Tests 6 failed (6)` | — |

   After the restore, the full `pnpm -C frontend test` passes (item 3).

2. `git diff 8c07b92 -- frontend/src/editor/internal/scrollSync.ts`: `1 insertions(+), 60 deletions(-)`. The one insertion is `import type { EditorView } from "@codemirror/view";`. The rest removes the two `@codemirror/state` imports, the `@codemirror/view` value import, `Placed`, and lines 69–123.
   - `diff <(git show 8c07b92:…/scrollSync.ts) …/exactScroll.ts` shows the moved code differs only in:
     - the new `ScrollBox` type and `farTop`;
     - the comment;
     - `placeFarScroll` calling `farTop` instead of its inline `overlaps` and `visibleTop`.

3. Recipes, final run, all exit 0:
   - `pnpm -C frontend lint`: `$ oxlint --type-aware && eslint --max-warnings 0 "src/**/*.vue"`, exit 0.
   - `pnpm -C frontend typecheck`: `$ vue-tsc -b`, exit 0.
   - `pnpm -C frontend test`: `Test Files 109 passed (109)`, `Tests 1445 passed (1445)`, exit 0.
   - `pnpm -C frontend unused`: `$ knip --include exports,types`, exit 0.
   - `pnpm -C frontend fmt:check`: `All matched files use the correct format.`, exit 0.

4. Real app, built with `cargo tauri build --debug --no-bundle` from this tree. Each run was a fresh session through `/tmp/yamt-m/r4/fresh.sh` (`conflict-repo.sh`, `vOn.ts` opened, collapsing toggled off) and started at `[[0,3688,903],[0,3688,903],[0,3628,903]]`.
   - **Session `m-r4-a`, a real xdotool click with Alt held on minimap row 151:**
     `row 151 expected 2552.5 minimap {"value":true} {"before":[0,0,0],"raf1":[0,2552,0],"raf2":[2552,2552,2492],"s1":[2552,2552,2492]}`
   - **Session `m-r4-b`, a scripted `__panes[1].scrollTop = 2552`:**
     `{"before":[0,0,0],"readBack":2552,"raf2":[2552,2552,2492],"s1":[2552,2552,2492]}`
   - **Stopped:** both sessions' `tauri-driver` and `xvfb`, with their folders removed. Only the owner's `target/debug/yamt --repo /tmp/yamt-conflict-project` (pid 61860) is still running, untouched.

**deviations_from_brief**
- **#1246 does not cite `#1240` literally.** `scripts/palette.test.ts` (VU17) reads `#1240` in a source file as a hex colour (`HEX_COLOUR` in `frontend/scripts/palette.ts:31`), and the first `pnpm test` failed on `exactScroll.ts`. The comment instead cites `docs/plan.md §2 #82` (whose row cites #1240) and `docs/slices/briefs/3.M-minimap-window-rework-3.md`, the round-3 brief, in the way `cutOnce.ts` cites its brief.
- **`farTop`'s `rendered` parameter is `Span` from `../../connectors`** (`{ top, bottom }`) rather than a new type, following TS6 (derive before declaring).
- **Small runtime difference:** `placeFarScroll` now always reads both `lineBlockAt(from).top` and `lineBlockAt(to).bottom`. The old inline `&&` skipped the second when the first comparison failed. Both reads are pure height-map lookups, so the result is unchanged.
- **#1249 taken up** as the brief allowed: each entry of `everyPane()` is on its own line, with the tooltip comment above `tooltips(...)`.
- **For the orchestrator:**
  - The project map (`editor` line, beside `cutOnce`) should name `exactScroll` (`farTop`: when a far scroll is pinned) for `just map-check` (PM6).
  - `scrollSync` there now means only the locked scroll.
  - `docs/architecture.md` may want the same note.
- **Scratch files:** the repro scripts are in `/tmp/yamt-m/r4/` (`fresh.sh`, `press.sh`); `press.sh` reuses `/tmp/yamt-m/r3/pressprobe.js`. `target/debug/yamt` was built in this worktree only.

**open_risks**
- `frontend/src/editor/internal/exactScroll.ts:38-40`: if the next retro wants the issue number written out in source, it needs a form the palette detector accepts.
- `pnpm -C frontend test:browser` was not run (not in the brief's recipes, and it cannot launch here per #1242).
- The real-app repro covered only the round-3 row 151 press and the D1 scripted write, as the Acceptance asks. The other round-3 rows were not repeated.