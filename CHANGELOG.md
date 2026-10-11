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
- Per change: an arrow applies it, a × ignores it; changed words are marked inside changed lines.
- Toolbar: apply all non-conflicting changes from the left or the right, undo, redo, and a count of
  what is left in the file.
- The result pane is an editor with syntax colours, Tab / Shift+Tab indent and outdent, undo and redo.
- **Mark resolved** writes the result and stages the file; **Reset file** brings the conflict back.
- Files the editor cannot show (binary, deleted on one side, symlinks, submodules) get a choice
  between the two sides.
- The file list keeps every file of the merge with its state and an icon for its type; work in an
  unfinished file is kept when you switch files.
- Closing asks before throwing away unsaved work, and exits with 0 when every file is resolved and
  1 otherwise. A window whose page has stopped responding closes on the second close request.
- On Linux with an NVIDIA driver, the app switches off WebKitGTK's DMABUF renderer itself.
- Releases for Linux (AppImage, `.deb`) and macOS (`.dmg`, unsigned).

[0.1.0]: ../../releases/tag/v0.1.0
