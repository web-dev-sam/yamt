import "../style.css";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import { DEFAULT_KEYS, loadFixture, type FileMergeData } from "../ipc";
import {
  LanguageServers,
  type DocVersion,
  type FormatReply,
  type OpenDocument,
  type ResultDocument,
  type ServerProblem,
} from "../lsp";
import { MergeController, type MergeHosts, type MergeOptions } from "./index";

const WIDTH = 1200;
const HEIGHT = 700;
const SCREENSHOT = "/tmp/yamt-lsp-editor/problem-tooltip.png";
const MESSAGE = "'undefinedThing' is not defined. Consider declaring it before this line.";
const LONG_LINE = 4;
const PROBLEM_START = 26;
const PROBLEM_END = 40;
const BLOCK = "<<<<<<< ours\n=======\n";
const MIDDLE = [
  "const a = 1;",
  "const b = 2;",
  "<<<<<<< ours",
  "=======",
  "const misspelled = [a, b, undefinedThing];",
  ">>>>>>> theirs",
  "const c = 3;",
  "",
].join("\n");
const PROBLEM: ServerProblem = {
  from: { line: LONG_LINE, character: PROBLEM_START },
  to: { line: LONG_LINE, character: PROBLEM_END },
  severity: "error",
  message: MESSAGE,
  source: "oxc",
  code: "eslint(no-undef)",
};

class ProbeServers extends LanguageServers {
  readonly calls: string[] = [];
  doc: ResultDocument | null = null;
  reply: (sent: string) => FormatReply = () => ({ kind: "noFormatter" });

  constructor() {
    super(null);
  }

  override open(doc: ResultDocument): OpenDocument {
    this.doc = doc;
    this.calls.push(`open ${doc.path}`);
    return {
      changed: () => this.calls.push("changed"),
      format: () => Promise.resolve(this.reply(doc.take(version(2)))),
      close: () => this.calls.push("close"),
    };
  }
}

const roots: HTMLElement[] = [];

function isVersion(n: number): n is DocVersion {
  return Number.isSafeInteger(n) && n > 0;
}

function version(n: number): DocVersion {
  if (!isVersion(n)) {
    throw new RangeError(`not a document version: ${n}`);
  }
  return n;
}

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

function sideText(block: string): string {
  const end = MIDDLE.indexOf(">>>>>>> theirs\n") + ">>>>>>> theirs\n".length;
  return MIDDLE.slice(0, MIDDLE.indexOf(BLOCK)) + block + MIDDLE.slice(end);
}

async function data(): Promise<FileMergeData> {
  return loadFixture("src/probe.ts", {
    "probe.json": {
      path: "src/probe.ts",
      deleted: null,
      middle: { kind: "Stages", text: MIDDLE },
      local: sideText("const ours = 1;\n"),
      remote: sideText("const theirs = 2;\nconst more = 3;\n"),
      eol: "Lf",
      disk_version: 0,
      chunks: [
        {
          chunk: {
            id: 0,
            kind: "Conflict",
            base: { start: 2, len: 4 },
            local: { start: 2, len: 1 },
            remote: { start: 2, len: 2 },
          },
          middle: { start: 2, len: 4 },
          words: {
            chunk: 0,
            local: { changed: [], removed_at: [] },
            remote: { changed: [], removed_at: [] },
          },
          waiting: {
            kind: "Markers",
            open: "<<<<<<< ours",
            between: ["======="],
            close: ">>>>>>> theirs",
          },
        },
      ],
    },
  });
}

function options(servers: LanguageServers | null, readOnly = false): MergeOptions {
  return {
    readOnly,
    preferences: { theme: "dark", keys: DEFAULT_KEYS },
    collapsed: false,
    servers,
  };
}

function opened(servers: ProbeServers): ResultDocument {
  if (servers.doc === null) {
    throw new Error("the Result was not opened");
  }
  return servers.doc;
}

function found<T extends Element>(node: T | null, what: string): T {
  if (node === null) {
    throw new Error(`no ${what}`);
  }
  return node;
}

function covers(tooltip: HTMLElement, x: number, y: number): boolean {
  return tooltip.contains(document.elementFromPoint(x, y));
}

beforeEach(async () => {
  await page.viewport(WIDTH, HEIGHT);
});

