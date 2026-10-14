import { describe, expect, it } from "vitest";
import DefaultFolder from "~icons/vscode-icons/default-folder";
import DefaultFolderOpened from "~icons/vscode-icons/default-folder-opened";
import FolderSrc from "~icons/vscode-icons/folder-type-src";
import FolderSrcOpened from "~icons/vscode-icons/folder-type-src-opened";
import FolderTest from "~icons/vscode-icons/folder-type-test";
import FolderTestOpened from "~icons/vscode-icons/folder-type-test-opened";

import { FOLDER_ICON_ROWS, folderIcon } from "./folderIcon";

describe("folderIcon", () => {
  it("matches a table name in any case, closed and open", () => {
    expect(folderIcon("SRC", false)).toBe(FolderSrc);
    expect(folderIcon("SRC", true)).toBe(FolderSrcOpened);
    expect(folderIcon("Tests", false)).toBe(FolderTest);
    expect(folderIcon("Tests", true)).toBe(FolderTestOpened);
  });

  it("gives an unknown name the generic folder pair", () => {
    expect(folderIcon("notes", false)).toBe(DefaultFolder);
    expect(folderIcon("notes", true)).toBe(DefaultFolderOpened);
    expect(folderIcon("transforms", true)).toBe(DefaultFolderOpened);
  });

  it("takes one folder name, so a chained row passes its last segment", () => {
    expect(folderIcon("packages/core/src", false)).toBe(DefaultFolder);
    expect(folderIcon("packages/core/src".split("/").at(-1) ?? "", false)).toBe(FolderSrc);
  });

  it("ignores keys inherited from Object.prototype", () => {
    expect(folderIcon("constructor", false)).toBe(DefaultFolder);
    expect(folderIcon("__proto__", true)).toBe(DefaultFolderOpened);
  });

  it("resolves every table name to its row's icons", () => {
    for (const [icons, names] of FOLDER_ICON_ROWS) {
      expect(icons.closed).not.toBe(icons.opened);
      for (const name of names) {
        expect(folderIcon(name, false)).toBe(icons.closed);
        expect(folderIcon(name, true)).toBe(icons.opened);
      }
    }
  });

  it("names every folder once and only in lower case", () => {
    const names = FOLDER_ICON_ROWS.flatMap(([, rowNames]) => rowNames);
    expect(names.filter((name, index) => names.indexOf(name) !== index)).toEqual([]);
    expect(names.filter((name) => name !== name.toLowerCase())).toEqual([]);
  });
});
