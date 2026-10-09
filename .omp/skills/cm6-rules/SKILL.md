---
name: cm6-rules
description: The CodeMirror 6 contract for yamt's editor/ module — state fields, effects and undo, position mapping, line separators, read-only panes, geometry and scroll re-entrancy. Autoloaded into web-impl; reviewers read it for any editor/ diff.
---

# CodeMirror 6 rules

`editor/` is framework-free TypeScript around three `EditorView`s. Its public surface is one
class, `MergeController` (`editor/index.ts`). Everything below is internal.

## State

- [CM1] Chunk positions and apply status live in **one** `StateField<ChunkSet>` on the center
  pane. A range is `from` = start of its first line, `to` = start of the line after, or the
  document end (an insertion point is `from === to`). `from` maps with `mapPos(pos, -1)`; `to`
  with `-1` when it is a line start or the range is empty, `+1` when a non-empty range ends
  mid-line — so typing on the chunk's lines stays inside and typing on the next line stays
  outside (corrected in 1.1; ratify at Gate D).
- [CM2] Status changes only through a `StateEffect<{ id: ChunkId; status }>`; the effect is
  registered with `invertedEffects` from `@codemirror/commands` so **undo restores status
  together with text**. Test: apply → undo ⇒ status back to `pending`.
- [CM3] Left and right panes: `EditorState.readOnly.of(true)` + `EditorView.editable.of(false)`;
  no `history()`. Their decorations are built once per file from the fixed `local`/`remote`
  ranges and never remapped. `editable: false` still allows selection and copy — keep it.
- [CM4] Every pane carries the same base extensions (bundled JetBrains Mono theme, line
  numbers, highlighting, `EditorState.lineSeparator` when `eol === "CrLf"`) so line metrics
  are identical — that identity is what makes connector and scroll math trivial.
- [CM5] Serialise the result with `state.sliceDoc()` (respects the configured separator),
  never `doc.toString()` (always `\n`). Test: CRLF file ⇒ `resultText()` contains `\r\n`.

## Transactions

- [CM6] Applying a chunk is one `view.dispatch({ changes, effects, userEvent: "yamt.apply" })`.
  The replacement range is the chunk's **current** mapped range; the replacement text is
  `data.local`/`data.remote` sliced by the chunk's fixed side range (lines → string once, at
  load, via `Text.of(lines)`; never re-split per apply).
- [CM7] Bulk apply builds all changes in **original** coordinates and passes them together as
  `state.changes([...])` — CM composes them — so the whole bulk is one undo step.
- [CM8] A chunk whose current range collapsed to empty because the user deleted it becomes
  `dismissed` in the same update cycle; the gutter marker disappears.
- [CM9] Never store a `number` position outside the StateField; derive from
  `state.field(chunkField)` at use time. Positions are `DocPos`-branded.

## Rendering

- [CM10] Decorations: `Decoration.line({ class })` for bands, `Decoration.mark` for
  intra-line diffs (later), `gutter({ domEventHandlers })` for apply/dismiss markers. Compute
  with `RangeSetBuilder` over `view.visibleRanges` only when the set depends on the viewport.
- [CM11] Connector endpoints come from `view.lineBlockAt(pos)` / `view.coordsAtPos`; subtract
  `scrollDOM.scrollTop`; draw only chunks intersecting either pane's `viewport`.
- [CM12] Scroll sync: one function `targets(source, scrollTop) → { left, center, right }`
  (piecewise-linear through chunk anchors in pixel space). Re-entrancy guard: a `syncing`
  flag set before writing `scrollTop`s, cleared in the next `requestAnimationFrame`;
  scroll events while `syncing` are ignored. Decision 12: this one function is the swap point.
- [CM13] Repaint of strips and sync is coalesced to one `requestAnimationFrame` per frame;
  no synchronous layout reads in scroll handlers.
- [CM14] `destroy()` destroys all three views, removes listeners, and leaves the host elements
  empty; `MergeView.vue` calls it on file switch.

## Dependencies (closed list, decision 4)

`@codemirror/state`, `@codemirror/view`, `@codemirror/language`, `@codemirror/commands`
(center only), `@lezer/highlight`, `@codemirror/lang-{javascript,php,vue,css,json}`.
Not the `codemirror` bundle, not `@codemirror/merge`, not `@codemirror/search`/`autocomplete`.
