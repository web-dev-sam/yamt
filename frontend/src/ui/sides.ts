import type { Side } from "../ipc";

export const SIDES: readonly Side[] = ["local", "remote"];

export type Taken = { readonly by: "side"; readonly side: Side } | { readonly by: "disk" };

const OTHER: Readonly<Record<Side, Side>> = { local: "remote", remote: "local" };

export function otherSide(side: Side): Side {
  return OTHER[side];
}
