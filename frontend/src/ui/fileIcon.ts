import type { Component } from "vue";
import DefaultFile from "~icons/vscode-icons/default-file";
import Apl from "~icons/vscode-icons/file-type-apl";
import Arduino from "~icons/vscode-icons/file-type-arduino";
import Assembly from "~icons/vscode-icons/file-type-assembly";
import Bazel from "~icons/vscode-icons/file-type-bazel";
import BuckBuild from "~icons/vscode-icons/file-type-buckbuild";
import Bundler from "~icons/vscode-icons/file-type-bundler";
import C from "~icons/vscode-icons/file-type-c";
import Cargo from "~icons/vscode-icons/file-type-cargo";
import CHeader from "~icons/vscode-icons/file-type-cheader";
import Clojure from "~icons/vscode-icons/file-type-clojure";
import ClojureScript from "~icons/vscode-icons/file-type-clojurescript";
import CMake from "~icons/vscode-icons/file-type-cmake";
import Cobol from "~icons/vscode-icons/file-type-cobol";
import CoffeeScript from "~icons/vscode-icons/file-type-coffeescript";
import Composer from "~icons/vscode-icons/file-type-composer";
import Config from "~icons/vscode-icons/file-type-config";
import Cpp from "~icons/vscode-icons/file-type-cpp";
import CppHeader from "~icons/vscode-icons/file-type-cppheader";
import Crystal from "~icons/vscode-icons/file-type-crystal";
import CSharp from "~icons/vscode-icons/file-type-csharp";
import Css from "~icons/vscode-icons/file-type-css";
import Cucumber from "~icons/vscode-icons/file-type-cucumber";
import Cython from "~icons/vscode-icons/file-type-cython";
import DartLang from "~icons/vscode-icons/file-type-dartlang";
import Delphi from "~icons/vscode-icons/file-type-delphi";
import Diff from "~icons/vscode-icons/file-type-diff";
import DLang from "~icons/vscode-icons/file-type-dlang";
import Docker from "~icons/vscode-icons/file-type-docker";
import Dotenv from "~icons/vscode-icons/file-type-dotenv";
import Dtd from "~icons/vscode-icons/file-type-dtd";
import Dylan from "~icons/vscode-icons/file-type-dylan";
import EditorConfig from "~icons/vscode-icons/file-type-editorconfig";
import Elm from "~icons/vscode-icons/file-type-elm";
import Emacs from "~icons/vscode-icons/file-type-emacs";
import Erlang from "~icons/vscode-icons/file-type-erlang";
import Fortran from "~icons/vscode-icons/file-type-fortran";
import FSharp from "~icons/vscode-icons/file-type-fsharp";
import Git from "~icons/vscode-icons/file-type-git";
import Go from "~icons/vscode-icons/file-type-go";
import Gpg from "~icons/vscode-icons/file-type-gpg";
import Gradle from "~icons/vscode-icons/file-type-gradle";
import Groovy from "~icons/vscode-icons/file-type-groovy";
import Handlebars from "~icons/vscode-icons/file-type-handlebars";
import Haskell from "~icons/vscode-icons/file-type-haskell";
import Haxe from "~icons/vscode-icons/file-type-haxe";
import Html from "~icons/vscode-icons/file-type-html";
import Image from "~icons/vscode-icons/file-type-image";
import Ini from "~icons/vscode-icons/file-type-ini";
import Java from "~icons/vscode-icons/file-type-java";
import Jenkins from "~icons/vscode-icons/file-type-jenkins";
import Jinja from "~icons/vscode-icons/file-type-jinja";
import Js from "~icons/vscode-icons/file-type-js";
import Json from "~icons/vscode-icons/file-type-json";
import JsonLd from "~icons/vscode-icons/file-type-jsonld";
import Julia from "~icons/vscode-icons/file-type-julia";
import Kotlin from "~icons/vscode-icons/file-type-kotlin";
import Less from "~icons/vscode-icons/file-type-less";
import License from "~icons/vscode-icons/file-type-license";
import Liquid from "~icons/vscode-icons/file-type-liquid";
import Lisp from "~icons/vscode-icons/file-type-lisp";
import LiveScript from "~icons/vscode-icons/file-type-livescript";
import Lua from "~icons/vscode-icons/file-type-lua";
import Makefile from "~icons/vscode-icons/file-type-makefile";
import SourceMap from "~icons/vscode-icons/file-type-map";
import Markdown from "~icons/vscode-icons/file-type-markdown";
import Meson from "~icons/vscode-icons/file-type-meson";
import Neo4j from "~icons/vscode-icons/file-type-neo4j";
import Nginx from "~icons/vscode-icons/file-type-nginx";
import Npm from "~icons/vscode-icons/file-type-npm";
import Nsis from "~icons/vscode-icons/file-type-nsi";
import ObjectiveC from "~icons/vscode-icons/file-type-objectivec";
import ObjectiveCpp from "~icons/vscode-icons/file-type-objectivecpp";
import OCaml from "~icons/vscode-icons/file-type-ocaml";
import OCamlInterface from "~icons/vscode-icons/file-type-ocaml-intf";
import Perl from "~icons/vscode-icons/file-type-perl";
import Php from "~icons/vscode-icons/file-type-php";
import PlSql from "~icons/vscode-icons/file-type-plsql";
import Pnpm from "~icons/vscode-icons/file-type-pnpm";
import PowerShell from "~icons/vscode-icons/file-type-powershell";
import PowerShellData from "~icons/vscode-icons/file-type-powershell-psd";
import PowerShellModule from "~icons/vscode-icons/file-type-powershell-psm";
import Protobuf from "~icons/vscode-icons/file-type-protobuf";
import Pug from "~icons/vscode-icons/file-type-pug";
import Puppet from "~icons/vscode-icons/file-type-puppet";
import Python from "~icons/vscode-icons/file-type-python";
import Q from "~icons/vscode-icons/file-type-q";
import R from "~icons/vscode-icons/file-type-r";
import Rake from "~icons/vscode-icons/file-type-rake";
import ReactJs from "~icons/vscode-icons/file-type-reactjs";
import ReactTs from "~icons/vscode-icons/file-type-reactts";
import Ruby from "~icons/vscode-icons/file-type-ruby";
import Rust from "~icons/vscode-icons/file-type-rust";
import Sas from "~icons/vscode-icons/file-type-sas";
import Sass from "~icons/vscode-icons/file-type-sass";
import Scala from "~icons/vscode-icons/file-type-scala";
import Scss from "~icons/vscode-icons/file-type-scss";
import Shell from "~icons/vscode-icons/file-type-shell";
import Sparql from "~icons/vscode-icons/file-type-sparql";
import Sql from "~icons/vscode-icons/file-type-sql";
import Squirrel from "~icons/vscode-icons/file-type-squirrel";
import Stylus from "~icons/vscode-icons/file-type-stylus";
import Svg from "~icons/vscode-icons/file-type-svg";
import Swift from "~icons/vscode-icons/file-type-swift";
import SystemVerilog from "~icons/vscode-icons/file-type-systemverilog";
import Tcl from "~icons/vscode-icons/file-type-tcl";
import Tex from "~icons/vscode-icons/file-type-tex";
import Text from "~icons/vscode-icons/file-type-text";
import Textile from "~icons/vscode-icons/file-type-textile";
import Toml from "~icons/vscode-icons/file-type-toml";
import TsConfig from "~icons/vscode-icons/file-type-tsconfig";
import Ttcn from "~icons/vscode-icons/file-type-ttcn";
import TypeScript from "~icons/vscode-icons/file-type-typescript";
import TypeScriptDef from "~icons/vscode-icons/file-type-typescriptdef";
import VisualBasic from "~icons/vscode-icons/file-type-vb";
import Velocity from "~icons/vscode-icons/file-type-velocity";
import Verilog from "~icons/vscode-icons/file-type-verilog";
import Vhdl from "~icons/vscode-icons/file-type-vhdl";
import Vue from "~icons/vscode-icons/file-type-vue";
import Wasm from "~icons/vscode-icons/file-type-wasm";
import Wolfram from "~icons/vscode-icons/file-type-wolfram";
import Xml from "~icons/vscode-icons/file-type-xml";
import XQuery from "~icons/vscode-icons/file-type-xquery";
import Xsl from "~icons/vscode-icons/file-type-xsl";
import Yaml from "~icons/vscode-icons/file-type-yaml";
import Yarn from "~icons/vscode-icons/file-type-yarn";

