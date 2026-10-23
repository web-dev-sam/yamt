import { expect, test } from "vitest";

import { parseCommand, type Command } from "./args";
import { parseChord } from "./keys";

test("start-app takes the brief's defaults: debug binary, 1600x1000, no recording, no settings", () => {
  expect(parseCommand(["start-app", "--name", "smoke", "--fresh-repo"])).toEqual({
    kind: "start-app",
    name: "smoke",
    binary: "target/debug/yamt",
    opens: { kind: "fresh" },
    settings: null,
    size: { width: 1600, height: 1000 },
    record: null,
    home: null,
  });
});

test("start-app reads every option of the acceptance run", () => {
  const argv = [
    "start-app",
    "--name",
    "smoke",
    "--repo",
    "/tmp/r",
    "--settings",
    '{"theme":"light"}',
    "--size",
    "800x600",
    "--record",
    "/tmp/s.mkv",
    "--record-seconds",
    "5",
    "--binary",
    "target/release/yamt",
    "--home",
    "/tmp/h-home",
  ];
  expect(parseCommand(argv)).toEqual({
    kind: "start-app",
    name: "smoke",
    binary: "target/release/yamt",
    opens: { kind: "dir", dir: "/tmp/r" },
    settings: '{"theme":"light"}',
    size: { width: 800, height: 600 },
    record: { file: "/tmp/s.mkv", seconds: 5 },
    home: "/tmp/h-home",
  });
});

test("start-app needs exactly one of --repo, --fresh-repo and --diff", () => {
  const needsOne = /needs one of --repo <dir>, --fresh-repo and --diff/;
  expect(() => parseCommand(["start-app", "--name", "a"])).toThrow(needsOne);
  expect(() => parseCommand(["start-app", "--name", "a", "--repo", "/r", "--fresh-repo"])).toThrow(
    needsOne,
  );
  expect(() => parseCommand(["start-app", "--name", "a", "--repo", "/r", "--diff"])).toThrow(
    needsOne,
  );
  expect(() => parseCommand(["start-app", "--name", "a", "--fresh-repo", "--diff"])).toThrow(
    needsOne,
  );
});

test("start-app --diff opens the compare window and no repository", () => {
  expect(
    parseCommand(["start-app", "--name", "c", "--diff", "--home", "/tmp/c-home"]),
  ).toMatchObject({ kind: "start-app", opens: { kind: "diff" }, home: "/tmp/c-home" });
});

test("--record and --record-seconds come together, with whole seconds of at least 1", () => {
  const base = ["start-app", "--name", "a", "--fresh-repo"];
  expect(() => parseCommand([...base, "--record", "/tmp/s.mkv"])).toThrow(/go together/);
  expect(() => parseCommand([...base, "--record-seconds", "5"])).toThrow(/go together/);
  expect(() => parseCommand([...base, "--record", "/s.mkv", "--record-seconds", "0"])).toThrow(
    /≥ 1/,
  );
  expect(() => parseCommand([...base, "--record", "/s.mkv", "--record-seconds", "1.5"])).toThrow(
    /whole number/,
  );
});

test("--settings must be a JSON object, --size must be <width>x<height>", () => {
  const base = ["start-app", "--name", "a", "--fresh-repo"];
  expect(() => parseCommand([...base, "--settings", "{theme}"])).toThrow(/not JSON/);
  expect(() => parseCommand([...base, "--settings", "[]"])).toThrow(/JSON object/);
  expect(() => parseCommand([...base, "--settings", "null"])).toThrow(/JSON object/);
  expect(() => parseCommand([...base, "--size", "1600"])).toThrow(/<width>x<height>/);
  expect(() => parseCommand([...base, "--size", "0x10"])).toThrow(/<width>x<height>/);
});

test("--home needs a folder", () => {
  expect(() => parseCommand(["start-app", "--name", "a", "--fresh-repo", "--home"])).toThrow(
    /--home needs a value/,
  );
  expect(() => parseCommand(["start-fixture", "--name", "a", "--home", "/tmp/h"])).toThrow(
    /unknown option --home/,
  );
});

