import type { Chunk, Side } from "../../ipc";

export type { Side } from "../../ipc";

const CHANGED_SIDES: Readonly<Record<Chunk["kind"], readonly Side[]>> = {
  LocalOnly: ["local"],
  RemoteOnly: ["remote"],
  BothSame: ["local", "remote"],
  Conflict: ["local", "remote"],
};

export function sideChanged(chunk: Chunk, side: Side): boolean {
  return CHANGED_SIDES[chunk.kind].includes(side);
}
