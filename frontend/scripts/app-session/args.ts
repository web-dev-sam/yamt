import {
  noPositionals,
  offsetPx,
  onePositional,
  sessionName,
  splitArgs,
  wholeNumber,
  type Parsed,
  type Spec,
} from "./argv";
import { parseColour, type Colour } from "./colours";
import type { Query } from "./find";
import { parseChord, type Chord } from "./keys";
import type { ScrollTo } from "./placement";
import type { Size } from "./state";

const DEFAULT_SIZE: Size = { width: 1600, height: 1000 };
const DEFAULT_BINARY = "target/debug/yamt";
const SIZE = /^([1-9][0-9]*)x([1-9][0-9]*)$/;

const USAGE = `usage: app-session <command> …   (relative paths are taken from the repository root)
  start-app     --name <n> [--binary target/debug/yamt] [--repo <dir> | --fresh-repo | --raw]
                [--settings <json text>] [--size 1600x1000] [--record <file.mkv> --record-seconds <s>]
                [--home <dir>]   (the app's home; created when missing; stop keeps it)
  start-fixture --name <n> [--size 1600x1000] [--raw | --raw-case <compare fixture>]
  click         --name <n> <accessible name or css> [--role <role>] [--nth <i, from 0>] [--x11] [--double]
  drag          --name <n> <accessible name or css> --dx <px> [--dy <px>] [--role <role>] [--nth <i>]
  press         --name <n> <key> [<key> …] [--x11]     keys: "Ctrl+Z", "Shift+Tab", "Enter", "a"
  type          --name <n> <text> [--x11]
  scroll        --name <n> <accessible name or css> --to <bottom|top|px> [--role <role>] [--nth <i>]
  hover         --name <n> <accessible name or css> [--role <role>] [--nth <i>]   pointer only, no click
  read          --name <n> <js expression>
  shot          --name <n> <file.png> [--display]
  focus-away    --name <n>
  focus-back    --name <n>
  colours       <file.mkv> <hex> [<hex> …]
  stop          --name <n>`;

type Opening = { readonly kind: "dir"; readonly dir: string } | { readonly kind: "fresh" | "raw" };
export type Recording = { readonly file: string; readonly seconds: number };

export type Command =
  | {
      readonly kind: "start-app";
      readonly name: string;
      readonly binary: string;
      readonly opens: Opening;
      readonly settings: string | null;
      readonly size: Size;
      readonly record: Recording | null;
      readonly home: string | null;
    }
  | {
      readonly kind: "start-fixture";
      readonly name: string;
      readonly size: Size;
      readonly search: string;
    }
  | {
      readonly kind: "click";
      readonly name: string;
      readonly query: Query;
      readonly x11: boolean;
      readonly double: boolean;
    }
  | {
      readonly kind: "drag";
      readonly name: string;
      readonly query: Query;
      readonly dx: number;
      readonly dy: number;
    }
  | {
      readonly kind: "press";
      readonly name: string;
      readonly chords: readonly Chord[];
      readonly x11: boolean;
    }
  | { readonly kind: "type"; readonly name: string; readonly text: string; readonly x11: boolean }
  | {
      readonly kind: "scroll";
      readonly name: string;
      readonly query: Query;
      readonly to: ScrollTo;
    }
  | { readonly kind: "hover"; readonly name: string; readonly query: Query }
  | { readonly kind: "read"; readonly name: string; readonly expression: string }
  | {
      readonly kind: "shot";
      readonly name: string;
      readonly file: string;
      readonly display: boolean;
    }
  | { readonly kind: "focus-away" | "focus-back" | "stop"; readonly name: string }
  | { readonly kind: "colours"; readonly file: string; readonly colours: readonly Colour[] };

type CommandKind = Command["kind"];

const SPECS: Readonly<Record<CommandKind, Spec>> = {
  "start-app": {
    values: ["name", "binary", "repo", "settings", "size", "record", "record-seconds", "home"],
    flags: ["fresh-repo", "raw"],
  },
  "start-fixture": { values: ["name", "size", "raw-case"], flags: ["raw"] },
  click: { values: ["name", "role", "nth"], flags: ["x11", "double"] },
  drag: { values: ["name", "dx", "dy", "role", "nth"], flags: [] },
  press: { values: ["name"], flags: ["x11"] },
  type: { values: ["name"], flags: ["x11"] },
  scroll: { values: ["name", "to", "role", "nth"], flags: [] },
  hover: { values: ["name", "role", "nth"], flags: [] },
  read: { values: ["name"], flags: [] },
  shot: { values: ["name"], flags: ["display"] },
  "focus-away": { values: ["name"], flags: [] },
  "focus-back": { values: ["name"], flags: [] },
  colours: { values: [], flags: [] },
  stop: { values: ["name"], flags: [] },
};

function size(parsed: Parsed): Size {
  const text = parsed.values.get("size");
  if (text === undefined) {
    return DEFAULT_SIZE;
  }
  const [, width, height] = SIZE.exec(text) ?? [];
  if (width === undefined || height === undefined) {
    throw new Error(`--size ${text}: expected <width>x<height>, e.g. 1600x1000`);
  }
  return { width: Number(width), height: Number(height) };
}

