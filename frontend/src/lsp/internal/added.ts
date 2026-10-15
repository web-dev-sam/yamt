import type { AddedServer } from "../../ipc";
import { PRESET_SERVERS, type PresetServer } from "./choices";
import { EVERY_ECOSYSTEM_FOLDERS } from "./ecosystems";
import { projectUri } from "./handshake";
import { sameValue } from "./json";
import type { ServerSpec } from "./spec";
import { mayFormat } from "./tool";

const FIRST_REPEAT = 2;
const WINDOWS_RUNNABLE = /\.(exe|cmd|bat)$/i;

function presetOf(base: string, args: readonly string[]): PresetServer | undefined {
  const program = base.replace(WINDOWS_RUNNABLE, "");
  return PRESET_SERVERS.find(
    ({ command }) => command.program === program && sameValue(command.args, args),
  );
}

function presetPart(
  preset: PresetServer | undefined,
  root: string,
): Pick<ServerSpec, "formats" | "settings" | "initializationOptions" | "help"> {
  if (preset === undefined) {
    return { formats: true, settings: null, initializationOptions: null, help: null };
  }
  const { tool, help } = preset;
  const workspaceUri = projectUri({ folder: "", root });
  return {
    formats: mayFormat(tool),
    settings: tool.settings,
    initializationOptions: tool.initializationOptions?.(workspaceUri) ?? null,
    help,
  };
}

export function addedSpecs(
  added: readonly AddedServer[],
  taken: readonly string[],
  root: string,
): readonly ServerSpec[] {
  const names = new Set(taken);
  return added.flatMap(({ command: [program = "", ...args], fileTypes }) => {
    const base = program.split(/[/\\]/).at(-1) ?? "";
    if (base === "") {
      return [];
    }
    const preset = presetOf(base, args);
    const wanted = preset?.tool.name ?? base;
    let name = wanted;
    for (let repeat = FIRST_REPEAT; names.has(name); repeat += 1) {
      name = `${wanted} (${repeat})`;
    }
    names.add(name);
    const command = { program, args };
    const spec = { name, command, project: "", folders: EVERY_ECOSYSTEM_FOLDERS, fileTypes };
    return [{ ...spec, ...presetPart(preset, root), install: null, notes: [] }];
  });
}
