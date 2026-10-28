import type { Text } from "@codemirror/state";

import type { Chunk, Column, Difference } from "../../ipc";
import { toDocPos, type DocPos } from "./docPos";
import { PANES, type Pane } from "./geometry";

export type Hidden = { readonly from: DocPos; readonly to: DocPos };
export type FoldLevel<P extends string = Pane> = Readonly<Record<P, Hidden | null>>;
export type Fold<P extends string = Pane> = { readonly hidden: readonly FoldLevel<P>[] };
export type LineSpan = { readonly start: number; readonly len: number };
export type ColumnChange = Pick<Difference, "left" | "right">;

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

function runEdge(before: LineSpan | undefined, after: LineSpan | undefined): RunEdge {
  return {
    start: before === undefined ? -Infinity : before.start + before.len,
    end: after === undefined ? Infinity : after.start,
  };
}

function paneEdge(before: Chunk | undefined, after: Chunk | undefined, pane: Pane): RunEdge {
  const key = CHUNK_RANGE[pane];
  return runEdge(before?.[key], after?.[key]);
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

function runLevels<P extends string>(
  panes: readonly P[],
  levelAt: (shift: number) => FoldLevel<P>,
): FoldLevel<P>[] {
  const levels: FoldLevel<P>[] = [];
  for (let depth = 0; depth < LEVELS; depth += 1) {
    const level = levelAt(CONTEXT_LINES * LEVEL_GROWTH ** depth);
    const outer = levels.at(-1);
    const hides = panes.some((pane) => level[pane] !== null);
    const differs =
      outer === undefined || panes.some((pane) => !sameHidden(level[pane], outer[pane]));
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
      left: paneEdge(before, after, "left"),
      center: paneEdge(before, after, "center"),
      right: paneEdge(before, after, "right"),
    };
    const hidden = runLevels(PANES, (shift) => ({
      left: hiddenLines(docs.left, edges.left, shift),
      center: hiddenLines(docs.center, edges.center, shift),
      right: hiddenLines(docs.right, edges.right, shift),
    }));
    return { hidden };
  });
}

export function columnRuns(
  changes: readonly ColumnChange[],
  docs: Readonly<Record<Column, Text>>,
): Fold<Column>[] {
  return Array.from({ length: changes.length + 1 }, (_, run) => {
    const before = changes[run - 1];
    const after = changes[run];
    const left = runEdge(before?.left, after?.left);
    const right = runEdge(before?.right, after?.right);
    const hidden = runLevels(["left", "right"] satisfies readonly Column[], (shift) => ({
      left: hiddenLines(docs.left, left, shift),
      right: hiddenLines(docs.right, right, shift),
    }));
    return { hidden };
  });
}

export function displayed<P extends string>(fold: Fold<P>, pane: P): Hidden | null {
  return fold.hidden.find((level) => level[pane] !== null)?.[pane] ?? null;
}

export function waveStartsIn<P extends string>(
  folds: readonly Fold<P>[],
  pane: P,
): (DocPos | null)[] {
  return folds.map((fold) => displayed(fold, pane)?.from ?? null);
}
