import { expect, test } from "vitest";
import DefaultFolder from "~icons/vscode-icons/default-folder";
import DefaultFolderOpened from "~icons/vscode-icons/default-folder-opened";
import FolderSrc from "~icons/vscode-icons/folder-type-src";
import FolderSrcOpened from "~icons/vscode-icons/folder-type-src-opened";
import FolderTest from "~icons/vscode-icons/folder-type-test";
import FolderTestOpened from "~icons/vscode-icons/folder-type-test-opened";

import { FOLDER_ICON_ROWS, folderIcon } from "./folderIcon";

test("folderIcon: matches a table name in any case, closed and open", () => {
  expect(folderIcon("SRC", false)).toBe(FolderSrc);
  expect(folderIcon("SRC", true)).toBe(FolderSrcOpened);
  expect(folderIcon("Tests", false)).toBe(FolderTest);
  expect(folderIcon("Tests", true)).toBe(FolderTestOpened);
});

test("folderIcon: gives an unknown name the generic folder pair", () => {
  expect(folderIcon("notes", false)).toBe(DefaultFolder);
  expect(folderIcon("notes", true)).toBe(DefaultFolderOpened);
  expect(folderIcon("transforms", true)).toBe(DefaultFolderOpened);
});

test("folderIcon: looks only at the last segment of a folder path", () => {
  expect(folderIcon("packages/core/src", false)).toBe(FolderSrc);
  expect(folderIcon("packages/core/src", true)).toBe(FolderSrcOpened);
  expect(folderIcon("src/notes", false)).toBe(DefaultFolder);
  expect(folderIcon("src/test/notes", true)).toBe(DefaultFolderOpened);
});

test("folderIcon: ignores keys inherited from Object.prototype", () => {
  expect(folderIcon("constructor", false)).toBe(DefaultFolder);
  expect(folderIcon("__proto__", true)).toBe(DefaultFolderOpened);
});

test("folderIcon: resolves every table name to its row's icons", () => {
  for (const [icons, rowNames] of FOLDER_ICON_ROWS) {
    expect(icons.closed).not.toBe(icons.opened);
    for (const name of rowNames.split(" ")) {
      expect(folderIcon(name, false)).toBe(icons.closed);
      expect(folderIcon(name, true)).toBe(icons.opened);
    }
  }
});

test("folderIcon: names every folder once, in lower case, none empty", () => {
  const all = FOLDER_ICON_ROWS.flatMap(([, rowNames]) => rowNames.split(" "));
  expect(all.filter((name, index) => all.indexOf(name) !== index)).toEqual([]);
  expect(all.filter((name) => name !== name.toLowerCase())).toEqual([]);
  expect(all).not.toContain("");
});
