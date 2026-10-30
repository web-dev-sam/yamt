import { mkdirSync, symlinkSync } from "node:fs";
import { delimiter, join } from "node:path";

import { fromRoot } from "./session";

export type FakeGlab = {
  readonly scenario: string;
  readonly posts: string;
  readonly log: string;
  readonly opened: string;
};

export function fakeGlab(scenarioFolder: string | null, folder: string): FakeGlab | null {
  if (scenarioFolder === null) {
    return null;
  }
  const dir = join(folder, "glab");
  mkdirSync(dir);
  const link = join(dir, "scenario");
  symlinkSync(scenarioFolder, link);
  return {
    scenario: link,
    posts: join(dir, "posts"),
    log: join(dir, "calls.log"),
    opened: join(dir, "opened.log"),
  };
}

export function glabEnv(glab: FakeGlab | null): NodeJS.ProcessEnv {
  if (glab === null) {
    return {};
  }
  const fakes = [fromRoot("scripts/fake-glab"), fromRoot("scripts/fake-open")];
  const path = [...fakes, process.env["PATH"] ?? ""];
  return {
    PATH: path.join(delimiter),
    YAMT_FAKE_GLAB: glab.scenario,
    YAMT_FAKE_GLAB_STATE: glab.posts,
    YAMT_FAKE_GLAB_LOG: glab.log,
    YAMT_FAKE_OPEN_LOG: glab.opened,
  };
}
