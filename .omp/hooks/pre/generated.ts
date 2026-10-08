import type { ExtensionAPI } from "@oh-my-pi/pi-coding-agent";

import { GENERATED_PATHS, matchesAny, pathsFromToolInput, toRepoRelative } from "../lib/policy";

const EDITING_TOOLS: Record<string, true> = { edit: true, write: true };

export default function generated(pi: ExtensionAPI): void {
  pi.on("tool_call", async (event, ctx) => {
    if (!EDITING_TOOLS[event.toolName]) return;
    const hit = pathsFromToolInput(event.toolName, event.input)
      .map((p) => toRepoRelative(p, ctx.cwd))
      .find((p) => matchesAny(p, GENERATED_PATHS));
    if (hit === undefined) return;
    return {
      block: true,
      reason: `[generated/PM4] ${hit} is generated. bindings.ts: run \`just bindings\`; lockfiles: run the package manager; snapshots/goldens: run \`just golden-update\` or the test with update mode and report it.`,
    };
  });
}
