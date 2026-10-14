import { expect, test } from "vitest";

import { iconTable, lookup, nameKey } from "./iconTable";

const TABLE = iconTable([
  ["cargo", "cargo.lock cargo.toml"],
  ["npm", "package.json"],
]);

test("iconTable: gives every space-separated name its row's icon", () => {
  expect(TABLE).toEqual({ "cargo.lock": "cargo", "cargo.toml": "cargo", "package.json": "npm" });
});

test("lookup: finds a table name and misses any other", () => {
  expect(lookup(TABLE, "cargo.toml")).toBe("cargo");
  expect(lookup(TABLE, "package.json")).toBe("npm");
  expect(lookup(TABLE, "cargo")).toBeUndefined();
  expect(lookup(TABLE, "Cargo.toml")).toBeUndefined();
});

test("lookup: misses keys inherited from Object.prototype", () => {
  expect(lookup(TABLE, "constructor")).toBeUndefined();
  expect(lookup(TABLE, "__proto__")).toBeUndefined();
  expect(lookup(TABLE, "toString")).toBeUndefined();
});

test("nameKey: is the last path segment in lower case", () => {
  expect(nameKey("Packages/Core/SRC")).toBe("src");
  expect(nameKey("Cargo.TOML")).toBe("cargo.toml");
  expect(nameKey("a/b/")).toBe("");
});
