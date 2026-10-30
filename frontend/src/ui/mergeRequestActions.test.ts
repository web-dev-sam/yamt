import { expect, test } from "vitest";
import { shallowRef } from "vue";

import { isMergeRequestIid, type MergeRequestIid } from "../ipc";
import { claimRow, setRow } from "./mergeRequestActions";

type Busy = { readonly kind: "busy" } | { readonly kind: "done"; readonly note: string };

function iid(value: number): MergeRequestIid {
  if (!isMergeRequestIid(value)) {
    throw new Error(`not an iid: ${value}`);
  }
  return value;
}

test("a row is claimed when free or done, never while busy (catches a second call per row)", () => {
  const rows = shallowRef<ReadonlyMap<MergeRequestIid, Busy>>(new Map());
  const [first, second] = [iid(640), iid(639)];

  expect(claimRow(rows, first, { kind: "busy" })).toBe(true);
  const claimed = rows.value;
  expect(claimRow(rows, first, { kind: "busy" })).toBe(false);
  expect(rows.value).toBe(claimed);
  expect(claimRow(rows, second, { kind: "busy" })).toBe(true);

  setRow(rows, first, { kind: "done", note: "ok" });
  expect(claimRow(rows, first, { kind: "busy" })).toBe(true);
  expect([...rows.value]).toEqual([
    [first, { kind: "busy" }],
    [second, { kind: "busy" }],
  ]);
});

test("every write is a new map; null forgets the row and keeps the others", () => {
  const [first, second] = [iid(640), iid(639)];
  const before: ReadonlyMap<MergeRequestIid, Busy> = new Map([
    [first, { kind: "busy" }],
    [second, { kind: "busy" }],
  ]);
  const rows = shallowRef(before);

  setRow(rows, first, null);
  expect([...rows.value]).toEqual([[second, { kind: "busy" }]]);
  expect([...before.keys()]).toEqual([first, second]);

  const forgotten = rows.value;
  setRow(rows, first, { kind: "done", note: "ok" });
  expect(rows.value).not.toBe(forgotten);
  expect(rows.value.get(first)).toEqual({ kind: "done", note: "ok" });
});
