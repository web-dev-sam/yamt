# Request — search every file of the window, as VS Code's search view, toggled by Ctrl/Cmd+Shift+S

Settled with the owner on 2026-10-28 (session 32: three answers below); details by the orchestrator as owner (OR13),
copied from VS Code's search view where marked. A design may refine a detail it names, never reopen a rule. Facts:
`.omp/run/notes/PlanScoutSearch.md` (path:line at main `15ab31c`). Windows: the merge window ("conflict mode") and the
range window ("diff mode", `yamt --diff=<a>..<b>`); not the compare window (it has tabs, not files).

## Owner's words

- "for diff and conflict mode: I want a global search (ctrl/cmd+shift+s by default) that searches in all files of the
  diff or conflicts. Make it appear above the file list. The shortcut is a toggle, and the searched content is
  remembered, the search works like in vscode and shows the files and its findings below. A file findings can be
  expanded/collapsed, a finding can be dismissed, it can reappear when user presses enter in search again. Should work
  just like in VSCode."
- Answer to "What should the search look in?": "every pane in full, but the finding list needs to be thought of, do you
  have an idea how to deduplicate it or render it slightly differently from vscode?"
- Answer to "Which of VS Code's search extras should come with it?": "for now, only match case".
- Answer to the orchestrator's proposal (one row per place, tagged with the panes that hold it): "your recommendation
  with the additions: the tag should be an icon (lucide:panel-left, lucide:panel-left-right-dashed (for conflicts
  base), lucide:panel-right). Also add a filter so that only the finding of one panel or two are shown, for that use
  the same icons as square toggle buttons that are highlighted when activated like the buttons in vscode search
  filters. Dont include these three in the search input, otherwise theres not much room left for the search text".
  The orchestrator reads "for conflicts base" as the merge window's middle pane, the Result (it shows an undecided
  conflict's base lines, plan §2 #53).

## Rules

1. **Key.** A new rebindable action "Toggle search" in Settings → keys, group "Window", default `Mod-Shift-s`
   (Ctrl+Shift+S, ⌘⇧S; free in every window and every installed CodeMirror keymap, `keys.ts:191-207`). It acts
   anywhere in the window under the file-list key's conditions (#61: not while a question waits or the key dialog
   records a key). Pressed while hidden: the panel shows and the keyboard goes into its box with the text selected.
   Pressed while shown: the panel hides and the keyboard goes back to the shown file.
2. **Place.** The left column, above the file list: the search panel on top, the file list below, sharing the
   column's width and its width handle (#84). The panel grows with its results up to half the column's height and
   scrolls inside; the file list keeps the rest. With the file list hidden (Ctrl/Cmd+B) the panel has the whole column;
   with both hidden the column goes, as today.
3. **Box.** One line, placeholder "Search", with one toggle inside its right end: Match Case (Lucide
   `case-sensitive`, title "Match case", pressed look and `aria-pressed` while on). Nothing else inside the box.
