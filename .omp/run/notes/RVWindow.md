The range window's root is built: `RangeApp`, `RangeView`, `RangeFileRow`, the store, the words, the editor seam, the `main.ts` switch, fence PM9 and the app-session options. The node tests, the 15 WebKit steps and the four real-app steps all passed. `pnpm -C frontend unused` and `just map-check` still fail because of docs and ipc files that aren't mine (details under deviations and open_risks).

```
summary
  A third root: main.ts switches exhaustively over merge|compare|range (app: data-window; fixture: ?range[=case], then ?diff).
  startRange builds createTauriRangeSource or createFixtureRangeSource, createRangeStore, startUp and RangeApp. No LanguageServers, no merge or compare store, no close guard.
  New ui files: RangeApp.vue (FileList + RangeFileRow, the visited RangeViews, ProblemBar, SettingsView, QuestionDialog, theme, Ctrl/Cmd+B, settings reload on focus),
    RangeView.vue, RangeFileRow.vue, rangeStore.ts (MOUNTED_FILES = 16), rangeText.ts, useRangeController.ts (followRange + useRangeController).
  Fence PM9 and the PM7 addition come from one root table in fences.ts. app-session has start-app --range <r> --repo <dir> and start-fixture --range-case <case>;
    the start-command parsing moved to the granted startArgs.ts.

files_changed
  frontend/src/main.ts
  frontend/src/ui/RangeApp.vue (new)
  frontend/src/ui/RangeView.vue (new)
  frontend/src/ui/RangeFileRow.vue (new)
  frontend/src/ui/rangeStore.ts (new), rangeStore.test.ts (new)
  frontend/src/ui/rangeText.ts (new), rangeText.test.ts (new)
  frontend/src/ui/useRangeController.ts (new), useRangeController.test.ts (new)
  frontend/src/ui/AGENTS.md
  frontend/scripts/fences.ts, frontend/scripts/fences.test.ts
  frontend/scripts/app-session/args.ts, args.test.ts, start.ts, startArgs.ts (new, granted by Main)

tests_added
  rangeStore.test.ts (14 tests):
    - no store before create
    - first file shown at start, mounted alone, settings seam registered
    - an empty range shows none
    - state before openRange answers: files screen, start-theme preferences, showFile does nothing, a load failure names "file 3"
    - a failed openRange → "Could not open the range: …"
    - showFile from settings returns to files
    - closeSettings, and an unknown path changes nothing
    - showing a visited file again keeps the order
    - the 17th file drops the least recently shown and keeps the others' order (twice)
    - a failed load reports open with its path and leaves visited; another file's success keeps the problem; the same file's later success clears it
    - after a failure, the next eviction drops the least recent mounted file
    - dismissProblem clears the problem
    - Ctrl+B toggles, but not while a clash question waits
    - answer settles the question
  rangeText.test.ts:
    - side labels: named, merge base, HEAD; headings with short ids
    - the empty-range sentence (the exact words from the brief)
    - renamed header "old → new"; every change's letter and word
    - counts "+n −m" or none
    - the mode note
    - every RangeFile sentence, 13 cases
  useRangeController.test.ts (followRange with a fake build):
    - one build with path, texts and preferences; the columns note
    - waits for its hosts, builds once, follows preferences and arrows, destroyed on unmount
    - each of the 6 sentence kinds builds nothing and shows its sentence; the exact binary words
    - a reply after unmount is dropped
    - a failed load stays loading
    - preferences set before the build reach the build
  fences.test.ts:
    - PM9 violations: merge root, compare root and lsp/, from .ts, .vue and .test.ts files
    - PM7: compare files importing rangeStore / RangeApp.vue
    - range files importing shared ui files violate nothing
  args.test.ts:
    - --range opens the range on --repo
    - --range needs --repo and refuses --fresh-repo and --diff
    - --range-case gives ?range=<encoded>, refuses --diff and --diff-case, and needs a value

smoke_evidence
  Worktree (/home/wds/.omp/wt/t9f912e506/m):
    - pnpm -C frontend typecheck → `$ vue-tsc -b`, exit 0
    - pnpm -C frontend lint → `$ oxlint --type-aware && eslint …`, exit 0
    - pnpm -C frontend test → Test Files 159 passed (159), Tests 2069 passed (2069)
    - sfc-order → exit 0; fmt:check → "All matched files use the correct format."
    - pnpm -C frontend unused → fails only on RangeSideLabel (src/ipc/index.ts:92, src/ipc/rangeDomain.ts:6), which is not mine
  Stryker (--mutate on rangeStore.ts, rangeText.ts, useRangeController.ts, --ignoreStatic):
    - rangeStore.ts 100.00 % (127 killed)
    - rangeText.ts 59 killed, 0 survived; 2 no-coverage on the `never` default
    - useRangeController.ts 2 survivors (flush:"post" → {} or ""), only observable with a real DOM; 19 no-coverage in the useRangeController/shownHosts wrapper, which builds a real RangeController
    - fences.ts and the app-session files were not run through Stryker
  WebKit (MiniBrowser through app-session start-fixture + just webdriver) ran in /tmp/rvwin: a copy of this worktree plus a766541's frontend/fixtures/range/ and scripts/range-repo.sh. Screenshots are in /tmp/rvwin-shots/.
    1. Marks and counts: rows "M config +1 −1", "A data/big.txt +1 −0", "R docs/keys.md docs/shortcuts.md +2 −0", "D src/api/mockBoards.ts +0 −43", "M public/logo.png" (no counts). Letter titles modified/added/renamed/deleted. 01-list.png.
    2. Tree: "View as tree" → data, big.txt, docs, current.md, keys.md docs/shortcuts.md, … (02-tree.png).
    3. Width: drag "File list width" +120 → aside width 360 (03-wide.png). The dots during the drag were not captured.
    4. Ctrl+B → aside display "none"; again → "flex".
    5. First file shown at start: header "config", row aria-selected true, sentence "Changed from a file to a symbolic link."
    6. Renamed header: "docs/shortcuts.md → docs/keys.md".
    7. Added reminders.ts: left 1 empty line, right 13 lines. Deleted mockBoards.ts: left 45, right empty.
    8. Sentences: "Larger than 8 MiB: not shown."; "Neither side is UTF-8 text."; "Binary file: not shown."; "Only the file mode changed: file → executable file.";
       "Submodule: 1111…1111 → 2222…2222"; kind change as in 5. Texts plus mode: header "tools/deploy.sh Mode changed: file → executable file".
    9. board.ts: per column words 1, removals 1, chunk lines 3 and 4; strip paths 1. Removal bar hover tooltip ` | { kind: "reminded"; … };` (09-board.png, 09-tooltip.png).
    10. Locked scroll: left scrollTop 1200 → right 1220.
    11. Find: left Ctrl+F "Board" → "58 of 161"; right Ctrl+F "remind" → "1 of 22", left panel closed.
    12. Arrows: Next ×3 → "| { kind: \"restored\"…", "if (from.id !== to.id) {", "const card = createCard(…"; Previous → back to "if (from.id !== to.id) {".
    13. Syntax: "import" rgb(224, 152, 107) against the line colour rgb(196, 194, 206), both columns.
    14. Gear → SettingsView (Theme, Antialiasing, Keymap; no "Language servers"; 14-settings.png) → Back → header "src/board/board.ts".
    15. --range-case empty → "feature (9c1ba3f) and feature (9c1ba3f) have the same files.", 0 rows (15-empty.png).
  Real app ran in /tmp/rvwin: debug build `cargo tauri build --debug --no-bundle` of that copy; repository from its scripts/range-repo.sh /var/tmp/rr-rvwindow.
    - Title: xdotool getwindowname → "main...feature — rr-rvwindow — yamt"; <html data-window="range">.
    - Headers (main...feature): "merge base of main and feature (531ea52)", hover "Build tools, the old notes and the vendored UI kit"; "feature (9c1ba3f)", hover "New logo, staging config and release tools".
    - Two vs three dots: main..feature lists 14 rows, the first "M README.md +1 −2", left header "main (4378055)" / "README: swimlanes"; main...feature lists 13 rows without README.md.
    - Close: launched directly on a private Xvfb :97; WM_DELETE_WINDOW sent at 12:53:18.35 by a throwaway ctypes sender (/tmp/rvwin-shots/wmclose.py) → process printed "exit 0" at once (whole run 9.17 s, started ~12:53:09).
    - Cleanup: no yamt, Xvfb, tauri-driver or WebKitWebDriver of mine left.

deviations_from_brief
  - frontend/scripts/app-session/startArgs.ts (new, granted by Main): args.ts would have been 329 lines, over the 300 cap. Start-app/start-fixture parsing moved there. args.ts keeps
    `export type { Recording } from "./startArgs"` because video.ts (not mine) imports Recording from ./args. To drop the re-export, change video.ts:5 to `import type { Recording } from "./startArgs";`.
    The project-map line for startArgs.ts is Main's.
  - fences.ts: the PM7/PM9 file test is now one case-insensitive pattern, (use)?(compare|range)…\.(ts|vue). It is slightly broader than before (it also matches e.g. compareX.vue and CompareX.ts) and is symmetric:
    each root is barred from the other roots' store/App files, all from lsp/. I made this change to keep fences.ts under 300 lines.
  - Contract choice: showFile(path) takes a path, because the shared FileList emits a path. shown is still a RangeFileId; the store adds a computed shownPath for `active`.
  - A failed openRange reports {action:"open", path:"the range"} ("Could not open the range: …"). No Problem kind fits and problem.ts is not mine. A loadFile for an id outside the list names it "file <id>".
  - "A later success clears the problem" is read as that same file's success; another file's success keeps it.
  - rangeText.fileHeading takes Pick<RangeEntry,"path"|"change">, so tests need no branded id.
  - Added, not in the brief:
    - the empty range also shows a gear above its sentence, so Settings stays reachable;
    - the ↑/↓ buttons are disabled while a file shows a sentence or is loading;
    - a submodule added or removed reads "none" for the missing side.
  - The compare window has no previous/next-change keys (only buttons), so RangeView binds none: "as in the compare window".
  - ui/AGENTS.md also fixes stale notes from earlier slices: FileMark now goes through App's #file slot; PaneFrame, paste and themes now say "every root".
  - Not mine to edit, needed:
    - project-map/architecture lines for RangeApp, RangeView, RangeFileRow, rangeStore, rangeText, useRangeController and startArgs, plus the PM9 line;
    - map-check also lists RVIpc's ipc files and commands.
  - The /tmp route was used for every WebKit and real-app step, as Main directed. The patch has no unowned paths; .omp/run/slices.json and .omp/run/patches/* in git status are not my edits.

open_risks
  - frontend/src/ui/useRangeController.ts:84-88 (flush:"post") and :113-131 (useRangeController/shownHosts) have no node test that can tell the difference, because they need a DOM.
    They were exercised in WebKit and the real app; the Stryker survivors are listed above.
  - frontend/src/ipc/rangeDomain.ts:6 / ipc/index.ts:92: RangeSideLabel has no importer, so knip fails. rangeText reads the label through RangeSide; either drop the export or use the type.
  - frontend/scripts/app-session/start.ts:80-84: the range launch arguments have no unit test; they ran for real (`--diff=main...feature --repo …`).
  - frontend/src/ui/RangeFileRow.vue: in a narrow panel a renamed row truncates both its name and its old path ("docs/… docs/sho…" at 240 px).
  - The real-app binary was built before a no-behaviour simplification of rangeStore.ts (entryOf, eviction guard); node tests and Stryker cover the final code.
  - /var/tmp/rr-rvwindow is still there: bash-guard refuses rm -rf outside /tmp.
```