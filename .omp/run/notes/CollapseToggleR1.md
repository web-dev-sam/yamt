# CollapseToggleR1 — 3.V-toggle round 2 (board "Unchanged lines, part 2" row 3)

Brief `docs/slices/briefs/3.V-toggle-rework-1.md`. Verbatim report below. Orchestrator: the brief's 'Ctrl+B … survives a reload' was the orchestrator's error (plan §2 #61: whether the list shows is never stored); the implementer checked the stored list/tree view instead — accepted.

---

The three review blocks (#870, #871, #872) are fixed in the owned files, and behaviour is unchanged. One acceptance line can't pass as written: Ctrl+B still hides the file list, but the list comes back after a reload. Plan §2 #61 says that state is never stored, and none of the files I touched handle it. All six `pnpm -C frontend` recipes exit 0.

```
summary
  - scrollSync.ts imports PANES from ./geometry; its own pane list is gone (#870).
  - MergeToolbar.vue: the IconButton field `pressed` is now `selected`. The template renders `button.selected?.value`
    as aria-pressed in one place; the copied `ariaPressed` is gone; `pressed()` is still only the mousedown handler (#871).
  - New ui/windowStorage.ts `storedValue<T>(key, fallback, { read, write }, warnEvent, storage?)` sets the three
    options once: sync flush, defaults not written, failures logged under the caller's event.
    createCollapsing, createHiddenButtons and createFileListMode call it; none of them call useStorage any more (#872).

files_changed
  frontend/src/editor/internal/scrollSync.ts
  frontend/src/ui/MergeToolbar.vue
  frontend/src/ui/collapsing.ts
  frontend/src/ui/toolbarButtons.ts
  frontend/src/ui/fileListMode.ts
  frontend/src/ui/windowStorage.ts (new)
  frontend/src/ui/windowStorage.test.ts (new)

tests_added
  windowStorage.test.ts:
    "a missing key gives the fallback and writes nothing"  — writeDefaults: false
    "a stored value is read through the caller's read"     — serializer.read is used
    "a change is written through the caller's write before the assignment returns" — flush: "sync" + serializer.write
    "a storage that throws gives the fallback and logs under the caller's event name" — onError + warnEvent, read and write paths
  The three callers' tests (collapsing, toolbarButtons, fileListMode) are unchanged.

smoke_evidence
  A1 failing paths (each one removed from windowStorage.ts by hand, `pnpm -C frontend exec vitest run --project node src/ui/windowStorage.test.ts`, then put back):
    flush removed        → "× a change is written through the caller's write before the assignment returns", "× a storage that throws …"; Tests 2 failed | 2 passed
    writeDefaults removed → "× a missing key gives the fallback and writes nothing"; Tests 1 failed | 3 passed
    onError removed      → "× a storage that throws gives the fallback and logs under the caller's event name"; 1 failed
    event fixed to "storage_failed" → same test fails; 1 failed
    Restored: file hash back to #F822 (the as-written version).
  Mutation testing (the web command of `just mutants`, run directly because windowStorage.ts is untracked and
  `git diff --diff-filter=AM` would skip it):
    `stryker run … --mutate src/ui/windowStorage.ts,src/ui/collapsing.ts,src/ui/toolbarButtons.ts,src/ui/fileListMode.ts --ignoreStatic`
    windowStorage.ts 100.00 (6 killed), fileListMode.ts 100.00, collapsing.ts 92.86, toolbarButtons.ts 85.71.
    6 mutants survived, none on lines I wrote: collapsing.ts:11 STORAGE_KEY; toolbarButtons.ts:23 STORAGE_KEY;
    toolbarButtons.ts:26 HIDDEN_AT_FIRST ×3 (these four are module-level constants, #732);
    toolbarButtons.ts:31 catch body `{}` (also existed before this change).
  A2 WebKit (fixture page, `tsx scripts/app-session.ts start-fixture --name tgl`, MiniBrowser; real clicks by WebDriver):
    fresh: stored null, toggle aria-pressed "true"
    click toggle → {"stored":"false","btn":"false","waves":0}; the other buttons' aria-pressed is null
    reload → {"stored":"false","btn":"false","waves":0}   (off survives a reload)
    click toggle → {"stored":"true","btn":"true","waves":22}; screenshot /tmp/tgl-on.png shows the pressed tint
    right-click on the toolbar (pointer button 2) → 7 items: Previous change|true, Next change|true, Collapse unchanged
      fragments|true, Apply … left|true, Apply … right|true, Undo|false, Redo|false
    Escape, Ctrl+B → the "Files" heading is not visible (file list hidden)
    reload → "Files" visible again, localStorage only "yamt.collapse.unchanged=true" (see deviations)
    "View as tree" → yamt.files.view "tree"; reload → still "tree", button "View as list", 11 tree items
    menu → show Undo; reload → yamt.toolbar.hidden ["redo"], Undo button shown
    Session stopped (vite and webdriver stopped).
  A3 pnpm -C frontend: lint exit 0; typecheck exit 0; test "Tests  799 passed (799)" exit 0; unused exit 0;
    fmt:check "All matched files use the correct format." exit 0; sfc-order exit 0.

deviations_from_brief
  - Acceptance 2, "Ctrl+B … survives a reload": the list is hidden after Ctrl+B but shown again after a reload.
    This matches the project map's state table and plan §2 #61 ("fileListShown … true at every start (never stored)"),
    and the code behind it is not in the owned files. The per-window choice that fileListMode.ts stores (list or tree)
    does survive a reload. I take that to be what the line meant [INFERENCE].
  - storedValue takes key and warnEvent as two positional strings, as the brief's signature says, though TS7 would want an
    object parameter for two strings that can be swapped. I followed the brief's signature.
  - Ran `pnpm -C frontend install --frozen-lockfile --offline` in the worktree because it had no node_modules (gitignored).
  - The project map's ui line and docs/architecture.md should name `windowStorage.ts (storedValue: values kept in the window's
    storage: sync flush, defaults not written, failures logged under the caller's event)`, or `just map-check` (PM6) will
    flag the new file. Both files are outside my owned set.

open_risks
  - frontend/src/ui/windowStorage.test.ts:65-91: the write path's warning says "storage disabled" (vueuse reads the old
    value through getItem before setItem), so the test pins that vueuse detail.
  - frontend/src/ui/windowStorage.ts:13: returns Ref<T> instead of vueuse's RemovableRef<T>; typecheck passes. The
    callers only read or assign the value.
```

Main should run `just map-check` after the doc line is added, and `just mutants 8183268` after the new files are added to git.