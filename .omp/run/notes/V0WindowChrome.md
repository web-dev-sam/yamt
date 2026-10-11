# Implementer report V0WindowChrome

## deviations_from_brief
[
  "Where the taken side is stored: one map, `taken: ShallowRef<ReadonlyMap<string, Side>>`, owns 'which side was taken' for both choices and deleted-side text files. `Choice.taken` is gone: `choices` is now `readonly FileSides[]` and ChoiceView takes props `{ sides, taken, shown }` (App passes `taken.get(path) ?? null`). takeSide sets the entry; reset deletes it. The brief said 'next to the choices' taken'; I chose this because it gives exactly one owner and it saved the store lines it needed.",
  "store.ts split, to stay at or under 300 lines and every function at or under 40: the one-question-at-a-time mechanism (ask/answer/question) moved unchanged into the new `ui/asking.ts` (`createAsking()`), owned by the store state. Also inside store.ts: a shared `Refs` type (AppStore's refs are derived as `Readonly<Refs[K]>`), a named `Actions` type with an `actions(state)` builder, track/untrack/dismissProblem inlined, and loadFiles reusing refreshFiles. store.ts is now exactly 300 lines.",
  "New files (for the project map): ui/asking.ts, ui/nextFile.ts, ui/nextFile.test.ts, ui/sideHeaders.test.ts. No new component (VU15). `SIDE_HEADERS` is replaced by `sideHeader(side, remote) → { text, tooltip }` in the same file, ui/sideHeaders.ts.",
  "Sentences and labels shown. Toolbar: 'Mark resolved'. Result header: 'Result' + 'Reset'. Headers: 'Local (yours)'; 'Remote (theirs)'; 'Remote (theirs): <branch>'; 'Remote (theirs): <short id> <subject>' (tooltip = full message; the other headers repeat their text as tooltip). Deleted-side view: 'Keep', 'Delete', 'Deleted in this branch.', 'Resolved by deleting the file.'. Choice Result column: 'Take the left or the right version.' / 'Keep the file or delete it.' before a choice; 'Resolved with the left version.' / 'Resolved with the right version.' / 'Resolved by deleting the file.' after. File list handle: role=separator, aria-label 'File list width'. The words live in choiceText.ts: exported constants DELETED_SENTENCE, KEEP, DELETE, DELETED_LINE; `resultLine(sides, taken)` exported; `resolvedLine` now private.",
  "How focus is detected: `useWindowFocus()` from @vueuse/core in App.vue; a `watch` calls `store.refreshFiles()` when it turns true. Checked in the real app (X11 on Xvfb): page blur/focus events fired and the mark updated. Not checked under KWin Wayland.",
  "The remote name is asked for once in main.ts (`void store.loadRemoteName()`) next to loadFiles. A rejection logs warn `store.remote_name_failed`; no problem bar.",
  "The `list` problem's cause widened from `Unexpected` to `ProblemCause`, since listFiles can now return a typed IpcError.",
  "A deleted-side text file's toolbar bar is empty: besides Mark resolved, apply, undo and redo, I also hid the status line, whose chunk counts mean nothing in read-only mode. Such files are not registered with `store.track` (read-only, nothing unsaved), so applying the kept text never triggers the exit question.",
  "Read-only mode is decided in useMergeController's createController: `{ readOnly: data.deleted !== null }`. MergeView shows the kept text with a watch: when the taken side is the kept side and the controller exists, it calls `applyAllNonConflicting(kept)`.",
  "Next file moves only when the acted-on file is still the active one (guards a switch made while the IPC call was in flight).",
  "File list width is component-local state in FileList.vue. The pointer position is stored raw, and CSS `min-w-40 max-w-[50vw]` keeps the width between 10rem and half the window, so resizing the window still respects it. Pointer capture on the handle; no window listeners.",
  "What 3.G gave in practice: docs/removed.md arrives with `unsupported: null` and `deleted: \"remote\"`, so loadFiles now opens it first, being the first file the editor can show. Closing the window prints `yamt: 4 of 4 files still unresolved` with 7 files listed (Rust's count, not touched).",
  "Change needed outside my slice: the strict `deleted` key breaks 7 editor test files that build fixture records by hand (apply, chunkField, decorations, pane, sides, tone, words). I asked V0EditorFindDragR2; it added `deleted: null,` to all seven in its round-2 patch. pnpm test fails in this worktree until that patch is merged; the combined tree passes 320/320.",
  "Smoke environment: a private Xvfb display (:57) instead of the Samsung screen, so X focus could be moved with xdotool and an xmessage window. The close request came from a throwaway WM_DELETE_WINDOW sender compiled in /tmp (removed), because WebDriver's close-window ends the app without the close flow."
]

