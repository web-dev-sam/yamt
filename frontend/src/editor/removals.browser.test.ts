import "../style.css";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import { DEFAULT_KEYS, loadFixture, type FileMergeData } from "../ipc";
import { MergeController, type MergeHosts, type MergeOptions } from "./index";

type RawRemoval = { readonly at: { line: number; column: number }; readonly text: string };

const WIDTH = 1200;
const HEIGHT = 700;
const SCREENSHOT = "/tmp/yamt-removal-tooltip/removal-tooltip.png";
const LONG = "export const removedSetting = computeTheDefault(alpha, beta, gamma, delta);";
const KEPT = "call(a, c);";
const MID_COLUMN = KEPT.indexOf("c)");
const REMOVALS: readonly RawRemoval[] = [
  { at: { line: 1, column: 0 }, text: `${LONG}\n` },
  { at: { line: 1, column: MID_COLUMN }, text: "b, " },
];
const BAR_PX = 4;
const BAR_LEFT_PX = -1;
const HALF_CHARACTER_PX = 4;
const HOVER_REST_MS = 600;
const OPEN_WAIT_MS = 3000;
const OPTIONS: MergeOptions = {
  readOnly: false,
  preferences: { theme: "dark", keys: DEFAULT_KEYS },
  collapsed: false,
  servers: null,
};

const roots: HTMLElement[] = [];

function box(style: string): HTMLDivElement {
  const node = document.createElement("div");
  node.setAttribute("style", style);
  return node;
}

function strip(): SVGSVGElement {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("style", "display: block; width: 100%; height: 100%");
  return svg;
}

function mount(): MergeHosts {
  const wrapper = box(
    "position: fixed; inset: 40px 0 auto 0; height: 400px; display: grid; grid-template-columns: 1fr 40px 1fr 40px 1fr; will-change: transform",
  );
  const pane = "min-width: 0; min-height: 0; height: 400px";
  const hosts: MergeHosts = {
    left: box(pane),
    center: box(pane),
    right: box(pane),
    strips: [strip(), strip()],
  };
  const [leftStrip, rightStrip] = hosts.strips.map((svg) => {
    const layer = box("min-height: 0; will-change: transform");
    layer.append(svg);
    return layer;
  });
  wrapper.append(hosts.left, leftStrip ?? "", hosts.center, rightStrip ?? "", hosts.right);
  document.body.append(wrapper);
  roots.push(wrapper);
  return hosts;
}

async function data(removals: readonly RawRemoval[]): Promise<FileMergeData> {
  const base = ["const a = 1;", LONG, "call(a, b, c);", "const z = 0;", ""].join("\n");
  return loadFixture("src/probe.ts", {
    "probe.json": {
      path: "src/probe.ts",
      deleted: null,
      middle: { kind: "Stages", text: base },
      local: ["const a = 1;", KEPT, "const z = 0;", ""].join("\n"),
      remote: base,
      eol: "Lf",
      disk_version: 0,
      chunks: [
        {
          chunk: {
            id: 0,
            kind: "LocalOnly",
            base: { start: 1, len: 2 },
            local: { start: 1, len: 1 },
            remote: { start: 1, len: 2 },
          },
          middle: { start: 1, len: 2 },
          words: {
            chunk: 0,
            local: { changed: [], removals },
            remote: { changed: [], removals: [] },
          },
          waiting: { kind: "SideLines" },
        },
      ],
    },
  });
}

function found<T extends Element>(node: T | null | undefined, what: string): T {
  if (node === null || node === undefined) {
    throw new Error(`no ${what}`);
  }
  return node;
}

function shownTooltip(): HTMLElement | null {
  return document.querySelector<HTMLElement>(".removal-tooltip");
}

async function openedTooltip(): Promise<HTMLElement> {
  return vi.waitFor(() => found(shownTooltip(), "tooltip yet"), { timeout: OPEN_WAIT_MS });
}

