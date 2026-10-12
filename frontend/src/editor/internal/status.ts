import type { Chunk } from "../../ipc";
import { otherSide, sideChanged, SIDES, type Side } from "./side";

export type SideStatus = "pending" | "applied" | "ignored";

export type ChunkStatus = Readonly<Record<Side, SideStatus>>;

export type ChunkState = { readonly chunk: Chunk; readonly status: ChunkStatus };

export type MergeSummary = { readonly changes: number; readonly conflicts: number };

export type ApplyMode = "replace" | "append";

export const PENDING: ChunkStatus = { local: "pending", remote: "pending" };

export const DELETED_BY_USER: ChunkStatus = { local: "ignored", remote: "ignored" };

export function isSideOpen(chunk: Chunk, status: ChunkStatus, side: Side): boolean {
  return sideChanged(chunk, side) && status[side] === "pending";
}

export function isResolved(chunk: Chunk, status: ChunkStatus): boolean {
  return !SIDES.some((side) => isSideOpen(chunk, status, side));
}

export function canBulkApply(chunk: Chunk, status: ChunkStatus, side: Side): boolean {
  return chunk.kind !== "Conflict" && isSideOpen(chunk, status, side);
}

export function decidesOtherSide(chunk: Chunk, status: ChunkStatus, side: Side): boolean {
  return chunk.kind === "Conflict" && isSideOpen(chunk, status, otherSide(side));
}

export function applyMode(status: ChunkStatus, side: Side): ApplyMode {
  return status[otherSide(side)] === "applied" ? "append" : "replace";
}

type SideMark = {
  readonly chunk: Chunk;
  readonly status: ChunkStatus;
  readonly side: Side;
  readonly value: SideStatus;
};

function markConflictSideOrChange({ chunk, status, side, value }: SideMark): ChunkStatus {
  const sides = chunk.kind === "Conflict" ? [side] : SIDES.filter((s) => sideChanged(chunk, s));
  return {
    local: sides.includes("local") ? value : status.local,
    remote: sides.includes("remote") ? value : status.remote,
  };
}

export function statusAfterApply(chunk: Chunk, status: ChunkStatus, side: Side): ChunkStatus {
  const applied = markConflictSideOrChange({ chunk, status, side, value: "applied" });
  const other = otherSide(side);
  return chunk.kind === "Conflict" && applied[other] === "pending" && chunk[other].len === 0
    ? markConflictSideOrChange({ chunk, status: applied, side: other, value: "ignored" })
    : applied;
}

export function statusAfterIgnore(chunk: Chunk, status: ChunkStatus, side: Side): ChunkStatus {
  return markConflictSideOrChange({ chunk, status, side, value: "ignored" });
}

export function summarize(states: readonly ChunkState[]): MergeSummary {
  const open = states.filter(({ chunk, status }) => !isResolved(chunk, status));
  const conflicts = open.filter(({ chunk }) => chunk.kind === "Conflict").length;
  return { changes: open.length - conflicts, conflicts };
}
