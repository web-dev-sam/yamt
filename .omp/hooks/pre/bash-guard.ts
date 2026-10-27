import type { ExtensionAPI } from "@oh-my-pi/pi-coding-agent";

type Rule = { pattern: RegExp; reason: string };

const DENIED_FOR_EVERYONE: Rule[] = [
  { pattern: /\bgit\s+push\b/, reason: "git push is a human action" },
  { pattern: /\bgit\s+reset\s+--hard\b/, reason: "git reset --hard discards work" },
  { pattern: /\bgit\s+checkout\s+(?:--\s+)?\.(?:\s|$)/, reason: "git checkout . discards work" },
  { pattern: /\bgit\s+clean\s+-\w*f/, reason: "git clean -f discards untracked files" },
  { pattern: /\bgit\s+branch\s+-D\b/, reason: "branch deletion is a human action" },
  { pattern: /\b(?:cargo|npm|pnpm|yarn)\s+publish\b/, reason: "publishing is a human action" },
  {
    pattern: /\b(?:curl|wget)\b[^|]*\|\s*(?:sudo\s+)?(?:ba|z|)sh\b/,
    reason: "piping downloads into a shell",
  },
  { pattern: /\bsudo\b/, reason: "no privilege escalation from an agent" },
  {
    pattern:
      /\brm\s+-\w*r\w*f?\w*\s+(?!(?:\.\/)?(?:target|node_modules|dist|\.vite)\b|\/tmp\/|\$TMPDIR\b|\$\(mktemp)/,
    reason: "rm -rf outside target/, node_modules/, dist/, /tmp",
  },
  {
    pattern:
      /\b(?:spectacle|grim|scrot|gnome-screenshot|flameshot)\b|org\.kde\.KWin\.ScreenShot2|\bimport\b(?![^;&|]*\s-display\b)[^;&|]*\s-window\s+root\b/,
    reason:
      "desktop screenshots can capture the owner's screen; use the WebDriver session screenshot (`GET /session/<id>/screenshot`, tauri-driver for the app) or the private display",
  },
  {
    pattern: /\bcargo[\s-]+mutants\b(?![^;&|]*\s--list\b)/,
    reason:
      "Rust mutation runs go through `just mutants <the commit before one patch>`, which refuses more than one patch's worth; a whole-feature run takes hours (#1630, VF7)",
  },
];

const DENIED_FOR_SUBAGENTS: Rule[] = [
  {
    pattern: /\bgit\s+(?:add|commit|rebase|merge|stash|tag|cherry-pick|am|apply)\b/,
    reason: "only the orchestrator commits (SP9); git in a scratch repo must use `git -C /tmp/...`",
  },
  {
    pattern: /\bjust\s+golden-update(?![\w-])/,
    reason:
      "golden snapshots change only through the orchestrator or the verifier on request (PM4); `just bindings` is allowed — it regenerates from source",
  },
];

const REVIEWERS: Record<string, true> = { "boundary-reviewer": true, "correctness-reviewer": true };

const WHOLE_WORKSPACE =
  "whole-workspace toolchains are the verifier's (RV6, OR10); run one targeted test file instead";

const DENIED_FOR_REVIEWERS: Rule[] = [
  { pattern: /\bjust\s+(?:check|clippy|test|web-[\w-]+)(?![\w-])/, reason: WHOLE_WORKSPACE },
  {
    pattern: /\bpnpm\s+(?:-C\s+\S+\s+)?(?:run\s+)?(?:lint|typecheck)(?![\w:-])/,
    reason: WHOLE_WORKSPACE,
  },
  {
    pattern: /\bpnpm\s+(?:-C\s+\S+\s+)?(?:run\s+)?test(?::browser)?\s*(?:$|[;&|])/,
    reason: WHOLE_WORKSPACE,
  },
  { pattern: /\bcargo\s+clippy\b[^;&|]*--workspace/, reason: WHOLE_WORKSPACE },
  { pattern: /\bcargo\s+nextest\s+run\b[^;&|]*--workspace/, reason: WHOLE_WORKSPACE },
  { pattern: /\bvue-tsc\b/, reason: WHOLE_WORKSPACE },
  { pattern: /\boxlint\b[^;&|]*--type-aware/, reason: WHOLE_WORKSPACE },
];

const SCRATCH_REPO = /\bgit\s+-C\s+(?:\/tmp\/|\$TMPDIR|\$\(mktemp)/;

export default function bashGuard(pi: ExtensionAPI): void {
  pi.on("tool_call", async (event, ctx) => {
    if (event.toolName !== "bash") return;
    const command = event.input.command;
    if (typeof command !== "string") return;

    for (const rule of DENIED_FOR_EVERYONE) {
      if (rule.pattern.test(command))
        return { block: true, reason: `[bash-guard] ${rule.reason}: ${command}` };
    }
    if (ctx.agent.kind !== "sub") return;
    if (REVIEWERS[ctx.agent.name]) {
      for (const rule of DENIED_FOR_REVIEWERS) {
        if (rule.pattern.test(command))
          return { block: true, reason: `[bash-guard] ${rule.reason}: ${command}` };
      }
    }
    if (SCRATCH_REPO.test(command)) return;
    for (const rule of DENIED_FOR_SUBAGENTS) {
      if (rule.pattern.test(command))
        return { block: true, reason: `[bash-guard] ${rule.reason}: ${command}` };
    }
    return;
  });
}