function covers(tooltip: HTMLElement, x: number, y: number): boolean {
  return tooltip.contains(document.elementFromPoint(x, y));
}

// Nothing signals a hover that opened no tooltip, so the pointer rests twice CodeMirror's hover
// time (300 ms, @codemirror/view hoverTooltip) on the platform clock before the check.
async function rest(): Promise<void> {
  await new Promise<void>((done) => {
    setTimeout(() => done(), HOVER_REST_MS);
  });
}

async function hoverBeside(bar: HTMLElement, dx: number): Promise<void> {
  const line = found(bar.closest<HTMLElement>(".cm-line"), "line");
  const lineBox = line.getBoundingClientRect();
  const barBox = bar.getBoundingClientRect();
  const x = (dx < 0 ? barBox.left : barBox.right) + dx - lineBox.left;
  await userEvent.hover(line, { position: { x, y: barBox.height / 2 } });
}

beforeEach(async () => {
  await page.viewport(WIDTH, HEIGHT);
});

afterEach(() => {
  roots.splice(0).forEach((root) => root.remove());
});

test("a bar keeps the owner's geometry: a 4 px box, the bar 4 px wide from 1 px left of it", async () => {
  const hosts = mount();
  const controller = new MergeController(await data(REMOVALS), hosts, OPTIONS);
  const bar = found(hosts.left.querySelector<HTMLElement>(".chunk-removal"), "bar");
  const after = getComputedStyle(bar, "::after");

  expect(bar.getBoundingClientRect().width).toBe(BAR_PX);
  expect(after.width).toBe(`${BAR_PX}px`);
  expect(after.left).toBe(`${BAR_LEFT_PX}px`);

  controller.destroy();
});

test("hovering a bar shows its removed text above the panes; beside it none; applying its side closes it", async () => {
  const hosts = mount();
  const controller = new MergeController(await data(REMOVALS), hosts, OPTIONS);
  const [lineStartBar, midLineBar] = hosts.left.querySelectorAll<HTMLElement>(".chunk-removal");
  const midLine = found(midLineBar, "mid-line bar");

  await hoverBeside(midLine, HALF_CHARACTER_PX);
  await rest();
  const besideRight = shownTooltip();
  await hoverBeside(midLine, -HALF_CHARACTER_PX);
  await rest();
  const besideLeft = shownTooltip();

  await userEvent.hover(found(lineStartBar, "line-start bar"));
  const tooltip = await openedTooltip();
  const shown = tooltip.getBoundingClientRect();
  const leftStrip = hosts.strips[0].getBoundingClientRect();
  const middle = shown.top + shown.height / 2;
  const overStrip = (leftStrip.left + leftStrip.right) / 2;
  await page.screenshot({ path: SCREENSHOT });

  expect(besideRight).toBeNull();
  expect(besideLeft).toBeNull();
  expect(tooltip.textContent).toBe(LONG);
  expect(hosts.left.contains(tooltip)).toBe(false);
  expect(document.body.contains(tooltip)).toBe(true);
  expect(shown.right).toBeGreaterThan(leftStrip.right);
  expect(covers(tooltip, overStrip, middle)).toBe(true);

  controller.applyAllNonConflicting("local");
  await vi.waitFor(() => expect(shownTooltip()).toBeNull(), { timeout: OPEN_WAIT_MS });
  expect(hosts.left.querySelector(".chunk-removal")).toBeNull();

  controller.destroy();
});

test("a whitespace-only removal shows its whitespace as marks", async () => {
  const hosts = mount();
  const removals = [{ at: { line: 1, column: 0 }, text: "\t\n" }];
  const controller = new MergeController(await data(removals), hosts, OPTIONS);

  await userEvent.hover(found(hosts.left.querySelector<HTMLElement>(".chunk-removal"), "bar"));
  const tooltip = await openedTooltip();

  expect(tooltip.textContent).toBe("→↵");
  expect(tooltip.classList.contains("removal-tooltip-whitespace")).toBe(true);

  controller.destroy();
});
