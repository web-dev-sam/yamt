# Changelog

All notable changes to yamt are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- `yamt --raw` opens a compare window for any two texts, no repository needed: type or paste into the left and right
  columns and the differences show with the merge window's colours, word marks and bands, updated as you type, with
  both columns scrolling together. A second `yamt --raw` while one is open says so and exits.
  - **Format** lays out JSON and XML in both columns, keeping keys, numbers and entities exactly as written; a column
    that does not parse says which line, and Ctrl/Cmd+Z undoes a Format.
  - A **language** drop-down: "Auto" recognises JSON, XML, HTML, PHP and scripts with a `#!` line; any language yamt
    highlights can be picked.
  - **Tabs** in the left panel: "+" adds one, a double-click renames it, × closes it (asking first when it holds text);
    Ctrl/Cmd+B hides the panel.
  - Tabs, their names, texts and languages and the shown tab are kept between runs, also after a crash.

### Changed

- The operation tag at the bottom of the file list (MERGE, REBASE, …) shows what git is doing, how far it got and the
  commit message in yamt's own tooltip the moment the pointer is on it, instead of the system's late tooltip.

### Fixed

- On Linux, pasting no longer crashes yamt when the clipboard cannot be read — the program that copied has quit, nothing
  was ever copied, or it does not answer. Such a paste now pastes nothing (a fault in the system's web engine,
  WebKitGTK 2.54). A middle-click pastes the selected text everywhere, as in other Linux programs.

## [0.4.2] - 2026-10-22

### Added

- A gray tag at the bottom of the file list names what git is doing — MERGE, SQUASH MERGE, REBASE, CHERRY-PICK,
  REVERT or PATCHES (`git am`); hover it for what is applied onto what, how far a sequence is ("Rebasing feature
  onto main · 2 of 5") and the full commit message.
- **Continue** (Continue rebase / cherry-pick / revert / applying patches, Commit merge for a merge) right after Mark
  resolved: once every file is resolved it runs git's own continue with git's prepared commit message and shows the
  next stop's conflicts without a restart; when git finishes, yamt closes with status 0. It asks first about unsaved
  edits and about a step that rewords or squashes a commit. Continue and Abort also sit in the header of files without
  a toolbar (binary, deleted on one side) and of a stop without conflicts.
- Continuing, skipping or editing in a terminal while yamt is open: when the window gets focus yamt shows where git
  stopped next, with a notice when unsaved edits of the old stop were dropped.
- With git's `rerere` on, a file git filled in with a resolution you recorded before is marked "remembered" in the file
  list instead of being staged: it opens with that resolution and both sides' changes for review, and Mark resolved
  stages it without asking about its conflicts.

### Changed

- During a rebase your own commit is on the left ("Local (yours)") and the commit the rebase builds on on the right,
  so your work is always on the left; staging, Take, Keep and Delete follow the panes, and the file on disk keeps git's
  conflict order.
- The right pane names what a revert undoes ("revert of 9b8e7d6 Add cache") and the patch `git am` applies.
- Abort works for every operation git records — merge, squash merge, rebase, cherry-pick, revert and `git am` — with
  git's own abort; its label and question name the operation and what is lost. A conflict git keeps no record of (a
  `git stash pop`) has neither Continue nor Abort.
- Closing the window while git continues or aborts waits until git is done; it is refused from the window meanwhile.

## [0.4.1] - 2026-10-20

### Added

- Language servers found in a repository can be switched off in Settings → Language servers, each with its own
  switch. A server switched off stops at once, its problems leave the Result, and it is not started again in that
  repository, also after a restart, until it is switched back on.
- One "Servers" button in the header holds every language server: its drop-down lists each one with its state, and
  choosing one opens its menu as before. A pin icon next to each puts that server's own button in the header; nothing
  is pinned at first, and pins are remembered per repository.
- The three panes can be resized: drag the strip between Local and Result, or between Result and Remote (or the line
  above it). Only the two panes next to it change; no pane gets narrower than 220 px. A double-click makes the three
  panes equal. The split is the same for every file, the binary and deleted-file views included, and is remembered
  across restarts.
- Three dots on the file list's edge and between the panes show where to drag.

### Changed

- The file list keeps the width you dragged it to across restarts; a double-click on its edge gives the starting width
  again.
- The header no longer shows one button per language server; they sit in the "Servers" drop-down unless pinned.

## [0.4.0] - 2026-10-18

