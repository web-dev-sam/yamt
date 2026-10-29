import { EditorState, Text, type TransactionSpec } from "@codemirror/state";
import { afterEach, expect, test, vi } from "vitest";

import { waveCenterY, waveJoinPath, wavePhase } from "../../connectors";
import { loadCompareFixture, type Column } from "../../ipc";
import {
  columnFoldExtension,
  mirrorSpec,
  ownerSteps,
  rangeRuns,
  renewSpec,
  stepSpec,
} from "./columnFolds";
import { joinPaints } from "./gap";
import type { WaveRow } from "./geometry";
import { columnWaves } from "./rangeFolds";
import { chainEnds, ChainPhases, paneEnds, phaseStyle, type WaveLayout } from "./wavePhase";

type Rect = { readonly left: number; readonly right: number };
type FakeStyle = Pick<CSSStyleDeclaration, "getPropertyValue" | "setProperty" | "removeProperty">;
type FakeDom = { readonly resizes: (() => void)[]; readonly disconnected: boolean[] };

const STRIP: Rect = { left: 700.4, right: 738.4 };
const MERGE_STRIPS: WaveLayout["strips"] = {
  local: { left: 700.4, right: 738.4 },
  remote: { left: 1179.4, right: 1217.4 },
};

afterEach(() => {
  vi.unstubAllGlobals();
});

test("two columns and one strip: the left leaves at the strip's left edge, the right enters at its right edge", () => {
  expect(chainEnds<Column>("left", [{ strip: STRIP, pane: "right" }])).toEqual(
    new Map([
      ["left", { kind: "leaves", at: 700.4 }],
      ["right", { kind: "enters", at: 738.4 }],
    ]),
  );
});

test("the merge chain through chainEnds gives paneEnds' ends: the middle enters and leaves", () => {
  const ends = chainEnds("left", [
    { strip: MERGE_STRIPS.local, pane: "center" },
    { strip: MERGE_STRIPS.remote, pane: "right" },
  ]);

  expect(Object.fromEntries(ends)).toEqual(paneEnds(MERGE_STRIPS));
  expect(Object.fromEntries(ends)).toEqual({
    left: { kind: "leaves", at: 700.4 },
    center: { kind: "through", enters: 738.4, leaves: 1179.4 },
    right: { kind: "enters", at: 1217.4 },
  });
});

function fakeStyle(): FakeStyle {
  const values = new Map<string, string>();
  return {
    getPropertyValue: (name) => values.get(name) ?? "",
    setProperty: (name, value) => {
      values.set(name, value ?? "");
    },
    removeProperty: (name) => {
      values.delete(name);
      return "";
    },
  };
}

