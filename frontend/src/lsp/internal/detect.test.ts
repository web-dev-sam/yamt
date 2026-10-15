import { expect, test } from "vitest";

import type { ProgramFolders, ProgramFound, ProjectFile } from "../../ipc";
import { detect, type ProjectLookups } from "./detect";
import type { ServerSpec } from "./spec";

type Tree = Readonly<Record<string, string | ProjectFile>>;

type Fake = ProjectLookups & {
  readonly fileCalls: (readonly string[])[];
  readonly programCalls: [string, string, ProgramFolders][];
};

const ROOT = "/repo";
const NODE_BIN: ProgramFolders = { project: ["node_modules/.bin"], home: [] };
const NO_SERVERS = { "package.json": "{}" };

function parentOf(path: string): string {
  return path.slice(0, Math.max(path.lastIndexOf("/"), 0));
}

function fileOf(tree: Tree, path: string): ProjectFile {
  const entry = tree[path];
  if (typeof entry === "string") {
    return { kind: "Text", text: entry };
  }
  if (entry !== undefined) {
    return entry;
  }
  const folder = Object.keys(tree).some((key) => key.startsWith(`${path}/`));
  return folder ? { kind: "Folder" } : { kind: "Missing" };
}

function lookups(tree: Tree, onPath: readonly string[] = []): Fake {
  const fileCalls: (readonly string[])[] = [];
  const programCalls: [string, string, ProgramFolders][] = [];
  return {
    fileCalls,
    programCalls,
    async projectFiles(paths) {
      fileCalls.push(paths);
      return paths.map((path) => fileOf(tree, path));
    },
    async findProgram(program, project, folders): Promise<ProgramFound> {
      programCalls.push([program, project, folders]);
      for (let at = project; ; at = parentOf(at)) {
        const bin = `${at === "" ? "" : `${at}/`}node_modules/.bin/${program}`;
        if (tree[bin] !== undefined) {
          return { kind: "Found", path: `${ROOT}/${bin}`, place: "Project" };
        }
        if (at === "") {
          break;
        }
      }
      return onPath.includes(program)
        ? { kind: "Found", path: `/usr/bin/${program}`, place: "Path" }
        : { kind: "NotFound", searched: ["/usr/bin"] };
    },
  };
}

function bins(folder: string, ...programs: string[]): Tree {
  return Object.fromEntries(
    programs.map((program) => [`${folder}node_modules/.bin/${program}`, ""]),
  );
}

function typescriptAt(folder: string, version: string): Tree {
  return {
    [`${folder}node_modules/typescript/package.json`]: JSON.stringify({ version }),
    [`${folder}tsconfig.json`]: "{}",
  };
}

function eslintAt(folder: string): Tree {
  return {
    [`${folder}eslint.config.js`]: "",
    [`${folder}node_modules/eslint/package.json`]: '{"version":"9.0.0"}',
  };
}

function summary(specs: readonly ServerSpec[]): string[] {
  return specs.map(({ name, command, project }) =>
    [name, command.program, ...command.args, `@${project}`].join(" "),
  );
}

test("project folders: the nearest package.json walking up, the file's own folder first", async () => {
  const tree = {
    ...NO_SERVERS,
    "frontend/package.json": "{}",
    "frontend/src/inner/package.json": "{}",
    ...bins("", "oxlint"),
  };
  const fake = lookups(tree);

  const specs = await detect(["frontend/src/a.ts", "frontend/src/inner/b.ts", "c.ts"], fake, ROOT);

  expect(summary(specs)).toEqual([
    "oxlint (repository root) oxlint --lsp @",
    "oxlint (frontend) oxlint --lsp @frontend",
    "oxlint (frontend/src/inner) oxlint --lsp @frontend/src/inner",
  ]);
  expect(fake.fileCalls[0]).toEqual([
    "frontend/src/package.json",
    "frontend/package.json",
    "package.json",
    "frontend/src/inner/package.json",
  ]);
});

test("project folders: a file at the root belongs to the root project", async () => {
  const specs = await detect(["a.ts"], lookups({ ...NO_SERVERS, ...bins("", "oxlint") }), ROOT);

  expect(summary(specs)).toEqual(["oxlint oxlint --lsp @"]);
  expect(specs[0]?.initializationOptions).toEqual([
    { workspaceUri: "file:///repo", options: { run: "onType" } },
  ]);
});

