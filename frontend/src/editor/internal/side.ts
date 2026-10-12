import type { Chunk, Side } from "../../ipc";

export type { Side } from "../../ipc";

export const SIDES: readonly Side[] = ["local", "remote"];

const OTHER: Readonly<Record<Side, Side>> = { local: "remote", remote: "local" };

const CHANGED_SIDES: Readonly<Record<Chunk["kind"], readonly Side[]>> = {
  LocalOnly: ["local"],
  RemoteOnly: ["remote"],
  BothSame: ["local", "remote"],
  Conflict: ["local", "remote"],
};

export function otherSide(side: Side): Side {
  return OTHER[side];
}

export function sideChanged(chunk: Chunk, side: Side): boolean {
  return CHANGED_SIDES[chunk.kind].includes(side);
}
