import type { ExtensionAPI } from "@oh-my-pi/pi-coding-agent";

import { flaggedTerms, readPlainLanguageLists, stringsIn } from "../lib/plain-language";

const MAX_REPORTED_FLAGS = 8;

export default function plainLanguage(pi: ExtensionAPI): void {
  pi.on("tool_call", async (event, ctx) => {
    if (event.toolName !== "ask" || ctx.agent.kind !== "main") return;
    const lists = readPlainLanguageLists(ctx.cwd);
    if (lists === undefined) return;
    const flags = flaggedTerms(stringsIn(event.input), lists);
    if (flags.length === 0) return;
    const listed = flags
      .slice(0, MAX_REPORTED_FLAGS)
      .map((f) => `${f.term}: "${f.excerpt}"`)
      .join(", ");
    return { block: true, reason: `[plain-language] rephrase for the human — flagged: ${listed}` };
  });
}
