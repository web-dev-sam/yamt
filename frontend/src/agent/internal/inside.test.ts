import { expect, test } from "vitest";

import { relativeInside } from "./inside";

const CHECKOUT = "/data/yamt/range/repo/pair/checkout";

test.each([
  ["a file inside", `${CHECKOUT}/src/a.ts`, "src/a.ts"],
  ["a relative path is taken from the checkout", "src/a.ts", "src/a.ts"],
  ["`.` segments and doubled separators are dropped", `${CHECKOUT}/./src//a.ts`, "src/a.ts"],
  ["`..` that stays inside", `${CHECKOUT}/src/../docs/b.md`, "docs/b.md"],
  ["a sibling folder whose name starts with the checkout's", `${CHECKOUT}2/a.ts`, null],
  ["`..` that climbs out", `${CHECKOUT}/../checkout2/a.ts`, null],
  ["`..` back into the checkout", `${CHECKOUT}/../checkout/a.ts`, "a.ts"],
  ["the checkout itself", CHECKOUT, null],
  ["the checkout with a trailing separator", `${CHECKOUT}/`, null],
  ["a parent folder", "/data/yamt", null],
  ["an unrelated absolute path", "/tmp/yamt-record-outside.txt", null],
  ["a relative path climbing out", "../../outside.txt", null],
])("%s", (_, path, expected) => {
  expect(relativeInside(path, CHECKOUT)).toBe(expected);
});

test("a Windows drive in another case and backslashes are inside", () => {
  const folder = "C:\\Users\\Ann\\AppData\\yamt\\checkout";
  expect(relativeInside("c:\\users\\ann\\appdata\\YAMT\\checkout\\src\\a.ts", folder)).toBe(
    "src/a.ts",
  );
  expect(relativeInside("C:/Users/Ann/AppData/yamt/checkout/b.ts", folder)).toBe("b.ts");
});

test("another drive is outside", () => {
  expect(
    relativeInside(
      "D:\\Users\\Ann\\AppData\\yamt\\checkout\\a.ts",
      "C:\\Users\\Ann\\AppData\\yamt\\checkout",
    ),
  ).toBeNull();
});

test("case counts outside a drive-letter folder", () => {
  expect(relativeInside("/Data/yamt/range/repo/pair/checkout/a.ts", CHECKOUT)).toBeNull();
  expect(relativeInside("/data/yamt/range/repo/pair/Checkout/a.ts", CHECKOUT)).toBeNull();
});
