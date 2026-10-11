import type { Side } from "../ipc";

export const SIDES: readonly Side[] = ["local", "remote"];

const OTHER: Readonly<Record<Side, Side>> = { local: "remote", remote: "local" };

export function otherSide(side: Side): Side {
  return OTHER[side];
}