### Added

- Abort merge: an icon button right after Mark resolved, hidden at first; show it from the toolbar's right-click
  menu. During a `git merge` it runs `git merge --abort` after one question. Every resolution and save is lost,
  the repository goes back to how it was before the merge, and yamt closes with status 1. If git refuses, its
  message shows and nothing changes. Not offered for a rebase, cherry-pick, revert or squash merge.
- Holding Alt (Option on macOS) shows a minimap of the Result at the window's right edge, over the right pane: the
  Result's code in its syntax colours, collapsed lines as one row, language-server errors and warnings on its left
  edge (errors over warnings) and every change still waiting on its right edge (conflicts in the conflict colour). A
  box marks the part on screen; a long file's minimap scrolls along. Clicking a line brings it to the middle of the
  Result, dragging the box or scrolling over the minimap scrolls; the cursor, the selection and the keyboard stay
  where they were. Releasing Alt, pressing another key or leaving the window hides it.

### Changed

- The toolbar's right-click menu remembers each button you decided, shown or hidden, so a button added later keeps
  its own starting state; choices made before carry over.

### Fixed

- The focus ring of a button or menu item reached by keyboard is in the theme's primary colour instead of the
  system's focus colour (blue on Linux).
- Problems from language servers are underlined with a visible squiggle; on Linux the wavy line was drawn flat.
- Settings lists wrap long text onto the next line instead of cutting it off or pushing it out of view: a long
  file-type list no longer hides the language server's command, and many shortcuts on one keymap action no longer
  squeeze its name.
- A jump far down a file in one go (from the top, to a part not drawn yet) lands where it was sent; on Linux the
  panes stopped about halfway and the other panes followed the wrong place.

## [0.3.2] - 2026-10-15

### Added

- Resting the pointer on a removal bar in the left or right pane shows the code that side removed, as a code block
  in the panes' font and syntax colours. It can be scrolled, selected and copied; removed whitespace alone shows as
  `·`, `→` and `↵`. It closes when the pointer leaves, or when that side's change is applied or ignored.

### Changed

- Removal bars are wider (4 px) with room on each side, and the dark theme has new colours; the native window's
  dark background matches them.

## [0.3.1] - 2026-10-15

### Added

- Language servers for more languages. Besides oxlint, oxfmt, TypeScript and eslint, yamt now finds Biome,
  rust-analyzer (Rust), gopls (Go), ruff, ty, basedpyright and pyright (Python), Phpactor or else Intelephense
  (PHP) and clangd (C and C++) in the repository's projects, and `.vue` files get TypeScript's problems when
  the project has `@vue/typescript-plugin`. The same once-per-repository question starts them. Phpactor shows
  the project's own PHPStan, Psalm, PHP-CS-Fixer and phpcs problems when the project has the tool and its
  config. Ctrl+S also formats with Biome, rustfmt, gofmt, ruff, clang-format (with a `.clang-format`) and
  PHP-CS-Fixer or phpcbf.
- A server the project uses but that is not installed shows "Not installed" with the command for that
  language's own installer: the project's package manager, uv, Poetry or PDM, rustup, `go install`, or
  Phpactor's download. A found server that stops while starting (rustup's `rust-analyzer` without the
  component) shows the same steps.
- Settings → Language servers → "From the list" fills in the command and file types of a known server, Deno
  and bash-language-server included.

### Changed

- yamt also looks for a server's program in the project's `.venv` and `vendor/bin` folders, and after the
  PATH in `~/go/bin`, `~/.cargo/bin`, `~/.local/bin` and Composer's global folder, so servers installed with
  `go install`, pipx or `uv tool` are found when yamt is started from the desktop.
- A server added by hand whose command is a known server's (for example `ruff server`) gets that server's
  name, settings and formatting rule.

## [0.3.0] - 2026-10-14

### Added

- Ctrl+B (Cmd+B on macOS) hides and shows the file list, from anywhere in the window; the merge view
  takes its room. The key is listed in settings as "Toggle file list" and can be changed there.
- A button at the right of the file list's "Files" header shows the files as a tree, as VS Code's
  Source Control view does: folders first, a chain of single folders on one row, every folder open at
  first and the shown file's folders opened when it changes, folder icons from vscode-icons. Pressing it
  again shows the flat list. The choice is remembered after a restart.
