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
import { startCommand, type StartCommand } from "./startArgs";

const USAGE = `usage: app-session <command> …   (relative paths are taken from the repository root)
  start-app     --name <n> [--binary target/debug/yamt] [--repo <dir> | --fresh-repo
                | --diff [--dir <start folder>] [--glab <tests/glab scenario>]
                | --range <a..b or a...b> --repo <dir> [--glab <tests/glab scenario>]] [--ai]
                [--settings <json text>] [--size 1600x1000] [--record <file.mkv> --record-seconds <s>]
                [--home <dir>]   (the app's home; created when missing; stop keeps it)
                --dir: tauri-driver and so the compare window start in that folder
                --glab: scripts/fake-glab and scripts/fake-open first on PATH; the scenario is the link
                <folder>/glab/scenario, opened addresses go to <folder>/glab/opened.log
  start-fixture --name <n> [--size 1600x1000] [--diff | --diff-case <compare fixture>
                | --range-case <range fixture> [--threads seeded] [--gitlab <script>]
                  [--ai [--ai-case <agent fixture: crash, checkout-fails, cancelled, …>] [--ai-changes]]]
                [--mr <merge-request script: list, slow, many, …>]   (with --diff, --diff-case or --range-case)
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

export type Command =
  | StartCommand
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
    values: [
      "name",
      "binary",
      "repo",
      "dir",
      "range",
      "settings",
      "size",
      "record",
      "record-seconds",
      "home",
      "glab",
    ],
    flags: ["fresh-repo", "diff", "ai"],
  },
  "start-fixture": {
    values: ["name", "size", "diff-case", "range-case", "threads", "gitlab", "ai-case", "mr"],
    flags: ["diff", "ai", "ai-changes"],
  },
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