import { iconTable, lookup, nameKey, type IconRow, type IconTable } from "./iconTable";

export const ICON_ROWS: Readonly<{
  byName: readonly IconRow<Component>[];
  byExtension: readonly IconRow<Component>[];
}> = {
  byName: [
    [Bazel, "build"],
    [BuckBuild, "buck"],
    [Bundler, "gemfile gemfile.lock"],
    [Cargo, "cargo.lock cargo.toml"],
    [CMake, "cmakelists.txt"],
    [Composer, "composer.json composer.lock"],
    [Config, "extensions.conf"],
    [Docker, "dockerfile"],
    [Dotenv, ".env"],
    [EditorConfig, ".editorconfig"],
    [Git, ".gitattributes .gitignore .gitmodules"],
    [Jenkins, "jenkinsfile"],
    [License, "license"],
    [Makefile, "makefile"],
    [Meson, "meson.build"],
    [Nginx, "nginx.conf"],
    [Npm, "package-lock.json package.json"],
    [Pnpm, "pnpm-lock.yaml pnpm-workspace.yaml"],
    [Rake, "rakefile"],
    [Shell, "pkgbuild"],
    [TsConfig, "tsconfig.json"],
    [Yarn, "yarn.lock"],
  ],
  byExtension: [
    [Apl, "apl dyalog"],
    [Arduino, "ino"],
    [Assembly, "s z80"],
    [Bazel, "build bzl"],
    [C, "c"],
    [CHeader, "h"],
    [Clojure, "clj cljc cljx edn"],
    [ClojureScript, "cljs"],
    [CMake, "cmake cmake.in"],
    [Cobol, "cob cpy"],
    [CoffeeScript, "coffee"],
    [Config, "cfg"],
    [Cpp, "c++ cc cpp cxx"],
    [CppHeader, "h++ hh hpp hxx"],
    [Crystal, "cr"],
    [CSharp, "cs"],
    [Css, "css"],
    [Cucumber, "feature"],
    [Cython, "pxd pxi pyx"],
    [DartLang, "dart"],
    [Delphi, "p pas"],
    [Diff, "diff patch"],
    [DLang, "d"],
    [Dtd, "dtd"],
    [Dylan, "dyl dylan intr"],
    [Elm, "elm"],
    [Emacs, "el"],
    [Erlang, "erl"],
    [Fortran, "f f77 f90 f95 for"],
    [FSharp, "fs"],
    [Go, "go"],
    [Gpg, "asc pgp sig"],
    [Gradle, "gradle"],
    [Groovy, "groovy"],
    [Handlebars, "handlebars hbs"],
    [Haskell, "hs"],
    [Haxe, "hx hxml"],
    [Html, "htm html"],
    [Image, "bmp gif ico jpeg jpg png webp"],
    [Ini, "ini properties"],
    [Java, "java"],
    [Jinja, "j2 jinja jinja2"],
    [Js, "cjs js mjs"],
    [Json, "json"],
    [JsonLd, "jsonld"],
    [Julia, "jl"],
    [Kotlin, "kt kts"],
    [Less, "less"],
    [Liquid, "liquid"],
    [Lisp, "cl lisp"],
    [LiveScript, "ls"],
    [Lua, "lua"],
    [Markdown, "markdown md mkd"],
    [Neo4j, "cyp cypher"],
    [Nsis, "nsh nsi"],
    [ObjectiveC, "m"],
    [ObjectiveCpp, "mm"],
    [OCaml, "ml mll mly"],
    [OCamlInterface, "mli"],
    [Perl, "pl pm"],
    [Php, "php php3 php4 php5 php7 phtml"],
    [PlSql, "pls"],
    [PowerShell, "ps1"],
    [PowerShellData, "psd1"],
    [PowerShellModule, "psm1"],
    [Protobuf, "proto"],
    [Pug, "jade pug"],
    [Puppet, "pp"],
    [Python, "py pyw"],
    [Q, "q"],
    [R, "r"],
    [ReactJs, "jsx"],
    [ReactTs, "tsx"],
    [Ruby, "rb"],
    [Rust, "rs"],
    [Sas, "sas"],
    [Sass, "sass"],
    [Scala, "scala"],
    [Scss, "scss"],
    [Shell, "bash ksh sh"],
    [SourceMap, "map"],
    [Sparql, "rq sparql"],
    [Sql, "sql"],
    [Squirrel, "nut"],
    [Stylus, "styl"],
    [Svg, "svg"],
    [Swift, "swift"],
    [SystemVerilog, "sv svh"],
    [Tcl, "tcl"],
    [Tex, "ltx tex"],
    [Text, "text txt"],
    [Textile, "textile"],
    [Toml, "toml"],
    [Ttcn, "ttcn ttcn3 ttcnpp"],
    [TypeScript, "cts mts ts"],
    [TypeScriptDef, "d.cts d.mts d.ts"],
    [Velocity, "vtl"],
    [Verilog, "v"],
    [Vhdl, "vhd vhdl"],
    [VisualBasic, "vb vbs"],
    [Vue, "vue"],
    [Wasm, "wast wat"],
    [Wolfram, "nb wl wls"],
    [Xml, "xml xsd"],
    [XQuery, "xq xqm xquery xqy xy"],
    [Xsl, "xsl"],
    [Yaml, "yaml yml"],
  ],
};

const ICONS: Readonly<{ byName: IconTable<Component>; byExtension: IconTable<Component> }> = {
  byName: iconTable(ICON_ROWS.byName),
  byExtension: iconTable(ICON_ROWS.byExtension),
};

export function fileIcon(path: string): Component {
  const name = nameKey(path);
  const icon = lookup(ICONS.byName, name);
  if (icon !== undefined) {
    return icon;
  }
  for (let dot = name.indexOf(".", 1); dot !== -1; dot = name.indexOf(".", dot + 1)) {
    const extensionIcon = lookup(ICONS.byExtension, name.slice(dot + 1));
    if (extensionIcon !== undefined) {
      return extensionIcon;
    }
  }
  return DefaultFile;
}