- The left pane's header names what is checked out, as the right one names what is merged in:
  "Local (yours): main", or the commit's short id and subject when no branch is checked out (during a
  rebase), with the full commit message on hover.
- Lines no change touches are collapsed behind a wavy line across all three panes and the space between
  them, as in WebStorm's merge window: 4 lines stay visible next to each change, and each click on the
  wave shows 4, then 8 more lines next to each change, then the rest. Hovering the wave thickens it;
  finding text in hidden lines shows them, and a Delete, Backspace or cut on the wave line shows lines
  instead of removing hidden ones.
- A "Collapse unchanged fragments" button in the toolbar (third, after the arrows) turns the collapsing
  off and on for every opened file; turning it back on hides every run again as when the file opened. The
  choice is remembered across restarts, and the toolbar's right-click menu can hide the button.
- Ctrl+S (Cmd+S on macOS) saves the Result to the file on disk without marking it resolved: git still lists
  the file as conflicted until "Mark resolved". Changes still waiting are written as git wrote them: a
  conflict as its conflict markers, a one-sided change applied, so no side is lost and yamt finds those
  conflicts again next time. A dot at the right end of the Result header shows unsaved work; undoing back
  to the saved text clears it, and closing the window asks only when something is not saved. The key can
  be changed in settings ("Save").
- Reset now brings back the file as it was when this run of yamt opened it, so saves made in earlier runs
  stay.
- Language servers: yamt finds oxlint, oxfmt, TypeScript and eslint in the repository's projects and asks
  once per repository whether to start them. Their problems underline the Result as you type, with the
  message on hover. Ctrl+S formats first, with oxfmt or an added server that formats (as one undo step,
  never touching changes that still wait). Left of the settings gear, each server's state; its menu has
  Start, Stop, Restart and Show log.
  A server that needs a separate package (typescript-language-server for TypeScript 5 and 6,
  vscode-langservers-extracted for eslint) shows "Not installed" with the install command for the
  project's own package manager and a Copy button; yamt starts it when you come back to the window.
  Other servers can be added in Settings → Language servers. yamt ships no language server.

### Fixed

- Ctrl+X with nothing selected cut two lines instead of one in the result pane on Linux.
- The wavy line now meets the curves between the panes on its middle line at every window width and
  screen; before, it met them up to 3 px off.

## [0.2.0] - 2026-10-13

### Added

- Keyboard focus in the side panes: click a side or one of its changes (an outline shows which), then
  Enter or Space applies the change, Backspace, Delete or x ignores it, Up and Down move between the
  changes still waiting on that side, Left and Right switch sides (onto the other half of the same
  conflict when it is still waiting). After a decision the next waiting change is focused; when a
  side has nothing left, the other side takes the keyboard. Ctrl+scroll (Cmd+scroll on macOS) over a
  side steps through its changes.
- Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y (Cmd on macOS) undo and redo from anywhere in the window, not only
  in the result pane.
- Ctrl+right-click (Cmd+right-click on macOS) on a highlighted change in a side pane ignores it.
  Ctrl+click and Ctrl+right-click also work on the thin bar of a change with no lines on that side.
- Ctrl+click (Cmd+click) on a conflict's apply arrow also ignores the other side; on its × it also
  takes the other side. Holding Ctrl (Cmd) when releasing a drag over several icons does the same
  for every conflict it covers. The icons' hover hint names the shortcut. One undo step either way.
- Previous change / Next change arrows in the toolbar move through the changes still waiting on the
  side that has the keyboard, like Up and Down there; with no side focused, the left side takes the
  keyboard first.
- A settings gear at the right end of the toolbar opens a settings page in place of the open file;
  Back returns to the file exactly as it was.
- Settings: a **Dark** / **Light** switch (Light follows WebStorm's Islands Light; conflicts stay
  purple), and every yamt keyboard shortcut — apply, ignore, next/previous change, left/right side,
  undo, redo, find, find next/previous, close find, indent, outdent. Per action, as in WebStorm's
  Keymap: add a key, change or remove one, remove all, or reset to the defaults; a key another
  action already uses asks before moving it. Changes act at once in every open file.
- Settings are kept per user in `~/.config/yamt/settings.json` (`~/Library/Application
  Support/yamt/settings.json` on macOS), holding only what you changed. The settings page can point
  yamt at another file — an existing one is used, a missing one is created — and yamt picks up edits
  made to the file whenever its window gets focus. A broken file is reported and never overwritten.
  The window opens in the saved colours from its first frame.
