import type { Chunk } from "../../ipc";

export type Tone = "inserted" | "modified" | "deleted" | "conflict";

type Pane = "local" | "center" | "remote";

export type Side = Exclude<Pane, "center">;

const CHANGED_SIDES: Readonly<Record<Chunk["kind"], readonly Side[]>> = {
  LocalOnly: ["local"],
  RemoteOnly: ["remote"],
  BothSame: ["local", "remote"],
  Conflict: ["local", "remote"],
};

export function sideChanged(chunk: Chunk, side: Side): boolean {
  return CHANGED_SIDES[chunk.kind].includes(side);
}

function sideOf(chunk: Chunk, pane: Pane): Side {
  if (pane !== "center") {
    return pane;
  }
  return chunk.kind === "RemoteOnly" ? "remote" : "local";
}

export function chunkTone(chunk: Chunk, pane: Pane): Tone {
  if (chunk.kind === "Conflict") {
    return "conflict";
  }
  if (chunk.base.len === 0) {
    return "inserted";
  }
  if (chunk[sideOf(chunk, pane)].len === 0) {
    return "deleted";
  }
  return "modified";
}
