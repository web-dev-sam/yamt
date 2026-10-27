import { DEFAULT_AGENT_COMMAND, DEFAULT_FIRST_MESSAGE, PLACEHOLDERS } from "../agent";
import type { AgentSettings } from "../ipc";
import { commandWords } from "./commandWords";

export const PLACEHOLDER_NAMES: readonly string[] = PLACEHOLDERS.map((name) => `{{ ${name} }}`);

/** One field of the AI section: the text in use, and what Use and Default store (null: nothing to press). */
export type AgentField = {
  readonly shown: string;
  readonly use: AgentSettings | null;
  readonly reset: AgentSettings | null;
};

function sameWords(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((word, index) => word === b[index]);
}

/** The command the AI starts with: the stored one, or the default when none is stored (plan row 113). */
export function commandInUse(agent: AgentSettings): readonly string[] {
  return agent.command ?? DEFAULT_AGENT_COMMAND;
}

export function firstMessageInUse(agent: AgentSettings): string {
  return agent.firstMessage ?? DEFAULT_FIRST_MESSAGE;
}

/** Use stores the typed words, or null (the default) when they are the default's; never no words. */
export function commandField(agent: AgentSettings, typed: string): AgentField {
  const words = commandWords(typed);
  const inUse = commandInUse(agent);
  const stored = sameWords(words, DEFAULT_AGENT_COMMAND) ? null : [...words];
  const usable = words.length > 0 && !sameWords(words, inUse);
  return {
    shown: inUse.join(" "),
    use: usable ? { ...agent, command: stored } : null,
    reset: agent.command === null ? null : { ...agent, command: null },
  };
}

export function firstMessageField(agent: AgentSettings, typed: string): AgentField {
  const inUse = firstMessageInUse(agent);
  const stored = typed === DEFAULT_FIRST_MESSAGE ? null : typed;
  return {
    shown: inUse,
    use: typed === inUse ? null : { ...agent, firstMessage: stored },
    reset: agent.firstMessage === null ? null : { ...agent, firstMessage: null },
  };
}