## open_risks
[
  {
    "location": "frontend/src/ui/store.ts:1-300",
    "risk": "The file is exactly at the 300-line max-lines limit. The next addition needs another split; the natural seam is the unsaved-work and close guard (track/untrack/unsavedFiles/mayClose/watchWindowClose)."
  },
  {
    "location": "frontend/src/ui/MergeView.vue:57-72",
    "risk": "The kept text is applied by a watch on `keptShown`, which uses `summary !== null` to mean 'the controller exists'. If a controller were rebuilt while the side stays taken (only reset rebuilds today, and reset clears the side), the watch would not fire again."
  },
  {
    "location": "frontend/src/ui/App.vue:28-34",
    "risk": "useWindowFocus was checked on X11 (Xvfb). Not observed under KWin Wayland, the owner's session."
  },
  {
    "location": "frontend/src/ipc/fixture.ts:87",
    "risk": "The strict `deleted` key fails every hand-written fixture record without it. Green only once V0EditorFindDragR2's round-2 patch (deleted: null in seven editor tests) is merged together with this slice."
  },
  {
    "location": "src-tauri (3.G, not touched)",
    "risk": "Exit message `yamt: 4 of 4 files still unresolved` while the list shows 7 files: the denominator appears to count only git's current unmerged files. Owned by Rust."
  }
]