afterEach(() => {
  roots.splice(0).forEach((root) => root.remove());
});

test("a problem's tooltip inside will-change: transform wrappers shows its message on top of the panes", async () => {
  const hosts = mount();
  const servers = new ProbeServers();
  const controller = new MergeController(await data(), hosts, options(servers));
  const doc = opened(servers);

  doc.take(version(1));
  doc.showProblems("oxlint", version(1), [PROBLEM]);
  const range = found(hosts.center.querySelector(".cm-lintRange-error"), "underline");
  await userEvent.hover(range);
  const tooltip = await vi.waitFor(
    () => found(document.querySelector<HTMLElement>(".cm-tooltip-lint"), "tooltip yet"),
    { timeout: 3000 },
  );
  const shown = tooltip.getBoundingClientRect();
  const under = range.getBoundingClientRect();
  const rightStrip = hosts.strips[1].getBoundingClientRect();
  const middle = shown.top + shown.height / 2;
  const overStrip =
    (Math.max(shown.left, rightStrip.left) + Math.min(shown.right, rightStrip.right)) / 2;
  await page.screenshot({ path: SCREENSHOT });

  expect(range.textContent).toBe("undefinedThing");
  expect(getComputedStyle(range).textDecorationStyle).toBe("wavy");
  expect(tooltip.textContent).toContain(MESSAGE);
  expect(tooltip.textContent).toContain("oxlint eslint(no-undef)");
  expect(shown.width).toBeGreaterThan(0);
  expect(shown.height).toBeGreaterThan(0);
  expect(shown.left).toBeGreaterThanOrEqual(0);
  expect(shown.right).toBeLessThanOrEqual(WIDTH);
  expect(shown.bottom).toBeLessThanOrEqual(under.top + 1);
  expect(shown.right).toBeGreaterThan(rightStrip.left);
  expect(covers(tooltip, shown.left + 4, middle)).toBe(true);
  expect(covers(tooltip, overStrip, middle)).toBe(true);

  controller.destroy();
});

test("the controller opens its Result, says changed when it is typed in, counts problems, and closes on destroy", async () => {
  const hosts = mount();
  const servers = new ProbeServers();
  const controller = new MergeController(await data(), hosts, options(servers));
  const heard: unknown[] = [];
  controller.onProblemsChange((counts) => heard.push(counts));
  const doc = opened(servers);

  doc.take(version(1));
  doc.showProblems("oxlint", version(1), [PROBLEM, { ...PROBLEM, severity: "warning" }]);
  await userEvent.click(found(hosts.center.querySelector(".cm-line"), "first line"));
  await userEvent.keyboard("x");
  const counts = controller.problems();
  controller.destroy();

  expect(servers.calls).toEqual(["open src/probe.ts", "changed", "close"]);
  expect(heard).toEqual([{ errors: 1, warnings: 1, other: 0 }]);
  expect(counts).toEqual({ errors: 1, warnings: 1, other: 0 });
});

test("a read-only controller, or one without servers, opens nothing and formats nothing", async () => {
  const servers = new ProbeServers();
  const readOnly = new MergeController(await data(), mount(), options(servers, true));
  const without = new MergeController(await data(), mount(), options(null));

  await expect(readOnly.format()).resolves.toEqual({ kind: "noFormatter" });
  await expect(without.format()).resolves.toEqual({ kind: "noFormatter" });
  expect(servers.calls).toEqual([]);
  expect(readOnly.problems()).toEqual({ errors: 0, warnings: 0, other: 0 });

  readOnly.destroy();
  without.destroy();
});

test("format applies the formatter's result through the controller as one undo step", async () => {
  const servers = new ProbeServers();
  const controller = new MergeController(await data(), mount(), options(servers));
  const result = MIDDLE.replace("const a = 1;", "const a = 1; // formatted");
  servers.reply = (sent) => ({ kind: "formatted", server: "oxfmt", sent, result });

  const outcome = await controller.format();
  const formatted = controller.resultText();
  controller.undo();

  expect(outcome).toEqual({ kind: "formatted", server: "oxfmt" });
  expect(formatted).toBe(result);
  expect(controller.resultText()).toBe(MIDDLE);

  controller.destroy();
});
