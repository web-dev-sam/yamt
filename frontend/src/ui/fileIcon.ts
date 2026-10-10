import type { Component } from "vue";
import DefaultFile from "~icons/vscode-icons/default-file";
import Bundler from "~icons/vscode-icons/file-type-bundler";
import C from "~icons/vscode-icons/file-type-c";
import Cargo from "~icons/vscode-icons/file-type-cargo";
import CHeader from "~icons/vscode-icons/file-type-cheader";
import CMake from "~icons/vscode-icons/file-type-cmake";
import Composer from "~icons/vscode-icons/file-type-composer";
import Cpp from "~icons/vscode-icons/file-type-cpp";
import CppHeader from "~icons/vscode-icons/file-type-cppheader";
import CSharp from "~icons/vscode-icons/file-type-csharp";
import Css from "~icons/vscode-icons/file-type-css";
import Diff from "~icons/vscode-icons/file-type-diff";
import Docker from "~icons/vscode-icons/file-type-docker";
import Dotenv from "~icons/vscode-icons/file-type-dotenv";
import EditorConfig from "~icons/vscode-icons/file-type-editorconfig";
import Git from "~icons/vscode-icons/file-type-git";
import Go from "~icons/vscode-icons/file-type-go";
import Gradle from "~icons/vscode-icons/file-type-gradle";
import Groovy from "~icons/vscode-icons/file-type-groovy";
import Html from "~icons/vscode-icons/file-type-html";
import Image from "~icons/vscode-icons/file-type-image";
import Ini from "~icons/vscode-icons/file-type-ini";
import Java from "~icons/vscode-icons/file-type-java";
import Js from "~icons/vscode-icons/file-type-js";
import Json from "~icons/vscode-icons/file-type-json";
import Kotlin from "~icons/vscode-icons/file-type-kotlin";
import Less from "~icons/vscode-icons/file-type-less";
import License from "~icons/vscode-icons/file-type-license";
import Lua from "~icons/vscode-icons/file-type-lua";
import Makefile from "~icons/vscode-icons/file-type-makefile";
import Markdown from "~icons/vscode-icons/file-type-markdown";
import Npm from "~icons/vscode-icons/file-type-npm";
import Perl from "~icons/vscode-icons/file-type-perl";
import Php from "~icons/vscode-icons/file-type-php";
import Pnpm from "~icons/vscode-icons/file-type-pnpm";
import PowerShell from "~icons/vscode-icons/file-type-powershell";
import Protobuf from "~icons/vscode-icons/file-type-protobuf";
import Python from "~icons/vscode-icons/file-type-python";
import ReactJs from "~icons/vscode-icons/file-type-reactjs";
import ReactTs from "~icons/vscode-icons/file-type-reactts";
import Ruby from "~icons/vscode-icons/file-type-ruby";
import Rust from "~icons/vscode-icons/file-type-rust";
import Sass from "~icons/vscode-icons/file-type-sass";
import Scala from "~icons/vscode-icons/file-type-scala";
import Scss from "~icons/vscode-icons/file-type-scss";
import Shell from "~icons/vscode-icons/file-type-shell";
import Sql from "~icons/vscode-icons/file-type-sql";
import Svg from "~icons/vscode-icons/file-type-svg";
import Swift from "~icons/vscode-icons/file-type-swift";
import Text from "~icons/vscode-icons/file-type-text";
import Toml from "~icons/vscode-icons/file-type-toml";
import TsConfig from "~icons/vscode-icons/file-type-tsconfig";
import TypeScript from "~icons/vscode-icons/file-type-typescript";
import TypeScriptDef from "~icons/vscode-icons/file-type-typescriptdef";
import Vue from "~icons/vscode-icons/file-type-vue";
import Xml from "~icons/vscode-icons/file-type-xml";
import Yaml from "~icons/vscode-icons/file-type-yaml";
import Yarn from "~icons/vscode-icons/file-type-yarn";

type IconTable = Readonly<Record<string, Component>>;

const ICONS: Readonly<{ byName: IconTable; byExtension: IconTable; fallback: Component }> = {
  byName: {
    ".editorconfig": EditorConfig,
    ".env": Dotenv,
    ".gitattributes": Git,
    ".gitignore": Git,
    ".gitmodules": Git,
    "cargo.lock": Cargo,
    "cargo.toml": Cargo,
    "cmakelists.txt": CMake,
    "composer.json": Composer,
    "composer.lock": Composer,
    dockerfile: Docker,
    gemfile: Bundler,
    "gemfile.lock": Bundler,
    license: License,
    makefile: Makefile,
    "package-lock.json": Npm,
    "package.json": Npm,
    "pnpm-lock.yaml": Pnpm,
    "pnpm-workspace.yaml": Pnpm,
    "tsconfig.json": TsConfig,
    "yarn.lock": Yarn,
  },
  byExtension: {
    bash: Shell,
    bmp: Image,
    c: C,
    cc: Cpp,
    cjs: Js,
    cpp: Cpp,
    cs: CSharp,
    css: Css,
    cts: TypeScript,
    cxx: Cpp,
    "d.cts": TypeScriptDef,
    "d.mts": TypeScriptDef,
    "d.ts": TypeScriptDef,
    diff: Diff,
    gif: Image,
    go: Go,
    gradle: Gradle,
    groovy: Groovy,
    h: CHeader,
    hpp: CppHeader,
    htm: Html,
    html: Html,
    ico: Image,
    ini: Ini,
    java: Java,
    jpeg: Image,
    jpg: Image,
    js: Js,
    json: Json,
    jsx: ReactJs,
    kt: Kotlin,
    kts: Kotlin,
    less: Less,
    lua: Lua,
    markdown: Markdown,
    md: Markdown,
    mjs: Js,
    mts: TypeScript,
    patch: Diff,
    php: Php,
    pl: Perl,
    png: Image,
    proto: Protobuf,
    ps1: PowerShell,
    py: Python,
    rb: Ruby,
    rs: Rust,
    sass: Sass,
    scala: Scala,
    scss: Scss,
    sh: Shell,
    sql: Sql,
    svg: Svg,
    swift: Swift,
    toml: Toml,
    ts: TypeScript,
    tsx: ReactTs,
    txt: Text,
    vue: Vue,
    webp: Image,
    xml: Xml,
    yaml: Yaml,
    yml: Yaml,
  },
  fallback: DefaultFile,
};

export function fileIcon(path: string): Component {
  const name = path.slice(path.lastIndexOf("/") + 1).toLowerCase();
  const byName = Object.hasOwn(ICONS.byName, name) ? ICONS.byName[name] : undefined;
  if (byName !== undefined) {
    return byName;
  }
  for (let dot = name.indexOf(".", 1); dot !== -1; dot = name.indexOf(".", dot + 1)) {
    const extension = name.slice(dot + 1);
    const byExtension = Object.hasOwn(ICONS.byExtension, extension)
      ? ICONS.byExtension[extension]
      : undefined;
    if (byExtension !== undefined) {
      return byExtension;
    }
  }
  return ICONS.fallback;
}
