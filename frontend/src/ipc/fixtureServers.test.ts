import { expect, test } from "vitest";

import { createFixtureServerHost, ONLY_IN_THE_APP } from "./fixtureServers";
import { REPOSITORY } from "./fixtureSettings";

const NODE = { project: ["node_modules/.bin"], home: [] };

test("the context is fixture mode's repository", async () => {
  expect((await createFixtureServerHost().context()).root).toBe(REPOSITORY);
});

test("findProgram walks .bin from the project up to the root", async () => {
  const host = createFixtureServerHost();
  expect(await host.findProgram("oxlint", "", NODE)).toEqual({
    kind: "Found",
    path: `${REPOSITORY}/node_modules/.bin/oxlint`,
    place: "Project",
  });
  expect(await host.findProgram("typescript-language-server", "web/app", NODE)).toEqual({
    kind: "Found",
    path: `${REPOSITORY}/node_modules/.bin/typescript-language-server`,
    place: "Project",
  });
});

test("a program in no .bin is not found, and the answer names every folder tried", async () => {
  const host = createFixtureServerHost();
  expect(await host.findProgram("tsgo", "web", NODE)).toEqual({
    kind: "NotFound",
    searched: [`${REPOSITORY}/web/node_modules/.bin`, `${REPOSITORY}/node_modules/.bin`],
  });
  expect(await host.findProgram("oxlint", "", { project: [], home: [] })).toEqual({
    kind: "NotFound",
    searched: [],
  });
});

test("projectFiles answers each path: a file's text, a folder, or missing", async () => {
  const answers = await createFixtureServerHost().projectFiles([
    "node_modules/typescript/package.json",
    "node_modules",
    "node_modules/.bin",
    "",
    "tsconfig.json",
    "eslint.config.js",
    "node_modules/vue/package.json",
    "node_modules/@vue/typescript-plugin/package.json",
    "node_modules/typ",
    "jsconfig.json",
  ]);
  const [typescript, ...rest] = answers;
  expect(typescript?.kind === "Text" && JSON.parse(typescript.text)).toEqual({
    name: "typescript",
    version: "5.9.3",
  });
  expect(rest.map((answer) => answer.kind)).toEqual([
    "Folder",
    "Folder",
    "Folder",
    "Text",
    "Text",
    "Text",
    "Missing",
    "Missing",
    "Missing",
  ]);
});

test("the package.json lists eslint, so the eslint rule finds its package", async () => {
  const [manifest, eslint] = await createFixtureServerHost().projectFiles([
    "package.json",
    "node_modules/eslint/package.json",
  ]);
  expect(manifest?.kind === "Text" && JSON.parse(manifest.text).devDependencies).toHaveProperty(
    "eslint",
  );
  expect(eslint?.kind).toBe("Text");
});

test("a start answers SpawnFailed: language servers run only in the app", async () => {
  const command = { program: "oxlint", args: ["--lsp"], project: "", folders: NODE };
  expect(await createFixtureServerHost().start(command, () => undefined)).toEqual({
    kind: "SpawnFailed",
    program: "oxlint",
    message: ONLY_IN_THE_APP,
  });
  expect(ONLY_IN_THE_APP).toBe("language servers run only in the app");
});