## smoke_evidence
[
  {
    "command": "pnpm -C frontend lint && pnpm -C frontend typecheck && pnpm -C frontend test",
    "observed": "lint: `$ oxlint --type-aware && eslint --max-warnings 0 \"src/**/*.vue\"` exit 0. typecheck: `$ vue-tsc -b` exit 0. test in this worktree: `Test Files  7 failed | 24 passed (31)`, chain exit=1. All 35 failures are editor tests: `Error: fixture synthetic.json: × Invalid key: Expected \"deleted\" but received undefined` (34) and the same for `selection.json` (1), in editor/internal/{apply,chunkField,decorations,pane,sides,tone,words}.test.ts. Those are hand-written records without the new required `deleted` key. V0EditorFindDragR2 added `deleted: null` to all seven in its round-2 patch (I may not edit editor/)."
  },
  {
    "command": "rsync my frontend + V0EditorFindDragR2's frontend/src/editor/ into /tmp/yamt-3w-combined/frontend (scratch, removed); pnpm exec vitest run --project node; pnpm exec vue-tsc -b",
    "observed": "`Test Files  31 passed (31)` `Tests  320 passed (320)`; tsc=0"
  },
  {
    "command": "pnpm -C frontend fmt:check && pnpm -C frontend unused && pnpm -C frontend sfc-order",
    "observed": "`All matched files use the correct format.` `Finished in 425ms on 101 files using 24 threads.` / `$ knip --include exports,types` / `$ tsx scripts/check-sfc-order.ts` → exit=0"
  },
  {
    "command": "scripts/conflict-repo.sh /tmp/yamt-smoke-3w; cargo tauri build --debug --no-bundle (embedded frontend, VITE_CHUNK_SOURCE=tauri); Xvfb :57 + tauri-driver --port 4544 --native-port 4545; WebDriver session with tauri:options {application: target/debug/yamt, args: [--repo, /tmp/yamt-smoke-3w]}, window 1600x900",
    "observed": "`Finished dev profile … Built application at: …/target/debug/yamt`. Visible h2 headers: `Local (yours) | title=Local (yours)`, `Remote (theirs): remote | title=Remote (theirs): remote`, `Result`. The file list shows 7 files; docs/removed.md opens first (it is now the first file the editor can show)."
  },
  {
    "command": "WebDriver: inspect docs/removed.md view; screenshot /tmp/yamt-smoke-3w/deleted-side-before.png",
    "observed": "Buttons [`Keep`, `Reset (disabled)`, `Delete`]. Section text: `Local (yours) Keep … # Removed / local text …` (left pane, line 3 highlighted with the word mark on 'local'), middle `# Removed / base text`, right column `Deleted in this branch.` + `Delete`. The toolbar bar is empty. Screenshot confirms."
  },
  {
    "command": "WebDriver: click Keep",
    "observed": "`active: notes/crlf.txt`, marks show `docs/removed.md resolved`. `git ls-files -s docs/removed.md` → `100644 63d4fa5… 0 docs/removed.md`; worktree file holds `local text`."
  },
  {
    "command": "WebDriver: toolbar on notes/crlf.txt; screenshot /tmp/yamt-smoke-3w/toolbar-outlined.png",
    "observed": "Header children in order: `Mark resolved [mr-2 rounded border px-3.5 py-1 border-control-border hover:bg-hover]`, apply-left, apply-right, Undo, Redo, `1 conflict`. Screenshot: outlined Mark resolved at the left end next to the file list; Result header holds `Result` + `Reset`."
  },
  {
    "command": "WebDriver actions: click » on the left strip, × on the right strip; screenshot /tmp/yamt-smoke-3w/toolbar-blue.png",
    "observed": "`mr-2 rounded border px-3.5 py-1 border-primary bg-primary text-on-primary hover:brightness-110 / Mark resolved All changes processed`. Screenshot shows a filled blue button."
  },
  {
    "command": "WebDriver: click Mark resolved",
    "observed": "`active: packages-private/sfc-playground/src/App.vue`, `notes/crlf.txt resolved`. `git ls-files -u` no longer lists notes/crlf.txt."
  },
  {
    "command": "WebDriver: open docs/removed.md again; screenshot deleted-side-kept.png; click Reset",
    "observed": "After Keep: center `# Removed\\n\\nlocal text\\n\\n`, buttons [`Reset`]. After Reset: center `# Removed\\n\\nbase text\\n\\n`, buttons [`Keep`, `Reset (disabled)`, `Delete`], mark unresolved. `git ls-files -s` shows stages 1 and 2 again. Screenshot deleted-side-after-reset.png."
  },
  {
    "command": "WebDriver: Delete on docs/removed.md, come back; screenshot deleted-side-deleted.png; Reset",
    "observed": "`activeAfter: packages-private/sfc-playground/src/App.vue` (moved on). Back on the file: middle column reads `Resolved by deleting the file.`, right column `Deleted in this branch.`, no Keep/Delete. `git ls-files -s docs/removed.md` empty and docs/ gone. Reset brings stages 1 and 2 back."
  },
  {
    "command": "WebDriver: open assets/logo.bin; screenshot /tmp/yamt-smoke-3w/choice-before.png; Take right; reopen; screenshot choice-taken.png",
    "observed": "Before: `Local (yours) A binary file, 10 B. Take left Remote (theirs): remote A binary file, 11 B. Take right Result Reset Take the left or the right version.`, buttons [`Take left`, `Take right`, `Reset (disabled)`]; three columns, empty bar above. After Take right: moved on to docs/removed.md. Back on logo.bin: `… Result Reset Resolved with the right version.`, buttons [`Reset`]."
  },
  {
    "command": "git -C /tmp/yamt-smoke-3w add src/added.ts; DISPLAY=:57 xdotool windowfocus <xmessage window>; then windowfocus <yamt window>; page focus log installed through WebDriver",
    "observed": "After blur: `log: [\"blur\"]`, `hasFocus: false`, mark still `src/added.ts`. After refocus: `log: [\"blur\",\"focus\"]`, `hasFocus: true`, marks `src/added.ts resolved`, `active: assets/logo.bin resolved` (unchanged), `problem: null`."
  },
  {
    "command": "WebDriver actions: drag the file list handle 240→520, 520→1400, 800→20, 160→420; screenshots file-list-wider.png, toolbar-wider-list.png",
    "observed": "Start `240 cursor=col-resize`. After the first drag `{list: 520, view: 520}`. Dragging past half `{maxed: 800, window: 1600}`; below the minimum `{minned: 160}` (10rem). Screenshot after the last drag shows a ~420px list. vOn.ts opened afterwards with panes and connectors drawn at the new width."
  },
  {
    "command": "env -u WAYLAND_DISPLAY DISPLAY=:57 GDK_BACKEND=x11 bash -c 'target/debug/yamt --repo /tmp/yamt-smoke-3w; echo \"exit status: $?\"'; send WM_DELETE_WINDOW to its window (throwaway Xlib sender in /tmp, removed)",
    "observed": "`yamt: 4 of 4 files still unresolved` / `exit status: 1`. Closing through WebDriver's DELETE /window earlier ended the app without that line, so the exit status comes from this direct run."
  },
  {
    "command": "stop everything started",
    "observed": "WebDriver session deleted. tauri-driver-3w, xmessage-3w and xvfb-3w services stopped; the yamt-app-3w run exited. Scratch dirs /tmp/yamt-3w-wd and /tmp/yamt-3w-combined removed. Screenshots kept in /tmp/yamt-smoke-3w/*.png."
  }
]

## orchestrator note
The exit message 'yamt: 4 of 4 files still unresolved' came from a fresh app started after 3 files were already resolved in the earlier session: a new session only lists files git still has unmerged, so 4 of 4 is right (outcome.rs uses session.files().len()). Not a bug.
The 7 editor test records needing `deleted: null` were added by V0EditorFindDragR2 and landed in af5461e.
