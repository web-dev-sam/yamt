import type { AgentCommand } from "../../ipc";

export const DEFAULT_AGENT_COMMAND: readonly string[] = ["omp", "acp"];

/** Looked in after PATH: omp installs through bun, and a desktop launcher's PATH often lacks both. */
const HOME_FOLDERS: readonly string[] = [".bun/bin", ".local/bin"];

/** The settings' words as the program and its arguments, nothing appended; null when no word is left. */
export function agentCommand(words: readonly string[]): AgentCommand | null {
  const [program, ...args] = words.filter((word) => word !== "");
  return program === undefined ? null : { program, args, homeFolders: HOME_FOLDERS };
}
