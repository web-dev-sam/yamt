import { expect, test } from "vitest";

import { parseCommand } from "./args";
import { appArgs, glabFolder, startFolder } from "./startArgs";

test("a scenario whose folder exists is its folder under tests/glab; the lookup is asked about it", () => {
  const asked: string[] = [];
  const folder = glabFolder("lined-up", (path) => {
    asked.push(path);
    return true;
  });

  expect(folder).toMatch(/\/tests\/glab\/lined-up$/);
  expect(asked).toEqual([folder]);
});

test("an unknown scenario is refused at start, naming the folder it looked for", () => {
  const asked: string[] = [];
  expect(() =>
    glabFolder("nosuch", (path) => {
      asked.push(path);
      return false;
    }),
  ).toThrow(/^--glab nosuch: no scenario folder \/.*\/tests\/glab\/nosuch$/);
  expect(asked).toHaveLength(1);
  expect(() => glabFolder("nosuch", () => false)).toThrow(`no scenario folder ${asked[0]}`);
});

test("start-app --diff --dir starts the compare window in that folder and passes the app no --repo", () => {
  const command = parseCommand(["start-app", "--name", "c", "--diff", "--dir", "/var/tmp/rr"]);
  expect(command).toMatchObject({ opens: { kind: "diff", startDir: "/var/tmp/rr" } });
  expect(parseCommand(["start-app", "--name", "c", "--diff"])).toMatchObject({
    opens: { kind: "diff", startDir: null },
  });
  expect(
    appArgs({ kind: "diff", startDir: "/var/tmp/rr" }, null, { ai: false, mr: false }),
  ).toEqual(["--diff"]);
});

test("a compare session starts in its --dir folder, asked about once; without --dir or --diff in the session folder", () => {
  const asked: string[] = [];
  const dir = startFolder({ kind: "diff", startDir: "/var/tmp/rr" }, "/tmp/s", (path) => {
    asked.push(path);
    return true;
  });
  expect(dir).toBe("/var/tmp/rr");
  expect(asked).toEqual(["/var/tmp/rr"]);
  expect(startFolder({ kind: "diff", startDir: null }, "/tmp/s", () => false)).toBe("/tmp/s");
  expect(startFolder({ kind: "fresh" }, "/tmp/s", () => false)).toBe("/tmp/s");
});

test("a --dir folder that does not exist is refused at start, naming it (catches a driver started nowhere)", () => {
  expect(() =>
    startFolder({ kind: "diff", startDir: "/var/tmp/nosuch" }, "/tmp/s", () => false),
  ).toThrow("--dir /var/tmp/nosuch: no folder /var/tmp/nosuch");
});

test("start-app --dir goes only with --diff", () => {
  const onlyDiff = /--dir <folder> goes with --diff/;
  const range = ["start-app", "--name", "r", "--range", "a...b", "--repo", "/r"];
  expect(() => parseCommand([...range, "--dir", "/d"])).toThrow(onlyDiff);
  expect(() => parseCommand(["start-app", "--name", "r", "--repo", "/r", "--dir", "/d"])).toThrow(
    onlyDiff,
  );
  expect(() => parseCommand(["start-app", "--name", "r", "--fresh-repo", "--dir", "/d"])).toThrow(
    onlyDiff,
  );
});

test("start-app --glab goes with --diff as with --range", () => {
  const diff = ["start-app", "--name", "c", "--diff", "--dir", "/var/tmp/rr"];
  expect(parseCommand([...diff, "--glab", "merge-requests"])).toMatchObject({
    opens: { kind: "diff", startDir: "/var/tmp/rr" },
    glab: "merge-requests",
  });
  expect(
    parseCommand(["start-app", "--name", "c", "--diff", "--glab", "logged-out"]),
  ).toMatchObject({ glab: "logged-out" });
  expect(() => parseCommand([...diff, "--glab", "../x"])).toThrow(/expected a folder name/);
});

