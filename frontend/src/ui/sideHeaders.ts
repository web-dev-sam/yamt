import type { RemoteName, Side } from "../ipc";

export type SideHeader = { readonly text: string; readonly tooltip: string };

const LOCAL = "Local (yours)";
const REMOTE = "Remote (theirs)";

function remoteHeader(remote: RemoteName | null): SideHeader {
  if (remote === null) {
    return { text: REMOTE, tooltip: REMOTE };
  }
  switch (remote.kind) {
    case "Branch": {
      const text = `${REMOTE}: ${remote.name}`;
      return { text, tooltip: text };
    }
    case "Commit":
      return { text: `${REMOTE}: ${remote.short_id} ${remote.subject}`, tooltip: remote.message };
    default: {
      const _exhaustive: never = remote;
      return _exhaustive;
    }
  }
}

export function sideHeader(side: Side, remote: RemoteName | null): SideHeader {
  return side === "local" ? { text: LOCAL, tooltip: LOCAL } : remoteHeader(remote);
}
