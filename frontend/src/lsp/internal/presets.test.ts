import { expect, test } from "vitest";

import { PRESETS } from "./presets";

function preset(name: string): (typeof PRESETS)[number] {
  const found = PRESETS.find((candidate) => candidate.name === name);
  if (found === undefined) {
    throw new Error(`no preset ${name}`);
  }
  return found;
}

test("presets run formatter first: oxfmt, oxlint, TypeScript, eslint", () => {
  expect(PRESETS.map(({ name }) => name)).toEqual(["oxfmt", "oxlint", "TypeScript", "eslint"]);
  expect(PRESETS.map(({ formats }) => formats)).toEqual([true, false, false, false]);
});

test("each preset serves its file types", () => {
  const scripts = ["js", "jsx", "mjs", "cjs", "ts", "tsx", "mts", "cts"];
  expect(preset("oxfmt").fileTypes).toEqual([
    ...scripts,
    ..."json jsonc json5 css scss less html vue md yaml yml toml graphql".split(" "),
  ]);
  expect(preset("oxlint").fileTypes).toEqual([...scripts, "vue"]);
  expect(preset("TypeScript").fileTypes).toEqual(scripts);
  expect(preset("eslint").fileTypes).toEqual([...scripts, "vue"]);
});

test("oxlint runs on type in its project's workspace; eslint validates on type", () => {
  expect(preset("oxlint").initializationOptions?.("file:///repo/frontend")).toEqual([
    { workspaceUri: "file:///repo/frontend", options: { run: "onType" } },
  ]);
  expect(preset("eslint").settings).toEqual({ validate: "on", run: "onType" });
  expect(PRESETS.filter((p) => p.initializationOptions !== null).map(({ name }) => name)).toEqual([
    "oxlint",
  ]);
  expect(PRESETS.filter((p) => p.settings !== null).map(({ name }) => name)).toEqual(["eslint"]);
});

test("eslint's configs are the flat config and the legacy .eslintrc forms", () => {
  const { look } = preset("eslint");
  expect(look.kind === "eslint" && look.configs).toEqual([
    "eslint.config.js",
    "eslint.config.mjs",
    "eslint.config.cjs",
    "eslint.config.ts",
    "eslint.config.mts",
    "eslint.config.cts",
    ".eslintrc",
    ".eslintrc.js",
    ".eslintrc.cjs",
    ".eslintrc.json",
    ".eslintrc.yaml",
    ".eslintrc.yml",
  ]);
});
