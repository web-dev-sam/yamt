import type { ExtensionAPI } from "@oh-my-pi/pi-coding-agent";

import { MAX_PARALLEL_AGENTS } from "../lib/policy";

export default function taskFanout(pi: ExtensionAPI): void {
  pi.on("tool_call", async (event, ctx) => {
    if (event.toolName !== "task" || ctx.agent.kind !== "main") return;
    const tasks = event.input.tasks;
    if (!Array.isArray(tasks) || tasks.length <= MAX_PARALLEL_AGENTS) return;
    return {
      block: true,
      reason: `[task-fanout/OR10] ${tasks.length} tasks in one call; at most MAX_PARALLEL_AGENTS (${MAX_PARALLEL_AGENTS}) agents run at once. Split the call.`,
    };
  });
}
