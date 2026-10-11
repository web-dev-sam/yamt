import { expect, test } from "vitest";

import type { Side } from "../ipc";
import { deletedSideView, keptToApply, type DeletedSideView } from "./deletedSide";

test.each<[Side, Side | null, DeletedSideView]>([
  [
    "remote",
    null,
    { kept: "local", keepIn: "local", deleteIn: "remote", middle: "base", resettable: false },
  ],
  [
    "remote",
    "local",
    { kept: "local", keepIn: null, deleteIn: null, middle: "kept", resettable: true },
  ],
  [
    "remote",
    "remote",
    { kept: "local", keepIn: null, deleteIn: null, middle: "deleted", resettable: true },
  ],
  [
    "local",
    null,
    { kept: "remote", keepIn: "remote", deleteIn: "local", middle: "base", resettable: false },
  ],
  [
    "local",
    "remote",
    { kept: "remote", keepIn: null, deleteIn: null, middle: "kept", resettable: true },
  ],
  [
    "local",
    "local",
    { kept: "remote", keepIn: null, deleteIn: null, middle: "deleted", resettable: true },
  ],
])("deleted on the %s side, %s taken", (deleted, taken, view) => {
  expect(deletedSideView(deleted, taken)).toEqual(view);
});

test("the kept text is applied while the middle must show it and still has changes", () => {
  const kept = deletedSideView("remote", "local");
  expect(keptToApply(kept, { changes: 2, conflicts: 0 })).toBe("local");
  expect(keptToApply(kept, { changes: 0, conflicts: 0 })).toBeNull();
  expect(keptToApply(kept, null)).toBeNull();
});

test("nothing is applied before a take or after a Delete", () => {
  const changes = { changes: 2, conflicts: 0 };
  expect(keptToApply(deletedSideView("remote", null), changes)).toBeNull();
  expect(keptToApply(deletedSideView("remote", "remote"), changes)).toBeNull();
  expect(keptToApply(deletedSideView("local", "remote"), changes)).toBe("remote");
});
