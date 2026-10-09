import { execFileSync } from "node:child_process";

import type { ExtensionAPI } from "@oh-my-pi/pi-coding-agent";

import {
  IMPLEMENTER_AGENTS,
  MAX_PARALLEL_AGENTS,
  readSliceRegistry,
  SLICE_REGISTRY,
} from "../lib/policy";

const BROADCAST = "agent://all";

function registryNotCommitted(cwd: string): string | undefined {
  try {
    const status = execFileSync("git", ["status", "--porcelain", "--", SLICE_REGISTRY], {
      cwd,
      encoding: "utf8",
    });
    if (status === "") return undefined;
    return `${SLICE_REGISTRY} has uncommitted changes; isolated agents run in a copy of HEAD, so commit it before spawning`;
  } catch (error) {
    return `cannot read the git status of ${SLICE_REGISTRY}: ${error instanceof Error ? error.message : String(error)}`;
  }
}

function spawnProblem(
  item: unknown,
  cwd: string,
  spawned: ReadonlySet<string>,
): string | undefined {
  if (item === null || typeof item !== "object") return undefined;
  const name: unknown = Reflect.get(item, "name");
  const agent: unknown = Reflect.get(item, "agent");
  const isolated = Reflect.get(item, "isolated") === true;
  const implementer = typeof agent === "string" && IMPLEMENTER_AGENTS[agent] === true;
  if (!isolated && !implementer) return undefined;
  if (typeof name !== "string")
    return `an implementer spawn needs an explicit \`name\` registered in ${SLICE_REGISTRY}`;
  if (spawned.has(name)) {
    return `"${name}" was already spawned in this session; a repeat is renamed "${name}-2", which ${SLICE_REGISTRY} does not list. Use a fresh name (${name}R1), register it, commit, then spawn`;
  }
  if (readSliceRegistry(cwd)[name] === undefined) {
    return `"${name}" is not a key of ${SLICE_REGISTRY}; write the registry with only the live task names, commit, then spawn`;
  }
  return isolated ? registryNotCommitted(cwd) : undefined;
}

export default function taskFanout(pi: ExtensionAPI): void {
  const spawned = new Set<string>();

  pi.on("tool_call", async (event, ctx) => {
    if (event.toolName === "write" && event.input.path === BROADCAST) {
      return {
        block: true,
        reason: `[task-fanout/OR10] A broadcast wakes every idle agent, beyond MAX_PARALLEL_AGENTS (${MAX_PARALLEL_AGENTS}). Message live agents by name.`,
      };
    }
    if (event.toolName !== "task" || ctx.agent.kind !== "main") return;
    const items: unknown[] = Array.isArray(event.input.tasks) ? event.input.tasks : [event.input];
    if (items.length > MAX_PARALLEL_AGENTS) {
      return {
        block: true,
        reason: `[task-fanout/OR10] ${items.length} tasks in one call; at most MAX_PARALLEL_AGENTS (${MAX_PARALLEL_AGENTS}) agents run at once. Split the call.`,
      };
    }
    for (const item of items) {
      const problem = spawnProblem(item, ctx.cwd, spawned);
      if (problem !== undefined) return { block: true, reason: `[task-fanout/OR1] ${problem}` };
    }
    for (const item of items) {
      const name: unknown =
        item !== null && typeof item === "object" ? Reflect.get(item, "name") : undefined;
      if (typeof name === "string") spawned.add(name);
    }
    return;
  });
}
