import { expect, test } from "vitest";

import type { ProgramFolders, ProgramFound, ProjectFile } from "../../ipc";
import { detect } from "./detect";
import type { ProjectLookups } from "./project";
import type { InstallHint, ServerSpec } from "./spec";

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

function joinedPath(folder: string, name: string): string {
  return folder === "" ? name : `${folder}/${name}`;
}

function inProjectFolders(
  tree: Tree,
  [program, project, folders]: [string, string, ProgramFolders],
): string | null {
  for (let at = project; ; at = parentOf(at)) {
    const hit = folders.project
      .map((folder) => joinedPath(at, `${folder}/${program}`))
      .find((path) => tree[path] !== undefined);
    if (hit !== undefined) {
      return hit;
    }
    if (at === "") {
      return null;
    }
  }
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
      const local = inProjectFolders(tree, [program, project, folders]);
      if (local !== null) {
        return { kind: "Found", path: `${ROOT}/${local}`, place: "Project" };
      }
      if (onPath.includes(program)) {
        return { kind: "Found", path: `/usr/bin/${program}`, place: "Path" };
      }
      const home = folders.home.find((folder) => tree[`~/${folder}/${program}`] !== undefined);
      return home === undefined
        ? { kind: "NotFound", searched: ["/usr/bin"] }
        : { kind: "Found", path: `/home/u/${home}/${program}`, place: "Home" };
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

test("project folders: files with no package.json above them are served by no preset; a Cargo.toml brings no node project", async () => {
  const fake = lookups({ "crates/session/Cargo.toml": "[workspace]", ...bins("", "oxlint") });

  expect(await detect(["crates/session/src/lib.ts"], fake, ROOT)).toEqual([]);
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
      help: null,
      notes: [],
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
      help: null,
      notes: [],
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
      help: null,
      notes: [],
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
        kind: "node",
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
      help: {
        kind: "node",
        package: "vscode-langservers-extracted",
        program: "vscode-eslint-language-server",
        folder: "",
        manager: null,
        reason: { kind: "eslint" },
      },
      notes: [],
    },
  ]);
  expect(local).toEqual(onPath);
});

