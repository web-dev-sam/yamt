import "../style.css";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import { DEFAULT_KEYS, loadCompareFixture } from "../ipc";
import { CompareController, type CompareEvents, type CompareHosts } from "./index";
import type { CompareOptions } from "./index";
import { found } from "./paneHarness";

const WIDTH = 1200;
const HEIGHT = 700;
const PANE_PX = 500;
const WAIT_MS = 3000;
const LINES = 80;
const DELETED = { start: 30, len: 5 };
const INSERTED_AT = 50;
const INSERTED = 12;
const SHIFT = INSERTED - DELETED.len;
const MIDDLE_LINE = 60;
const BELOW_DIFFERENCES = /^const line(5[7-9]|[67]\d) = \d+;$/;
const HALF = 0.5;
const SCREENSHOTS = "/tmp/yamt-compare";
const MOUNTED = "data-compare-probe";
const OPTIONS: CompareOptions = {
  preferences: { theme: "dark", keys: DEFAULT_KEYS },
  language: { kind: "auto" },
  columnLimit: 8_388_608,
};
const EVENTS: CompareEvents = { settled: () => {}, detected: () => {}, refused: () => {} };

function common(line: number): string {
  return `const line${line} = ${line};`;
}

function leftText(): string {
  const lines = Array.from({ length: LINES }, (_, line) => {
    if (line === 10) {
      return "const value = old(a, b);";
    }
    if (line === 20) {
      return "call(x);";
    }
    return line >= DELETED.start && line < DELETED.start + DELETED.len
      ? `gone ${line}`
      : common(line);
  });
  return [...lines, ""].join("\n");
}

function rightText(): string {
  const lines: string[] = [];
  for (let line = 0; line < LINES; line += 1) {
    if (line === INSERTED_AT) {
      lines.push(...Array.from({ length: INSERTED }, (_, added) => `added ${added}`));
    }
    if (line === 10) {
      lines.push("const value = new(a);");
    } else if (line === 20) {
      lines.push("call(x, y);");
    } else if (line < DELETED.start || line >= DELETED.start + DELETED.len) {
      lines.push(common(line));
    }
  }
  return [...lines, ""].join("\n");
}

