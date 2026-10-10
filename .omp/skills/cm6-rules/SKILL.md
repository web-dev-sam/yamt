---
name: cm6-rules
description: The CodeMirror 6 contract for yamt's editor/ module — state fields, effects and undo, position mapping, line separators, read-only panes, geometry and scroll re-entrancy. Autoloaded into web-impl; reviewers read it for any editor/ diff.
---

# CodeMirror 6 rules

`editor/` is framework-free TypeScript around three `EditorView`s. Its public surface is one
class, `MergeController` (`editor/index.ts`). Everything below is internal.

## State

- [CM1] Chunk positions and per-side status live in **one** `StateField<readonly ChunkSpan[]>` on
  the center pane. A range is `from` = start of its first line, `to` = start of the line after, or
  the document end (an insertion point is `from === to`). Mapping:
  - `from` maps with `mapPos(pos, -1)`.
  - `to` maps with `-1` when it is a line start or the range is empty, and `+1` when a non-empty
    range ends mid-line.
  - A span applied in this transaction maps `to` with `+1` and pushes later spans' `from` to at
    least that `to`.
  - Every other `to` is capped at the next span's `from`.
    So spans stay sorted and disjoint (RK14), typing on a chunk's lines stays inside, and typing on
    the next line stays outside.
- [CM2] Status changes only through `setStatus`, a `StateEffect<{ id: ChunkId; status: ChunkStatus }>`
  whose status is per side: `Readonly<Record<Side, "pending" | "applied" | "ignored">>` (plan §2 #33).
  The effect is registered with `invertedEffects` from `@codemirror/commands`, so **undo restores
  status together with text**. Test: apply → undo ⇒ both sides `pending`.
- [CM3] Left and right panes: `EditorState.readOnly.of(true)` + `EditorView.editable.of(false)`;
  no `history()`. Their decorations come from the fixed `local`/`remote` ranges (never remapped)
  plus a read-only status mirror the controller pushes after each center transaction (1.4).
  `editable: false` still allows selection and copy — keep it. The selection is drawn over every
  tint (innermost mark, `selectionOverTints`).
- [CM4] Every pane carries the same base extensions (bundled JetBrains Mono theme, line
  numbers, highlighting, `EditorState.lineSeparator` when `eol === "CrLf"`) so line metrics
  are identical — that identity is what makes connector and scroll math trivial.
- [CM5] Serialise the result with `state.sliceDoc()` (respects the configured separator),
  never `doc.toString()` (always `\n`). Test: CRLF file ⇒ `resultText()` contains `\r\n`.

## Transactions

- [CM6] An action (apply, ignore, bulk apply) is a list of `Steps` dispatched one at a time by
  `dispatchSteps`, never merged into one `dispatch(...steps)`. The steps are:
  1. a cursor move annotated `Transaction.addToHistory.of(false)` (left out by a bulk apply when
     the cursor is already visible);
  2. the action as one transaction `{ changes?, effects: setStatus…, userEvent: "yamt.apply" | "yamt.ignore" }`;
  3. a recorded selection step, which history keeps as the action's `selectionsAfter`: redo shows
     the block, and typing afterwards is its own undo step.
     The replacement range is the chunk's current mapped range. The replacement text is
     `data.local`/`data.remote` sliced by the chunk's fixed side range (lines → string once, at
     load, via `Text.of(lines)`; never re-split per apply).
- [CM7] Bulk apply builds all changes in **original** coordinates and passes them together as
  `state.changes([...])` in its action step (CM composes them), so the whole bulk is one undo step.
- [CM8] A block whose current range the user deleted, while a side was still open (fresh or
  half-applied), becomes ignored on both sides in the same update cycle; its arrows disappear.
  Test: `sides.test.ts` 'deleting a whole open or half-applied conflict in the middle pane ignores every side'.
- [CM9] Never store a `number` position outside the StateField; derive from
  `state.field(chunkField)` at use time. Positions are `DocPos`-branded.

## Rendering

- [CM10] Decorations: `Decoration.line({ class })` for bands. Side panes add `Decoration.mark`
  word marks and `Decoration.widget` removal bars (`words.ts`; `ignoreEvent()` false). Apply/ignore
  arrows are SVG groups in the gap strips, acting on `pointerdown`; each strip's `mousedown` calls
  `preventDefault`, so the middle pane keeps focus (a CM gutter on the inner edge missed clicks in
  WebKit; 1.4). Compute with `RangeSetBuilder` over `view.visibleRanges` only when the set depends
  on the viewport.
- [CM11] Connector endpoints come from `view.lineBlockAt(pos)` / `view.coordsAtPos`; subtract
  `scrollDOM.scrollTop`; draw only chunks intersecting either pane's `viewport`.
- [CM12] Scroll sync: one function `targets(source, scrollTop) → { left, center, right }`
  (piecewise-linear through chunk anchors in pixel space). Re-entrancy guard: the follower panes
  a sync wrote ignore their echo until the next `requestAnimationFrame`, and a source whose
  `scrollTop` did not change does not re-sync. Decision 12: this one function is the swap point.
- [CM13] Repaint of strips and sync is coalesced to one `requestAnimationFrame` per frame;
  no synchronous layout reads in scroll handlers.
- [CM14] `destroy()` destroys all three views, removes listeners, and leaves the host elements
  empty; `MergeView.vue` calls it on file switch.

## Dependencies (closed list, decision 4)

`@codemirror/state`, `@codemirror/view`, `@codemirror/language`, and `@codemirror/commands` (center
pane only: `history`, `defaultKeymap`, `historyKeymap`, `indentWithTab`; Tab/Shift+Tab indent the
lines the selection touches by the file's own unit, plan §2 #35). Also `@lezer/highlight` and
`@codemirror/language-data` (every official grammar, each loaded on demand, plan §2 #29). The panes
get only the grammar's `Language`, never its `LanguageSupport` extras (auto-closing tags, Markdown
list keys). Grammars are reached only through `language-data`, never imported one by one.
Not the `codemirror` bundle, not `@codemirror/merge`, not `@codemirror/search`/`autocomplete`.