test("eslint: without its server, an install hint for vscode-langservers-extracted", async () => {
  const tree = { ...NO_SERVERS, ...eslintAt(""), "yarn.lock": "" };

  const specs = await detect(["a.ts"], lookups(tree), ROOT);

  expect(specs.map(({ install }) => install)).toEqual([
    {
      kind: "node",
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
  return detect(["app/a.ts"], lookups(withHint), ROOT).then((specs) => {
    const install = specs[0]?.install;
    return install?.kind === "node" ? install.manager : undefined;
  });
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
  expect((await detect(["a.ts"], noPrograms, ROOT))[0]?.install).toEqual(
    expect.objectContaining({ kind: "node", reason: { kind: "eslint" } }),
  );
});

test("a short answer from projectFiles leaves the rest missing", async () => {
  const fake = lookups({ "package.json": "{}", ...bins("", "oxlint") });
  const short = { ...fake, projectFiles: async () => [] };

  expect(await detect(["a.ts"], short, ROOT)).toEqual([]);
});

const RUST_BIN: ProgramFolders = { project: [], home: [".cargo/bin"] };
const GO_BIN: ProgramFolders = { project: [], home: ["go/bin"] };
const PYTHON_BIN: ProgramFolders = {
  project: [".venv/bin", ".venv/Scripts", "venv/bin", "venv/Scripts"],
  home: [".local/bin"],
};
const PHP_BIN: ProgramFolders = {
  project: ["vendor/bin"],
  home: [".config/composer/vendor/bin", ".composer/vendor/bin", ".local/bin"],
};
const CLANG_BIN: ProgramFolders = { project: [], home: [] };
const PYTHON_TYPES = ["py", "pyi"];
const PHPACTOR_HINT: InstallHint = {
  kind: "download",
  program: "phpactor",
  command:
    "curl --create-dirs -Lo ~/.local/bin/phpactor https://github.com/phpactor/phpactor/releases/latest/download/phpactor.phar && chmod a+x ~/.local/bin/phpactor",
  needs: "PHP 8.2 or later",
};

function venv(folder: string, ...programs: string[]): Tree {
  return Object.fromEntries(programs.map((program) => [`${folder}.venv/bin/${program}`, ""]));
}

function home(folder: string, program: string): Tree {
  return { [`~/${folder}/${program}`]: "" };
}

function installOf(specs: readonly ServerSpec[]): (InstallHint | null)[] {
  return specs.map(({ install }) => install);
}

test("ecosystems: a path joins only the ecosystems that serve its type", async () => {
  const tree = {
    ...NO_SERVERS,
    "Cargo.toml": "[workspace]\n",
    "pyproject.toml": "[tool.ruff]\n",
    ...bins("", "oxlint"),
  };
  const servers = ["rust-analyzer", "ruff"];
  const typescriptFake = lookups(tree, servers);
  const rustFake = lookups(tree, servers);

  const typescriptOnly = await detect(["src/a.ts"], typescriptFake, ROOT);
  const rustOnly = await detect(["src/lib.rs"], rustFake, ROOT);

  expect(summary(typescriptOnly)).toEqual(["oxlint oxlint --lsp @"]);
  expect(typescriptFake.programCalls.map(([program]) => program)).not.toContain("rust-analyzer");
  expect(summary(rustOnly)).toEqual(["rust-analyzer rust-analyzer @"]);
  expect(rustFake.fileCalls[0]).toEqual(["src/Cargo.toml", "Cargo.toml"]);
});

test("ecosystems: one folder that is a project of two ecosystems is read once, specs in table order", async () => {
  const tree = { ...NO_SERVERS, "Cargo.toml": "", ...bins("", "oxfmt") };
  const fake = lookups(tree, ["rust-analyzer"]);

  const specs = await detect(["src/lib.rs", "src/a.ts"], fake, ROOT);

  expect(summary(specs)).toEqual(["oxfmt oxfmt --lsp @", "rust-analyzer rust-analyzer @"]);
  expect(fake.fileCalls).toHaveLength(2);
});

test("rust-analyzer: the workspace's manifest counts, found on PATH, without cargo check", async () => {
  const tree = {
    "rs/Cargo.toml": '[workspace]\nmembers = ["core"]\n',
    "rs/core/Cargo.toml": "[package]\n",
  };
  const fake = lookups(tree, ["rust-analyzer"]);

  const specs = await detect(["rs/core/src/lib.rs"], fake, ROOT);

  expect(specs).toEqual([
    {
      name: "rust-analyzer",
      command: { program: "rust-analyzer", args: [] },
      project: "rs",
      folders: RUST_BIN,
      fileTypes: ["rs"],
      formats: true,
      settings: { "rust-analyzer": { checkOnSave: false } },
      initializationOptions: { checkOnSave: false },
      install: null,
      help: { kind: "rustup", component: "rust-analyzer", program: "rust-analyzer" },
      notes: [],
    },
  ]);
  expect(fake.programCalls).toEqual([["rust-analyzer", "rs", RUST_BIN]]);
});

test("rust-analyzer: found in ~/.cargo/bin counts; missing → rustup's component", async () => {
  const tree = { "Cargo.toml": "[package]\n" };

  const inHome = await detect(
    ["src/lib.rs"],
    lookups({ ...tree, ...home(".cargo/bin", "rust-analyzer") }),
    ROOT,
  );
  const missing = await detect(["src/lib.rs"], lookups(tree), ROOT);
  const noManifest = await detect(["src/lib.rs"], lookups({}, ["rust-analyzer"]), ROOT);

  expect(installOf(inHome)).toEqual([null]);
  expect(installOf(missing)).toEqual([
    { kind: "rustup", component: "rust-analyzer", program: "rust-analyzer" },
  ]);
  expect(noManifest).toEqual([]);
});

test("gopls: go.mod counts, found on PATH or in ~/go/bin, missing → go install", async () => {
  const tree = { "go/go.mod": "module calc\n" };

  const onPath = await detect(["go/calc/calc.go"], lookups(tree, ["gopls"]), ROOT);
  const inHome = await detect(
    ["go/calc/calc.go"],
    lookups({ ...tree, ...home("go/bin", "gopls") }),
    ROOT,
  );
  const missing = await detect(["go/calc/calc.go"], lookups(tree), ROOT);
  const noManifest = await detect(["go/calc/calc.go"], lookups({}, ["gopls"]), ROOT);

  expect(onPath).toEqual([
    {
      name: "gopls",
      command: { program: "gopls", args: [] },
      project: "go",
      folders: GO_BIN,
      fileTypes: ["go"],
      formats: true,
      settings: null,
      initializationOptions: null,
      install: null,
      help: { kind: "go", module: "golang.org/x/tools/gopls@latest", program: "gopls" },
      notes: [],
    },
  ]);
  expect(installOf(inHome)).toEqual([null]);
  expect(installOf(missing)).toEqual([
    { kind: "go", module: "golang.org/x/tools/gopls@latest", program: "gopls" },
  ]);
  expect(noManifest).toEqual([]);
});

test("ruff: a [tool.ruff] section counts wherever ruff is; formats; its spec", async () => {
  const tree = { "py/pyproject.toml": "[project]\n[tool.ruff.lint]\n" };

  const specs = await detect(["py/api/stats.py"], lookups(tree, ["ruff"]), ROOT);

  expect(specs).toEqual([
    {
      name: "ruff",
      command: { program: "ruff", args: ["server"] },
      project: "py",
      folders: PYTHON_BIN,
      fileTypes: PYTHON_TYPES,
      formats: true,
      settings: null,
      initializationOptions: null,
      install: null,
      help: { kind: "python", package: "ruff", program: "ruff", folder: "py", manager: null },
      notes: [],
    },
  ]);
});

test("ruff: ruff.toml or .ruff.toml with ruff in ~/.local/bin counts; missing → pip's hint", async () => {
  const config = { "requirements.txt": "", "ruff.toml": "" };
  const hidden = { "requirements.txt": "", ".ruff.toml": "" };

  const inHome = await detect(
    ["a.py"],
    lookups({ ...config, ...home(".local/bin", "ruff") }),
    ROOT,
  );
  const missing = await detect(["a.py"], lookups(hidden), ROOT);

  expect(summary(inHome)).toEqual(["ruff ruff server @"]);
  expect(installOf(inHome)).toEqual([null]);
  expect(installOf(missing)).toEqual([
    { kind: "python", package: "ruff", program: "ruff", folder: "", manager: null },
  ]);
});

test("ruff, ty, basedpyright: with no config, only the project's venv copy counts", async () => {
  const tree = { "py/pyproject.toml": "[project]\n" };
  const programs = ["ruff", "ty", "basedpyright-langserver"];

  const local = await detect(["py/a.py"], lookups({ ...tree, ...venv("py/", ...programs) }), ROOT);
  const onPath = await detect(
    ["py/a.py"],
    lookups(tree, [...programs, "pyright-langserver"]),
    ROOT,
  );

  expect(summary(local)).toEqual([
    "ruff ruff server @py",
    "ty ty server @py",
    "basedpyright basedpyright-langserver --stdio @py",
  ]);
  expect(local.map(({ formats }) => formats)).toEqual([true, false, false]);
  expect(onPath).toEqual([]);
});

test("ty, basedpyright, pyright: their config signs count, missing → their PyPI packages", async () => {
  const tree = {
    "pyproject.toml": "[tool.basedpyright]\n[tool.pyright]\n",
    "ty.toml": "",
  };

  const specs = await detect(["a.pyi"], lookups(tree), ROOT);

  expect(summary(specs)).toEqual([
    "ty ty server @",
    "basedpyright basedpyright-langserver --stdio @",
    "pyright pyright-langserver --stdio @",
  ]);
  expect(installOf(specs).map((hint) => hint?.kind === "python" && hint.package)).toEqual([
    "ty",
    "basedpyright",
    "pyright",
  ]);
});

test("pyright: pyrightconfig.json counts on PATH; a venv copy alone does not", async () => {
  const tree = { "setup.py": "" };

  const configured = await detect(
    ["a.py"],
    lookups({ ...tree, "pyrightconfig.json": "{}" }, ["pyright-langserver"]),
    ROOT,
  );
  const venvOnly = await detect(
    ["a.py"],
    lookups({ ...tree, ...venv("", "pyright-langserver") }),
    ROOT,
  );

  expect(summary(configured)).toEqual(["pyright pyright-langserver --stdio @"]);
  expect(configured[0]?.formats).toBe(false);
  expect(venvOnly).toEqual([]);
});

function pythonManagerFor(tree: Tree): Promise<unknown> {
  const project = { "py/pyproject.toml": "[tool.ruff]\n", ...tree };
  return detect(["py/a.py"], lookups(project), ROOT).then((specs) => {
    const install = specs[0]?.install;
    return install?.kind === "python" ? install.manager : undefined;
  });
}

test("python manager: each lock file, the nearest wins, none → null", async () => {
  expect(await pythonManagerFor({ "py/uv.lock": "" })).toBe("uv");
  expect(await pythonManagerFor({ "py/poetry.lock": "" })).toBe("poetry");
  expect(await pythonManagerFor({ "pdm.lock": { kind: "TooLarge" } })).toBe("pdm");
  expect(await pythonManagerFor({ "py/pdm.lock": "", "uv.lock": "" })).toBe("pdm");
  expect(await pythonManagerFor({ "py/uv.lock": { kind: "Folder" }, "poetry.lock": "" })).toBe(
    "poetry",
  );
  expect(await pythonManagerFor({ "py/pnpm-lock.yaml": "" })).toBeNull();
});

test("PHP: Phpactor first, else Intelephense, each with its own options and folders", async () => {
  const tree = { "php/composer.json": "{}" };

  const both = await detect(
    ["php/src/Stats.php"],
    lookups(tree, ["phpactor", "intelephense"]),
    ROOT,
  );
  const intelephense = await detect(["php/src/Stats.php"], lookups(tree, ["intelephense"]), ROOT);
  const phar = await detect(
    ["php/src/Stats.php"],
    lookups({ ...tree, ...home(".local/bin", "phpactor") }, ["intelephense"]),
    ROOT,
  );

  expect(both).toEqual([
    {
      name: "Phpactor",
      command: { program: "phpactor", args: ["language-server"] },
      project: "php",
      folders: PHP_BIN,
      fileTypes: ["php"],
      formats: false,
      settings: null,
      initializationOptions: { "language_server.enable_trust_check": false },
      install: null,
      help: PHPACTOR_HINT,
      notes: [],
    },
  ]);
  expect(intelephense).toEqual([
    {
      name: "Intelephense",
      command: { program: "intelephense", args: ["--stdio"] },
      project: "php",
      folders: PHP_BIN,
      fileTypes: ["php"],
      formats: false,
      settings: null,
      initializationOptions: null,
      install: null,
      help: null,
      notes: [],
    },
  ]);
  expect(summary(phar)).toEqual(["Phpactor phpactor language-server @php"]);
});

test("PHP: Phpactor in vendor/bin counts; neither server → Phpactor's download hint", async () => {
  const tree = { "composer.json": "{}" };

  const vendor = await detect(["a.php"], lookups({ ...tree, "vendor/bin/phpactor": "" }), ROOT);
  const neither = await detect(["a.php"], lookups(tree), ROOT);
  const noManifest = await detect(["a.php"], lookups({}, ["phpactor"]), ROOT);

  expect(installOf(vendor)).toEqual([null]);
  expect(summary(neither)).toEqual(["Phpactor phpactor language-server @"]);
  expect(installOf(neither)).toEqual([PHPACTOR_HINT]);
  expect(noManifest).toEqual([]);
});

test("clangd: formats only with a .clang-format or _clang-format up to the root", async () => {
  const tree = { "c/compile_commands.json": "[]" };
  const path = ["c/src/main.c"];

  const plain = await detect(path, lookups(tree, ["clangd"]), ROOT);
  const styled = await detect(path, lookups({ ...tree, "c/.clang-format": "" }, ["clangd"]), ROOT);
  const above = await detect(path, lookups({ ...tree, "_clang-format": "" }, ["clangd"]), ROOT);

  expect(plain).toEqual([
    {
      name: "clangd",
      command: { program: "clangd", args: [] },
      project: "c",
      folders: CLANG_BIN,
      fileTypes: ["c", "h", "cc", "cpp", "cxx", "hh", "hpp", "hxx"],
      formats: false,
      settings: null,
      initializationOptions: null,
      install: null,
      help: { kind: "system", program: "clangd" },
      notes: [],
    },
  ]);
  expect(styled[0]?.formats).toBe(true);
  expect(above[0]?.formats).toBe(true);
});

test("clangd: build/compile_commands.json makes the folder holding build/ the project; missing → the system's package manager", async () => {
  const tree = { "c/build/compile_commands.json": "[]" };

  const specs = await detect(["c/src/main.cpp"], lookups(tree), ROOT);
  const noManifest = await detect(["c/src/main.cpp"], lookups({}, ["clangd"]), ROOT);

  expect(summary(specs)).toEqual(["clangd clangd @c"]);
  expect(installOf(specs)).toEqual([{ kind: "system", program: "clangd" }]);
  expect(noManifest).toEqual([]);
});

test("Biome: the project's copy counts and formats; a copy on PATH does not", async () => {
  const tree = { "biome/package.json": "{}" };

  const local = await detect(
    ["biome/src/index.js"],
    lookups({ ...tree, ...bins("biome/", "biome") }),
    ROOT,
  );
  const onPath = await detect(["biome/src/index.js"], lookups(tree, ["biome"]), ROOT);

  expect(local).toEqual([
    {
      name: "Biome",
      command: { program: "biome", args: ["lsp-proxy"] },
      project: "biome",
      folders: NODE_BIN,
      fileTypes: [
        "js",
        "jsx",
        "mjs",
        "cjs",
        "ts",
        "tsx",
        "mts",
        "cts",
        "json",
        "jsonc",
        "css",
        "graphql",
      ],
      formats: true,
      settings: null,
      initializationOptions: null,
      install: null,
      help: null,
      notes: [],
    },
  ]);
  expect(onPath).toEqual([]);
});

const SCRIPT_TYPES = ["js", "jsx", "mjs", "cjs", "ts", "tsx", "mts", "cts"];
const VUE_PACKAGE = { "web/node_modules/vue/package.json": '{"version":"3.5.0"}' };
const VUE_PLUGIN = { "node_modules/@vue/typescript-plugin/package.json": "{}" };
const TS_SERVER_HINT: InstallHint = {
  kind: "node",
  package: "typescript-language-server",
  program: "typescript-language-server",
  folder: "web",
  manager: "pnpm",
  reason: { kind: "typescript", version: "5.9.3" },
};

function vueProject(version: string): Tree {
  return { "web/package.json": "{}", "web/pnpm-lock.yaml": "", ...typescriptAt("web/", version) };
}

test("Vue with the plugin up the chain: the TypeScript server also serves vue and loads the plugin from the project folder", async () => {
  const tree = { ...vueProject("5.9.3"), ...VUE_PACKAGE, ...VUE_PLUGIN };

  const specs = await detect(
    ["web/src/App.vue"],
    lookups(tree, ["typescript-language-server"]),
    ROOT,
  );

  expect(specs).toEqual([
    {
      name: "TypeScript",
      command: { program: "typescript-language-server", args: ["--stdio"] },
      project: "web",
      folders: NODE_BIN,
      fileTypes: [...SCRIPT_TYPES, "vue"],
      formats: false,
      settings: null,
      initializationOptions: {
        plugins: [{ name: "@vue/typescript-plugin", location: "/repo/web", languages: ["vue"] }],
      },
      install: null,
      help: TS_SERVER_HINT,
      notes: [],
    },
  ]);
});

test("Vue: the plugin's location is the project folder in the root's own separators", async () => {
  const tree = { ...vueProject("6.0.0"), ...VUE_PACKAGE, ...VUE_PLUGIN };

  const windows = await detect(
    ["web/src/App.vue"],
    lookups(tree, ["typescript-language-server"]),
    "C:\\repo",
  );
  const atRoot = await detect(
    ["src/App.vue"],
    lookups(
      {
        "package.json": "{}",
        ...typescriptAt("", "6.0.0"),
        "node_modules/vue/package.json": "{}",
        ...VUE_PLUGIN,
      },
      ["typescript-language-server"],
    ),
    ROOT,
  );

  expect(windows[0]?.initializationOptions).toEqual({
    plugins: [{ name: "@vue/typescript-plugin", location: "C:\\repo\\web", languages: ["vue"] }],
  });
  expect(atRoot[0]?.initializationOptions).toEqual({
    plugins: [{ name: "@vue/typescript-plugin", location: "/repo", languages: ["vue"] }],
  });
});

test("Vue without the plugin: TypeScript unchanged, plus a never-started Vue spec with the plugin's hint", async () => {
  const tree = { ...vueProject("5.9.3"), ...VUE_PACKAGE };

  const specs = await detect(
    ["web/src/App.vue"],
    lookups(tree, ["typescript-language-server"]),
    ROOT,
  );

  expect(specs).toEqual([
    expect.objectContaining({
      name: "TypeScript",
      fileTypes: SCRIPT_TYPES,
      initializationOptions: null,
      install: null,
      notes: [],
    }),
    {
      name: "Vue",
      command: { program: "typescript-language-server", args: ["--stdio"] },
      project: "web",
      folders: NODE_BIN,
      fileTypes: ["vue"],
      formats: false,
      settings: null,
      initializationOptions: null,
      install: {
        kind: "node",
        package: "@vue/typescript-plugin",
        program: "@vue/typescript-plugin",
        folder: "web",
        manager: "pnpm",
        reason: { kind: "vue" },
      },
      help: null,
      notes: [],
    },
  ]);
});

test("Vue in a TypeScript 7 or native-preview project: the TypeScript spec carries the note with the program that runs and the project's version", async () => {
  const seven = { ...vueProject("7.0.0"), ...VUE_PACKAGE, ...VUE_PLUGIN };
  const preview = { ...vueProject("5.9.3"), ...VUE_PACKAGE, ...bins("web/", "tsgo") };

  const tsc = await detect(["web/src/App.vue"], lookups(seven), ROOT);
  const tsgo = await detect(["web/src/App.vue"], lookups(preview), ROOT);

  expect(tsc).toEqual([
    expect.objectContaining({
      command: { program: "tsc", args: ["--lsp", "--stdio"] },
      fileTypes: SCRIPT_TYPES,
      initializationOptions: null,
      notes: [{ kind: "vueNeedsTypeScript6", program: "tsc", version: "7.0.0" }],
    }),
  ]);
  expect(tsgo).toEqual([
    expect.objectContaining({
      command: { program: "tsgo", args: ["--lsp", "--stdio"] },
      notes: [{ kind: "vueNeedsTypeScript6", program: "tsgo", version: "5.9.3" }],
    }),
  ]);
});

test("Vue: without the vue package nothing changes, plugin or not", async () => {
  const plain = vueProject("5.9.3");
  const pluginOnly = { ...plain, ...VUE_PLUGIN };
  const seven = { ...vueProject("7.0.0"), ...VUE_PLUGIN };
  const server = ["typescript-language-server"];

  for (const tree of [plain, pluginOnly]) {
    expect(await detect(["web/a.ts"], lookups(tree, server), ROOT)).toEqual([
      expect.objectContaining({ fileTypes: SCRIPT_TYPES, initializationOptions: null, notes: [] }),
    ]);
  }
  expect((await detect(["web/a.ts"], lookups(seven), ROOT))[0]?.notes).toEqual([]);
});

test("Vue: oxlint and eslint in a project with vue and no TypeScript config are their no-vue specs, with no Vue spec or note", async () => {
  const plain = { "web/package.json": "{}", ...bins("web/", "oxlint"), ...eslintAt("web/") };
  const server = ["vscode-eslint-language-server"];

  const withVue = await detect(["web/a.ts"], lookups({ ...plain, ...VUE_PACKAGE }, server), ROOT);
  const without = await detect(["web/a.ts"], lookups(plain, server), ROOT);

  expect(summary(withVue)).toEqual([
    "oxlint oxlint --lsp @web",
    "eslint vscode-eslint-language-server --stdio @web",
  ]);
  expect(withVue).toEqual(without);
  expect(withVue.flatMap(({ notes }) => notes)).toEqual([]);
});

test("help: a found server carries the hint it would have had missing; a missing one only its install", async () => {
  const tree = vueProject("5.9.3");

  const [found] = await detect(["web/a.ts"], lookups(tree, ["typescript-language-server"]), ROOT);
  const [missing] = await detect(["web/a.ts"], lookups(tree), ROOT);
  const [orElse] = await detect(
    ["a.php"],
    lookups({ "composer.json": "{}" }, ["intelephense"]),
    ROOT,
  );
  const [projectProgram] = await detect(
    ["web/a.ts"],
    lookups({ ...tree, ...bins("web/", "oxlint") }),
    ROOT,
  );

  expect([found?.install, found?.help]).toEqual([null, TS_SERVER_HINT]);
  expect([missing?.install, missing?.help]).toEqual([TS_SERVER_HINT, null]);
  expect(orElse?.help).toBeNull();
  expect(projectProgram?.help).toBeNull();
});

const PHP_PROJECT = { "php/composer.json": "{}" };

async function phpactorIn(tree: Tree, servers = ["phpactor"]): Promise<ServerSpec | undefined> {
  return (
    await detect(["php/src/Stats.php"], lookups({ ...PHP_PROJECT, ...tree }, servers), ROOT)
  )[0];
}

test.each<[string, string, string[], boolean]>([
  [
    "language_server_phpstan.enabled",
    "vendor/bin/phpstan",
    ["phpstan.neon", "phpstan.neon.dist", "phpstan.dist.neon"],
    false,
  ],
  ["language_server_psalm.enabled", "vendor/bin/psalm", ["psalm.xml", "psalm.xml.dist"], false],
  [
    "language_server_php_cs_fixer.enabled",
    "vendor/bin/php-cs-fixer",
    [".php-cs-fixer.php", ".php-cs-fixer.dist.php"],
    true,
  ],
  [
    "php_code_sniffer.enabled",
    "vendor/bin/phpcs",
    [".phpcs.xml", "phpcs.xml", ".phpcs.xml.dist", "phpcs.xml.dist"],
    true,
  ],
])(
  "Phpactor: %s is on only with %s and one of %j in the project; formats: %s",
  async (key, bin, configs, formats) => {
    for (const config of configs) {
      const spec = await phpactorIn({ [`php/${bin}`]: "", [`php/${config}`]: "" });
      expect(spec?.initializationOptions).toEqual({
        "language_server.enable_trust_check": false,
        [key]: true,
      });
      expect(spec?.formats).toBe(formats);
    }
    const programOnly = await phpactorIn({ [`php/${bin}`]: "" });
    const configOnly = await phpactorIn({ [`php/${configs[0] ?? ""}`]: "" });
    const programAbove = await phpactorIn({ [bin]: "", [`php/${configs[0] ?? ""}`]: "" });
    const configAbove = await phpactorIn({ [`php/${bin}`]: "", [configs[0] ?? ""]: "" });
    for (const off of [programOnly, configOnly, programAbove, configAbove]) {
      expect([off?.initializationOptions, off?.formats]).toEqual([
        { "language_server.enable_trust_check": false },
        false,
      ]);
    }
  },
);

test("Phpactor: every integration at once; Intelephense never gets them", async () => {
  const all = {
    "php/vendor/bin/phpstan": "",
    "php/phpstan.neon": "",
    "php/vendor/bin/psalm": "",
    "php/psalm.xml": "",
    "php/vendor/bin/phpcs": "",
    "php/phpcs.xml.dist": "",
  };

  const phpactor = await phpactorIn(all);
  const intelephense = await phpactorIn(all, ["intelephense"]);

  expect(phpactor?.initializationOptions).toEqual({
    "language_server.enable_trust_check": false,
    "language_server_phpstan.enabled": true,
    "language_server_psalm.enabled": true,
    "php_code_sniffer.enabled": true,
  });
  expect(phpactor?.formats).toBe(true);
  expect([intelephense?.name, intelephense?.initializationOptions, intelephense?.formats]).toEqual([
    "Intelephense",
    null,
    false,
  ]);
});

test("pyright: the project venv's Python becomes pythonPath, from .venv or venv; none without one", async () => {
  const tree = { "py/pyproject.toml": "[tool.pyright]\n" };
  const server = ["pyright-langserver"];

  const [dotVenv] = await detect(
    ["py/a.py"],
    lookups({ ...tree, "py/.venv/bin/python": "" }, server),
    ROOT,
  );
  const [venv] = await detect(
    ["py/a.py"],
    lookups({ ...tree, "py/venv/Scripts/python": "" }, server),
    ROOT,
  );
  const [onPath] = await detect(["py/a.py"], lookups(tree, [...server, "python"]), ROOT);
  const [ruff] = await detect(
    ["py/a.py"],
    lookups({ "py/pyproject.toml": "[tool.ruff]\n", "py/.venv/bin/python": "" }, ["ruff"]),
    ROOT,
  );

  expect(dotVenv?.settings).toEqual({ python: { pythonPath: "/repo/py/.venv/bin/python" } });
  expect(venv?.settings).toEqual({ python: { pythonPath: "/repo/py/venv/Scripts/python" } });
  expect(onPath?.settings).toBeNull();
  expect(ruff?.settings).toBeNull();
});

test("reads: a node-only project reads its configs, packages and lock files, nothing of other ecosystems", async () => {
  const fake = lookups({ "web/package.json": "{}" });

  await detect(["web/a.ts"], fake, ROOT);

  const up = [
    "node_modules/typescript/package.json",
    "node_modules/vue/package.json",
    "node_modules/@vue/typescript-plugin/package.json",
    "node_modules/eslint/package.json",
    "pnpm-lock.yaml",
    "yarn.lock",
    "bun.lock",
    "bun.lockb",
    "package-lock.json",
  ];
  expect(fake.fileCalls[1]).toEqual([
    ...[
      "tsconfig.json",
      "jsconfig.json",
      ...["js", "mjs", "cjs", "ts", "mts", "cts"].map((ext) => `eslint.config.${ext}`),
      ...["", ".js", ".cjs", ".json", ".yaml", ".yml"].map((ext) => `.eslintrc${ext}`),
      "package.json",
    ].map((name) => `web/${name}`),
    ...up.map((name) => `web/${name}`),
    ...up,
  ]);
});

test("reads: a python-only project reads its tools' configs and the lock files, nothing of other ecosystems", async () => {
  const fake = lookups({ "py/pyproject.toml": "[tool.ruff]\n" }, ["ruff"]);

  await detect(["py/a.py"], fake, ROOT);

  const locks = ["uv.lock", "poetry.lock", "pdm.lock"];
  expect(fake.fileCalls[1]).toEqual([
    ...["ruff.toml", ".ruff.toml", "pyproject.toml", "ty.toml", "pyrightconfig.json"].map(
      (name) => `py/${name}`,
    ),
    ...locks.map((name) => `py/${name}`),
    ...locks,
  ]);
});

test("reads: a rust-only project reads nothing beyond its manifests; a php project reads its tools", async () => {
  const rust = lookups({ "Cargo.toml": "" }, ["rust-analyzer"]);
  const php = lookups({ "composer.json": "" }, ["phpactor"]);

  await detect(["src/lib.rs"], rust, ROOT);
  await detect(["a.php"], php, ROOT);

  expect(rust.fileCalls).toEqual([["src/Cargo.toml", "Cargo.toml"], []]);
  expect(php.fileCalls[1]).toEqual([
    "vendor/bin/phpstan",
    "phpstan.neon",
    "phpstan.neon.dist",
    "phpstan.dist.neon",
    "vendor/bin/psalm",
    "psalm.xml",
    "psalm.xml.dist",
    "vendor/bin/php-cs-fixer",
    ".php-cs-fixer.php",
    ".php-cs-fixer.dist.php",
    "vendor/bin/phpcs",
    ".phpcs.xml",
    "phpcs.xml",
    ".phpcs.xml.dist",
    "phpcs.xml.dist",
  ]);
});
