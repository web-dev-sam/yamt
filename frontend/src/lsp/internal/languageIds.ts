import { extensionOf } from "./spec";

const LANGUAGE_IDS: Readonly<Record<string, string>> = {
  js: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  jsx: "javascriptreact",
  ts: "typescript",
  mts: "typescript",
  cts: "typescript",
  tsx: "typescriptreact",
  json: "json",
  jsonc: "jsonc",
  json5: "json5",
  css: "css",
  scss: "scss",
  less: "less",
  html: "html",
  vue: "vue",
  md: "markdown",
  yaml: "yaml",
  yml: "yaml",
  toml: "toml",
  graphql: "graphql",
  py: "python",
  pyi: "python",
  rs: "rust",
  go: "go",
  php: "php",
  c: "c",
  h: "c",
  cc: "cpp",
  cpp: "cpp",
  cxx: "cpp",
  hh: "cpp",
  hpp: "cpp",
  hxx: "cpp",
  sh: "shellscript",
  bash: "shellscript",
};

export function languageId(path: string): string {
  const extension = extensionOf(path);
  const id = Object.hasOwn(LANGUAGE_IDS, extension) ? LANGUAGE_IDS[extension] : undefined;
  return id ?? extension;
}