test("start-fixture --mr adds the merge-request script to the compare or range fixture page", () => {
  const fixture = ["start-fixture", "--name", "fx"];
  expect(parseCommand([...fixture, "--diff", "--mr", "list"])).toMatchObject({
    search: "?diff&mr=list",
  });
  expect(parseCommand([...fixture, "--diff-case", "words", "--mr", "slow"])).toMatchObject({
    search: "?diff=words&mr=slow",
  });
  expect(
    parseCommand([...fixture, "--range-case", "review", "--gitlab", "refusal", "--mr", "a b"]),
  ).toMatchObject({ search: "?range=review&gitlab=refusal&mr=a%20b" });
  expect(parseCommand([...fixture, "--range-case", "empty"])).toMatchObject({
    search: "?range=empty",
  });
});

test("start-fixture --mr refuses the merge window, which has no merge-request page", () => {
  expect(() => parseCommand(["start-fixture", "--name", "fx", "--mr", "list"])).toThrow(
    /--mr only with --diff, --diff-case or --range-case/,
  );
  expect(() => parseCommand(["start-fixture", "--name", "fx", "--diff", "--mr"])).toThrow(
    /--mr needs a value/,
  );
});

test("start-fixture --open-mr opens the merge-request page at start, only with an --mr script", () => {
  const fixture = ["start-fixture", "--name", "fx"];
  expect(parseCommand([...fixture, "--diff", "--mr", "list", "--open-mr"])).toMatchObject({
    search: "?diff&mr=list&open=mergeRequests",
  });
  expect(
    parseCommand([...fixture, "--range-case", "review", "--mr", "list", "--open-mr"]),
  ).toMatchObject({ search: "?range=review&mr=list&open=mergeRequests" });
  expect(() => parseCommand([...fixture, "--diff", "--open-mr"])).toThrow(
    "start-fixture takes --open-mr only with --mr <script>",
  );
  expect(() => parseCommand([...fixture, "--mr", "list", "--open-mr"])).toThrow(
    /--mr only with --diff, --diff-case or --range-case/,
  );
});

test("start-fixture --reviewed seeded adds &reviewed=seeded to a range fixture page, only with --range-case", () => {
  const fixture = ["start-fixture", "--name", "fx"];
  expect(
    parseCommand([...fixture, "--range-case", "review", "--reviewed", "seeded"]),
  ).toMatchObject({ search: "?range=review&reviewed=seeded" });
  expect(
    parseCommand([
      ...fixture,
      "--range-case",
      "review",
      "--threads",
      "seeded",
      "--reviewed",
      "seeded",
    ]),
  ).toMatchObject({ search: "?range=review&threads=seeded&reviewed=seeded" });
  const onlyRange =
    "start-fixture takes --threads, --gitlab, --reviewed, --heading and --ai only with --range-case";
  expect(() => parseCommand([...fixture, "--reviewed", "seeded"])).toThrow(onlyRange);
  expect(() => parseCommand([...fixture, "--diff", "--reviewed", "seeded"])).toThrow(onlyRange);
  expect(() =>
    parseCommand(["start-app", "--name", "a", "--diff", "--reviewed", "seeded"]),
  ).toThrow(/unknown option --reviewed/);
});

test("start-app --review-of passes --review-of=<project!iid> after the range, only with --range", () => {
  const range = ["start-app", "--name", "r", "--range", "main...feature", "--repo", "/tmp/rr"];
  const command = parseCommand([...range, "--review-of", "group/app!12", "--mr"]);
  expect(command).toMatchObject({
    opens: {
      kind: "range",
      range: "main...feature",
      dir: "/tmp/rr",
      review: { of: "group/app!12", names: null },
    },
  });
  if (command.kind !== "start-app") {
    throw new Error("not a start-app command");
  }
  expect(appArgs(command.opens, "/tmp/rr", command)).toEqual([
    "--diff=main...feature",
    "--review-of=group/app!12",
    "--repo",
    "/tmp/rr",
    "--mr",
  ]);
  const onlyRange =
    "start-app --review-of <project!iid> goes with --range: the range window's marks";
  expect(() =>
    parseCommand(["start-app", "--name", "c", "--diff", "--review-of", "group/app!12"]),
  ).toThrow(onlyRange);
  expect(() =>
    parseCommand(["start-app", "--name", "c", "--repo", "/r", "--review-of", "group/app!12"]),
  ).toThrow(onlyRange);
  expect(() =>
    parseCommand(["start-fixture", "--name", "fx", "--range-case", "review", "--review-of", "a!1"]),
  ).toThrow(/unknown option --review-of/);
});

