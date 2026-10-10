import type { Chunk } from "../../ipc";
import { sideChanged, type Side } from "./side";

export type SideStatus = "pending" | "applied" | "ignored";

export type ChunkStatus = Readonly<Record<Side, SideStatus>>;

export type ChunkState = { readonly chunk: Chunk; readonly status: ChunkStatus };

export type MergeSummary = { readonly changes: number; readonly conflicts: number };

export type ApplyMode = "replace" | "append";

const SIDES: readonly Side[] = ["local", "remote"];
const OTHER: Readonly<Record<Side, Side>> = { local: "remote", remote: "local" };

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

export function applyMode(status: ChunkStatus, side: Side): ApplyMode {
  return status[OTHER[side]] === "applied" ? "append" : "replace";
}

function handle(chunk: Chunk, status: ChunkStatus, side: Side, value: SideStatus): ChunkStatus {
  const sides = chunk.kind === "Conflict" ? [side] : SIDES.filter((s) => sideChanged(chunk, s));
  return {
    local: sides.includes("local") ? value : status.local,
    remote: sides.includes("remote") ? value : status.remote,
  };
}

export function statusAfterApply(chunk: Chunk, status: ChunkStatus, side: Side): ChunkStatus {
  const applied = handle(chunk, status, side, "applied");
  const other = OTHER[side];
  return chunk.kind === "Conflict" && applied[other] === "pending" && chunk[other].len === 0
    ? handle(chunk, applied, other, "ignored")
    : applied;
}

export function statusAfterIgnore(chunk: Chunk, status: ChunkStatus, side: Side): ChunkStatus {
  return handle(chunk, status, side, "ignored");
}

export function summarize(states: readonly ChunkState[]): MergeSummary {
  const open = states.filter(({ chunk, status }) => !isResolved(chunk, status));
  const conflicts = open.filter(({ chunk }) => chunk.kind === "Conflict").length;
  return { changes: open.length - conflicts, conflicts };
}
