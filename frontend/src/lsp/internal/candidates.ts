import { foldersUp, joined, type Ecosystem } from "./ecosystems";
import { HINT_FILES } from "./install";
import { integrationFiles } from "./integrations";
import { DETECTED_PRESETS, type DetectedPreset } from "./presets";
import { modulePackage, type Wanted } from "./project";
import type { Formats, Sign, Tool } from "./tool";
import { VUE_FILES } from "./vue";

function signFile(sign: Sign): readonly string[] {
  switch (sign.kind) {
    case "manifest":
      return [];
    case "file":
      return [sign.name];
    case "section":
      return [sign.file];
  }
}

function formatConfigs(formats: Formats): readonly string[] {
  return formats.kind === "withConfig" ? formats.files : [];
}

function projectFiles({ fromProject }: Tool): readonly string[] {
  return fromProject.kind === "integrations" ? integrationFiles(fromProject.integrations) : [];
}

function lookedFor(preset: DetectedPreset): Wanted {
  const { look } = preset;
  switch (look.kind) {
    case "projectProgram":
      return { here: [], up: formatConfigs(preset.formats) };
    case "used": {
      const tools = [preset, ...look.orElse];
      return {
        here: [...look.signs.flatMap(signFile), ...tools.flatMap(projectFiles)],
        up: tools.flatMap((tool) => formatConfigs(tool.formats)),
      };
    }
    case "typescript":
      return {
        here: look.configs,
        up: [...formatConfigs(preset.formats), modulePackage(look.package), ...VUE_FILES],
      };
    case "eslint":
      return {
        here: look.configs,
        up: [...formatConfigs(preset.formats), modulePackage(look.package)],
      };
  }
}

export function candidates(folder: string, ecosystems: ReadonlySet<Ecosystem>): readonly string[] {
  const wanted = [
    ...DETECTED_PRESETS.filter((preset) => ecosystems.has(preset.ecosystem)).map(lookedFor),
    ...[...ecosystems].map((ecosystem) => HINT_FILES[ecosystem]),
  ];
  return [
    ...wanted.flatMap(({ here }) => here.map((name) => joined(folder, name))),
    ...foldersUp(folder).flatMap((at) =>
      wanted.flatMap(({ up }) => up.map((name) => joined(at, name))),
    ),
  ];
}