test("project folders: files with no package.json above them are served by no preset", async () => {
  const fake = lookups({ "crates/session/Cargo.toml": "", ...bins("", "oxlint") });

  expect(await detect(["crates/session/src/lib.rs"], fake, ROOT)).toEqual([]);
  expect(fake.fileCalls).toHaveLength(1);
  expect(fake.programCalls).toEqual([]);
});

test("project folders: a folder named package.json is no project", async () => {
  const fake = lookups({ "package.json/x": "", ...bins("", "oxlint") });

  expect(await detect(["a.ts"], fake, ROOT)).toEqual([]);
});

test("project folders: two files in one project check it once", async () => {
  const fake = lookups({ "frontend/package.json": "{}", ...bins("frontend/", "oxlint") });

  const specs = await detect(["frontend/a.ts", "frontend/src/b.ts", "frontend/a.ts"], fake, ROOT);

  expect(summary(specs)).toEqual(["oxlint oxlint --lsp @frontend"]);
  expect(fake.fileCalls).toHaveLength(2);
  expect(fake.programCalls.filter(([program]) => program === "oxlint")).toEqual([
    ["oxlint", "frontend", NODE_BIN],
  ]);
  expect(fake.programCalls.map(([, , folders]) => folders)).toEqual(
    fake.programCalls.map(() => NODE_BIN),
  );
});

test("oxlint and oxfmt: found in the project (or above it), formatter first, with their options", async () => {
  const tree = { "web/package.json": "{}", ...bins("", "oxlint", "oxfmt") };

  const specs = await detect(["web/a.ts"], lookups(tree), ROOT);

  expect(specs).toEqual([
    {
      name: "oxfmt",
      command: { program: "oxfmt", args: ["--lsp"] },
      project: "web",
      folders: NODE_BIN,
      fileTypes: expect.arrayContaining(["ts", "vue", "json", "md", "toml"]),
      formats: true,
      settings: null,
      initializationOptions: null,
      install: null,
    },
    {
      name: "oxlint",
      command: { program: "oxlint", args: ["--lsp"] },
      project: "web",
      folders: NODE_BIN,
      fileTypes: expect.arrayContaining(["ts", "vue"]),
      formats: false,
      settings: null,
      initializationOptions: [{ workspaceUri: "file:///repo/web", options: { run: "onType" } }],
      install: null,
    },
  ]);
});

test("oxlint and oxfmt: a global install does not count", async () => {
  const specs = await detect(["a.ts"], lookups(NO_SERVERS, ["oxlint", "oxfmt"]), ROOT);

  expect(specs).toEqual([]);
});

test("TypeScript 7 or later: the project's own tsc in language-server mode", async () => {
  const tree = { ...NO_SERVERS, ...typescriptAt("", "7.0.0-dev.20251001") };

  const specs = await detect(["a.ts"], lookups(tree), ROOT);

  expect(specs).toEqual([
    {
      name: "TypeScript",
      command: { program: "tsc", args: ["--lsp", "--stdio"] },
      project: "",
      folders: NODE_BIN,
      fileTypes: ["js", "jsx", "mjs", "cjs", "ts", "tsx", "mts", "cts"],
      formats: false,
      settings: null,
      initializationOptions: null,
      install: null,
    },
  ]);
});

test("TypeScript 5 with the project's own tsgo: the native preview; tsgo on PATH does not count", async () => {
  const tree = { ...NO_SERVERS, ...typescriptAt("", "5.9.3") };

  const specs = await detect(["a.ts"], lookups({ ...tree, ...bins("", "tsgo") }), ROOT);
  const onPath = await detect(["a.ts"], lookups(tree, ["tsgo"]), ROOT);

  expect(summary(specs)).toEqual(["TypeScript tsgo --lsp --stdio @"]);
  expect(specs[0]?.install).toBeNull();
  expect(summary(onPath)).toEqual(["TypeScript typescript-language-server --stdio @"]);
});

test("TypeScript 6: typescript-language-server from the project or PATH, else an install hint", async () => {
  const tree = { ...NO_SERVERS, ...typescriptAt("", "6.0.1") };
  const inProject = { ...tree, ...bins("", "typescript-language-server") };

  const local = await detect(["a.ts"], lookups(inProject), ROOT);
  const onPath = await detect(["a.ts"], lookups(tree, ["typescript-language-server"]), ROOT);

  expect(summary(local)).toEqual(["TypeScript typescript-language-server --stdio @"]);
  expect(local[0]?.install).toBeNull();
  expect(summary(onPath)).toEqual(summary(local));
  expect(onPath[0]?.install).toBeNull();
});

