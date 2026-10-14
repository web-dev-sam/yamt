import type { AddedServer } from "../../ipc";
import type { ServerSpec } from "./spec";

const FIRST_REPEAT = 2;

export function addedSpecs(
  added: readonly AddedServer[],
  taken: readonly string[],
): readonly ServerSpec[] {
  const names = new Set(taken);
  return added.flatMap(({ command: [program = "", ...args], fileTypes }) => {
    const base = program.split(/[/\\]/).at(-1) ?? "";
    if (base === "") {
      return [];
    }
    let name = base;
    for (let repeat = FIRST_REPEAT; names.has(name); repeat += 1) {
      name = `${base} (${repeat})`;
    }
    names.add(name);
    const command = { program, args };
    return [
      {
        name,
        command,
        project: "",
        fileTypes,
        formats: true,
        settings: null,
        initializationOptions: null,
        install: null,
      },
    ];
  });
}
