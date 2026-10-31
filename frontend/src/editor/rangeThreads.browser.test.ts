import "../style.css";
import { searchPanelOpen } from "@codemirror/search";
import type { TransactionSpec } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import {
  changedThreadLine,
  DEFAULT_KEYS,
  diffLineOf,
  loadCompareFixture,
  onePlace,
  unchangedThreadLine,
  type ThreadPlace,
} from "../ipc";
import { RangeController, type CompareHosts, type RangeEvents, type ShownThread } from "./index";
import { showTint } from "./internal/threadTint";
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
const BAND_BELOW_TOP_PX = 300;
const OUTSIDE_GAP_PX = 80;
const LEFT_TOP = 1;
const RIGHT_TOP = 7;
const RIGHT_BOTTOM = 9;
const LEFT_BOTTOM = 15;
const SCROLLED_LINES = 5;
const LAST_SHOWN_RIGHT = 25;
const BOX_PX = 40;
const SCREENSHOTS = "/tmp/yamt-range";
const TEXT_CLEAR_PX = 20;

type Edges = { readonly top: number; readonly bottom: number };

function text(changed: string): string {
  const lines = Array.from({ length: LINES }, (_, index) => `const line${index} = ${index};`);
  lines[0] = LONG_LINE;
  lines[10] = changed;
  return lines.join("\n");
}

type Lines = { readonly start: number; readonly len: number };
type ProbeCase = {
  readonly left: string;
  readonly right: string;
  readonly differences: readonly { readonly left: Lines; readonly right: Lines }[];
  readonly threads: readonly ShownThread[];
};

const LEFT = text("const changed = old;");
const RIGHT = text("const changed = new;");
const NO_WORDS = { changed: [], removals: [] };
const THREAD: ShownThread = {
  key: KEY,
  place: onePlace(unchangedThreadLine("left", { left: 2, right: 2 })),
  shown: "open",
};
const MODIFIED: ProbeCase = {
  left: LEFT,
  right: RIGHT,
  differences: [{ left: { start: 10, len: 1 }, right: { start: 10, len: 1 } }],
  threads: [THREAD],
};

const DELETED_AT = 300;
const DELETED_LINES = 2;
const DELETION_RIGHT = LEFT.split("\n")
  .filter((_, index) => index < DELETED_AT || index >= DELETED_AT + DELETED_LINES)
  .join("\n");
const DELETION: ProbeCase = {
  left: LEFT,
  right: DELETION_RIGHT,
  differences: [
    { left: { start: DELETED_AT, len: DELETED_LINES }, right: { start: DELETED_AT, len: 0 } },
  ],
  threads: [
    {
      key: KEY,
      place: onePlace(changedThreadLine("left", DELETED_AT + DELETED_LINES - 1)),
      shown: "open",
    },
  ],
};

const ADDED_FILE: ProbeCase = {
  left: "",
  right: "one\ntwo\n",
  differences: [{ left: { start: 0, len: 0 }, right: { start: 0, len: 2 } }],
  threads: [],
};

const DRAG_RIGHT = RIGHT.split("\n")
  .flatMap((line, index) =>
    index === 10 ? ["const changed = new a;", "const changed = new b;"] : [line],
  )
  .flatMap((line, index) => (index === 21 ? ["const added = 1;", line] : [line]))
  .join("\n");
const DRAG: ProbeCase = {
  left: LEFT,
  right: DRAG_RIGHT,
  differences: [
    { left: { start: 10, len: 1 }, right: { start: 10, len: 2 } },
    { left: { start: 20, len: 0 }, right: { start: 21, len: 1 } },
  ],
  threads: [],
};
const ACROSS: ThreadPlace = {
  start: diffLineOf(unchangedThreadLine("right", { left: 8, right: 8 })),
  end: changedThreadLine("right", 11),
};

const PLAIN = LEFT.split("\n");
const REMOVED_AT = 5;
const ADDED_AT = 7;
const TONES: ProbeCase = {
  left: LEFT,
  right: PLAIN.flatMap((line, index) => {
    if (index === REMOVED_AT) {
      return [];
    }
    return index === ADDED_AT + 1 ? ["const added = 1;", line] : [line];
  }).join("\n"),
  differences: [
    { left: { start: REMOVED_AT, len: 1 }, right: { start: REMOVED_AT, len: 0 } },
    { left: { start: ADDED_AT + 1, len: 0 }, right: { start: ADDED_AT, len: 1 } },
  ],
  threads: [],
};
const TONES_PLACE: ThreadPlace = {
  start: diffLineOf(changedThreadLine("left", REMOVED_AT)),
  end: changedThreadLine("right", ADDED_AT),
};

