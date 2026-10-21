import { EditorState } from "@codemirror/state";
import { expect, test, vi } from "vitest";

import { columnLimit, utf8Length } from "./columnBytes";

const EURO = "€";

function column(doc: string, limit: number): { state: EditorState; refused: () => void } {
  const refused = vi.fn<() => void>();
  return { state: EditorState.create({ doc, extensions: columnLimit(limit, refused) }), refused };
}

test("utf8Length counts what TextEncoder writes, for one- to four-byte characters and a lone surrogate", () => {
  const encoder = new TextEncoder();
  for (const text of ["", "abc", "é", EURO, "😀", "a😀é€\n", "\ud800", "x\udc00y"]) {
    expect(utf8Length(text)).toBe(encoder.encode(text).length);
  }
});

test("a three-byte character that passes the limit is refused and reported", () => {
  const { state, refused } = column("ab", 4);

  const after = state.update({ changes: { from: 2, insert: EURO } }).state;

  expect(after.doc.toString()).toBe("ab");
  expect(refused).toHaveBeenCalledOnce();
});

test("an edit that reaches the limit exactly is accepted; one byte more is refused", () => {
  const { state, refused } = column("ab", 5);

  const full = state.update({ changes: { from: 2, insert: EURO } }).state;
  const over = full.update({ changes: { from: 0, insert: "x" } }).state;

  expect(full.doc.toString()).toBe(`ab${EURO}`);
  expect(over.doc.toString()).toBe(`ab${EURO}`);
  expect(refused).toHaveBeenCalledOnce();
});

test("the count follows each change: removed bytes make room, line breaks count one", () => {
  const { state, refused } = column(`${EURO}\n${EURO}`, 7);

  const replaced = state.update({ changes: { from: 0, to: 1, insert: "ab" } }).state;
  const filled = replaced.update({ changes: { from: 0, insert: "c" } }).state;
  const over = filled.update({ changes: { from: 0, insert: "d" } }).state;

  expect(filled.doc.toString()).toBe(`cab\n${EURO}`);
  expect(over.doc.toString()).toBe(`cab\n${EURO}`);
  expect(refused).toHaveBeenCalledOnce();
});
