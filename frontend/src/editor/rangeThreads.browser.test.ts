import "../style.css";
import { searchPanelOpen } from "@codemirror/search";
import { EditorView } from "@codemirror/view";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import { DEFAULT_KEYS, loadCompareFixture, unchangedThreadLine, type ThreadLine } from "../ipc";
import { RangeController, type CompareHosts, type RangeEvents, type ShownThread } from "./index";
import { found } from "./paneHarness";

const WIDTH = 1200;
const HEIGHT = 700;
const PANE_PX = 500;
const WAIT_MS = 3000;
const GROWN_PX = 200;
const FAR_PX = 10_000;
const SIDEWAYS_PX = 300;
const LINES = 800;
const LONG_LINE = `const long = "${"x".repeat(400)}";`;
const MOUNTED = "data-range-threads-probe";
const KEY = "thread-1";

function text(changed: string): string {
  const lines = Array.from({ length: LINES }, (_, index) => `const line${index} = ${index};`);
  lines[0] = LONG_LINE;
  lines[10] = changed;
  return lines.join("\n");
}

const LEFT = text("const changed = old;");
const RIGHT = text("const changed = new;");
const NO_WORDS = { changed: [], removals: [] };
const CASE = {
  left: LEFT,
  right: RIGHT,
  differences: [
    {
      left: { start: 10, len: 1 },
      right: { start: 10, len: 1 },
      words: { left: NO_WORDS, right: NO_WORDS },
    },
  ],
};
const THREAD: ShownThread = {
  key: KEY,
  line: unchangedThreadLine("left", { left: 2, right: 2 }),
  shown: "open",
};