type Opened = {
  readonly hosts: CompareHosts;
  readonly controller: RangeController;
  readonly threadHosts: () => ReadonlyMap<string, HTMLElement>;
  readonly started: ThreadPlace[];
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

async function measured(host: HTMLElement): Promise<EditorView> {
  const view = viewIn(host);
  const line = found(view.contentDOM.querySelector<HTMLElement>(".cm-line"), "line");
  await vi.waitFor(() => expect(view.defaultLineHeight).toBe(line.getBoundingClientRect().height), {
    timeout: WAIT_MS,
  });
  return view;
}

const controllers: RangeController[] = [];

async function opened(probe: ProbeCase = MODIFIED, collapsed = false): Promise<Opened> {
  const hosts = mount();
  const differences = probe.differences.map((difference) => ({
    ...difference,
    words: { left: NO_WORDS, right: NO_WORDS },
  }));
  const files = { "threads.json": { left: probe.left, right: probe.right, differences } };
  const { comparison } = await loadCompareFixture("threads", files);
  let shown: ReadonlyMap<string, HTMLElement> = new Map();
  const started: ThreadPlace[] = [];
  const toggled: (readonly string[])[] = [];
  const events: RangeEvents = {
    startThread: (place) => started.push(place),
    toggleThreads: (keys) => toggled.push(keys),
    hosts: (next) => {
      shown = next;
    },
  };
  const controller = new RangeController(
    {
      path: "src/probe.ts",
      left: probe.left,
      right: probe.right,
      differences: comparison.differences,
    },
    hosts,
    { preferences: { theme: "dark", keys: DEFAULT_KEYS }, collapsed, threads: [] },
    events,
  );
  controllers.push(controller);
  controller.showThreads(probe.threads);
  await measured(hosts.left);
  await measured(hosts.right);
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

function bandEdges(strip: SVGSVGElement): Readonly<Record<"left" | "right", Edges>> {
  const path = found(strip.querySelector("path.chunk-band"), "band").getAttribute("d") ?? "";
  const numbers = (path.match(/-?[\d.]+/g) ?? []).map(Number);
  function at(index: number): number {
    return numbers[index] ?? Number.NaN;
  }
  return {
    left: { top: at(LEFT_TOP), bottom: at(LEFT_BOTTOM) },
    right: { top: at(RIGHT_TOP), bottom: at(RIGHT_BOTTOM) },
  };
}

function lineNumber(host: HTMLElement, label: string): HTMLElement {
  const numbers = [...host.querySelectorAll<HTMLElement>(".cm-lineNumbers .cm-gutterElement")];
  return found(numbers.find((number) => number.textContent === label) ?? null, `line ${label}`);
}

type Point = { readonly clientX: number; readonly clientY: number };

function centre(element: Element): Point {
  const rect = element.getBoundingClientRect();
  return { clientX: (rect.left + rect.right) / 2, clientY: (rect.top + rect.bottom) / 2 };
}

function pressOn(cell: HTMLElement): void {
  const init = { bubbles: true, cancelable: true, button: 0, ...centre(cell) };
  cell.dispatchEvent(new MouseEvent("mousedown", init));
}

function moveTo(point: Point): void {
  document.body.dispatchEvent(new PointerEvent("pointermove", { bubbles: true, ...point }));
}

function release(cell: HTMLElement): void {
  cell.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, ...centre(cell) }));
}

function heldDrag(from: HTMLElement, to: HTMLElement): void {
  pressOn(from);
  moveTo(centre(to));
}

function labelOf(cell: Element): string {
  const text = cell.textContent;
  const badge = cell.querySelector(".cm-thread-count")?.textContent ?? "";
  return text.slice(0, text.length - badge.length);
}

function tinted(host: HTMLElement): string[] {
  const cells = host.querySelectorAll(".cm-lineNumbers .cm-gutterElement.cm-thread-tint");
  return [...cells].map(labelOf);
}

function tintedLines(host: HTMLElement): number {
  return host.querySelectorAll(".cm-line.cm-thread-tint").length;
}