function opening(parsed: Parsed): Opening {
  const dir = parsed.values.get("repo");
  const raw = parsed.flags.has("raw");
  if ([dir !== undefined, parsed.flags.has("fresh-repo"), raw].filter(Boolean).length !== 1) {
    throw new Error("start-app needs one of --repo <dir>, --fresh-repo and --raw");
  }
  return dir === undefined ? { kind: raw ? "raw" : "fresh" } : { kind: "dir", dir };
}

function fixtureSearch(parsed: Parsed): string {
  const fixture = parsed.values.get("raw-case");
  const raw = parsed.flags.has("raw") ? "?raw" : "";
  return fixture === undefined ? raw : `?raw=${encodeURIComponent(fixture)}`;
}

function recording(parsed: Parsed): Recording | null {
  const file = parsed.values.get("record");
  const seconds = parsed.values.get("record-seconds");
  if (file === undefined && seconds === undefined) {
    return null;
  }
  if (file === undefined || seconds === undefined) {
    throw new Error("--record and --record-seconds go together");
  }
  return { file, seconds: wholeNumber(seconds, "--record-seconds", 1) };
}

function settingsText(parsed: Parsed): string | null {
  const text = parsed.values.get("settings");
  if (text === undefined) {
    return null;
  }
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`--settings is not JSON: ${reason}`, { cause: error });
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`--settings must be a JSON object, got ${text}`);
  }
  return text;
}

function scrollTo(parsed: Parsed): ScrollTo {
  const text = parsed.values.get("to");
  if (text === undefined) {
    throw new Error("scroll needs --to <bottom|top|px>");
  }
  if (text === "top" || text === "bottom") {
    return { kind: text };
  }
  return { kind: "px", px: wholeNumber(text, "--to", 0) };
}

function query(parsed: Parsed): Query {
  const nth = parsed.values.get("nth");
  return {
    name: onePositional(parsed, "accessible name"),
    role: parsed.values.get("role") ?? null,
    nth: nth === undefined ? null : wholeNumber(nth, "--nth", 0),
  };
}

function dragCommand(parsed: Parsed): Command {
  const dx = parsed.values.get("dx");
  if (dx === undefined) {
    throw new Error("drag needs --dx <px>");
  }
  const dy = parsed.values.get("dy");
  return {
    kind: "drag",
    name: sessionName(parsed),
    query: query(parsed),
    dx: offsetPx(dx, "--dx"),
    dy: dy === undefined ? 0 : offsetPx(dy, "--dy"),
  };
}

function startCommand(kind: "start-app" | "start-fixture", parsed: Parsed): Command {
  noPositionals(parsed);
  const name = sessionName(parsed);
  if (kind === "start-fixture") {
    return { kind, name, size: size(parsed), search: fixtureSearch(parsed) };
  }
  return {
    kind,
    name,
    binary: parsed.values.get("binary") ?? DEFAULT_BINARY,
    opens: opening(parsed),
    settings: settingsText(parsed),
    size: size(parsed),
    record: recording(parsed),
    home: parsed.values.get("home") ?? null,
  };
}

function inputCommand(kind: "click" | "press" | "type", parsed: Parsed): Command {
  const name = sessionName(parsed);
  const x11 = parsed.flags.has("x11");
  switch (kind) {
    case "click":
      return { kind, name, query: query(parsed), x11, double: parsed.flags.has("double") };
    case "press":
      if (parsed.positionals.length === 0) {
        throw new Error("press needs at least one key");
      }
      return { kind, name, chords: parsed.positionals.map(parseChord), x11 };
    case "type":
      return { kind, name, text: onePositional(parsed, "text"), x11 };
  }
}

function coloursCommand(parsed: Parsed): Command {
  const [file, ...hexes] = parsed.positionals;
  if (file === undefined || hexes.length === 0) {
    throw new Error("colours needs <file.mkv> and at least one <hex>");
  }
  return { kind: "colours", file, colours: hexes.map(parseColour) };
}

function build(kind: CommandKind, parsed: Parsed): Command {
  switch (kind) {
    case "start-app":
    case "start-fixture":
      return startCommand(kind, parsed);
    case "click":
    case "press":
    case "type":
      return inputCommand(kind, parsed);
    case "scroll":
      return { kind, name: sessionName(parsed), query: query(parsed), to: scrollTo(parsed) };
    case "hover":
      return { kind, name: sessionName(parsed), query: query(parsed) };
    case "drag":
      return dragCommand(parsed);
    case "read":
      return {
        kind,
        name: sessionName(parsed),
        expression: onePositional(parsed, "js expression"),
      };
    case "shot": {
      const file = onePositional(parsed, "file");
      return { kind, name: sessionName(parsed), file, display: parsed.flags.has("display") };
    }
    case "focus-away":
    case "focus-back":
    case "stop":
      noPositionals(parsed);
      return { kind, name: sessionName(parsed) };
    case "colours":
      return coloursCommand(parsed);
  }
}

function isCommandKind(word: string): word is CommandKind {
  return Object.hasOwn(SPECS, word);
}

export function parseCommand(argv: readonly string[]): Command {
  const [word, ...rest] = argv;
  if (word === undefined || !isCommandKind(word)) {
    const problem = word === undefined ? "no command" : `unknown command "${word}"`;
    throw new Error(`${problem}\n${USAGE}`);
  }
  return build(word, splitArgs(rest, SPECS[word]));
}
