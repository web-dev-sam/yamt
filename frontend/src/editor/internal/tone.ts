import type { Chunk } from "../../ipc";
import type { Side } from "./side";
import { isResolved, isSideOpen, type ChunkStatus } from "./status";

export type Tone = "inserted" | "modified" | "deleted" | "conflict";
export type ChangeTone = Exclude<Tone, "conflict">;

export function changeTone(baseLines: number, changedLines: number): ChangeTone {
  if (baseLines === 0) {
    return "inserted";
  }
  if (changedLines === 0) {
    return "deleted";
  }
  return "modified";
}

function sideOf(chunk: Chunk, pane: Side | "center"): Side {
  if (pane !== "center") {
    return pane;
  }
  return chunk.kind === "RemoteOnly" ? "remote" : "local";
}

export function chunkTone(chunk: Chunk, pane: Side | "center"): Tone {
  if (chunk.kind === "Conflict") {
    return "conflict";
  }
  return changeTone(chunk.middle.len, chunk[sideOf(chunk, pane)].len);
}

export function paneTone(chunk: Chunk, status: ChunkStatus, pane: Side | "center"): Tone | null {
  const waiting = pane === "center" ? !isResolved(chunk, status) : isSideOpen(chunk, status, pane);
  return waiting ? chunkTone(chunk, pane) : null;
}