function lineSpot(host: HTMLElement, number: number): Point {
  const view = viewIn(host);
  const block = view.lineBlockAt(view.state.doc.line(number).from);
  return {
    clientX: view.scrollDOM.getBoundingClientRect().right - TEXT_CLEAR_PX,
    clientY: view.documentTop + (block.top + block.bottom) / 2,
  };
}

async function pixelsAt(
  spots: Readonly<Record<string, Point>>,
): Promise<Readonly<Record<string, string>>> {
  const png = await page.screenshot({ save: false });
  const image = await createImageBitmap(await (await fetch(`data:image/png;base64,${png}`)).blob());
  const canvas = new OffscreenCanvas(image.width, image.height);
  const context = canvas.getContext("2d");
  if (context === null) {
    throw new Error("no 2d context");
  }
  context.drawImage(image, 0, 0);
  const scale = image.width / window.innerWidth;
  const entries = Object.entries<Point>(spots).map(([name, { clientX, clientY }]) => {
    const pixel = context.getImageData(
      Math.round(clientX * scale),
      Math.round(clientY * scale),
      1,
      1,
    );
    return [name, [...pixel.data].join(",")];
  });
  return Object.fromEntries(entries);
}

function escapeDown(): KeyboardEvent {
  return new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true });
}

function nextFrame(): Promise<number> {
  return new Promise((resolve) => requestAnimationFrame(resolve));
}

async function nextFrames(): Promise<void> {
  await nextFrame();
  await nextFrame();
}

function tintDispatches(calls: readonly (readonly TransactionSpec[])[]): number {
  return calls.filter((specs) =>
    specs.some(({ effects }) => [effects ?? []].flat().some((effect) => effect.is(showTint))),
  ).length;
}

beforeEach(async () => {
  await page.viewport(WIDTH, HEIGHT);
});

