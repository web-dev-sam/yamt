# SaveWeb (3.Z-web, board row 7) — committed 536b621

I've built slice 3.Z-web. Ctrl/Cmd+S now formats the Result and writes it to disk unstaged, a dot marks unsaved work, and the close question asks only when there is unsaved work. All acceptance items were observed and the layer recipes exit 0. Two of the WebKit checks ran in the real app rather than on the fixture page, because the fixture page cannot show them (see deviation 9). `just map-check` will fail until docs I don't own name the new files (deviation 10).

```
summary
  The Save key (default Ctrl/Cmd+S, rebindable) saves the shown editable file: format → snapshot → `saveFile`. It writes the decided parts as shown, waiting one-sided changes as their side's lines, and waiting conflicts as git's markers in the file's own line breaks.
  editor/internal/fileText.ts builds the file text with one ChangeSet over the Result, no transaction. editor/internal/savedPoint.ts holds the saved point: the Result text and every status. MergeController exposes snapshot() and onUnsavedChange.
  Unsaved means the text or a status differs from the last save, or there is typing inside a change whose sides all still wait. Undoing back clears it; typing during a write keeps it.
  ui/saving.ts holds store.save, store.formatOutcomes, Mark resolved (finish, moved from store.ts) and the one-write-per-file claim (`writing`). The Result header shows the dot; the close question uses the new words.
  Carried findings fixed: #887 (fixture.save now logs `text`), #889 (one `WriteRequest` type for finishFile and saveFile).

files_changed
  frontend/src/editor/index.ts, editor/AGENTS.md, editor/internal/apply.ts, editor/problems.browser.test.ts
  frontend/src/editor/internal/fileText.ts (new), fileText.test.ts (new), savedPoint.ts (new), savedPoint.test.ts (new)
  frontend/src/ipc/keys.ts, keys.test.ts, ChunkSource.ts, index.ts, fixture.ts, fixture.test.ts
  frontend/src/ui/saving.ts (new), store.ts, store.test.ts, useMergeController.ts, useMergeController.test.ts, closeGuard.ts, MergeView.vue, question.ts, question.test.ts, keyText.ts, keyText.test.ts, problem.ts, problemText.ts, problemText.test.ts

tests_added
  fileText.test.ts:
    both sides waiting → git's markers (diff3 base section kept), in Lf and in CrLf (CRLF marker lines)
    a waiting one-sided change → its side's lines; typing inside it is not written, typing outside is
    decided changes → written as shown, typing included
    half-decided conflict → the decided section holds the Result's lines (typing included), the waiting side its own; also with the other side ignored
    a change at the end of a file without a final line break (conflict, emptied side, replaced line) → still no final line break
    insertion-point conflict, mid-file and at a file end without a line break
    a conflict with an empty side → that section is empty
    AsShown → written as shown, typing included
    a line break deleted at a waiting change's edge is written back, so no marker shares a line
  savedPoint.test.ts:
    type → dot; undo → none (listener hears [true, false])
    ignoring a one-sided change → dot, with the text unchanged
    apply + undo → none
    save clears the dot; undo past the save lights it again
    typing during the write keeps the dot
    typing inside a fully waiting one-sided change or conflict → dot stays after save; deciding the change, then saving, clears it
    typing in the decided section of a half-decided conflict → a save clears the dot
    once the listener is set to null it hears nothing more
  store.test.ts (store.save):
    Written → file text sent (taken after format, so format edits are included), markSaved, files updated, formatOutcomes set
    a file git lists as Resolved → writes asShown
    no dot, or no snapshot → format runs, nothing is sent
    a format refusal ("failed") → still saved; a null outcome records nothing
    a second save while one is in flight is ignored, a save of another file goes on, and typing during the write keeps the dot
    a save during a reset or a finish of the same file is ignored
    a finish that ends during a save leaves the save's claim in place
    ChangedOnDisk → nothing marked saved, notice shown, file reloaded
    error → problem {action:"save"}, log store.save_failed, the words "Could not save a.ts: writing a.ts failed: disk full"; the next save clears it
  The existing "closing asks only with unsaved work" test still passes against FileWork = { unsaved() }.
  Key, key-text and wording tests:
    keys.test: "save" in KEY_ACTIONS order; default Mod-s; Ctrl+S on Linux and ⌘S on macOS press it, ⌃S on macOS does not
    keyText.test: Save's name, place and group; Ctrl/⌘S clashes with Save
    question.test: the new exit wording, exact
    problemText.test: the save wording
  fixture.test: fixture.save logs {path, text, length, lines}.
  useMergeController.test: `unsaved` follows the editor and resets to false on a rebuild or dispose; snapshot comes from the live editor, null without one.

smoke_evidence
  Acceptance 1 (node tests, failing-path proofs: rule broken in place, test file run, file restored and re-run green):
    fileText.ts, 5 rules broken at once (isResolved check skipped, decided section uses side lines, no restored or omitted line breaks, "\n" join) →
      "× … every line ending in the file's own break (CrLf)"  expected 'a\n<<<<<<< HEAD\nL…' to be 'a\r\n<<<<<<< HEAD\r\nL…'
      "× decided changes are written as shown, typing included"
      "× a half-decided conflict keeps its markers …"
      "× a change at the end of a file without a final line break …"
      "× an insertion-point conflict …"  expected 'a<<<<<<< ours\n…'
      "× a line break deleted at a waiting change's edge …"
      "Tests  6 failed | 4 passed (10)"; restored → "Tests  10 passed (10)"
    savedPoint.ts, 3 rules broken (statuses not compared, decided check dropped, markSaved uses the current state) →
      × ignoring a one-sided change…, × typing during the write…, × typing inside a one-sided change…, × typing inside a conflict…, × typing in the decided section…
      "Tests  5 failed | 4 passed (9)"
    savedPoint.ts, the typing-inside check alone disabled → "× typing inside a one-sided change …", "× typing inside a conflict …", "Tests  2 failed | 7 passed (9)"; restored → "Tests  9 passed (9)"
    saving.ts, whileWriting deletes even when it did not claim → "× a finish that ends while a save of the same file runs leaves that save's claim in place 5012ms" (it hangs, then times out); restored → "Tests  92 passed (92)"
  Acceptance 2 (WebKit; user agent "AppleWebKit/605.1.15 … Version/60.5 Safari/605.1.15"; real keys and pointer through app-session/WebDriver):
    Fixture page (`app-session start-fixture`: `pnpm dev --port <free> --strictPort` + `just webdriver <free>`), file vueuse-use-magic-keys.ts:
      click in the Result, Ctrl+Home, type "// saved by yamt" → `<span role="img" title="Not saved" aria-label="Not saved" class="ml-auto size-2 shrink-0 rounded-full bg-fg">`, 8×8 px at x=1112 inside the header span 713–1132
      screenshot: /tmp/yamt-saveweb/dot.png (dot at the right end of the "Result | Reset" header)
      Ctrl+S → dot gone; log `[info] fixture.save {path: "vueuse-use-magic-keys.ts", text: "// saved by yamtimport type { ComputedRef } from 'vue-demi'\n…", length: 5196, lines: 197}`
        the text contains the waiting local one-sided change ("import type { MaybeComputedRef }") and one marker block:
        "<<<<<<< ours" / "  useEventListener(target, 'keydown', …" … "=======" / "  if (target) {" … "  }" / ">>>>>>> theirs"
      Ctrl+Z → dot back
      Ctrl+F, type "useEvent" (focus INPUT .find-field), Ctrl+S → a second fixture.save (text "import type { ComputedRef } …", the undone version); dot gone; the field still reads "useEvent"
    Real app (debug build `cargo tauri build --debug --no-bundle` → "Built application at …/target/debug/yamt"; `app-session start-app --fresh-repo` on private display :2):
      notes/crlf.txt: type "line four", Ctrl+S → dot gone; `od -c` shows "line one\r\n<<<<<<< HEAD\r\nline two, local\r\n=======\r\nline two, remote\r\n>>>>>>> remote\r\nline three\r\nline four"; `git ls-files -u` still has 3 stages; `git status` "UU notes/crlf.txt"
      Choice view (assets/logo.bin: "Take left" / "Take right" / "Reset"), Ctrl+S → logo.bin unchanged (mtime 1791996179, size 10, sha1 c69f4875… same), 3 stages, no problem bar
      Unsaved typing in notes/crlf.txt, then logo.bin shown, Ctrl+S → crlf.txt not written (mtime 1791996232, size 105 unchanged)
      Window close (WM_DELETE_WINDOW sent to window 2097156) → dialog text "Unsaved Changes\n\nThese files have changes that are not saved to disk. Exit without saving them?\n\nnotes/crlf.txt\nExit Without Saving\nCancel"; screenshot /tmp/yamt-saveweb/close-question.png; Cancel → dialog closed
      Ctrl+S, then window close → no question, "window gone"
    Sessions stopped: saveweb (vite, webdriver), saveapp (tauri-driver, xvfb).
  Acceptance 3: `pnpm lint && pnpm typecheck && pnpm unused && pnpm fmt:check && pnpm sfc-order && echo "ALL EXIT 0"` → "All matched files use the correct format." … "ALL EXIT 0"; `pnpm test` → "Test Files  85 passed (85) / Tests  1046 passed (1046)".

deviations_from_brief
  1. store.ts would have gone over oxlint's limits (300 lines per file, 40 per function).
     - finish moved into ui/saving.ts and returns whether it wrote; the store's finishThenMoveOn calls moveOn after it.
     - createRefs was pulled out of createAppStore.
     - store.ts is now 296 lines.
  2. `writing` claim, a decision the brief left open: only save is ignored while a write to the same path runs. finish and reset run as before, but take the claim only if it is free, and release only a claim they took.
  3. ipc/keys.ts went to 302 lines with "save". KeyAction is now derived as `(typeof KEY_ACTIONS)[number]` from an `as const` list, the same pattern as toolbarButtons.ts.
  4. MergeController.resultText() is removed, since nothing used it after the cutover. problems.browser.test.ts now uses snapshot().asShown(). MergeHandle.resultText, unsaved() and markSaved(text) are removed as the contract says.
  5. fileText does not use wholeLines (only sideLines is exported from apply.ts). Its own lineChange also puts back a line break the user deleted at a waiting change's edge; otherwise a marker would share a line with the next text. This has its own test.
  6. fixture.save keeps `length` and `lines` next to the new `text`.
  7. New or renamed exports:
     - ipc: WriteRequest (ChunkSource.ts, index.ts).
     - editor: ResultSnapshot, MergeController.snapshot, MergeController.onUnsavedChange; internal fileText, SavedPoint (class), ResultSnapshot.
     - useMergeController: re-exports FormatOutcome and ResultSnapshot; MergeHandle.unsaved, MergeHandle.snapshot.
     - saving.ts: Writing, FinishRequest, Saving, whileWriting, finish, createSaving.
     - FinishRequest is now Omit<WriteRequest, "text"> & { summary; snapshot: Pick<ResultSnapshot, "asShown" | "markSaved"> }.
  8. The store.save tests are in store.test.ts, which already has every source helper; there is no saving.test.ts. "A resolved file writes asShown" is tested there, because that rule sits in saving.ts, not in fileText.
  9. The close-question and choice-view checks ran in the real app, because fixture mode has no choice files and no close handling.
     - `xdotool windowquit` did nothing on the private display with no window manager. The close came from a throwaway Xlib WM_DELETE_WINDOW sender in /tmp, since deleted.
     - `just app-session` cannot pass JS expressions that contain parentheses (the justfile's `{{ args }}` quoting), so I ran `pnpm exec tsx scripts/app-session.ts` directly.
     - Before typing, the visible Result's .cm-content got aria-label "Result text" so the pointer could click it.
  10. Needed outside my files:
     - project-map and docs/architecture.md must name ui/saving.ts, editor/internal/fileText.ts and savedPoint.ts, or `just map-check` fails. The state-table row "saved baseline per opened file" becomes "the saved point in MergeController (savedPoint.ts)". `closeGuard` now tracks `{ unsaved }`.
     - architecture.md:724 still says "Cancel File Merge".
     - cm6-rules CM5 still names resultText() (now snapshot().asShown()).
     - CHANGELOG.md needs the Save entry.
  11. The dot uses `bg-fg`; the brief only said "palette tokens".
  12. I ran `pnpm install --frozen-lockfile --offline`, because the worktree had no node_modules.

open_risks
  1. frontend/src/editor/internal/fileText.ts:50-59: an emptied change at the end of a file without a final line break deletes from `from - 1`. If another waiting span ends exactly there, the two changes overlap and ChangeSet.of resolves them by mapping, untested. Adjacent chunks like that should not come from merge-core [INFERENCE].
  2. frontend/src/editor/internal/savedPoint.ts:32-41: "typing inside a fully waiting change" means the span's text differs from its text at open. A format edit inside such a change also keeps the dot after a save, which is consistent with the rule since that text is not written either.
  3. frontend/src/ui/saving.ts:120-130: formatOutcomes is never cleared on reload or reset; the status-area slice decides how long an outcome shows. If handle.format() ever rejected, that save would not happen; this relies on the editor's never-rejects guarantee.
  4. problems.browser.test.ts was edited but not run (Playwright WebKit cannot launch on this host, known).
  5. Fixture-mode Save always replies Written, so the dot clears even though nothing is on disk; this is expected for fixtures.
```