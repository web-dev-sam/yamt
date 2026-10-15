import { serverHint } from "./install";
import { PRESETS, type Preset } from "./presets";
import type { Place } from "./project";
import type { InstallHint } from "./spec";
import type { Command, Tool } from "./tool";

export type PresetChoice = {
  readonly name: string;
  readonly command: readonly [string, ...string[]];
  readonly fileTypes: readonly string[];
};

export type PresetServer = {
  readonly tool: Tool;
  readonly command: Command;
  readonly fileTypes: readonly string[];
  readonly help: InstallHint | null;
};

const AT_ROOT: Place = { folder: "", files: new Map() };

function serversOf(preset: Preset): readonly PresetServer[] {
  const { fileTypes } = preset;
  if (preset.ecosystem === null) {
    return [{ tool: preset, command: preset.command, fileTypes, help: null }];
  }
  const { look } = preset;
  switch (look.kind) {
    case "projectProgram":
      return [{ tool: preset, command: look.command, fileTypes, help: null }];
    case "used":
      return [
        { tool: preset, command: look.command, fileTypes, help: serverHint(AT_ROOT, look) },
        ...look.orElse.map((tool) => ({ tool, command: tool.command, fileTypes, help: null })),
      ];
    case "typescript":
      return [{ tool: preset, command: look.server.command, fileTypes, help: null }];
    case "eslint":
      return [
        { tool: preset, command: look.server.command, fileTypes, help: serverHint(AT_ROOT, look) },
      ];
  }
}

export const PRESET_SERVERS: readonly PresetServer[] = PRESETS.flatMap(serversOf);

export function presetChoices(): readonly PresetChoice[] {
  return PRESET_SERVERS.map(({ tool, command, fileTypes }) => ({
    name: tool.name,
    command: [command.program, ...command.args],
    fileTypes,
  }));
}