afterEach(() => {
  controllers.splice(0).forEach((controller) => controller.destroy());
  document.querySelectorAll(`[${MOUNTED}]`).forEach((wrapper) => wrapper.remove());
  delete document.documentElement.dataset["theme"];
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

test("a box fits inside its column and horizontal scroll leaves it in place", async () => {
  const probe = await opened();
  const host = hostOf(probe);
  host.append(box("height: 40px"));
  const { scrollDOM } = viewIn(probe.hosts.left);
  await vi.waitFor(
    () => {
      const placed = host.getBoundingClientRect();
      expect(placed.height).toBe(40);
      expect(placed.right).toBeLessThanOrEqual(scrollDOM.getBoundingClientRect().right);
    },
    { timeout: WAIT_MS },
  );
  const before = host.getBoundingClientRect().left;

  scrollDOM.scrollLeft = SIDEWAYS_PX;
  await vi.waitFor(() => expect(scrollDOM.scrollLeft).toBe(SIDEWAYS_PX), { timeout: WAIT_MS });

  expect(host.getBoundingClientRect().left).toBe(before);
});

test("a press and release on one line number starts a one-line thread on release, nothing on press; a press on the count toggles that line's threads", async () => {
  const probe = await opened();
  const count = found(probe.hosts.left.querySelector<HTMLElement>(".cm-thread-count"), "count");
  const fifth = lineNumber(probe.hosts.left, "5");

  pressOn(fifth);
  const onPress = [...probe.started];
  release(fifth);
  await userEvent.click(count);

  expect(onPress).toEqual([]);
  expect(probe.started).toEqual([onePlace(unchangedThreadLine("left", { left: 4, right: 4 }))]);
  expect(probe.toggled).toEqual([[KEY]]);
  expect(count.textContent).toBe("1");
});

test("a removed line's row in a pure deletion is inside the band in both columns and keeps the lines above in step", async () => {
  const probe = await opened(DELETION);
  const { hosts } = probe;
  hostOf(probe).append(box(`height: ${GROWN_PX}px`));
  const view = await measured(hosts.left);
  const left = view.scrollDOM;
  const lineHeight = view.defaultLineHeight;
  const aboveBand = lineTop(hosts.left, DELETED_AT + 1) - BAND_BELOW_TOP_PX;
  left.scrollTop = aboveBand - 1;
  await vi.waitFor(
    () =>
      expect(hosts.left.querySelector<HTMLElement>(".cm-thread-row")?.offsetHeight).toBe(GROWN_PX),
    { timeout: WAIT_MS },
  );

  left.scrollTop = aboveBand;

  await vi.waitFor(
    () => {
      const band = bandEdges(hosts.strip);
      expect(band.left.bottom - band.left.top).toBeCloseTo(
        DELETED_LINES * lineHeight + GROWN_PX,
        0,
      );
      expect(band.right.bottom - band.right.top).toBeCloseTo(GROWN_PX, 0);
      expect(band.right.top).toBeCloseTo(band.left.top, 0);
      expect(viewIn(hosts.right).scrollDOM.scrollTop).toBeCloseTo(left.scrollTop, 0);
    },
    { timeout: WAIT_MS },
  );
});

test("a field the user left by pressing outside the boxes is not focused again when its row comes back", async () => {
  const probe = await opened();
  const host = hostOf(probe);
  const field = document.createElement("textarea");
  host.append(field);
  const outside = box(
    `position: fixed; top: ${PANE_PX + OUTSIDE_GAP_PX}px; height: 40px; width: 200px`,
  );
  outside.setAttribute(MOUNTED, "");
  document.body.append(outside);
  await userEvent.click(field);
  await userEvent.click(outside);
  const { scrollDOM } = viewIn(probe.hosts.left);

  scrollDOM.scrollTop = FAR_PX;
  await vi.waitFor(() => expect(host.isConnected).toBe(false), { timeout: WAIT_MS });
  scrollDOM.scrollTop = 0;
  await vi.waitFor(() => expect(host.isConnected).toBe(true), { timeout: WAIT_MS });
  viewIn(probe.hosts.left).dispatch({ selection: { anchor: 0 } });

  expect(document.activeElement).not.toBe(field);
});

test("an added file's empty left column and the empty line after a last newline start no thread", async () => {
  const probe = await opened(ADDED_FILE);

  await userEvent.click(lineNumber(probe.hosts.left, "1"));
  await userEvent.click(lineNumber(probe.hosts.right, "3"));
  await userEvent.click(lineNumber(probe.hosts.right, "2"));

  expect(probe.started).toEqual([onePlace(changedThreadLine("right", 1))]);
});

test("a drag over four right-column numbers across unchanged and added lines tints them and the change's removed lines on the left, and starts the range on release", async () => {
  const probe = await opened(DRAG);
  const { left, right } = probe.hosts;
  const to = lineNumber(right, "12");

  heldDrag(lineNumber(right, "9"), to);

  await vi.waitFor(
    () => {
      expect(tinted(right)).toEqual(["9", "10", "11", "12"]);
      expect(tinted(left)).toEqual(["9", "10", "11"]);
    },
    { timeout: WAIT_MS },
  );
  expect([tintedLines(left), tintedLines(right)]).toEqual([3, 4]);
  expect(probe.started).toEqual([]);
  release(to);
  expect(probe.started).toEqual([ACROSS]);
  await vi.waitFor(() => expect([...tinted(left), ...tinted(right)]).toEqual([]), {
    timeout: WAIT_MS,
  });
});

test("a drag from a removed line on the left to an added line on the right starts a both-sides range; upwards gives the same place", async () => {
  const probe = await opened(DRAG);
  const { left, right } = probe.hosts;
  const removed = lineNumber(left, "11");
  const added = lineNumber(right, "12");
  const place: ThreadPlace = {
    start: diffLineOf(changedThreadLine("left", 10)),
    end: changedThreadLine("right", 11),
  };

  heldDrag(removed, added);
  await vi.waitFor(
    () => {
      expect(tinted(left)).toEqual(["11"]);
      expect(tinted(right)).toEqual(["11", "12"]);
    },
    { timeout: WAIT_MS },
  );
  release(added);
  heldDrag(added, removed);
  release(removed);

  expect(probe.started).toEqual([place, place]);
});

test("Escape during a drag starts nothing and clears the tint", async () => {
  const probe = await opened(DRAG);
  const { left, right } = probe.hosts;
  const to = lineNumber(right, "12");
  heldDrag(lineNumber(right, "9"), to);
  await vi.waitFor(() => expect(tinted(right)).toHaveLength(4), { timeout: WAIT_MS });
  const escape = new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true });

  document.body.dispatchEvent(escape);
  release(to);

  expect(escape.defaultPrevented).toBe(true);
  expect(probe.started).toEqual([]);
  await vi.waitFor(() => expect([...tinted(left), ...tinted(right)]).toEqual([]), {
    timeout: WAIT_MS,
  });
});

