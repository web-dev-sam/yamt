import "../style.css";
import { language } from "@codemirror/language";
import { EditorView } from "@codemirror/view";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import { DEFAULT_KEYS, loadCompareFixture } from "../ipc";
import {
  RangeController,
  type CompareHosts,
  type RangeEvents,
  type RangeOptions,
  type RangeTexts,
} from "./index";
import { found } from "./paneHarness";

const WIDTH = 1200;
const HEIGHT = 700;
const PANE_PX = 500;
const WAIT_MS = 3000;
const SCREENSHOTS = "/tmp/yamt-range";
const MOUNTED = "data-range-probe";
const PATH = "src/probe.ts";
const OPTIONS: RangeOptions = { preferences: { theme: "dark", keys: DEFAULT_KEYS } };
const EVENTS: RangeEvents = { startThread: () => {}, toggleThreads: () => {}, hosts: () => {} };
const LEFT = [
  "const first = 1;",
  "const value = old(a, b);",
  "const same = 2;",
  "call(x);",
  "const last = 3;",
  "",
].join("\n");
const RIGHT = [
  "// added",
  "const first = 1;",
  "const value = new(a);",
  "const same = 2;",
  "call(x, y);",
  "const last = 3;",
  "",
].join("\n");
const CASE = {
  left: LEFT,
  right: RIGHT,
  differences: [
    {
      left: { start: 0, len: 0 },
      right: { start: 0, len: 1 },
      words: {
        left: { changed: [], removals: [] },
        right: { changed: [], removals: [] },
      },
    },
    {
      left: { start: 1, len: 1 },
      right: { start: 2, len: 1 },
      words: {
        left: {
          changed: [
            { line: 1, start: 14, len: 3 },
            { line: 1, start: 19, len: 3 },
          ],
          removals: [],
        },
        right: {
          changed: [{ line: 2, start: 14, len: 3 }],
          removals: [{ at: { line: 2, column: 19 }, text: ", b" }],
        },
      },
    },
    {
      left: { start: 3, len: 1 },
      right: { start: 4, len: 1 },
      words: {
        left: { changed: [], removals: [{ at: { line: 3, column: 6 }, text: ", y" }] },
        right: { changed: [{ line: 4, start: 6, len: 3 }], removals: [] },
      },
    },
  ],
};

function box(style: string): HTMLDivElement {
  const node = document.createElement("div");
  node.setAttribute("style", style);
  return node;
}

function mount(): CompareHosts {
  const wrapper = box(
    `position: fixed; inset: 40px 0 auto 0; height: ${PANE_PX}px; display: grid; grid-template-columns: 1fr 40px 1fr; will-change: transform`,
  );
  wrapper.setAttribute(MOUNTED, "");
  const pane = `min-width: 0; min-height: 0; height: ${PANE_PX}px`;
  const strip = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  strip.setAttribute("style", "display: block; width: 100%; height: 100%");
  const layer = box("min-height: 0; will-change: transform");
  layer.append(strip);
  const hosts = { left: box(pane), right: box(pane), strip };
  wrapper.append(hosts.left, layer, hosts.right);
  document.body.append(wrapper);
  return hosts;
}

function viewIn(host: HTMLElement): EditorView {
  const view = EditorView.findFromDOM(
    found(host.querySelector<HTMLElement>(".cm-editor"), "editor"),
  );
  if (view === null) {
    throw new Error("no view");
  }
  return view;
}

const controllers: RangeController[] = [];

async function opened(): Promise<{ hosts: CompareHosts; controller: RangeController }> {
  const hosts = mount();
  const { comparison } = await loadCompareFixture("probe", { "probe.json": CASE });
  const texts: RangeTexts = {
    path: PATH,
    left: LEFT,
    right: RIGHT,
    differences: comparison.differences,
  };
  const controller = new RangeController(texts, hosts, OPTIONS, EVENTS);
  controllers.push(controller);
  return { hosts, controller };
}

beforeEach(async () => {
  await page.viewport(WIDTH, HEIGHT);
});

