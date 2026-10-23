import { afterEach, expect, test, vi } from "vitest";

import { createFixtureCompareSource, log, type TabId } from "../ipc";
import { logProblem, type Problem } from "./problem";

const TAB = await openedTab();

async function openedTab(): Promise<TabId> {
  const reply = await createFixtureCompareSource(log, "", {}).openCompare();
  if (!reply.ok) {
    throw new Error("the fixture opened no tab");
  }
  return reply.value.list.shown;
}

afterEach(() => {
  vi.restoreAllMocks();
});

function logged(problem: Problem): string[] {
  const lines: string[] = [];
  vi.spyOn(console, "error").mockImplementation((line: string) => {
    lines.push(line);
  });
  logProblem(problem);
  return lines;
}

test.each([
  [
    { action: "tabs", cause: { kind: "UnknownTab", tab: 3 } },
    '[error] store.tabs_failed {kind: "UnknownTab", tab: 3}',
  ],
  [
    { action: "loadTab", name: "Compare 2", cause: { kind: "WorkerStopped" } },
    '[error] store.loadTab_failed {name: "Compare 2", kind: "WorkerStopped"}',
  ],
  [
    {
      action: "saveTab",
      tab: TAB,
      column: "right",
      name: "Compare 2",
      cause: { kind: "ColumnTooLarge", limit: 8 },
    },
    '[error] store.saveTab_failed {name: "Compare 2", kind: "ColumnTooLarge", limit: 8}',
  ],
] satisfies [Problem, string][])(
  "a failed compare call is logged with the tab's name and the cause: %o (catches a log line without its tab)",
  (problem, line) => {
    expect(logged(problem)).toEqual([line]);
  },
);

test("a settings failure logs its cause, and only the file's path for key problems (catches a log line without the cause)", () => {
  expect(
    logged({ action: "settings", cause: { kind: "Unexpected", message: "ipc gone" } }),
  ).toEqual(['[error] store.settings_failed {kind: "Unexpected", message: "ipc gone"}']);
  vi.restoreAllMocks();
  expect(
    logged({
      action: "settings",
      cause: { kind: "Keys", path: "/home/me/settings.json", problems: [] },
    }),
  ).toEqual(['[error] store.settings_failed {kind: "Keys", path: "/home/me/settings.json"}']);
});
