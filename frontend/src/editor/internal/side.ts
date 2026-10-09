import type { Chunk } from "../../ipc";

export type Side = "local" | "remote";

const CHANGED_SIDES: Readonly<Record<Chunk["kind"], readonly Side[]>> = {
  LocalOnly: ["local"],
  RemoteOnly: ["remote"],
  BothSame: ["local", "remote"],
  Conflict: ["local", "remote"],
};

export function sideChanged(chunk: Chunk, side: Side): boolean {
  return CHANGED_SIDES[chunk.kind].includes(side);
}
