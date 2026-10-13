# Changelog

All notable changes to yamt are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
- A settings gear at the right end of the toolbar opens a settings page in place of the open file
  (empty for now); Back returns to the file exactly as it was.
- Right-click the toolbar to show or hide its icon buttons (previous/next change, apply all from the
  left or the right, undo, redo) from a menu with a check mark per button. Their keys keep working,
  and yamt remembers the choice for every file and after a restart.

### Changed

- The dark look follows WebStorm's Islands Dark: darker panes (#191A1C), the file list and the open
  file as rounded panels on a lighter frame, notices as rounded boxes; syntax and change colours are
  unchanged.

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

[Unreleased]: ../../compare/v0.1.1...HEAD
[0.1.0]: ../../releases/tag/v0.1.0
