import { expect, test } from "vitest";

import { merged, type ListedRequest } from "../index";

type Row = ListedRequest & { readonly title: string };

function row(iid: number, createdAt: number, title = `!${iid}`): Row {
  return { iid, createdAt, title, draft: false, assignees: [], reviewers: [], labels: [] };
}

test("rows come newest created first, a tie ordered by the higher iid first", () => {
  const page = [row(9, 100), row(3, 300), row(4, 200), row(7, 200), row(5, 200)];
  expect(merged([], page).map((listed) => listed.iid)).toEqual([3, 7, 5, 4, 9]);
});

test("a page's rows join the current ones in order", () => {
  const current = [row(9, 300), row(4, 100)];
  const page = [row(6, 200), row(2, 50)];
  expect(merged(current, page).map((listed) => listed.iid)).toEqual([9, 6, 4, 2]);
});

test("a row in both appears once, the page's copy kept", () => {
  const current = [row(9, 300, "old title"), row(4, 100)];
  const page = [row(9, 300, "new title"), row(2, 50)];
  const rows = merged(current, page);
  expect(rows.map((listed) => listed.iid)).toEqual([9, 4, 2]);
  expect(rows[0]?.title).toBe("new title");
});