test("a scroll during a drag moves the end to the line under the pointer", async () => {
  const probe = await opened(DRAG);
  const view = await measured(probe.hosts.right);
  const point = centre(lineNumber(probe.hosts.right, "12"));
  pressOn(lineNumber(probe.hosts.right, "9"));
  moveTo(point);
  const scrolled = SCROLLED_LINES * view.defaultLineHeight;

  view.scrollDOM.scrollTop = scrolled;
  await vi.waitFor(() => expect(view.scrollDOM.scrollTop).toBeCloseTo(scrolled, 0), {
    timeout: WAIT_MS,
  });
  view.scrollDOM.dispatchEvent(new Event("scroll"));
  document.body.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, ...point }));

  expect(probe.started).toEqual([
    { start: ACROSS.start, end: unchangedThreadLine("right", { left: 15, right: 16 }) },
  ]);
});

test("a drag selects no text in either column", async () => {
  const probe = await opened(DRAG);
  const views = [viewIn(probe.hosts.left), viewIn(probe.hosts.right)];
  const before = views.map((view) => view.state.selection);

  await userEvent.dragAndDrop(
    lineNumber(probe.hosts.right, "9"),
    lineNumber(probe.hosts.right, "12"),
  );

  expect(views.map((view, index) => before[index]?.eq(view.state.selection))).toEqual([true, true]);
  expect(document.getSelection()?.isCollapsed).toBe(true);
  expect(probe.started).toEqual([ACROSS]);
});

test("a drag stops at a collapsed run's wave", async () => {
  const probe = await opened(DRAG, true);
  const view = await measured(probe.hosts.right);
  const from = lineNumber(probe.hosts.right, "22");
  const wave = view.lineBlockAt(view.state.doc.line(LAST_SHOWN_RIGHT + 2).from);

  pressOn(from);
  moveTo({
    clientX: centre(from).clientX,
    clientY: view.documentTop + (wave.top + wave.bottom) / 2,
  });
  release(from);

  expect(probe.started).toEqual([
    {
      start: diffLineOf(changedThreadLine("right", 21)),
      end: unchangedThreadLine("right", { left: LAST_SHOWN_RIGHT - 2, right: LAST_SHOWN_RIGHT }),
    },
  ]);
});

test("the pointer over a thread's box tints its lines in both columns; leaving clears them", async () => {
  const probe = await opened({ ...DRAG, threads: [{ key: KEY, place: ACROSS, shown: "open" }] });
  const { left, right } = probe.hosts;
  const host = hostOf(probe);
  host.append(box(`height: ${BOX_PX}px`));
  await vi.waitFor(() => expect(host.getBoundingClientRect().height).toBe(BOX_PX), {
    timeout: WAIT_MS,
  });
  expect([...tinted(left), ...tinted(right)]).toEqual([]);

  await userEvent.hover(host);
  await vi.waitFor(
    () => {
      expect(tinted(right)).toEqual(["9", "10", "11", "12"]);
      expect(tinted(left)).toEqual(["9", "10", "11"]);
    },
    { timeout: WAIT_MS },
  );
  await userEvent.unhover(host);

  await vi.waitFor(() => expect([...tinted(left), ...tinted(right)]).toEqual([]), {
    timeout: WAIT_MS,
  });
});

test("a draft's lines stay tinted", async () => {
  const probe = await opened({ ...DRAG, threads: [{ key: KEY, place: ACROSS, shown: "draft" }] });

  await vi.waitFor(
    () => {
      expect(tinted(probe.hosts.right)).toEqual(["9", "10", "11", "12"]);
      expect(tinted(probe.hosts.left)).toEqual(["9", "10", "11"]);
    },
    { timeout: WAIT_MS },
  );
});

test("the next tint repaints a column whose tint was changed by another dispatch", async () => {
  const draft: ShownThread = { key: KEY, place: ACROSS, shown: "draft" };
  const probe = await opened({ ...DRAG, threads: [draft] });
  const { right } = probe.hosts;
  await vi.waitFor(() => expect(tinted(right)).toHaveLength(4), { timeout: WAIT_MS });
  viewIn(right).dispatch({ effects: showTint.of([]) });

  probe.controller.showThreads([draft]);

  expect(tinted(right)).toEqual(["9", "10", "11", "12"]);
});

