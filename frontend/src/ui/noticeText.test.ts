import { expect, test } from "vitest";

import type { DiskResult } from "../ipc";
import { noticeKey, noticeRow, type DiskNotice, type Notice } from "./noticeText";

const PATH = "src/a.ts";

const OPENINGS: readonly [Pick<DiskNotice, "editsDropped" | "when">, string][] = [
  [
    { when: "running", editsDropped: true },
    `${PATH} changed on disk; your edits in yamt were dropped`,
  ],
  [{ when: "running", editsDropped: false }, `${PATH} changed on disk`],
  [{ when: "start", editsDropped: false }, `${PATH} differs on disk from git's merge`],
];

const TAILS: readonly [DiskResult, string][] = [
  [{ kind: "Staged" }, "staged as resolved"],
  [{ kind: "MarkersLeft", conflicts: 1 }, "1 conflict left"],
  [{ kind: "MarkersLeft", conflicts: 3 }, "3 conflicts left"],
  [{ kind: "LeftAsIs" }, "left unstaged"],
  [{ kind: "StageFailed", message: "index.lock exists\n" }, "staging failed: index.lock exists"],
];

test.each(
  OPENINGS.flatMap(([opening, sentence]) =>
    TAILS.map(([result, tail]) => [{ ...opening, result }, `${sentence} — ${tail}`] as const),
  ),
)("%j reads %j", (fields, text) => {
  expect(noticeRow({ kind: "disk", path: PATH, ...fields }).text).toBe(text);
});

test("the close button names the file its notice is about", () => {
  const notice: Notice = {
    kind: "disk",
    path: PATH,
    result: { kind: "Staged" },
    editsDropped: false,
    when: "running",
  };

  expect(noticeRow(notice).closeLabel).toBe("Close the notice about src/a.ts");
});

test("a stop moved on outside names the operation and every dropped file; without one it names git", () => {
  const files = ["a.ts", "b.ts"];

  expect(noticeRow({ kind: "movedOn", operation: "Rebase", files })).toEqual({
    key: "movedOn",
    text: "The rebase moved on outside yamt; your unsaved edits in a.ts, b.ts were dropped",
    closeLabel: "Close the notice about the dropped edits",
  });
  expect(noticeRow({ kind: "movedOn", operation: "Am", files: ["a.ts"] }).text).toBe(
    "The patch application moved on outside yamt; your unsaved edits in a.ts were dropped",
  );
  expect(noticeRow({ kind: "movedOn", operation: null, files: ["a.ts"] }).text).toBe(
    "Git moved on outside yamt; your unsaved edits in a.ts were dropped",
  );
});

test("a file named movedOn has its own key, apart from the moved-on notice", () => {
  const file: Notice = {
    kind: "disk",
    path: "movedOn",
    result: { kind: "Staged" },
    editsDropped: false,
    when: "running",
  };

  expect(noticeKey(file)).not.toBe(noticeKey({ kind: "movedOn", operation: null, files: [] }));
});
