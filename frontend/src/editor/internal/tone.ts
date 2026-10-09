import type { Chunk } from "../../ipc";

export type Tone = "inserted" | "modified" | "deleted" | "conflict";

type Pane = "local" | "center" | "remote";

function sideOf(chunk: Chunk, pane: Pane): Exclude<Pane, "center"> {
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
