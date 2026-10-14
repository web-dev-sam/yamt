import type { Text } from "@codemirror/state";

import type { Chunk } from "../../ipc";
import { toDocPos, type DocPos } from "./docPos";
import { PANES, type Pane } from "./geometry";

export type Hidden = { readonly from: DocPos; readonly to: DocPos };
export type FoldLevel = Readonly<Record<Pane, Hidden | null>>;
export type Fold = { readonly hidden: readonly FoldLevel[] };

type RunEdge = { readonly start: number; readonly end: number };

const CONTEXT_LINES = 4;
const LEVEL_GROWTH = 2;
const LEVELS = 3;
export const MIN_HIDDEN_LINES = 2;
const CHUNK_RANGE = {
  left: "local",
  center: "middle",
  right: "remote",
} as const satisfies Readonly<Record<Pane, "local" | "middle" | "remote">>;

function runEdge(before: Chunk | undefined, after: Chunk | undefined, pane: Pane): RunEdge {
  const key = CHUNK_RANGE[pane];
  return {
    start: before === undefined ? -Infinity : before[key].start + before[key].len,
    end: after === undefined ? Infinity : after[key].start,
  };
}

function hiddenLines(doc: Text, edge: RunEdge, shift: number): Hidden | null {
  const first = Math.max(0, edge.start + shift);
  const end = Math.min(doc.lines, edge.end - shift);
  if (end - first < MIN_HIDDEN_LINES) {
    return null;
  }
  return { from: toDocPos(doc.line(first + 1).from), to: toDocPos(doc.line(end).to) };
}

export function sameHidden(a: Hidden | null, b: Hidden | null): boolean {
  return a === null || b === null ? a === b : a.from === b.from && a.to === b.to;
}

function runLevels(
  edges: Readonly<Record<Pane, RunEdge>>,
  docs: Readonly<Record<Pane, Text>>,
): FoldLevel[] {
  const levels: FoldLevel[] = [];
  for (let depth = 0; depth < LEVELS; depth += 1) {
    const shift = CONTEXT_LINES * LEVEL_GROWTH ** depth;
    const level: FoldLevel = {
      left: hiddenLines(docs.left, edges.left, shift),
      center: hiddenLines(docs.center, edges.center, shift),
      right: hiddenLines(docs.right, edges.right, shift),
    };
    const outer = levels.at(-1);
    const hides = PANES.some((pane) => level[pane] !== null);
    const differs =
      outer === undefined || PANES.some((pane) => !sameHidden(level[pane], outer[pane]));
    if (hides && differs) {
      levels.push(level);
    }
  }
  return levels;
}

export function foldRuns(chunks: readonly Chunk[], docs: Readonly<Record<Pane, Text>>): Fold[] {
  return Array.from({ length: chunks.length + 1 }, (_, run) => {
    const before = chunks[run - 1];
    const after = chunks[run];
    const edges = {
      left: runEdge(before, after, "left"),
      center: runEdge(before, after, "center"),
      right: runEdge(before, after, "right"),
    };
    return { hidden: runLevels(edges, docs) };
  });
}

export function displayed(fold: Fold, pane: Pane): Hidden | null {
  return fold.hidden.find((level) => level[pane] !== null)?.[pane] ?? null;
}
