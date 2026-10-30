import { expect, test } from "vitest";

import { parseCommand } from "./args";
import { appArgs, glabFolder } from "./startArgs";

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
  expect(appArgs({ kind: "diff", startDir: "/var/tmp/rr" }, null, false)).toEqual(["--diff"]);
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
