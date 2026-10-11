import { tmpdir } from "node:os";
import { resolve } from "node:path";

import type { ExtensionAPI } from "@oh-my-pi/pi-coding-agent";

import {
  type AgentIdentity,
  escapesRepo,
  matchesAny,
  ORCHESTRATOR_EDITABLE,
  ownershipFor,
  pathsFromToolInput,
  PRODUCT_CODE_ROOTS,
  readSliceRegistry,
  toRepoRelative,
  writeTargetsFromCommand,
} from "../lib/policy";

const EDITING_TOOLS: Record<string, true> = { edit: true, write: true };

export default function ownership(pi: ExtensionAPI): void {
  pi.on("tool_call", async (event, ctx) => {
    const agent: AgentIdentity = ctx.agent;
    const input = event.input;

    let targets: string[];
    if (EDITING_TOOLS[event.toolName]) {
      targets = pathsFromToolInput(event.toolName, input);
    } else if (event.toolName === "bash" && typeof input.command === "string") {
      targets = writeTargetsFromCommand(
        input.command,
        resolve(ctx.cwd, typeof input.cwd === "string" ? input.cwd : "."),
      );
    } else {
      return;
    }
    if (targets.length === 0) return;

    const scratch = tmpdir();
    const relTargets = targets
      .filter(
        (t) => !/^[a-z][a-z0-9+.-]*:\/\//.test(t) && !resolve(ctx.cwd, t).startsWith(`${scratch}/`),
      )
      .map((t) => toRepoRelative(t, ctx.cwd));
    if (relTargets.length === 0) return;

    if (agent.kind === "main") {
      const hit = relTargets.find(
        (p) => matchesAny(p, PRODUCT_CODE_ROOTS) && !matchesAny(p, ORCHESTRATOR_EDITABLE),
      );
      if (hit === undefined) return;
      return {
        block: true,
        reason: `[ownership/OR-main] The orchestrator does not edit product code (${hit}); only ORCHESTRATOR_EDITABLE in .omp/hooks/lib/policy.ts. Brief a slice and spawn rust-impl or web-impl.`,
      };
    }

    const registry = readSliceRegistry(ctx.cwd);
    const slice = ownershipFor(agent, registry);
    if (slice === undefined) {
      return {
        block: true,
        reason: `[ownership/SP1] No slice registered for agent "${agent.id}" in .omp/run/slices.json; this agent may not write files.`,
      };
    }

    for (const p of relTargets) {
      if (escapesRepo(p)) {
        return { block: true, reason: `[ownership/SP1] Write outside the repository: ${p}` };
      }
      if (!matchesAny(p, slice.owned)) {
        return {
          block: true,
          reason: `[ownership/SP1] ${p} is outside your slice (owned: ${slice.owned.join(", ")}). Report the needed change in deviations_from_brief instead.`,
        };
      }
    }
    return;
  });
}