test("a session name is a plain file name, never a path", () => {
  expect(() => parseCommand(["stop", "--name", "../x"])).toThrow(/letters, digits/);
  expect(() => parseCommand(["stop", "--name", ""])).toThrow(/letters, digits/);
  expect(() => parseCommand(["stop"])).toThrow(/--name <n> is required/);
  expect(parseCommand(["stop", "--name", "fx_2-b"])).toEqual({ kind: "stop", name: "fx_2-b" });
});

test("start-fixture takes a name and a size, and opens the merge page", () => {
  expect(parseCommand(["start-fixture", "--name", "fx", "--size", "1280x800"])).toEqual({
    kind: "start-fixture",
    name: "fx",
    size: { width: 1280, height: 800 },
    search: "",
  });
});

test("start-fixture --diff opens the compare page, --diff-case one compare fixture in its first tab", () => {
  expect(parseCommand(["start-fixture", "--name", "fx", "--diff"])).toMatchObject({
    search: "?diff",
  });
  expect(
    parseCommand(["start-fixture", "--name", "fx", "--diff-case", "json-payload"]),
  ).toMatchObject({ search: "?diff=json-payload" });
  expect(() => parseCommand(["start-fixture", "--name", "fx", "--diff-case"])).toThrow(
    /--diff-case needs a value/,
  );
});

test("click takes one accessible name, an optional role, a 0-based --nth, --x11 and --double", () => {
  expect(parseCommand(["click", "--name", "fx", "Next change"])).toEqual({
    kind: "click",
    name: "fx",
    query: { name: "Next change", role: null, nth: null },
    x11: false,
    double: false,
  });
  expect(
    parseCommand(["click", "--name", "fx", "Dark", "--role", "button", "--nth", "0", "--x11"]),
  ).toEqual({
    kind: "click",
    name: "fx",
    query: { name: "Dark", role: "button", nth: 0 },
    x11: true,
    double: false,
  });
  expect(parseCommand(["click", "--name", "fx", "File list width", "--double"])).toEqual({
    kind: "click",
    name: "fx",
    query: { name: "File list width", role: null, nth: null },
    x11: false,
    double: true,
  });
  expect(() => parseCommand(["click", "--name", "fx", "Dark", "--nth", "-1"])).toThrow(/≥ 0/);
  expect(() => parseCommand(["click", "--name", "fx", "Next", "change"])).toThrow(
    /exactly one accessible name/,
  );
});

test("drag takes one target by name or css, a signed --dx, an optional --dy, --role and --nth", () => {
  expect(parseCommand(["drag", "--name", "a", "Local and Result widths", "--dx", "-120"])).toEqual({
    kind: "drag",
    name: "a",
    query: { name: "Local and Result widths", role: null, nth: null },
    dx: -120,
    dy: 0,
  });
  expect(
    parseCommand([
      "drag",
      "--name",
      "a",
      ".chunk-action-apply",
      "--dx",
      "0",
      "--dy",
      "60",
      "--nth",
      "1",
    ]),
  ).toEqual({
    kind: "drag",
    name: "a",
    query: { name: ".chunk-action-apply", role: null, nth: 1 },
    dx: 0,
    dy: 60,
  });
  expect(() => parseCommand(["drag", "--name", "a", "x"])).toThrow(/drag needs --dx <px>/);
  expect(() => parseCommand(["drag", "--name", "a", "x", "--dx", "1.5"])).toThrow(/whole number/);
  expect(() => parseCommand(["drag", "--name", "a", "x", "--dx", "right"])).toThrow(/whole number/);
  expect(() => parseCommand(["drag", "--name", "a", "x", "--dx", "5", "--dy", "-"])).toThrow(
    /--dy -: expected a whole number/,
  );
  expect(() => parseCommand(["drag", "--name", "a", "--dx", "5"])).toThrow(
    /exactly one accessible name/,
  );
  expect(() => parseCommand(["drag", "--name", "a", "x", "--dx", "5", "--double"])).toThrow(
    /unknown option --double/,
  );
});

test("press parses every key, in order", () => {
  expect(
    parseCommand(["press", "--name", "a", "Ctrl+Z", "Shift+Tab", "Enter", "a", "--x11"]),
  ).toEqual({
    kind: "press",
    name: "a",
    chords: ["Ctrl+Z", "Shift+Tab", "Enter", "a"].map(parseChord),
    x11: true,
  });
  expect(() => parseCommand(["press", "--name", "a"])).toThrow(/at least one key/);
  expect(() => parseCommand(["press", "--name", "a", "Ctrl+Nope"])).toThrow(/unknown key/);
});