test("start-fixture --heading adds &heading=<value> after --reviewed's, only with --range-case", () => {
  const fixture = ["start-fixture", "--name", "fx"];
  expect(
    parseCommand([...fixture, "--range-case", "review", "--heading", "mergeRequest"]),
  ).toMatchObject({ search: "?range=review&heading=mergeRequest" });
  expect(
    parseCommand([
      ...fixture,
      "--range-case",
      "review",
      "--heading",
      "fork",
      "--reviewed",
      "seeded",
      "--gitlab",
      "moved",
      "--threads",
      "seeded",
    ]),
  ).toMatchObject({
    search: "?range=review&threads=seeded&gitlab=moved&reviewed=seeded&heading=fork",
  });
  const onlyRange =
    "start-fixture takes --threads, --gitlab, --reviewed, --heading and --ai only with --range-case";
  expect(() => parseCommand([...fixture, "--heading", "unnamed"])).toThrow(onlyRange);
  expect(() => parseCommand([...fixture, "--diff", "--heading", "unnamed"])).toThrow(onlyRange);
});

test("start-app --mr-title, --mr-source and --mr-target reach the app right after --review-of=…", () => {
  const reviewed = [
    "start-app",
    "--name",
    "r",
    "--range",
    "531ea52..9c1ba3f",
    "--repo",
    "/tmp/rr",
    "--review-of",
    "group/app!12",
  ];
  const named = [
    "--mr-title",
    'Say "due" = soon',
    "--mr-source",
    "sam:feature",
    "--mr-target",
    "main",
  ];
  const command = parseCommand([...reviewed, ...named, "--ai"]);
  expect(command).toMatchObject({
    opens: {
      review: {
        of: "group/app!12",
        names: { title: 'Say "due" = soon', source: "sam:feature", target: "main" },
      },
    },
  });
  if (command.kind !== "start-app") {
    throw new Error("not a start-app command");
  }
  expect(appArgs(command.opens, "/tmp/rr", command)).toEqual([
    "--diff=531ea52..9c1ba3f",
    "--review-of=group/app!12",
    '--mr-title=Say "due" = soon',
    "--mr-source=sam:feature",
    "--mr-target=main",
    "--repo",
    "/tmp/rr",
    "--ai",
  ]);
});

test.each([
  ["only a title", ["--mr-title", "t"]],
  ["only a source", ["--mr-source", "s"]],
  ["only a target", ["--mr-target", "m"]],
  ["no target", ["--mr-title", "t", "--mr-source", "s"]],
  ["no title", ["--mr-source", "s", "--mr-target", "m"]],
  ["no source", ["--mr-title", "t", "--mr-target", "m"]],
])("start-app with %s of the --mr-* names is refused", (_case, names) => {
  const reviewed = ["start-app", "--name", "r", "--range", "a..b", "--repo", "/r"];
  const together =
    "start-app --mr-title, --mr-source and --mr-target go together, with --review-of";
  expect(() => parseCommand([...reviewed, "--review-of", "g/a!1", ...names])).toThrow(together);
});

test("start-app --mr-* names without --review-of are refused, on a range or a compare window", () => {
  const names = ["--mr-title", "t", "--mr-source", "s", "--mr-target", "m"];
  const together =
    "start-app --mr-title, --mr-source and --mr-target go together, with --review-of";
  expect(() =>
    parseCommand(["start-app", "--name", "r", "--range", "a..b", "--repo", "/r", ...names]),
  ).toThrow(together);
  expect(() => parseCommand(["start-app", "--name", "c", "--diff", ...names])).toThrow(together);
});
