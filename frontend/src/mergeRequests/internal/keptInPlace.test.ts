import { expect, test } from "vitest";

import { keptInPlace } from "../index";

type Item = { readonly id: number; readonly version: string };

function items(version: string, ...ids: readonly number[]): readonly Item[] {
  return ids.map((id) => ({ id, version }));
}

function keyOf(item: Item): number {
  return item.id;
}

test("a_held_item_keeps_its_index_and_takes_its_new_version", () => {
  const kept = keptInPlace(items("old", 1, 2, 3), items("new", 3, 2, 1), new Set([2, 3]), keyOf);
  expect(kept).toEqual([
    { id: 1, version: "new" },
    { id: 2, version: "new" },
    { id: 3, version: "new" },
  ]);
  expect(keptInPlace(items("old", 1, 2, 3), items("new", 3, 1, 2), new Set([2]), keyOf)).toEqual(
    items("new", 3, 2, 1),
  );
});

test("the_others_fill_in_next_order", () => {
  expect(
    keptInPlace(items("old", 1, 2, 3, 4), items("new", 4, 5, 3, 2, 1), new Set([1]), keyOf),
  ).toEqual(items("new", 1, 4, 5, 3, 2));
  expect(keptInPlace(items("old", 1, 2), items("new", 2, 1, 3), new Set([3]), keyOf)).toEqual(
    items("new", 2, 1, 3),
  );
});

test("a_held_item_gone_from_next_is_dropped", () => {
  expect(keptInPlace(items("old", 1, 2, 3), items("new", 3, 1), new Set([2]), keyOf)).toEqual(
    items("new", 3, 1),
  );
  expect(keptInPlace(items("old", 1, 2, 3), items("new", 3, 2), new Set([1, 3]), keyOf)).toEqual(
    items("new", 2, 3),
  );
});

test("nothing_held_is_next", () => {
  const next = items("new", 3, 1, 2);
  expect(keptInPlace(items("old", 1, 2, 3), next, new Set<number>(), keyOf)).toEqual(next);
});
