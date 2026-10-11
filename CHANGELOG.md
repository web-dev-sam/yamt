# Changelog

All notable changes to yamt are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - unreleased

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
- Scrolling keeps up with the screen on large files (thousands of lines, hundreds of changes).
- Closing asks before throwing away unsaved work, and exits with 0 when every file is resolved and
  1 otherwise. A window whose page has stopped responding closes on the second close request.
- On Linux with an NVIDIA driver, the app switches off WebKitGTK's DMABUF renderer itself.
- Releases for Linux (AppImage, `.deb`) and macOS (`.dmg`, unsigned).

[0.1.0]: ../../releases/tag/v0.1.0
