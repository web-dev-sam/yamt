import { expect, test } from "vitest";

import type { DiskResult } from "../ipc";
import { noticeCloseLabel, noticeText, type Notice } from "./noticeText";

const PATH = "src/a.ts";

const OPENINGS: readonly [Pick<Notice, "editsDropped" | "when">, string][] = [
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
  expect(noticeText({ path: PATH, ...fields })).toBe(text);
});

test("the close button names the file its notice is about", () => {
  expect(noticeCloseLabel(PATH)).toBe("Close the notice about src/a.ts");
});
