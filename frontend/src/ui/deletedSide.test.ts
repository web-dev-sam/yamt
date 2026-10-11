import { expect, test } from "vitest";

import type { Side } from "../ipc";
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
])("deleted on the %s side, %j taken", (deleted, taken, view) => {
  expect(deletedSideView(deleted, taken)).toEqual(view);
});

test("the kept text is applied while the middle must show it and still has changes", () => {
  const kept = deletedSideView("remote", LOCAL);
  expect(keptToApply(kept, { changes: 2, conflicts: 0 })).toBe("local");
  expect(keptToApply(kept, { changes: 0, conflicts: 0 })).toBeNull();
  expect(keptToApply(kept, null)).toBeNull();
});

test("nothing is applied before a take, after a Delete, or after the disk resolved the file", () => {
  const changes = { changes: 2, conflicts: 0 };
  expect(keptToApply(deletedSideView("remote", null), changes)).toBeNull();
  expect(keptToApply(deletedSideView("remote", REMOTE), changes)).toBeNull();
  expect(keptToApply(deletedSideView("remote", DISK), changes)).toBeNull();
  expect(keptToApply(deletedSideView("local", REMOTE), changes)).toBe("remote");
});
