import type { ProgramFolders, ProgramFound, ProjectFile, StartReply } from "./domain";
import { REPOSITORY } from "./fixtureSettings";
import type { ServerHost } from "./ServerHost";

export const ONLY_IN_THE_APP = "language servers run only in the app";

const PROCESS_ID = 1;

const TREE: Readonly<Record<string, string>> = {
  "package.json": JSON.stringify({
    name: "fixture",
    private: true,
    devDependencies: { eslint: "9.39.1", oxlint: "1.87.0", typescript: "5.9.3", vue: "3.5.43" },
  }),
  "tsconfig.json": JSON.stringify({ compilerOptions: { strict: true } }),
  "eslint.config.js": "export default [];\n",
  "node_modules/eslint/package.json": JSON.stringify({ name: "eslint", version: "9.39.1" }),
  "node_modules/typescript/package.json": JSON.stringify({ name: "typescript", version: "5.9.3" }),
  "node_modules/vue/package.json": JSON.stringify({ name: "vue", version: "3.5.43" }),
  "node_modules/.bin/oxlint": "",
  "node_modules/.bin/typescript-language-server": "",
};

function joined(folder: string, name: string): string {
  return folder === "" ? name : `${folder}/${name}`;
}

function foldersUp(folder: string): readonly string[] {
  return folder === ""
    ? [""]
    : [folder, ...foldersUp(folder.slice(0, Math.max(folder.lastIndexOf("/"), 0)))];
}

function projectFile(path: string): ProjectFile {
  const text = TREE[path];
  if (text !== undefined) {
    return { kind: "Text", text };
  }
  const isFolder = path === "" || Object.keys(TREE).some((file) => file.startsWith(`${path}/`));
  return isFolder ? { kind: "Folder" } : { kind: "Missing" };
}

function findProgram(program: string, project: string, folders: ProgramFolders): ProgramFound {
  const places = foldersUp(project).flatMap((at) =>
    folders.project.map((entry) => joined(at, entry)),
  );
  const found = places.find((place) => TREE[joined(place, program)] !== undefined);
  return found === undefined
    ? { kind: "NotFound", searched: places.map((place) => `${REPOSITORY}/${place}`) }
    : { kind: "Found", path: `${REPOSITORY}/${joined(found, program)}`, place: "Project" };
}

export function createFixtureServerHost(): ServerHost {
  return {
    context: async () => ({ root: REPOSITORY, process_id: PROCESS_ID }),
    start: async ({ program }): Promise<StartReply> => ({
      kind: "SpawnFailed",
      program,
      message: ONLY_IN_THE_APP,
    }),
    send: () => undefined,
    stop: async () => undefined,
    findProgram: async (program, project, folders) => findProgram(program, project, folders),
    projectFiles: async (paths) => paths.map(projectFile),
  };
}