afterEach(() => {
  controllers.splice(0).forEach((controller) => controller.destroy());
  document.querySelectorAll(`[${MOUNTED}]`).forEach((wrapper) => wrapper.remove());
});

function markLine(host: HTMLElement, selector: string): { text: string; line: number } {
  const mark = found(host.querySelector<HTMLElement>(selector), selector);
  const view = viewIn(host);
  return { text: mark.textContent, line: view.state.doc.lineAt(view.posAtDOM(mark)).number };
}

test("each column is marked with its own lines from one reply: bands, word marks, removal bars and the strip", async () => {
  const { hosts } = await opened();
  const bands = await vi.waitFor(
    () => {
      const shown = [...hosts.strip.querySelectorAll("path.chunk-band")];
      expect(shown).toHaveLength(3);
      return shown;
    },
    { timeout: WAIT_MS },
  );
  await page.screenshot({ path: `${SCREENSHOTS}/range-dark.png` });

  for (const host of [hosts.left, hosts.right]) {
    expect(host.querySelectorAll(".cm-line.chunk-band.chunk-modified")).toHaveLength(2);
    expect(host.querySelectorAll(".chunk-removal")).toHaveLength(1);
  }
  expect(hosts.left.querySelectorAll(".cm-line.chunk-marker-inserted")).toHaveLength(1);
  expect(hosts.right.querySelectorAll(".cm-line.chunk-band.chunk-inserted")).toHaveLength(1);
  expect(markLine(hosts.left, ".chunk-word-modified")).toEqual({ text: "old", line: 2 });
  expect(markLine(hosts.right, ".chunk-word-modified")).toEqual({ text: "new", line: 3 });
  expect(markLine(hosts.left, ".chunk-removal").line).toBe(4);
  expect(markLine(hosts.right, ".chunk-removal").line).toBe(3);
  expect(bands.every((band) => (band.getAttribute("d") ?? "") !== "")).toBe(true);
});

test("a .ts path loads TypeScript into both columns and colours its keywords", async () => {
  const { hosts } = await opened();

  await vi.waitFor(
    () => {
      for (const host of [hosts.left, hosts.right]) {
        expect(viewIn(host).state.facet(language)?.name).toBe("typescript");
      }
    },
    { timeout: WAIT_MS },
  );
  const line = found(hosts.left.querySelector<HTMLElement>(".cm-line"), "line");
  const keyword = await vi.waitFor(
    () => found(line.querySelector<HTMLElement>("span"), "keyword span"),
    { timeout: WAIT_MS },
  );

  expect(keyword.textContent).toBe("const");
  expect(getComputedStyle(keyword).color).not.toBe(getComputedStyle(line).color);
});

test("moveToChange(down) puts the selection on the next difference, no wrap", async () => {
  const { hosts, controller } = await opened();
  const left = viewIn(hosts.left);

  controller.moveToChange("down");
  const first = left.state.doc.lineAt(left.state.selection.main.head).text;
  controller.moveToChange("down");
  const second = left.state.doc.lineAt(left.state.selection.main.head).text;
  controller.moveToChange("down");
  const past = left.state.doc.lineAt(left.state.selection.main.head).text;

  expect(hosts.left.contains(document.activeElement)).toBe(true);
  expect([first, second, past]).toEqual(["const value = old(a, b);", "call(x);", "call(x);"]);
});

test("typing, Enter, Backspace and Delete change neither column", async () => {
  const { hosts } = await opened();

  for (const host of [hosts.left, hosts.right]) {
    await userEvent.click(found(host.querySelector<HTMLElement>(".cm-content"), "content"));
    await userEvent.keyboard("abc{Enter}{Backspace}{Delete}");
  }

  expect(viewIn(hosts.left).state.sliceDoc()).toBe(LEFT);
  expect(viewIn(hosts.right).state.sliceDoc()).toBe(RIGHT);
});

test("destroy empties both hosts and the strip", async () => {
  const { hosts, controller } = await opened();
  controllers.splice(controllers.indexOf(controller), 1);

  controller.destroy();

  expect([hosts.left, hosts.right, hosts.strip].map((host) => host.childElementCount)).toEqual([
    0, 0, 0,
  ]);
});
