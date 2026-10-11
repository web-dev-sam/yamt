import { expect, test } from "vitest";

import type { FileMergeData, Side } from "../ipc";
import { deletedSideView, keptToApply, type DeletedSideView } from "./deletedSide";
import type { Taken } from "./sides";

const LOCAL: Taken = { by: "side", side: "local" };
const REMOTE: Taken = { by: "side", side: "remote" };
const DISK: Taken = { by: "disk" };

test.each<[Side, Taken | null, DeletedSideView]>([
  [
    "remote",
    null,
    { kept: "local", keepIn: "local", deleteIn: "remote", middle: "loaded", resettable: false },
  ],
  [
    "remote",
    LOCAL,
    { kept: "local", keepIn: null, deleteIn: null, middle: "kept", resettable: true },
  ],
  [
    "remote",
    REMOTE,
    { kept: "local", keepIn: null, deleteIn: null, middle: "deleted", resettable: true },
  ],
  [
    "remote",
    DISK,
    { kept: "local", keepIn: "local", deleteIn: "remote", middle: "loaded", resettable: true },
  ],
  [
    "local",
    null,
    { kept: "remote", keepIn: "remote", deleteIn: "local", middle: "loaded", resettable: false },
  ],
  [
    "local",
    REMOTE,
    { kept: "remote", keepIn: null, deleteIn: null, middle: "kept", resettable: true },
  ],
  [
    "local",
    LOCAL,
    { kept: "remote", keepIn: null, deleteIn: null, middle: "deleted", resettable: true },
  ],
  [
    "local",
    DISK,
    { kept: "remote", keepIn: "remote", deleteIn: "local", middle: "loaded", resettable: true },
  ],
])("deleted on the %s side, %j taken, middle from the stages", (deleted, taken, view) => {
  expect(deletedSideView(deleted, taken, "Stages")).toEqual(view);
});

test.each<FileMergeData["middle"]["kind"]>(["Disk", "DiskNotText"])(
  "a middle loaded from the disk (%s) can be reset before any take",
  (loaded) => {
    expect(deletedSideView("remote", null, loaded)).toEqual({
      kept: "local",
      keepIn: "local",
      deleteIn: "remote",
      middle: "loaded",
      resettable: true,
    });
  },
);

test("the kept text is applied while the middle must show it and still has changes", () => {
  const kept = deletedSideView("remote", LOCAL, "Stages");
  expect(keptToApply(kept, { changes: 2, conflicts: 0 })).toBe("local");
  expect(keptToApply(kept, { changes: 0, conflicts: 0 })).toBeNull();
  expect(keptToApply(kept, null)).toBeNull();
});

test("nothing is applied before a take, after a Delete, or after the disk resolved the file", () => {
  const changes = { changes: 2, conflicts: 0 };
  expect(keptToApply(deletedSideView("remote", null, "Stages"), changes)).toBeNull();
  expect(keptToApply(deletedSideView("remote", REMOTE, "Stages"), changes)).toBeNull();
  expect(keptToApply(deletedSideView("remote", DISK, "Disk"), changes)).toBeNull();
  expect(keptToApply(deletedSideView("local", REMOTE, "Stages"), changes)).toBe("remote");
});