- Right-click the toolbar to show or hide its icon buttons (previous/next change, apply all from the
  left or the right, undo, redo) from a menu with a check mark per button. Their keys keep working,
  and yamt remembers the choice for every file and after a restart.
- Windows: a per-user installer (`yamt_<version>_x64-setup.exe`, no admin rights). Needs Git for
  Windows (`git.exe` on the PATH); WebView2 comes with Windows 10 and 11. Code text keeps ClearType
  edges at fractional display scaling (125–175 %). Untested: repositories with `core.autocrlf=true`.
- Settings → **Antialiasing** (Linux): **Subpixel** (default) draws code text with coloured
  subpixel edges like WebStorm's, whatever the desktop's own font setting; **Greyscale** draws it
  grey. Takes effect the next time yamt starts.

### Changed

- The dark look follows WebStorm's Islands Dark: darker panes (#191A1C), the file list and the open
  file as rounded panels on a lighter frame, notices as rounded boxes; syntax and change colours are
  unchanged.
- The toolbar's Undo and Redo buttons start hidden (right-click the toolbar to show them);
  Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y (Cmd on macOS) still undo and redo. Ctrl+Shift+Y no longer redoes.
- Code lines are 20 px apart (were 18.2): every line now starts on a whole screen pixel, so line
  spacing no longer alternates, at 100 %, 125 %, 150 %, 175 % and 200 % scaling.

## [0.1.0] - 2026-10-11

### Added

- `yamt` (or `yamt --repo <path>`) opens every conflicted file of a stopped `git merge`, `rebase` or
  `cherry-pick` in one window; with nothing to merge it says so and exits without a window.
- Three panes per file: your side on the left, theirs on the right, the result in the middle,
  starting from the common base; bands connect each change to its place in the result.
- Per change: an arrow applies it, a × ignores it; press and drag over several to apply or ignore
  them at once (one undo step); Ctrl+click (Cmd+click on macOS) on a highlighted change applies it;
  changed words are marked inside changed lines.
- Toolbar: **Mark resolved** first (blue once nothing is left), apply all non-conflicting changes
  from the left or the right, undo, redo, and a count of what is left in the file.
- The result pane is an editor with syntax colours, Tab / Shift+Tab indent and outdent, undo and redo.
- Ctrl+F (Cmd+F) finds text in the pane you clicked, with a match count.
- **Mark resolved** writes the result, stages the file and opens the next unresolved file;
  **Reset**, next to "Result", brings the conflict back.
- The right pane's header names what is merged in: the branch, or the commit and its subject.
- A file deleted on one side and changed on the other shows the changed side with its changes, with
  **Keep** and **Delete**; other files the editor cannot show (binary, symlinks, submodules) get a
  choice between the two sides.
- The file list keeps every file of the merge with git's view of its state (also after a `git add`
  elsewhere) and an icon for its type; drag its edge to resize it; work in an unfinished file is kept
  when you switch files, and files you are not looking at cost nothing while you scroll.
- The file on disk is the truth: when a conflicted file changes outside yamt (before it starts, or
  while you are in another window), a file with no conflict markers left, or deleted, is staged and
  marked resolved; a file with markers left shows the disk text with only the conflicts still marked.
  yamt never overwrites a change it has not shown: unsaved edits in that file are dropped, and a
  notice names the file.
- Scrolling keeps up with the screen on large files (thousands of lines, hundreds of changes).
- Closing asks before throwing away unsaved work, and exits with 0 when every file is resolved and
  1 otherwise. A window whose page has stopped responding closes on the second close request.
- On Linux with an NVIDIA driver, the app switches off WebKitGTK's DMABUF renderer itself.
- Releases for Linux (AppImage, `.deb`) and macOS (`.dmg`, unsigned).

[Unreleased]: ../../compare/v0.4.2...HEAD
[0.4.2]: ../../compare/v0.4.1...v0.4.2
[0.4.1]: ../../compare/v0.4.0...v0.4.1
[0.4.0]: ../../compare/v0.3.2...v0.4.0
[0.3.2]: ../../compare/v0.3.1...v0.3.2
[0.3.1]: ../../compare/v0.3.0...v0.3.1
[0.3.0]: ../../compare/v0.2.0...v0.3.0
[0.2.0]: ../../compare/v0.1.1...v0.2.0
[0.1.0]: ../../releases/tag/v0.1.0