4. **Pane filters** (owner). Under the box, outside it, one square icon toggle per pane, highlighted while on (VS Code's
   toggle look): merge window `panel-left` (the left pane), `panel-left-right-dashed` (the Result), `panel-right` (the
   right pane); range window `panel-left` (old side), `panel-right` (new side). Titles name the pane as its header does
   (#86/#87 names in the merge window, the commits in the range window). All on at first; each independent; a row shows
   while at least one of its panes is on, its icons only for the panes on; every pane off → no rows and the summary says
   every pane is filtered out. A filter change runs no new search and brings back nothing dismissed.
5. **Matching.** The box's text literally (no whole word, no regular expression), case-insensitive unless Match Case,
   within one line. Runs as you type after a 300 ms pause (VS Code's `search.searchOnTypeDebouncePeriod`) and at once
   on Enter. An empty box shows nothing.
6. **What is searched** (owner: every pane in full). Merge window: every conflicted text file of the stop, all three
   panes — the left pane, the Result as it is now (an opened file's unsaved edits included; an unopened file's Result
   as it would open), the right pane. Range window: every changed file's old and new text. Files without text (binary,
   too large, not UTF-8, submodule, a choice file) are skipped silently, as VS Code skips binaries.
7. **The list.** A summary line "N results in M files" (VS Code's words; N counts rows). One group per file: chevron,
   file icon, name, folder dimmed, its row count; open at first; a click on the group opens or closes it. One row per
   **place** (owner): matches in two or more panes are one place when they sit (a) on lines that line up outside every
   change, at the same column, or (b) inside one change or conflict, on lines with the same text, at the same column;
   any other match is its own row. A row shows its line trimmed around the match, the match highlighted, and at its
   right end one icon per pane holding it (owner: `panel-left` / `panel-left-right-dashed` / `panel-right`), each
   titled with the pane and its line number. Rows run in the Result's order (range window: the new side's); a row only
   in side panes sorts at its change's place there. Two matches on one line are two rows.
8. **Going to a finding.** A click on a row opens its file (as a file-list click does) and selects the match in the
   Result (range window: the new side) when the row has it there and that pane is on, else in the leftmost pane on that
   has it; it is scrolled into view, a collapsed stretch around it shows (#63, `request-range-collapse.md`), and that
   pane gets the keyboard. A click on a row's pane icon does the same in that pane. Keyboard (orchestrator, VS Code's
   tree): Down from the box enters the list; Up/Down move through groups and rows; Left/Right close/open a group; Enter
   on a row goes to it.
9. **Dismiss** (VS Code's "Dismiss"). Hovering a row shows a close button (Lucide `x`, title "Dismiss") that removes the
   row; a file group has one that removes the group. Counts follow. Everything dismissed comes back when the search runs
   again: Enter, a changed query, Match Case.
10. **Follows the texts.** When a searched text changes (an edit, a decided change, undo/redo, a file changed on disk,
    Reset, Take), that file is searched again after the same pause; rows dismissed there stay dismissed while the same
    place still matches. The merge window moving to the next stop of an operation keeps the query and searches the new
    stop's files.
11. **Remembered** for the window's run (owner: "the searched content is remembered"): query, Match Case, filters,
    results, open groups and dismissals stay while the panel is hidden and are back when it shows. Not across restarts
    (orchestrator; the owner may veto).
12. **Size.** At most 20,000 rows (VS Code's `search.maxResults`), then the summary says the results were cut and to
    narrow the search. The window never freezes while searching a large range.
13. **Unchanged**: Ctrl/Cmd+F in a pane (#44), Ctrl/Cmd+B (#61), the file list's own behaviour, the compare window.

## Acceptance

WebKit fixture pages of both windows and the real app on `scripts/demo-repo.sh` (merge) and `scripts/range-repo.sh`
(range): Ctrl/Cmd+Shift+S shows the panel above the file list with the keyboard in the box, again hides it, again shows
the same query and results; a query finds matches in every pane, an unchanged matching line is one row with all its
pane icons, a line only one side has is its own row with that icon; the filters show one or two panes' rows; Match Case
narrows; a row click opens the file at the match in the right pane (a collapsed stretch shows), an icon click in that
pane; a group collapses and opens; a dismissed row and group come back on Enter; an edit in the Result updates that
file's rows; the key can be rebound in Settings. The place rule, ordering, dismissals, re-runs and the cap are tested
as pure code. `just check` passes; dark and light.

## Non-goals

Whole word, regular expressions, replace, files to include/exclude (owner: "for now, only match case"); search history;
keeping the query across restarts; the compare window; searching thread comments or AI answers; multi-line queries;
next/previous-result keys (F4); the view's Refresh / Clear / Collapse All buttons.

## Slice graph (proposal; the session's orchestrator refines it after the design)

| row | slice                                                                                                                                                                            | owner     | owns (coarse)                                                                                                          | needs   |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ---------------------------------------------------------------------------------------------------------------------- | ------- |
| 1   | design: where matching runs (one matcher), where each window's texts and line-up data come from, who owns the search state, the reveal API, the panel's place over the file list | designer  | read-only                                                                                                              | —       |
| 2   | Rust: the texts (and line-up data) the design needs, for the merge session and the range                                                                                         | rust-impl | `crates/session`, `crates/range`, `src-tauri` commands (exact files from the design)                                   | 1       |
| 3   | editor: go to a match in a pane — selection, scroll, a collapsed stretch shown — on both controllers (`skill://cm6-rules`)                                                       | web-impl  | `editor/index.ts`, `editor/range.ts`, the internals they need                                                          | 1       |
| 4   | search core, framework-free: matching, the place rule, order, filters, dismissals, re-runs, the cap; pure tests                                                                  | web-impl  | a new module (design names it)                                                                                         | 1       |
| 5   | window: the panel, the key action, the column above the file list in both roots, the stores and IPC sources                                                                      | web-impl  | new `ui/` panel files, `ipc/keys.ts`, `ui/keyText.ts`, `ui/App.vue`, `ui/RangeApp.vue`, `ui/FileList.vue`, both stores | 2, 3, 4 |
| 6   | final run: `just check`, WebKit, real app in both windows                                                                                                                        | verifier  | —                                                                                                                      | 5       |

At most two implementers live (OR10): e.g. 2 ∥ 4, then 3 ∥ 5 with 3's contract fixed in 5's brief.

## Facts and risks for the design

- **Merge texts.** Rust reads every conflicted file's base, local and remote at open (`open.rs:71-104,174-228`); the
  window gets texts only for files it opened (`load_file`, `views.ts:45-53`); an opened file's live Result is reachable
  only through its view's `MergeHandle.snapshot().asShown()` (`useMergeController.ts:60`, `savedPoint.ts:12-17`); the
  store holds no handles (architecture §5.1: Vue never holds an `EditorView`, a position or document text); the one
  registry by path is the close guard's `track/untrack` (`closeGuard.ts:45-51`). Line-up data is per file
  (`FileMergeData.chunks`), so rule 7 needs every file's chunks, not only opened ones'.
- **Range texts.** No cache: every `load_range_file` re-reads both blobs and re-diffs (`load.rs:8-31`); Rust keeps blob
  ids and sizes only (`open.rs:29-33,72-82`); no limit on the file count; 8 MiB per side; the window keeps at most 16
  files mounted (`rangeStore.ts:83`). A search over every file through `load_range_file` is one IPC call and one diff
  per file per run.
- **One matcher** (vision 2): no `regex` crate is a yamt dependency (only tauri's, `Cargo.lock`); the window has JS
  string search and CodeMirror's `SearchCursor`. Case-folding must be the same for every file and pane.
- **Reveal.** Neither controller can go to a position today (`MergeHandle`, `RangeHandle` surfaces); internal seams:
  `revealSpan` (`internal/viewport.ts:68`), selection dispatch as `moveToDifference` does (`compareFocus.ts:30-49`), the
  fold reveal on a selection inside hidden lines (`folds.ts:146-149,272-289`), and #82's far-scroll rule.
- **Layout.** `FileList.vue`'s `<aside>` carries the width (`FileList.vue:49-52`, `usePanelWidth`), so a panel above it
  needs a column around both or a slot inside it. The folder-sums feature (`request-folder-sums.md`) edits the same
  file first.
- **Keys.** Add the action to `KEY_ACTIONS`, defaults, `ACTION_NAMES`, `ACTION_PLACES`, `KEYMAP_GROUPS` (`keyText.test.ts:31`
  checks they match); each root handles window keys next to `fileListKey` (`App.vue:48-50`, `RangeApp.vue:46-48`);
  `pressesKey` counts Shift for letters, so Ctrl+Shift+S never matches Save (`keys.ts:241`).
