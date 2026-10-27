import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { copyOrSelect } from "./copyOrSelect";

type Page = { written: string[]; selected: unknown[] };

const page: Page = { written: [], selected: [] };

function element(): Element {
  return Object.create(null);
}

function clipboard(write: (text: string) => Promise<void>): void {
  vi.stubGlobal("navigator", { clipboard: { writeText: write } });
}

beforeEach(() => {
  page.written = [];
  page.selected = [];
  vi.stubGlobal("window", {
    getSelection: () => ({
      selectAllChildren: (node: unknown) => {
        page.selected.push(node);
      },
    }),
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

test("a clipboard write that lands copies the text, selects nothing and answers true", async () => {
  clipboard((text) => {
    page.written.push(text);
    return Promise.resolve();
  });

  expect(await copyOrSelect("https://gitlab/x", element())).toBe(true);
  expect(page.written).toEqual(["https://gitlab/x"]);
  expect(page.selected).toEqual([]);
});

test("a refused clipboard write selects the element showing the text and answers false", async () => {
  clipboard(() => Promise.reject(new Error("not allowed")));
  const shown = element();

  expect(await copyOrSelect("https://gitlab/x", shown)).toBe(false);
  expect(page.selected).toEqual([shown]);
});

test("a clipboard that throws at once, or is missing, also selects the element", async () => {
  clipboard(() => {
    throw new Error("no clipboard");
  });
  const shown = element();
  expect(await copyOrSelect("x", shown)).toBe(false);

  vi.stubGlobal("navigator", {});
  expect(await copyOrSelect("x", shown)).toBe(false);
  expect(page.selected).toEqual([shown, shown]);
});

test("a failed write with no element to select only answers false", async () => {
  clipboard(() => Promise.reject(new Error("not allowed")));

  expect(await copyOrSelect("x", null)).toBe(false);
  expect(page.selected).toEqual([]);
});
