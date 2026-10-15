import { expect, test } from "vitest";

import {
  LOCK_FILES,
  packageManager,
  PYTHON_LOCK_FILES,
  PYTHON_LOCK_MANAGER,
} from "./packageManager";

test("the packageManager field names the manager; yarn 1 is classic yarn, yarn 2+ is berry", () => {
  expect(packageManager("pnpm@12.0.0", null)).toBe("pnpm");
  expect(packageManager("yarn@1.22.0", null)).toBe("yarn");
  expect(packageManager("yarn@4.1.0", null)).toBe("yarnBerry");
  expect(packageManager("yarn@2.0.0", null)).toBe("yarnBerry");
  expect(packageManager("npm@10", null)).toBe("npm");
  expect(packageManager("bun@1.1", null)).toBe("bun");
  expect(packageManager("pnpm@9.1.0+sha512.abc", null)).toBe("pnpm");
});

test("every lock file names its manager", () => {
  expect(LOCK_FILES.map((lock) => [lock, packageManager(null, lock)])).toEqual([
    ["pnpm-lock.yaml", "pnpm"],
    ["yarn.lock", "yarn"],
    ["bun.lock", "bun"],
    ["bun.lockb", "bun"],
    ["package-lock.json", "npm"],
  ]);
});

test("a field beats a lock file; an unknown or versionless field falls back to the lock file", () => {
  expect(packageManager("bun@1.1", "pnpm-lock.yaml")).toBe("bun");
  expect(packageManager("deno@2.0.0", "yarn.lock")).toBe("yarn");
  expect(packageManager("pnpm", "yarn.lock")).toBe("yarn");
  expect(packageManager("xpnpm@9", "yarn.lock")).toBe("yarn");
  expect(packageManager("pnpm@x", null)).toBeNull();
});

test("no field and no lock file: no manager", () => {
  expect(packageManager(null, null)).toBeNull();
});

test("every Python lock file names its manager", () => {
  expect(PYTHON_LOCK_FILES.map((lock) => [lock, PYTHON_LOCK_MANAGER[lock]])).toEqual([
    ["uv.lock", "uv"],
    ["poetry.lock", "poetry"],
    ["pdm.lock", "pdm"],
  ]);
});