test("type, read and shot take exactly one positional; -- lets one start with --", () => {
  expect(parseCommand(["type", "--name", "a", "--", "--not-an-option"])).toEqual({
    kind: "type",
    name: "a",
    text: "--not-an-option",
    x11: false,
  });
  expect(parseCommand(["read", "--name", "a", "document.documentElement.dataset.theme"])).toEqual({
    kind: "read",
    name: "a",
    expression: "document.documentElement.dataset.theme",
  });
  expect(parseCommand(["shot", "--name", "a", "/tmp/a.png", "--display"])).toEqual({
    kind: "shot",
    name: "a",
    file: "/tmp/a.png",
    display: true,
  });
  expect(() => parseCommand(["read", "--name", "a"])).toThrow(/exactly one js expression, got 0/);
});

test("scroll takes a target and --to top, bottom or a whole pixel offset", () => {
  function scroll(to: string): Command {
    return parseCommand(["scroll", "--name", "a", ".cm-scroller", "--to", to, "--nth", "1"]);
  }
  expect(scroll("top")).toEqual({
    kind: "scroll",
    name: "a",
    query: { name: ".cm-scroller", role: null, nth: 1 },
    to: { kind: "top" },
  });
  expect(scroll("bottom")).toMatchObject({ to: { kind: "bottom" } });
  expect(scroll("250")).toMatchObject({ to: { kind: "px", px: 250 } });
  expect(() => scroll("middle")).toThrow(/whole number/);
  expect(() => parseCommand(["scroll", "--name", "a", "x"])).toThrow(/--to <bottom\|top\|px>/);
});

test("hover takes one target like scroll, by name or css, with --role and --nth, and no --to", () => {
  expect(parseCommand(["hover", "--name", "a", ".chunk-removal", "--nth", "2"])).toEqual({
    kind: "hover",
    name: "a",
    query: { name: ".chunk-removal", role: null, nth: 2 },
  });
  expect(parseCommand(["hover", "--name", "a", "Save", "--role", "button"])).toEqual({
    kind: "hover",
    name: "a",
    query: { name: "Save", role: "button", nth: null },
  });
  expect(() => parseCommand(["hover", "--name", "a"])).toThrow(/exactly one accessible name/);
  expect(() => parseCommand(["hover", "--name", "a", "x", "--to", "top"])).toThrow(
    /unknown option --to/,
  );
});

test("colours takes a file and at least one colour, and needs no session", () => {
  expect(parseCommand(["colours", "/tmp/s.mkv", "26282c", "#191A1C"])).toEqual({
    kind: "colours",
    file: "/tmp/s.mkv",
    colours: [
      { hex: "26282c", rgb: 0x26282c },
      { hex: "191a1c", rgb: 0x191a1c },
    ],
  });
  expect(() => parseCommand(["colours", "/tmp/s.mkv"])).toThrow(/at least one <hex>/);
  expect(() => parseCommand(["colours", "/tmp/s.mkv", "--name", "a", "26282c"])).toThrow(
    /unknown option --name/,
  );
});

test("unknown commands show the usage; unknown, valueless or repeated options are errors", () => {
  expect(() => parseCommand([])).toThrow(/no command\nusage: app-session/);
  expect(() => parseCommand(["tap", "--name", "a"])).toThrow(/unknown command "tap"\nusage:/);
  expect(() => parseCommand(["read", "--name", "a", "--x11", "1"])).toThrow(/unknown option --x11/);
  expect(() => parseCommand(["read", "x", "--name"])).toThrow(/--name needs a value/);
  expect(() => parseCommand(["stop", "--name", "a", "--name", "b"])).toThrow(/--name given twice/);
  expect(() => parseCommand(["click", "--name", "a", "--x11", "--x11", "b"])).toThrow(
    /--x11 given twice/,
  );
  expect(() => parseCommand(["stop", "--name", "a", "extra"])).toThrow(/unexpected arguments/);
});
