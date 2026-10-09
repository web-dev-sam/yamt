import type { Chunk } from "../../ipc";

export type Tone = "inserted" | "modified" | "deleted" | "conflict";
export type Side = "local" | "remote";

export const CHANGED_SIDES: Readonly<Record<Chunk["kind"], readonly [Side, ...Side[]]>> = {
  LocalOnly: ["local"],
  RemoteOnly: ["remote"],
  BothSame: ["local", "remote"],
  Conflict: ["local", "remote"],
};

export function chunkTone(chunk: Chunk, side: Side): Tone {
  if (chunk.kind === "Conflict") {
    return "conflict";
  }
  if (chunk.base.len === 0) {
    return "inserted";
  }
  if (chunk[side].len === 0) {
    return "deleted";
  }
  return "modified";
}
