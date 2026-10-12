import type { Span } from "../../connectors";
import type { Chunk } from "../../ipc";
import { SIDE_PANE, type ChunkRow } from "./geometry";
import { otherSide, type Side } from "./side";
import { isSideOpen, type ChunkState } from "./status";

export type Direction = "down" | "up";

export type Target = { readonly side: Side; readonly id: Chunk["id"] };

export type SideMark =
  | { readonly kind: "alone"; readonly remembered: Chunk["id"] | null }
  | { readonly kind: "change"; readonly id: Chunk["id"] };

const POINT_HIT_PX = 4;

function waits({ chunk, status }: ChunkState, side: Side): boolean {
  return isSideOpen(chunk, status, side);
}

function indexOf(states: readonly ChunkState[], id: Chunk["id"]): number {
  return states.findIndex(({ chunk }) => chunk.id === id);
}

export function stepFrom(
  states: readonly ChunkState[],
  {
    side,
    id,
    direction,
  }: { readonly side: Side; readonly id: Chunk["id"]; readonly direction: Direction },
): Chunk["id"] | null {
  const index = indexOf(states, id);
  if (index < 0) {
    return null;
  }
  const found =
    direction === "down"
      ? states.slice(index + 1).find((state) => waits(state, side))
      : states.slice(0, index).findLast((state) => waits(state, side));
  return found?.chunk.id ?? null;
}

export function afterDecision(
  states: readonly ChunkState[],
  side: Side,
  id: Chunk["id"],
): Chunk["id"] | null {
  const below = states.slice(indexOf(states, id) + 1).find((state) => waits(state, side));
  return (below ?? states.find((state) => waits(state, side)))?.chunk.id ?? null;
}

export function hasWaiting(states: readonly ChunkState[], side: Side): boolean {
  return states.some((state) => waits(state, side));
}

export function markedId(mark: SideMark): Chunk["id"] | null {
  return mark.kind === "change" ? mark.id : mark.remembered;
}

export function alone(mark: SideMark): SideMark & { readonly kind: "alone" } {
  return { kind: "alone", remembered: markedId(mark) };
}

export function crossTo(
  states: readonly ChunkState[],
  { from, to, toSide }: { readonly from: SideMark; readonly to: SideMark; readonly toSide: Side },
): SideMark {
  const kept = alone(to);
  for (const id of [from.kind === "change" ? from.id : null, kept.remembered]) {
    const state = id === null ? undefined : states[indexOf(states, id)];
    if (state !== undefined && waits(state, toSide)) {
      return { kind: "change", id: state.chunk.id };
    }
  }
  return kept;
}

export function handoverTo(
  {
    before,
    after,
  }: { readonly before: readonly ChunkState[]; readonly after: readonly ChunkState[] },
  { focused, hidden }: { readonly focused: Side | null; readonly hidden: Side | null },
): Side | null {
  if (focused === null || !hasWaiting(before, focused) || hasWaiting(after, focused)) {
    return null;
  }
  const other = otherSide(focused);
  return other === hidden ? null : other;
}

type AfterDecision =
  | { readonly kind: "handover"; readonly side: Side }
  | { readonly kind: "reveal" }
  | { readonly kind: "stay" };

export function afterDecisionFocus({
  beforeMark,
  afterMark,
  handover,
}: {
  readonly beforeMark: SideMark;
  readonly afterMark: SideMark;
  readonly handover: Side | null;
}): AfterDecision {
  if (handover !== null) {
    return { kind: "handover", side: handover };
  }
  return afterMark.kind === "change" && afterMark.id !== markedId(beforeMark)
    ? { kind: "reveal" }
    : { kind: "stay" };
}

export function fromScreen(
  rows: readonly ChunkRow[],
  {
    side,
    area,
    direction,
  }: { readonly side: Side; readonly area: Span; readonly direction: Direction },
): Chunk["id"] | null {
  const pane = SIDE_PANE[side];
  const open = rows.filter((row) => waits(row, side));
  const found =
    direction === "down"
      ? open.find(({ [pane]: span }) => span.bottom > area.top || span.top >= area.top)
      : open.findLast(({ [pane]: span }) => span.top < area.bottom || span.bottom <= area.bottom);
  return found?.chunk.id ?? null;
}

export function stepAlone(
  rows: readonly ChunkRow[],
  {
    side,
    fallback,
    areas,
    direction,
  }: {
    readonly side: Side;
    readonly fallback: Side | null;
    readonly areas: Readonly<Record<Side, Span>>;
    readonly direction: Direction;
  },
): Target | null {
  const target = hasWaiting(rows, side) || fallback === null ? side : fallback;
  const id = fromScreen(rows, { side: target, area: areas[target], direction });
  return id === null ? null : { side: target, id };
}

export function changeAt(rows: readonly ChunkRow[], side: Side, y: number): Chunk["id"] | null {
  const pane = SIDE_PANE[side];
  const open = rows.filter((row) => waits(row, side));
  const band = open.find(({ [pane]: span }) => span.top <= y && y < span.bottom);
  const point = open.find(
    ({ [pane]: span }) => span.top === span.bottom && Math.abs(y - span.top) <= POINT_HIT_PX,
  );
  return (band ?? point)?.chunk.id ?? null;
}
