import { expect, test } from "vitest";

import { loadFixture, type FileMergeData, type Side } from "../ipc";
import { isEditable } from "./views";

const DATA = await loadFixture("vueuse-use-magic-keys.ts");

test.each<[Side | null, FileMergeData["middle"], boolean]>([
  [null, { kind: "Stages", text: "m\n" }, true],
  [null, { kind: "Disk", text: "m\n" }, true],
  [null, { kind: "DiskNotText", found: "Binary" }, false],
  ["remote", { kind: "Stages", text: "m\n" }, false],
  ["local", { kind: "Disk", text: "m\n" }, false],
  ["remote", { kind: "DiskNotText", found: "Deleted" }, false],
])("deleted on side %s with a %j middle is editable: %s", (deleted, middle, editable) => {
  expect(isEditable({ ...DATA, deleted, middle })).toBe(editable);
});
