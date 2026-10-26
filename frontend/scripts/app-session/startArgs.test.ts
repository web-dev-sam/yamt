import { expect, test } from "vitest";

import type { Parsed } from "./argv";
import { glabFolder, glabScenario } from "./startArgs";

const RANGE = { kind: "range", range: "main...feature", dir: "/tmp/rr" } as const;

function withGlab(scenario: string): Parsed {
  return { values: new Map([["glab", scenario]]), flags: new Set(), positionals: [] };
}

test("a scenario names its folder under tests/glab", () => {
  expect(glabFolder("lined-up")).toMatch(/\/tests\/glab\/lined-up$/);
});

test("a scenario whose folder exists is taken; the lookup is asked about that folder", () => {
  const asked: string[] = [];
  const scenario = glabScenario(withGlab("lined-up"), RANGE, (path) => {
    asked.push(path);
    return true;
  });

  expect(scenario).toBe("lined-up");
  expect(asked).toEqual([glabFolder("lined-up")]);
});

test("an unknown scenario is refused at start, naming the folder it looked for", () => {
  expect(() => glabScenario(withGlab("lined_up"), RANGE, () => false)).toThrow(
    /--glab lined_up: expected a folder name/,
  );
  expect(() => glabScenario(withGlab("nosuch"), RANGE, () => false)).toThrow(
    `--glab nosuch: no scenario folder ${glabFolder("nosuch")}`,
  );
});
