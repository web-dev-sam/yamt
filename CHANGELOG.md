# Changelog

All notable changes to yamt are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

[Unreleased]: ../../compare/v0.2.0...HEAD
[0.2.0]: ../../compare/v0.1.1...v0.2.0
[0.1.0]: ../../releases/tag/v0.1.0