test("TypeScript 5.9 without its server: install hint with the version, folder and manager", async () => {
  const tree = {
    "package.json": "{}",
    "pnpm-lock.yaml": "",
    "frontend/package.json": JSON.stringify({ packageManager: "pnpm@12.0.0" }),
    ...typescriptAt("frontend/", "5.9.3"),
  };

  const specs = await detect(["frontend/src/main.ts"], lookups(tree), ROOT);

  expect(specs).toEqual([
    expect.objectContaining({
      name: "TypeScript",
      command: { program: "typescript-language-server", args: ["--stdio"] },
      project: "frontend",
      folders: NODE_BIN,
      install: {
        package: "typescript-language-server",
        program: "typescript-language-server",
        folder: "frontend",
        manager: "pnpm",
        reason: { kind: "typescript", version: "5.9.3" },
      },
    }),
  ]);
});

test("TypeScript: the package counts up to the root, jsconfig.json counts as config", async () => {
  const tree = {
    "app/package.json": "{}",
    "app/jsconfig.json": "{}",
    "node_modules/typescript/package.json": '{"version":"7.1.0"}',
  };

  const specs = await detect(["app/a.js"], lookups(tree), ROOT);

  expect(summary(specs)).toEqual(["TypeScript tsc --lsp --stdio @app"]);
});

test("TypeScript: the nearest typescript package decides the version", async () => {
  const tree = {
    "app/package.json": "{}",
    ...typescriptAt("app/", "7.0.0"),
    "node_modules/typescript/package.json": '{"version":"5.9.3"}',
  };

  const specs = await detect(["app/a.ts"], lookups(tree), ROOT);

  expect(summary(specs)).toEqual(["TypeScript tsc --lsp --stdio @app"]);
});

test("TypeScript: the whole leading number is the major version", async () => {
  const tree = { ...NO_SERVERS, ...typescriptAt("", "10.0.0") };

  const specs = await detect(["a.ts"], lookups(tree), ROOT);

  expect(summary(specs)).toEqual(["TypeScript tsc --lsp --stdio @"]);
});

test("TypeScript: not detected without a config, without the package, or with no version", async () => {
  const noConfig = {
    ...NO_SERVERS,
    "node_modules/typescript/package.json": '{"version":"7.0.0"}',
  };
  const noPackage = { ...NO_SERVERS, "tsconfig.json": "{}", ...bins("", "tsc") };
  const malformed = {
    ...NO_SERVERS,
    ...typescriptAt("", "7.0.0"),
    "node_modules/typescript/package.json": "{ not json",
  };
  const noVersion = { ...malformed, "node_modules/typescript/package.json": '{"version":"next"}' };
  const numberVersion = { ...malformed, "node_modules/typescript/package.json": '{"version":7}' };
  const notLeading = { ...NO_SERVERS, ...typescriptAt("", "x7.0.0") };
  const notText: Tree = {
    ...malformed,
    "node_modules/typescript/package.json": { kind: "NotText" },
  };

  for (const tree of [
    noConfig,
    noPackage,
    malformed,
    noVersion,
    numberVersion,
    notLeading,
    notText,
  ]) {
    expect(await detect(["a.ts"], lookups(tree, ["typescript-language-server"]), ROOT)).toEqual([]);
  }
});

test("eslint: config, package and its server found on PATH or in the project", async () => {
  const tree = { ...NO_SERVERS, ...eslintAt("") };

  const onPath = await detect(["a.ts"], lookups(tree, ["vscode-eslint-language-server"]), ROOT);
  const local = await detect(
    ["a.ts"],
    lookups({ ...tree, ...bins("", "vscode-eslint-language-server") }),
    ROOT,
  );

  expect(onPath).toEqual([
    {
      name: "eslint",
      command: { program: "vscode-eslint-language-server", args: ["--stdio"] },
      project: "",
      folders: NODE_BIN,
      fileTypes: ["js", "jsx", "mjs", "cjs", "ts", "tsx", "mts", "cts", "vue"],
      formats: false,
      settings: { validate: "on", run: "onType" },
      initializationOptions: null,
      install: null,
    },
  ]);
  expect(local).toEqual(onPath);
});

test("eslint: without its server, an install hint for vscode-langservers-extracted", async () => {
  const tree = { ...NO_SERVERS, ...eslintAt(""), "yarn.lock": "" };

  const specs = await detect(["a.ts"], lookups(tree), ROOT);

  expect(specs.map(({ install }) => install)).toEqual([
    {
      package: "vscode-langservers-extracted",
      program: "vscode-eslint-language-server",
      folder: "",
      manager: "yarn",
      reason: { kind: "eslint" },
    },
  ]);
});