test.each(["light", "webstorm-dark"] as const)(
  "in %s the tint shows on a removed and an added line and each keeps its difference colour",
  async (theme) => {
    document.documentElement.dataset["theme"] = theme;
    const probe = await opened(TONES);
    const { left, right } = probe.hosts;
    probe.controller.setPreferences({ theme, keys: DEFAULT_KEYS });
    function spots(): Readonly<Record<string, Point>> {
      return {
        removed: lineSpot(left, REMOVED_AT + 1),
        leftUnchanged: lineSpot(left, REMOVED_AT + 2),
        added: lineSpot(right, ADDED_AT + 1),
        rightUnchanged: lineSpot(right, ADDED_AT),
      };
    }
    const plain = await pixelsAt(spots());

    probe.controller.showThreads([{ key: KEY, place: TONES_PLACE, shown: "draft" }]);
    await vi.waitFor(() => expect(tinted(right)).toEqual(["6", "7", "8"]), { timeout: WAIT_MS });
    await page.screenshot({ path: `${SCREENSHOTS}/tint-${theme}.png` });
    const tint = await pixelsAt(spots());

    expect(tinted(left)).toEqual(["6", "7", "8"]);
    for (const line of ["removed", "added", "leftUnchanged"]) {
      expect(tint[line], line).not.toBe(plain[line]);
    }
    expect(tint["removed"]).not.toBe(tint["leftUnchanged"]);
    expect(tint["added"]).not.toBe(tint["rightUnchanged"]);
  },
);

test("after a finished drag Escape reaches the page untouched and a further move and release start nothing", async () => {
  const probe = await opened(DRAG);
  const { left, right } = probe.hosts;
  const from = lineNumber(right, "9");
  const to = lineNumber(right, "12");
  heldDrag(from, to);
  release(to);
  const escape = escapeDown();
  const reached = vi.fn();
  document.body.addEventListener("keydown", reached, { once: true });

  document.body.dispatchEvent(escape);
  moveTo(centre(from));
  release(from);
  await nextFrames();

  expect([escape.defaultPrevented, reached.mock.calls.length]).toEqual([false, 1]);
  expect(probe.started).toEqual([ACROSS]);
  expect([...tinted(left), ...tinted(right)]).toEqual([]);
});

test("destroying the controller mid-drag leaves Escape to the page and a further move and release start nothing", async () => {
  const probe = await opened(DRAG);
  const from = lineNumber(probe.hosts.right, "9");
  const to = lineNumber(probe.hosts.right, "12");
  heldDrag(from, to);
  const point = centre(to);
  controllers.splice(controllers.indexOf(probe.controller), 1);
  probe.controller.destroy();
  const escape = escapeDown();
  const reached = vi.fn();
  document.body.addEventListener("keydown", reached, { once: true });

  document.body.dispatchEvent(escape);
  moveTo(point);
  document.body.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, ...point }));
  await nextFrames();

  expect([escape.defaultPrevented, reached.mock.calls.length]).toEqual([false, 1]);
  expect(probe.started).toEqual([]);
});

test("two scrolls in one frame during a drag move the end once, in the next frame, to the line under the pointer", async () => {
  const probe = await opened(DRAG);
  const { right } = probe.hosts;
  const view = await measured(right);
  pressOn(lineNumber(right, "9"));
  moveTo(centre(lineNumber(right, "12")));
  await vi.waitFor(() => expect(tinted(right)).toEqual(["9", "10", "11", "12"]), {
    timeout: WAIT_MS,
  });
  const dispatch = vi.spyOn(view, "dispatch");

  for (const lines of [SCROLLED_LINES, SCROLLED_LINES + 1]) {
    view.scrollDOM.scrollTop = lines * view.defaultLineHeight;
    view.scrollDOM.dispatchEvent(new Event("scroll"));
  }
  const atOnce = tintDispatches(dispatch.mock.calls);
  await vi.waitFor(() => expect(tinted(right).at(-1)).toBe("18"), { timeout: WAIT_MS });
  await nextFrames();

  expect([atOnce, tintDispatches(dispatch.mock.calls)]).toEqual([0, 1]);
});
