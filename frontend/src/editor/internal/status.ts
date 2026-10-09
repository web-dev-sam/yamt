import type { Chunk } from "../../ipc";
import { sideChanged, type Side } from "./side";

export type ChunkStatus =
  | "pending"
  | "applied-local"
  | "applied-remote"
  | "applied-both"
  | "dismissed";

export type ChunkState = { readonly chunk: Chunk; readonly status: ChunkStatus };

export type MergeSummary = { readonly changes: number; readonly conflicts: number };

export function isResolved(chunk: Chunk, status: ChunkStatus): boolean {
  switch (status) {
    case "pending":
      return false;
    case "applied-local":
    case "applied-remote":
      return chunk.kind !== "Conflict";
    case "applied-both":
    case "dismissed":
      return true;
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}

export function canApply(chunk: Chunk, status: ChunkStatus, side: Side): boolean {
  return sideChanged(chunk, side) && !isResolved(chunk, status) && status !== `applied-${side}`;
}

export function statusAfterApply(status: ChunkStatus, side: Side): ChunkStatus {
  return status === "pending" ? `applied-${side}` : "applied-both";
}

export function summarize(states: readonly ChunkState[]): MergeSummary {
  const open = states.filter(({ chunk, status }) => !isResolved(chunk, status));
  const conflicts = open.filter(({ chunk }) => chunk.kind === "Conflict").length;
  return { changes: open.length - conflicts, conflicts };
}
