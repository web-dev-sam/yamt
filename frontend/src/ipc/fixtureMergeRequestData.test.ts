import { expect, test } from "vitest";

import type * as Generated from "./bindings";
import { fixtureRows } from "./fixtureMergeRequestData";

const LISTED = 40;

function rowOf(rows: readonly Generated.MergeRequestRow[], iid: number): Generated.MergeRequestRow {
  const found = rows.find((row) => row.iid === iid);
  if (found === undefined) {
    throw new Error(`no fixture row !${iid}`);
  }
  return found;
}

test("the readiness cycle puts a conflict first, a fork's conflict second and a draft's blocker last (catches a page script finding no conflicting row)", () => {
  const rows = fixtureRows(0, LISTED);
  expect(rowOf(rows, 640).readiness).toEqual({ kind: "conflicts", also: [] });
  expect(rowOf(rows, 639).readiness).toEqual({ kind: "conflicts", also: [] });
  expect(rowOf(rows, 636).readiness).toEqual({
    kind: "conflicts",
    also: [{ kind: "discussions" }],
  });
  expect(rowOf(rows, 634).readiness).toEqual({ kind: "blocked", reason: { kind: "draft" } });
  expect(rowOf(rows, 620).readiness).toEqual({
    kind: "conflicts",
    also: [{ kind: "discussions" }, { kind: "draft" }],
  });
  expect(rowOf(rows, 633).readiness).toEqual({
    kind: "blocked",
    reason: { kind: "other", status: "MERGE_TRAIN_STUCK" },
  });
  expect(rows.filter((row) => row.fromFork).map((row) => row.iid)).toEqual([
    639, 631, 623, 615, 607,
  ]);
});

test("every fifth row has no size and the others grow with the row (catches a size cycle off by one)", () => {
  const rows = fixtureRows(0, LISTED);
  expect(rowOf(rows, 636).size).toBeNull();
  expect(rowOf(rows, 640).size).toEqual({ additions: 12, deletions: 0, files: 1 });
  expect(rowOf(rows, 633).size).toEqual({ additions: 96, deletions: 15, files: 2 });
  expect(rows.filter((row) => row.size === null).map((row) => row.iid)).toEqual([
    636, 631, 626, 621, 616, 611, 606, 601,
  ]);
});