type Opened = {
  readonly hosts: CompareHosts;
  readonly controller: RangeController;
  readonly threadHosts: () => ReadonlyMap<string, HTMLElement>;
  readonly started: ThreadLine[];
  readonly toggled: (readonly string[])[];
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

async function opened(): Promise<Opened> {
  const hosts = mount();
  const { comparison } = await loadCompareFixture("threads", { "threads.json": CASE });
  let shown: ReadonlyMap<string, HTMLElement> = new Map();
  const started: ThreadLine[] = [];
  const toggled: (readonly string[])[] = [];
  const events: RangeEvents = {
    startThread: (line) => started.push(line),
    toggleThreads: (keys) => toggled.push(keys),
    hosts: (next) => {
      shown = next;
    },
  };
  const controller = new RangeController(
    { path: "src/probe.ts", left: LEFT, right: RIGHT, differences: comparison.differences },
    hosts,
    { preferences: { theme: "dark", keys: DEFAULT_KEYS } },
    events,
  );
  controllers.push(controller);
  controller.showThreads([THREAD]);
  return { hosts, controller, threadHosts: () => shown, started, toggled };
}

function hostOf({ threadHosts }: Opened): HTMLElement {
  return found(threadHosts().get(KEY) ?? null, "thread host");
}

function lineTop(host: HTMLElement, number: number): number {
  const view = viewIn(host);
  return view.lineBlockAt(view.state.doc.line(number).from).top;
}

function bandTop(strip: SVGSVGElement): number {
  return found(strip.querySelector("path.chunk-band"), "band").getBoundingClientRect().top;
}

beforeEach(async () => {
  await page.viewport(WIDTH, HEIGHT);
});

afterEach(() => {
  controllers.splice(0).forEach((controller) => controller.destroy());
  document.querySelectorAll(`[${MOUNTED}]`).forEach((wrapper) => wrapper.remove());
});

test("a host growing by 200 px moves the next line in both columns by 200 px and the band's edges with it", async () => {
  const probe = await opened();
  const { hosts } = probe;
  await vi.waitFor(() => expect(hosts.strip.querySelector("path.chunk-band")).not.toBeNull(), {
    timeout: WAIT_MS,
  });
  const before = { left: lineTop(hosts.left, 4), right: lineTop(hosts.right, 4) };
  const band = bandTop(hosts.strip);

  hostOf(probe).append(box(`height: ${GROWN_PX}px`));

  await vi.waitFor(
    () => {
      expect(lineTop(hosts.left, 4) - before.left).toBe(GROWN_PX);
      expect(lineTop(hosts.right, 4) - before.right).toBe(GROWN_PX);
      expect(bandTop(hosts.strip) - band).toBe(GROWN_PX);
    },
    { timeout: WAIT_MS },
  );
  const cells = [hosts.left, hosts.right].map(
    (host) => found(host.querySelector<HTMLElement>(".cm-thread-row"), "row").offsetHeight,
  );
  expect(cells).toEqual([GROWN_PX, GROWN_PX]);
});

test("typing in a textarea inside a host leaves both documents unchanged and Ctrl+F there opens no find bar", async () => {
  const probe = await opened();
  const field = document.createElement("textarea");
  hostOf(probe).append(field);

  await userEvent.click(field);
  await userEvent.keyboard("hello{Enter}{Backspace}{Control>}f{/Control}");

  expect(field.value).toBe("hello");
  expect(document.activeElement).toBe(field);
  for (const host of [probe.hosts.left, probe.hosts.right]) {
    const view = viewIn(host);
    expect(searchPanelOpen(view.state)).toBe(false);
  }
  expect(viewIn(probe.hosts.left).state.sliceDoc()).toBe(LEFT);
  expect(viewIn(probe.hosts.right).state.sliceDoc()).toBe(RIGHT);
});

test("scrolling 10,000 px away and back gives the same host node with the textarea's text and focus kept", async () => {
  const probe = await opened();
  const host = hostOf(probe);
  const field = document.createElement("textarea");
  host.append(field);
  await userEvent.click(field);
  await userEvent.keyboard("kept");
  const { scrollDOM } = viewIn(probe.hosts.left);

  scrollDOM.scrollTop = FAR_PX;
  await vi.waitFor(() => expect(host.isConnected).toBe(false), { timeout: WAIT_MS });
  scrollDOM.scrollTop = 0;
  await vi.waitFor(() => expect(host.isConnected).toBe(true), { timeout: WAIT_MS });
  await vi.waitFor(() => expect(document.activeElement).toBe(field), { timeout: WAIT_MS });

  expect(probe.threadHosts().get(KEY)).toBe(host);
  expect(field.value).toBe("kept");
});

test("horizontal scroll leaves the box in place", async () => {
  const probe = await opened();
  const host = hostOf(probe);
  host.append(box("height: 40px"));
  const { scrollDOM } = viewIn(probe.hosts.left);
  await vi.waitFor(() => expect(host.getBoundingClientRect().height).toBe(40), {
    timeout: WAIT_MS,
  });
  const before = host.getBoundingClientRect().left;

  scrollDOM.scrollLeft = SIDEWAYS_PX;
  await vi.waitFor(() => expect(scrollDOM.scrollLeft).toBe(SIDEWAYS_PX), { timeout: WAIT_MS });

  expect(host.getBoundingClientRect().left).toBe(before);
});

test("a press on a line number starts a thread there; a press on the count toggles that line's threads", async () => {
  const probe = await opened();
  const numbers = [
    ...probe.hosts.left.querySelectorAll<HTMLElement>(".cm-lineNumbers .cm-gutterElement"),
  ];
  const count = found(probe.hosts.left.querySelector<HTMLElement>(".cm-thread-count"), "count");
  const fifth = found(numbers.find((number) => number.textContent === "5") ?? null, "line 5");

  await userEvent.click(fifth);
  await userEvent.click(count);

  expect(probe.started).toEqual([{ kind: "unchangedOnLeft", left: 4, right: 4 }]);
  expect(probe.toggled).toEqual([[KEY]]);
  expect(count.textContent).toBe("1");
});
