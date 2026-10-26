import { expect, test } from "vitest";

import { glabFolder } from "./startArgs";

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
