import type { Side } from "../ipc";

export const SIDE_HEADERS: Readonly<Record<Side, string>> = {
  local: "Local (yours)",
  remote: "Remote (theirs)",
};