const NO_WORDS = { changed: [], removals: [] };
const CASE = {
  left: leftText(),
  right: rightText(),
  differences: [
    {
      left: { start: 10, len: 1 },
      right: { start: 10, len: 1 },
      words: {
        left: {
          changed: [
            { line: 10, start: 14, len: 3 },
            { line: 10, start: 19, len: 3 },
          ],
          removals: [],
        },
        right: {
          changed: [{ line: 10, start: 14, len: 3 }],
          removals: [{ at: { line: 10, column: 19 }, text: ", b" }],
        },
      },
    },
    {
      left: { start: 20, len: 1 },
      right: { start: 20, len: 1 },
      words: {
        left: { changed: [], removals: [{ at: { line: 20, column: 6 }, text: ", y" }] },
        right: { changed: [{ line: 20, start: 6, len: 3 }], removals: [] },
      },
    },
    {
      left: DELETED,
      right: { start: DELETED.start, len: 0 },
      words: { left: NO_WORDS, right: NO_WORDS },
    },
    {
      left: { start: INSERTED_AT, len: 0 },
      right: { start: INSERTED_AT - DELETED.len, len: INSERTED },
      words: { left: NO_WORDS, right: NO_WORDS },
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

function scroller(host: HTMLElement): HTMLElement {
  return found(host.querySelector<HTMLElement>(".cm-scroller"), "scroller");
}

function middleLineText(host: HTMLElement): string | null {
  const area = scroller(host).getBoundingClientRect();
  const hit = document.elementFromPoint(
    area.left + area.width * HALF,
    area.top + area.height * HALF,
  );
  return hit?.closest(".cm-line")?.textContent ?? null;
}

const controllers: CompareController[] = [];

async function opened(): Promise<{ hosts: CompareHosts; controller: CompareController }> {
  const hosts = mount();
  const texts = await loadCompareFixture("probe", { "probe.json": CASE });
  const controller = new CompareController(texts, hosts, OPTIONS, EVENTS);
  controllers.push(controller);
  return { hosts, controller };
}

function cursorLine(): string | null {
  const node = document.getSelection()?.focusNode ?? null;
  const element = node instanceof Element ? node : (node?.parentElement ?? null);
  return element?.closest(".cm-line")?.textContent ?? null;
}

async function stripBands(hosts: CompareHosts): Promise<Element[]> {
  return vi.waitFor(
    () => {
      const shown = [...hosts.strip.querySelectorAll("path.chunk-band")];
      expect(shown).toHaveLength(2);
      return shown;
    },
    { timeout: WAIT_MS },
  );
}

beforeEach(async () => {
  await page.viewport(WIDTH, HEIGHT);
});

afterEach(() => {
  controllers.splice(0).forEach((controller) => controller.destroy());
  document.querySelectorAll(`[${MOUNTED}]`).forEach((wrapper) => wrapper.remove());
  delete document.documentElement.dataset["theme"];
});

test("the strip holds one band per difference on screen, in each difference's tone", async () => {
  const { hosts } = await opened();
  const bands = await stripBands(hosts);

  expect(bands.map((band) => band.getAttribute("class"))).toEqual([
    "chunk-modified chunk-band",
    "chunk-modified chunk-band",
  ]);
  expect(bands.every((band) => (band.getAttribute("d") ?? "") !== "")).toBe(true);
});

test("both columns tint their lines, mark their words and draw removal bars", async () => {
  const { hosts } = await opened();

  for (const host of [hosts.left, hosts.right]) {
    expect(host.querySelectorAll(".cm-line.chunk-band.chunk-modified")).toHaveLength(2);
    expect(host.querySelectorAll(".chunk-word-modified").length).toBeGreaterThan(0);
    expect(host.querySelectorAll(".chunk-removal")).toHaveLength(1);
  }
  expect(hosts.left.querySelector(".chunk-word-modified")?.textContent).toBe("old");
});

test("hovering a removal bar shows the text the column lacks", async () => {
  const { hosts } = await opened();
  const bar = found(hosts.right.querySelector<HTMLElement>(".chunk-removal"), "bar");

  await userEvent.hover(bar);
  const tooltip = await vi.waitFor(
    () => found(document.querySelector<HTMLElement>(".removal-tooltip"), "tooltip"),
    { timeout: WAIT_MS },
  );

  expect(tooltip.textContent).toBe(", b");
});

test("scrolling the left column moves the right one through the differences' anchors", async () => {
  const { hosts } = await opened();
  await stripBands(hosts);
  const left = scroller(hosts.left);
  const right = scroller(hosts.right);
  const line = found(hosts.left.querySelector(".cm-line"), "line").getBoundingClientRect();

  left.scrollTop = (MIDDLE_LINE + HALF) * line.height - PANE_PX * HALF;
  const shown = await vi.waitFor(
    () => {
      const text = middleLineText(hosts.left);
      expect(text).toMatch(BELOW_DIFFERENCES);
      expect(middleLineText(hosts.right)).toBe(text);
      return text;
    },
    { timeout: WAIT_MS },
  );

  expect(shown).toBe(common(MIDDLE_LINE));
  expect(right.scrollTop - left.scrollTop).toBeCloseTo(SHIFT * line.height, 0);
});

test("the toolbar arrows step the left column's cursor to each difference, no wrap", async () => {
  const { hosts, controller } = await opened();

  controller.moveToChange("down");
  const first = cursorLine();
  controller.moveToChange("down");
  controller.moveToChange("down");
  const third = cursorLine();
  controller.moveToChange("down");
  controller.moveToChange("down");
  const past = cursorLine();
  controller.moveToChange("up");
  const back = cursorLine();

  expect(hosts.left.contains(document.activeElement)).toBe(true);
  expect(first).toBe("const value = old(a, b);");
  expect(third).toBe(`gone ${DELETED.start}`);
  expect(past).toBe(common(INSERTED_AT));
  expect(back).toBe(`gone ${DELETED.start}`);
});

test("the find bar in one column gives both columns the same space above line 1", async () => {
  const { hosts } = await opened();
  const content = found(hosts.left.querySelector<HTMLElement>(".cm-content"), "left content");

  await userEvent.click(content);
  await userEvent.keyboard("{Control>}f{/Control}");
  await vi.waitFor(
    () => {
      expect(hosts.left.querySelector(".find-bar")).not.toBeNull();
      expect(hosts.right.querySelector(".cm-editor.find-space")).not.toBeNull();
      expect(hosts.left.querySelector(".cm-editor.find-space")).not.toBeNull();
    },
    { timeout: WAIT_MS },
  );
  const rightContent = found(hosts.right.querySelector<HTMLElement>(".cm-content"), "right");

  expect(hosts.right.querySelector(".find-bar")).toBeNull();
  expect(getComputedStyle(rightContent).paddingTop).toBe(getComputedStyle(content).paddingTop);
});

test("the columns and the strip follow the theme, dark then light", async () => {
  const { hosts, controller } = await opened();
  const [band] = await stripBands(hosts);
  const dark = [
    getComputedStyle(scroller(hosts.left)).backgroundColor,
    getComputedStyle(found(band, "band")).fill,
  ];
  await page.screenshot({ path: `${SCREENSHOTS}/compare-dark.png` });

  document.documentElement.dataset["theme"] = "light";
  controller.setPreferences({ theme: "light", keys: DEFAULT_KEYS });
  const light = [
    getComputedStyle(scroller(hosts.left)).backgroundColor,
    getComputedStyle(found(band, "band")).fill,
  ];
  await page.screenshot({ path: `${SCREENSHOTS}/compare-light.png` });

  expect(light[0]).not.toBe(dark[0]);
  expect(light[1]).not.toBe(dark[1]);
});