function fakeDom(): FakeDom {
  const dom: FakeDom = { resizes: [], disconnected: [] };
  vi.stubGlobal("devicePixelRatio", 1);
  vi.stubGlobal(
    "ResizeObserver",
    class {
      readonly #index: number;
      constructor(callback: () => void) {
        this.#index = dom.resizes.push(callback) - 1;
      }
      observe(): void {}
      disconnect(): void {
        dom.disconnected[this.#index] = true;
      }
    },
  );
  vi.stubGlobal("matchMedia", () => ({
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
  vi.stubGlobal(
    "HTMLElement",
    class {
      readonly style = fakeStyle();
    },
  );
  vi.stubGlobal("Element", class {});
  return dom;
}

function measured(rect: Rect): { getBoundingClientRect: () => Rect } {
  return { getBoundingClientRect: () => rect };
}

function phaseOf(host: HTMLElement): string[] {
  return ["--fold-wave-x", "--fold-wave-period"].map((name) => host.style.getPropertyValue(name));
}

test("ChainPhases writes both columns' phase on a resize and removes both on destroy", () => {
  const dom = fakeDom();
  const hosts = { left: new HTMLElement(), right: new HTMLElement() };
  const strip = Object.assign(new Element(), measured(STRIP));
  const views = {
    left: { scrollDOM: measured({ left: 260, right: 699 }) },
    right: { scrollDOM: measured({ left: 741, right: 1180 }) },
  };
  const phases = new ChainPhases<Column>(
    { first: "left", next: [{ strip, pane: "right" }] },
    hosts,
    () => views,
  );

  for (const resize of dom.resizes) {
    resize();
  }
  const written = [phaseOf(hosts.left), phaseOf(hosts.right)];
  phases.destroy();

  expect(written).toEqual([
    Object.values(phaseStyle(wavePhase(260, { kind: "leaves", at: 700 }))),
    Object.values(phaseStyle(wavePhase(741, { kind: "enters", at: 738 }))),
  ]);
  expect(written[0]).not.toEqual(written[1]);
  expect([phaseOf(hosts.left), phaseOf(hosts.right)]).toEqual([
    ["", ""],
    ["", ""],
  ]);
  expect(dom.disconnected).toEqual([true]);
});

function numbered(from: number, to: number): string[] {
  return Array.from({ length: to - from + 1 }, (_, index) => `line ${from + index}`);
}

const LEFT_LINES = numbered(1, 100);
const RIGHT_LINES = [
  ...numbered(1, 30),
  "new a",
  "new b",
  ...numbered(32, 70),
  "added",
  ...numbered(71, 100),
];
const DOCS: Readonly<Record<Column, Text>> = {
  left: Text.of(LEFT_LINES),
  right: Text.of(RIGHT_LINES),
};
const NO_WORDS = { changed: [], removals: [] };
const { comparison } = await loadCompareFixture("pair", {
  "pair.json": {
    left: LEFT_LINES.join("\n"),
    right: RIGHT_LINES.join("\n"),
    differences: [
      {
        left: { start: 30, len: 1 },
        right: { start: 30, len: 2 },
        words: { left: NO_WORDS, right: NO_WORDS },
      },
      {
        left: { start: 70, len: 0 },
        right: { start: 71, len: 1 },
        words: { left: NO_WORDS, right: NO_WORDS },
      },
    ],
  },
});
const RIGHT_OFFSET = 1000;
const LINE_PX = 10;
const WIRING = {
  views: (): never => {
    throw new Error("a state test has no views");
  },
  hovered: () => null,
};

type Pair = Record<Column, EditorState>;

function onLeft(pair: Pair, spec: TransactionSpec): Pair {
  const left = pair.left.update(spec).state;
  const mirrored = mirrorSpec(pair.right, left.field(ownerSteps));
  return { left, right: mirrored === null ? pair.right : pair.right.update(mirrored).state };
}

function opened(collapsed: boolean): Pair {
  const pair = {
    left: EditorState.create({ doc: DOCS.left, extensions: columnFoldExtension("left", WIRING) }),
    right: EditorState.create({
      doc: DOCS.right,
      extensions: columnFoldExtension("right", WIRING),
    }),
  };
  const runs = rangeRuns(comparison.differences, [], DOCS);
  return onLeft(pair, renewSpec(pair.left, runs, collapsed));
}

type WaveView = {
  readonly state: EditorState;
  lineBlockAt(pos: number): { readonly top: number };
};

function waves(pair: Pair): WaveRow<Column>[] {
  function view(state: EditorState, offset: number): WaveView {
    return {
      state,
      lineBlockAt: (pos) => ({ top: state.doc.lineAt(pos).number * LINE_PX + offset }),
    };
  }
  return columnWaves({ left: view(pair.left, 0), right: view(pair.right, RIGHT_OFFSET) });
}

test("columnWaves gives each run's wave top in each column from that column's own lines", () => {
  const pair = opened(true);
  const clicked = onLeft(pair, stepSpec(pair.left, 1));

  expect(waves(pair)).toEqual([
    { left: 10, right: 1010 },
    { left: 360, right: 1370 },
    { left: 750, right: 1770 },
  ]);
  expect(waves(clicked)[1]).toEqual({ left: 400, right: 1410 });
});

test("columnWaves gives null in both columns where nothing hides", () => {
  expect(waves(opened(false))).toEqual([
    { left: null, right: null },
    { left: null, right: null },
    { left: null, right: null },
  ]);
});

test("joinPaints joins the two tops level across the strip, each shifted by its own column", () => {
  const size = { width: 40, height: 500, lineHeight: 20 };
  const center = waveCenterY(size.lineHeight);

  const paints = joinPaints(
    [
      { left: 100, right: 80 },
      { left: null, right: 5 },
      { left: 2000, right: 1980 },
    ],
    { left: -50, right: -30 },
    size,
  );

  expect(paints).toEqual([
    { run: 0, d: waveJoinPath({ left: 50 + center, right: 50 + center }, size.width) },
  ]);
});
