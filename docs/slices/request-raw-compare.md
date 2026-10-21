# Owner request — `yamt --raw`: compare any two texts in two columns, with tabs that survive a restart (2026-10-21)

For the orchestrator. Intent captured from the owner's message (#1461); three product questions are asked (below), the
rest is decided as the boring choice and marked as an orchestrator default the owner may veto. What is left open is
design (designer).

## The owner's words

> "I had an idea adding a --raw flag to yamt that opens a two column view where left is base and right is right. The
> user can enter in both columns anything and it shows where it differs in the base column with the existing visuals.
> With this the user can compare any two texts. there should be an action button to format json or other standard
> formats so payloads can be compared properly. A dropdown for the current language and language auto-detect. On the
> left where the files are, are tabs in that mode, the user can create a new tab and compare different things. The
> pasted comparisions persists resdtarts"

Plan §2 #5 ("3-way always — 2-way diff mode / replacing `git difftool` — out of scope") is reopened by the owner's
request (new information under DR4: a changed requirement, asked by the owner directly, as #990 was). The replacement
row keeps `git difftool`/file-pair diffs out of scope and admits one 2-way view: pasted text behind `--raw`.

## Questions asked (answers recorded here when they arrive)

| question                                                      | options                                                                                                                                                        | answer  |
| ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| Which formats does Format cover?                              | JSON only, built in · **JSON and XML, built in (default)** · JSON, YAML, CSS, HTML, Markdown, GraphQL, JS/TS through a bundled formatter (app a few MB larger) | pending |
| Does Format sort JSON object keys?                            | **keep the order (default)** · always sort · two actions (Format / Format and sort keys)                                                                       | pending |
| Arrows in the strip that copy a change into the other column? | **bands only (default)** · bands and arrows both ways, as WebStorm's compare                                                                                   | pending |

## Rules (product terms)

1. **`yamt --raw`** opens the compare window instead of a merge. No git and no repository are needed: it works from any
   folder, also one inside a repository with a merge in progress (that merge is not touched). `--raw` together with
   `--repo` is a usage error; `--help` names `--raw`. Closing the window ends the process with exit 0 and no question.
2. **Two columns, both editable**: left and right, each a full editor (typing, paste, undo/redo by keyboard per
   column, find with Ctrl/Cmd+F, the user's keys and theme from the settings file). The left is the base the right is
   compared against.
3. **The differences, with the merge window's visuals**: the same change colours (added, changed, removed), the
   word-level marks inside changed lines and the removal bars, in both columns, and the curved bands in a strip between
   them; locked scrolling as in the merge window. The differences follow every edit in either column without a button
   (after a short pause while typing, never on every key if that slows typing).
4. **Format** (a toolbar button) formats both columns in the tab's current language as one undo step per column. A
   column whose text does not parse stays as it is and the window says which column and why (the parser's message and
   line); the other column is still formatted. Languages Format does not cover: the button is disabled with a hover
   text naming the covered ones. Scope per the first two questions.
5. **Language**: a toolbar drop-down with "Auto" first, then every language yamt can highlight (the editor's language
   list). "Auto" detects from the text of both columns and shows what it found ("Auto · JSON"); nothing recognised →
   plain text. A picked language stays until changed. One language per tab, for both columns; highlighting and Format
   follow it at once.
6. **Tabs instead of files**: the left panel (where the file list is in a merge) lists the tabs. A "+" button in the
   panel's header adds an empty tab and shows it; a click shows a tab; the shown tab is highlighted as the shown file is.
   Each tab shows its name and its language.
7. **Everything survives a restart**: the tabs, their order, names, both texts, the language choice and which tab was
   shown come back exactly at the next `yamt --raw`, also after a crash or a kill (saved within about a second of the
   last change). Undo history does not survive.
8. **Dark and light**, every colour from the theme's tokens; the settings view (gear) works as in a merge.

## Orchestrator defaults (boring choices; the owner may veto)

- **Names**: a new tab is "Compare 1", "Compare 2", … (numbers never reused while a tab exists); a double-click on the
  name renames it (Enter keeps, Escape cancels, empty keeps the old name).
- **Closing a tab**: an × on the tab's row while hovered; a tab holding text asks first ("Close Compare 2? Its text is
  lost.", Yes/No, the window's existing question); an empty tab closes at once. Closing the last tab leaves one new empty
  tab, so the window never shows nothing.
- **Headers**: "Left" and "Right" above the columns; changes are coloured as the right column's changes against the left.
- **Auto-detect** recognises by its own rules the formats Format covers plus the unmistakable openings (a `#!` line, `<?php`,
  `<!DOCTYPE html>`, `<?xml`); code languages without such a sign read as plain text until picked. A bundled
  machine-learning detector (VS Code's) is not added.
- **Size**: a column holds up to 8 MiB, the merge window's per-file limit (`crates/session/src/decode.rs:6`); a bigger
  paste is refused with a notice.
- **Toolbar in this window**: Format, the language drop-down, the previous/next change arrows if the design gets them
  for free, the gear. None of the merge buttons (apply, reset, mark resolved, abort, continue, servers).
- **File list key**: Ctrl/Cmd+B hides and shows the tab panel as it does the file list; its width is the file list's.

## Facts for the design (sourced)

- **Arguments**: `src-tauri/src/args.rs` — `Invocation::{Merge { repo }, Help, Version}`, `parse`, `USAGE`; an unknown
  argument is a usage error. Start-up decision: `src-tauri/src/outcome.rs:42` `startup(repo)` (`:47` "nothing to merge
  in …"); `src-tauri/src/lib.rs:34` `run`.
- **The page's start**: `frontend/src/main.ts` — `IN_APP = import.meta.env.VITE_CHUNK_SOURCE === "tauri"`; otherwise
  fixture mode from `window.location.search`; one `createAppStore(source, startTheme, servers, host)`, `startUp()`,
  `App.vue` mounted.
- **Diff engine**: `crates/merge-core/src/lib.rs` exports `compute_chunks(base, local, remote, &Options)`,
  `word_changes(base, local, remote, &chunks)`, `line_map(from, to)`, `apply_non_conflicting`; there is no 2-way entry
  point. [INFERENCE] `compute_chunks(left, left, right)` yields only right-side changes, which is a 2-way diff in the
  existing chunk shape — the designer confirms or refutes from `compute.rs`. The window also has a pure TS Myers line
  diff, `editor/internal/lineDiff.ts`, used only to map a formatter's answer (plan §2 #70). Vision 2: one diff rule.
- **Highlighting**: `editor/internal/language.ts` — `languageOf(path)` = `LanguageDescription.matchFilename(languages,
  basename)` from `@codemirror/language-data` 6.5.2 (151 entries), loaded lazily; `loadLanguage` reconfigures
  `languageCompartment` in the three views. Detection is by file name only today.
- **No formatter in the window**: `frontend/package.json` has no formatter dependency; formatting exists only through
  language servers (plan §2 #70, needs a project root and an installed server). Prettier 3.9.10's npm package is 9.96 MB
  unpacked (`npm view prettier dist.unpackedSize`), its browser build a subset [INFERENCE: a few MB].
- **Stored UI state**: `ui/windowStorage.ts` `storedValue` (localStorage keys `yamt.*`, e.g. `ui/collapsing.ts:14`);
  the settings file is Rust's (`crates/settings`, temp file + rename, plan §2 #57). WebKit's localStorage quota is about
  5 MB per origin [INFERENCE] — two 8 MiB columns do not fit.
- **Caps**: oxlint `max-lines` 300: `editor/index.ts` 286, `ui/store.ts` 297, `ui/App.vue` 120, `ui/FileList.vue` 131.
- **Visuals to reuse** (project map): `tone.ts` `paneTone` (the one tint rule), `decorations`, `words` + `removalTooltip`,
  `geometry`, `gap`, `strips`, `frame`, `scrollSync`, `find`, `paneViews`, `pane` (compartments, `LINE_HEIGHT_PX`);
  `MergeController` is built around three panes and two strips.

## Acceptance

In the real app (`yamt --raw` from a folder outside any repository and from one with a merge in progress) and in WebKit
on the fixture page for the window parts:

- `yamt --raw` opens the compare window with one empty tab on first use; `--raw --repo x` prints a usage error; the
  merge in progress is untouched (`git status` before = after).
- Typing or pasting into either column shows the differences with the merge window's colours, word marks, removal bars
  and bands, updated after each edit; both columns scroll locked; undo per column; find in each column.
- Two JSON payloads with the same data in different layouts compare as equal after Format (and with different key order
  if the sort answer says so); invalid JSON in one column names that column and the line, the other is formatted.
- The language drop-down: Auto detects JSON (and the other covered formats); picking TypeScript highlights both columns
  at once; the choice is per tab.
- "+" adds a tab; switching tabs shows each tab's own texts, language and scroll; rename and close (with the question
  when it holds text) work; Ctrl/Cmd+B hides the panel.
- Quit and start again (also after `kill -9` a second after typing): the same tabs, names, texts, languages and shown
  tab. Dark and light. `just check` passes, including `map-check`.

## Non-goals

Comparing files from disk or `yamt --raw a.json b.json`; a 3-way compare; saving a column to a file; language servers,
problems or formatting through them in this window; the minimap, collapsed unchanged lines and the merge buttons in this
window; undo history across restarts; reaching the compare window from a merge window; two `yamt --raw` windows editing
the same tabs at once (see risks).

## Risks and owner checks

- **Two `yamt --raw` windows at once** write the same stored tabs; without a rule the last write wins and the other
  window's edits are lost. The design says what happens (e.g. the second window refuses, or reads only).
- **Typing speed** with two 8 MiB columns: the differences must not be recomputed on every key; measure typing in a
  large column before and after.
- **Saving often** large texts: written only when changed, not the whole store on every key.

## Suggested order (refine at slice mapping)

1. Designer: two or three options for the diff's home (Rust merge-core behind an IPC command vs. the window), how the
   page learns it is in `--raw` mode, the editor's two-column controller (reuse of the merge view's internals, the line
   caps), who owns tabs and where they are stored, Format and detection as pure modules, the plan §2 rows (#5's
   replacement and the new ones), and the builds with disjoint files.
2. Builds per the design: Rust (arguments, start-up, stored tabs, the diff command) beside the window's editor
   controller; then the window's tabs, toolbar, Format and detection.
3. Final run: `just check`, `just mutants <commit before the feature>`, WebKit and the real app per the acceptance.
