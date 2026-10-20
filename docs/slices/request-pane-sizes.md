# Request — three dots on every resize handle; the three panes resizable, their shares remembered (GitHub issue 4)

Settled (orchestrator as owner, OR13 and #876); a design may refine a detail it names, never reopen a rule.

## Owner's words

- GitHub issue 4 (2026-10-19), "three dots to show draggability and make all three panes resizable", with a picture:
  a dark gap between two panels, three grey dots stacked vertically in its middle.
- Chat (2026-10-19): "Three dots in an edge as a hint that a pane (file list) is resizable like in vscode [the same
  picture]. Also make all three panes (left, result, right) edges draggable (resizable), and remember its percentage
  sizes across restarts".

## Rules

1. **Dots.** Three small round dots stacked vertically, centred on the handle, in a muted colour (a token per theme in
   `style.css`), brighter while the pointer is over the handle or drags it. On the file list's handle (today's 5 px
   gap between the file list and the merge area, `FileList.vue`'s `separator`) and on each pane divider; on a divider
   they never cover a band, a wave join or an icon (where exactly: the design).
2. **Pane dividers.** The boundary between Local and Result and the one between Result and Remote are dragged with the
   pointer (`col-resize` cursor). A drag moves only that boundary: the two panes beside it change width, the third
   keeps its own, the strip between them moves along and keeps its width. Where a press starts a drag follows
   WebStorm's merge window (DR6: its dividers between the three editors are drag handles; the design cites
   intellij-community's splitter for it) and never takes a press from a strip's icons (apply/ignore and their drag,
   #45), its wave clicks (#63) or Ctrl/Cmd+click (#46).
3. **Limits.** No pane gets narrower than a minimum (the design proposes one, citing VS Code or WebStorm); a narrower
   window keeps the shares, and the minimum wins when the window is too narrow for the stored shares.
4. **Reset.** A double-click on a pane divider makes the three panes equal; on the file list's handle it gives the file
   list its starting width (VS Code: a double-click on a sash resets it; the design cites the source).
5. **Shares.** The panes' widths are kept as shares of the three panes' total (strips excluded) — one split for the
   window: every opened file shows it, also files opened later, and the choice view's three columns (binary and
   similar files, #36) and the deleted-side view (#47) follow it and are resized the same way. Remembered across
   restarts in the window's own storage (`ui/windowStorage.ts` `storedValue`, as #58/#61/#68); anything stored that
   is not a valid split → three equal panes.
6. **File list width**: today session-only; whether it is remembered too is asked of the owner (the design names what
   each answer costs).
7. **Unchanged during and after a drag**: the locked scroll; bands, wave joins and icons in place; the wave one
   unbroken line (#64); the minimap over the Result's right edge (#81); the find bar; no text selected by a drag; the
   keyboard where it was; scrolling no slower.

## Acceptance

In WebKit (fixture page) and the real app: dots on all three handles in dark and light; dragging each divider changes
exactly the two panes beside it, the third keeps its width to the pixel, strips and bands follow, locked scroll and
waves intact; a drag starting on an apply icon still applies or drags over icons, a wave click still opens lines; the
minimum holds; a double-click gives equal panes (dividers) or the starting width (file list); another file, the
choice view and the deleted-side view show the same split; after a restart the split is the same; a narrow window
keeps the shares; `just check` passes; scroll timing no worse.

## Non-goals

Keyboard resizing; a split per file; collapsing a pane by dragging it to zero; vertical layouts; resizing the
header rows.
