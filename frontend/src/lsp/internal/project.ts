import type { ProgramFound, ProjectFile, ServerHost } from "../../ipc";
import { ECOSYSTEMS, foldersUp, joined, present, type Ecosystem, type Files } from "./ecosystems";
import { sectionOf } from "./json";

export type ProjectLookups = Pick<ServerHost, "findProgram" | "projectFiles">;

export type Project = {
  readonly ecosystem: Ecosystem;
  readonly folder: string;
  readonly files: Files;
  readonly lookups: ProjectLookups;
};

export async function readFiles(lookups: ProjectLookups, paths: readonly string[]): Promise<Files> {
  const unique = [...new Set(paths)];
  const answers = await lookups.projectFiles(unique).catch((): readonly ProjectFile[] => []);
  return new Map(
    unique.map((path, index): [string, ProjectFile] => [
      path,
      answers[index] ?? { kind: "Missing" },
    ]),
  );
}

export function jsonField(file: ProjectFile | undefined, field: string): string | null {
  if (file?.kind !== "Text") {
    return null;
  }
  try {
    const value = sectionOf(JSON.parse(file.text), field);
    return typeof value === "string" ? value : null;
  } catch {
    return null;
  }
}

function findProgram(project: Project, program: string): Promise<ProgramFound> {
  return project.lookups
    .findProgram(program, project.folder, ECOSYSTEMS[project.ecosystem].folders)
    .catch((): ProgramFound => ({ kind: "NotFound", searched: [] }));
}

export async function foundAnywhere(project: Project, program: string): Promise<boolean> {
  return (await findProgram(project, program)).kind === "Found";
}

export async function inProject(project: Project, program: string): Promise<boolean> {
  const answer = await findProgram(project, program);
  return answer.kind === "Found" && answer.place === "Project";
}

export function nearest<Name extends string>(
  project: Project,
  names: readonly Name[],
): Name | null {
  const held = foldersUp(project.folder).flatMap((at) =>
    names.filter((name) => present(project.files.get(joined(at, name)))),
  );
  return held[0] ?? null;
}

export function hasConfig(project: Project, configs: readonly string[]): boolean {
  return configs.some((config) => present(project.files.get(joined(project.folder, config))));
}
