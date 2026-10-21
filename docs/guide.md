# Using yamt

The [README](../README.md#use) has the short version. This page has every detail. On macOS, read Cmd for Ctrl and
Option for Alt.

## Start and exit

- When `git merge`, `git rebase`, `git cherry-pick`, `git revert` or `git am` stops with conflicts, run `yamt` in the
  repository, or `yamt --repo <path>` from anywhere.
- yamt starts from a terminal. Double-clicking it in a file manager or Finder shows nothing.
- Closing the window exits with status 0 when every file is resolved and 1 otherwise, so scripts can tell.

## The file list

- Lists every conflicted file with git's view of it: resolved or not, also when you run `git add` elsewhere. Click a
  file to open it.
- Drag its edge to make it wider. A double-click on the edge gives the starting width back.
- The button at the right of its "Files" header switches between a list and a tree (folders first, with VS Code's
  folder icons).
- Ctrl+B hides and shows it.
- The width and the list or tree choice are remembered after a restart.
- If you turned on git's `rerere`, a file git filled in with a resolution you recorded before is marked "remembered"
  and is not staged. Open it to review the resolution with both sides' changes, then press Mark resolved.

## What git is doing

A gray tag at the bottom of the file list names the operation: MERGE, SQUASH MERGE, REBASE, CHERRY-PICK, REVERT or
PATCHES (for `git am`). Hover it for the details and the full commit message, for example:

- "Merging feature into main"
- "Rebasing feature onto main · 2 of 5"
- "Cherry-picking 3f2c1a0 Fix login · 1 of 3"
- "Reverting 9b8e7d6 Add cache"
- "Applying patch 2 of 4: Fix typo"

## The three panes

Your own work is always on the left.

- The left header names what is checked out: the branch, or the commit and its subject. During a rebase it names the
  commit being replayed onto the new base.
- The right header names what comes in:
  - the branch or commit you merge or pick
  - the commit the rebase builds on
  - "revert of" the commit a revert undoes
  - the patch `git am` applies

### Resizing

- Drag the strip between Local and Result, or between Result and Remote (or the line above it).
- Only the two panes next to it change, and none gets narrower than 220 px.
- A double-click makes the three equal.
- The split is the same for every file and is remembered after a restart.
- Three dots on the file list's edge and between the panes show where to drag.

### Collapsed lines

- Lines that no change touches are collapsed behind a wavy line across all three panes. 4 lines stay next to each
  change, so every change of a file is in view with little scrolling.
- Click the wave, in any pane or between them, to show 4 more lines next to each change. Click again for 8 more, a
  third time for the rest.
- Searching for text in hidden lines shows them.
- The toolbar's "Collapse unchanged fragments" button turns collapsing off and on again for every open file.

### Minimap

- Hold Alt for a minimap of the result over the right pane's right edge. Releasing Alt hides it.
- It shows the code in syntax colours, language-server errors and warnings on its left edge, the changes still waiting
  on its right edge, and a box over the part on screen.
- Click a line to bring it to the middle of the result, or drag the box or scroll over the minimap. The cursor and the
  keyboard stay where they were.

## Applying changes

- Each change has an arrow that applies it to the result and a × that ignores it.
- Press one and drag up or down to apply or ignore several at once, as one undo step.
- On a conflict:
  - Ctrl+click on the arrow also ignores the other side.
  - Ctrl+click on the × also takes the other side.
  - Holding Ctrl when releasing a drag does the same for every conflict it covers.
- Ctrl+click a highlighted change to apply it, Ctrl+right-click to ignore it.
- Ctrl+scroll over a side steps through its changes.
- The toolbar applies all non-conflicting changes from the left or from the right in one click.

## Keyboard

Click a side or one of its changes first; an outline shows which side has the keyboard. These are the default keys;
settings can change them.

| Key                  | Does                                                         |
| -------------------- | ------------------------------------------------------------ |
| Enter, Space         | apply the change                                             |
| Backspace, Delete, x | ignore the change                                            |
| Up, Down             | go to the previous or next change still waiting on that side |
| Left, Right          | switch sides                                                 |
| Ctrl+Z               | undo, from anywhere in the window                            |
| Ctrl+Shift+Z, Ctrl+Y | redo, from anywhere in the window                            |
| Ctrl+S               | save without staging                                         |
| Ctrl+F               | find text in the pane you clicked                            |
| F3, Shift+F3, Escape | next match, previous match, close find                       |
| Tab, Shift+Tab       | indent, outdent in the result                                |
| Ctrl+B               | hide or show the file list                                   |

The toolbar's up and down arrows do the same as Up and Down, on the left side when no side has the keyboard.

## Editing, saving and resolving

- The result pane is a normal editor: type, indent and outdent, undo and redo.
- Ctrl+S saves the result to the file without staging it, so you can stop and come back later.
  - Changes still waiting are written as git wrote them (a conflict as its conflict markers), and yamt finds them
    again next time.
  - A dot at the right end of the Result header shows unsaved work. Closing the window asks only when something is not
    saved.
- **Mark resolved** writes the result, stages the file and opens the next unresolved one. It turns blue once nothing
  is left to process.
- **Reset**, next to "Result", brings the file back as it was when this run of yamt opened it.
- A file deleted on one side and changed on the other shows the changed side with its changes, and two buttons:
  **Keep** and **Delete**.
- Other files the editor cannot show (binary files, symlinks, submodules) get a choice between the two sides.

## Continue and Abort

**Continue** is called **Continue rebase**, **Continue cherry-pick**, **Continue revert** or **Continue applying
patches**, and **Commit merge** for a merge. It sits right after Mark resolved, and in the header of files without a
toolbar.

- Once every file is resolved, it runs git's own continue with the commit message git prepared. No editor opens; hooks
  run as in a terminal.
- It shows the next stop's conflicts without a restart. When git finishes, yamt closes with status 0.
- It asks first about unsaved edits, and when a step rewords or squashes a commit, since that message stays as git
  prepared it.
- If git refuses (a hook says no), yamt shows git's message and nothing changes.
- Continuing in a terminal works too. When the window gets focus, yamt shows where git stopped next, and says so if
  unsaved edits of the old stop were dropped.

**Abort** starts hidden: turn it on in the toolbar's right-click menu, and it shows right after Continue. It is also in
the header of files without a toolbar.

- It runs git's own abort for the merge, rebase, cherry-pick, revert, squash merge or `git am` in progress, and the
  repository goes back to how it was before. yamt then closes with status 1.
- One question first names what is lost: every resolution and save, and for a rebase or a sequence, the commits
  already done.
- If git refuses (for example a file staged and then changed again), yamt shows git's message and changes nothing.

A conflict git keeps no record of, such as a `git stash pop`, has neither Continue nor Abort.

## Toolbar

- Right-click it to choose which of its buttons show: continue, abort, previous and next change, collapse unchanged
  fragments, apply all from either side, undo, redo. Abort, Undo and Redo start hidden.
- The choice applies to every file and is remembered after a restart. The keys work either way.

## Settings

The gear at the toolbar's right end opens settings:

- **Dark** or **Light** colours.
- On Linux, **Subpixel** (colour-edged text like WebStorm's, the default) or **Greyscale** antialiasing.
- Every yamt shortcut: add, change or remove a key per action, or reset it. A key another action uses asks before
  moving.
- The [language servers](../README.md#language-servers).

Settings are saved per user and hold only what you changed:

- Linux: `~/.config/yamt/settings.json`
- macOS: `~/Library/Application Support/yamt/settings.json`
- Windows: `%APPDATA%\yamt\settings.json`

Point the settings page at another file, for example in your dotfiles, and yamt reads and writes that one. It picks up
your edits whenever its window gets focus.
