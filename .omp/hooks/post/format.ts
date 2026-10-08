import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

import type { ExtensionAPI } from "@oh-my-pi/pi-coding-agent";

import { pathsFromToolInput, toRepoRelative } from "../lib/policy";

const EDITING_TOOLS: Record<string, true> = { edit: true, write: true };
const OXFMT_EXTENSIONS = /\.(?:ts|vue|json|css|md|yml|yaml|toml)$/;

export default function formatOnEdit(pi: ExtensionAPI): void {
  pi.on("tool_result", async (event, ctx) => {
    if (event.isError || !EDITING_TOOLS[event.toolName]) return;
    const failures: string[] = [];
    for (const rel of pathsFromToolInput(event.toolName, event.input).map((p) => toRepoRelative(p, ctx.cwd))) {
      const abs = resolve(ctx.cwd, rel);
      if (!existsSync(abs)) continue;
      const result = rel.endsWith(".rs")
        ? spawnSync("rustfmt", ["--edition", "2024", abs], { cwd: ctx.cwd, encoding: "utf8" })
        : OXFMT_EXTENSIONS.test(rel) && existsSync(resolve(ctx.cwd, "frontend/node_modules/.bin/oxfmt"))
          ? spawnSync("pnpm", ["-C", "frontend", "exec", "oxfmt", abs], { cwd: ctx.cwd, encoding: "utf8" })
          : undefined;
      if (result !== undefined && result.status !== 0) failures.push(`${rel}: ${result.stderr.trim().split("\n")[0] ?? "formatter failed"}`);
    }
    if (failures.length === 0) return;
    return { additionalContext: `[format] formatter could not run on: ${failures.join("; ")}` };
  });
}