test("eslint: not detected without a config or without the package", async () => {
  const noConfig: Tree = { ...eslintAt(""), "eslint.config.js": { kind: "Missing" } };
  const noPackage: Tree = {
    ...eslintAt(""),
    "node_modules/eslint/package.json": { kind: "Folder" },
  };
  const legacy: Tree = { ...noConfig, ".eslintrc.yml": { kind: "TooLarge" } };
  const server = ["vscode-eslint-language-server"];

  expect(await detect(["a.ts"], lookups({ ...NO_SERVERS, ...noConfig }, server), ROOT)).toEqual([]);
  expect(await detect(["a.ts"], lookups({ ...NO_SERVERS, ...noPackage }, server), ROOT)).toEqual(
    [],
  );
  expect(
    summary(await detect(["a.ts"], lookups({ ...NO_SERVERS, ...legacy }, server), ROOT)),
  ).toEqual(["eslint vscode-eslint-language-server --stdio @"]);
});

test("names are unique across projects; a tool in one project keeps its plain name", async () => {
  const tree = {
    "a/package.json": "{}",
    "b/package.json": "{}",
    ...bins("", "oxlint"),
    ...bins("b/", "oxfmt"),
  };

  const specs = await detect(["b/x.ts", "a/x.ts"], lookups(tree), ROOT);

  expect(specs.map(({ name }) => name)).toEqual(["oxlint (a)", "oxfmt", "oxlint (b)"]);
});

function managerFor(tree: Tree): Promise<unknown> {
  const withHint = { ...tree, ...typescriptAt("app/", "5.9.3") };
  return detect(["app/a.ts"], lookups(withHint), ROOT).then((specs) => specs[0]?.install?.manager);
}

test("package manager: the lock file nearest the project folder, up to the root", async () => {
  const app = { "app/package.json": "{}" };

  expect(await managerFor({ ...app, "app/bun.lockb": "" })).toBe("bun");
  expect(await managerFor({ ...app, "bun.lock": { kind: "NotText" } })).toBe("bun");
  expect(await managerFor({ ...app, "package-lock.json": { kind: "TooLarge" } })).toBe("npm");
  expect(await managerFor({ ...app, "app/yarn.lock": "", "pnpm-lock.yaml": "" })).toBe("yarn");
  expect(
    await managerFor({ ...app, "app/yarn.lock": { kind: "Folder" }, "pnpm-lock.yaml": "" }),
  ).toBe("pnpm");
  expect(await managerFor({ ...app, "app/package-lock.json": "", "app/pnpm-lock.yaml": "" })).toBe(
    "pnpm",
  );
});

test("package manager: the project's field beats a lock file; a malformed package.json has none", async () => {
  const field = JSON.stringify({ packageManager: "yarn@4.1.0" });

  expect(await managerFor({ "app/package.json": field, "app/pnpm-lock.yaml": "" })).toBe(
    "yarnBerry",
  );
  expect(await managerFor({ "app/package.json": "{", "app/pnpm-lock.yaml": "" })).toBe("pnpm");
  expect(
    await managerFor({ "app/package.json": '{"packageManager":["pnpm@9"]}', "app/yarn.lock": "" }),
  ).toBe("yarn");
  expect(
    await managerFor({ "app/package.json": "{}", "package.json": '{"packageManager":"bun@1.1"}' }),
  ).toBeNull();
});

test("a rejecting lookup means not found", async () => {
  const tree = { ...NO_SERVERS, ...eslintAt(""), ...bins("", "oxlint") };
  const files = lookups(tree);
  const noFiles = { ...files, projectFiles: () => Promise.reject(new Error("gone")) };
  const noPrograms = { ...files, findProgram: () => Promise.reject(new Error("gone")) };

  expect(await detect(["a.ts"], noFiles, ROOT)).toEqual([]);
  expect(summary(await detect(["a.ts"], noPrograms, ROOT))).toEqual([
    "eslint vscode-eslint-language-server --stdio @",
  ]);
  expect((await detect(["a.ts"], noPrograms, ROOT))[0]?.install?.reason).toEqual({
    kind: "eslint",
  });
});

test("a short answer from projectFiles leaves the rest missing", async () => {
  const fake = lookups({ "package.json": "{}", ...bins("", "oxlint") });
  const short = { ...fake, projectFiles: async () => [] };

  expect(await detect(["a.ts"], short, ROOT)).toEqual([]);
});
