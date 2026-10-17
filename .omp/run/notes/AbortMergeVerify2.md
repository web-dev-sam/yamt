# AbortMergeVerify2 — final run 2, board "Abort merge" row 5 (after owner correction #1091)

Brief `docs/slices/briefs/3.A-abort-verify-2.md`, at HEAD `17eead1`. Gate **pass** (`just check` exit 0, map ok, 10 goldens,
hooks 16/16). Env: rustc 1.99.0, node 24.22.0, pnpm 12.0.0. Debug build on Xvfb :78 + kwin_x11, xdotool, throwaway
HOME/XDG_CONFIG_HOME/XDG_DATA_HOME; exit status via `; echo EXITSTATUS $?`.

## Mutants (`just mutants 407ec81`)
Rust 16 caught, 0 missed, 25 unviable. Stryker 815 killed, 92 survived, 16 no coverage; aborting.ts 33/33. Since run 1 only
aborting.ts and toolbarButtons.ts changed; toolbarButtons.ts 11 survivors: `catch` equivalent; ten module constants sent
back by the verifier → #1097: orchestrator applied three by hand on a scratch copy — abortMerge:false 16 tests fail,
previous:true 10 fail, STORAGE_KEY "" 9 fail → dropped (b).

## Real app
a. Fresh storage: header Files + toggle; no button; menu 8 entries, Abort merge first unchecked (Undo, Redo unchecked);
   chosen → right after Mark resolved, on another file too; kept after restart. Close → exit 1 "7 of 7".
b. Mark resolved one file, unsaved edit in App.vue; Escape → repo unchanged, Down draws/moves the side's outline; Cancel →
   unchanged, Down moves the outline; Abort Merge → gone < 4 s, no unsaved question, `yamt: merge aborted`, EXITSTATUS 1;
   status empty, diff --stat HEAD empty, no MERGE_HEAD, HEAD unchanged. (Clicking into the left pane showed no outline at
   once: the outline appears on the first Down, the existing #54 behaviour.)
c. Old storage `["undo"]` seeded in the WebKit storage (sqlite3, UTF-16LE): Undo hidden, Redo shown, Abort merge hidden;
   menu checks match.
d. Cherry-pick stop with Abort merge chosen in storage: menu 7 entries, no button; exit 1.
e. Refusal (Mark resolved, edit, Ctrl+S → MM): "Could not abort the merge: … not uptodate …", app stays, repo unchanged,
   `store.abort_failed kind=Git` logged; close → exit 1 "6 of 7".
Screenshots /tmp/a-yamt-abort-verify-2/ (dark and light). Everything it started stopped.
