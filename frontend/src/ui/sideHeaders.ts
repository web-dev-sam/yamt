import type { Side, SideNames } from "../ipc";

export type SideHeader = { readonly text: string; readonly tooltip: string };

const LABEL: Readonly<Record<Side, string>> = {
  local: "Local (yours)",
  remote: "Remote (theirs)",
};

export function sideHeader(side: Side, names: SideNames): SideHeader {
  const label = LABEL[side];
  const name = names[side];
  if (name === null) {
    return { text: label, tooltip: label };
  }
  switch (name.kind) {
    case "Branch": {
      const text = `${label}: ${name.name}`;
      return { text, tooltip: text };
    }
    case "Commit":
      return { text: `${label}: ${name.short_id} ${name.subject}`, tooltip: name.message };
    default: {
      const _exhaustive: never = name;
      return _exhaustive;
    }
  }
}
