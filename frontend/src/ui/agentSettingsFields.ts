import {
  DEFAULT_AGENT_COMMAND,
  DEFAULT_FIRST_MESSAGE,
  PLACEHOLDERS,
  unknownPlaceholders,
} from "../agent";
import type { AgentSettings } from "../ipc";
import { commandWords } from "./commandWords";

export const PLACEHOLDER_NAMES: readonly string[] = PLACEHOLDERS.map((name) => `{{ ${name} }}`);

export const YOLO_NOTE =
  "yamt allows the AI's commands, and its deletes and moves only inside its checkout. With omp's approval mode set to yolo, omp asks yamt nothing about deletes and moves, so they are allowed anywhere.";

/** One field of the AI section: the text in use, and what Use and Default store (null: nothing to press). */
export type AgentField = {
  readonly shown: string;
  readonly use: AgentSettings | null;
  readonly reset: AgentSettings | null;
};

function sameWords(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((word, index) => word === b[index]);
}

/** Use stores the typed words, or null (the default) when they are the default's; never no words. */
export function commandField(agent: AgentSettings, typed: string): AgentField {
  const words = commandWords(typed);
  const inUse = agent.command ?? DEFAULT_AGENT_COMMAND;
  const stored = sameWords(words, DEFAULT_AGENT_COMMAND) ? null : [...words];
  const usable = words.length > 0 && !sameWords(words, inUse);
  return {
    shown: inUse.join(" "),
    use: usable ? { ...agent, command: stored } : null,
    reset: agent.command === null ? null : { ...agent, command: null },
  };
}

export function firstMessageField(agent: AgentSettings, typed: string): AgentField {
  const inUse = agent.firstMessage ?? DEFAULT_FIRST_MESSAGE;
  const stored = typed === DEFAULT_FIRST_MESSAGE ? null : typed;
  return {
    shown: inUse,
    use: typed === inUse ? null : { ...agent, firstMessage: stored },
    reset: agent.firstMessage === null ? null : { ...agent, firstMessage: null },
  };
}

export function unknownPlaceholderLines(typed: string): readonly string[] {
  return unknownPlaceholders(typed).map(
    (text) => `${text} is not a placeholder; it is sent as typed.`,
  );
}
