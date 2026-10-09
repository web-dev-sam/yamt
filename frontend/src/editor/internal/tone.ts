import type { Chunk } from "../../ipc";

export type Tone = "inserted" | "modified" | "deleted" | "conflict";

function sideOf(chunk: Chunk, pane: "local" | "center" | "remote"): "local" | "remote" {
  if (pane !== "center") {
    return pane;
  }
  return chunk.kind === "RemoteOnly" ? "remote" : "local";
}

export function chunkTone(chunk: Chunk, pane: "local" | "center" | "remote"): Tone {
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
