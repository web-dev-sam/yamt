import { expect, test } from "vitest";

import { staleTiles } from "./minimapTiles";

const QUIET = {
  docChanged: false,
  foldsChanged: false,
  themeChanged: false,
  languageChanged: false,
  treeBefore: 4000,
  treeAfter: 4000,
};

test("doc or folds or theme or language → all; tree grown → from the old length; statuses → none", () => {
  expect(staleTiles({ ...QUIET, docChanged: true, treeAfter: 9000 })).toBe("all");
  expect(staleTiles({ ...QUIET, foldsChanged: true })).toBe("all");
  expect(staleTiles({ ...QUIET, themeChanged: true })).toBe("all");
  expect(staleTiles({ ...QUIET, languageChanged: true, treeAfter: 0 })).toBe("all");
  expect(staleTiles({ ...QUIET, treeAfter: 9000 })).toEqual({ from: 4000 });
  expect(staleTiles(QUIET)).toBe("none");
});
