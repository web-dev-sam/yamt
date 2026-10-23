import { expect, test } from "vitest";

import type { ColumnText } from "../editor";
import { createFixtureCompareSource, log, nextColumnVersion, type TabTexts } from "../ipc";
import { formatFailures, sendSettled } from "./useCompareController";

async function emptyTab(): Promise<TabTexts> {
  const source = createFixtureCompareSource(log, "");
  const opened = await source.openCompare();
  if (!opened.ok) {
    throw new Error("the fixture source did not open");
  }
  const loaded = await source.loadTab(opened.value.list.shown);
  if (!loaded.ok) {
    throw new Error("the fixture source did not load its first tab");
  }
  return loaded.value;
}

test("a failed column becomes one notice entry with its line; formatted and unchanged ones none", () => {
  expect(
    formatFailures(
      {
        left: { kind: "failed", message: "Expected ',' or '}'", line: 3 },
        right: { kind: "formatted" },
      },
      "JSON",
    ),
  ).toEqual([{ column: "left", language: "JSON", message: "Expected ',' or '}'", line: 3 }]);
  expect(
    formatFailures(
      { left: { kind: "unchanged" }, right: { kind: "failed", message: "Unclosed <a>", line: 7 } },
      "XML",
    ),
  ).toEqual([{ column: "right", language: "XML", message: "Unclosed <a>", line: 7 }]);
});

test("both columns failing give left then right; none failing gives an empty list", () => {
  const failed = { kind: "failed", message: "m", line: 1 } as const;

  expect(
    formatFailures({ left: failed, right: failed }, "JSON").map(({ column }) => column),
  ).toEqual(["left", "right"]);
  expect(
    formatFailures({ left: { kind: "formatted" }, right: { kind: "unchanged" } }, "JSON"),
  ).toEqual([]);
});

test("each settled column is saved, and each reply is shown only once its save answered", async () => {
  const { comparison } = await emptyTab();
  const { left, right } = comparison.versions;
  const reply = { ...comparison, versions: { left, right: nextColumnVersion(right) } };
  const events: string[] = [];
  const answers = new Map<string, (answer: typeof reply | null) => void>();
  const columns: ColumnText[] = [
    { column: "left", text: "a", version: nextColumnVersion(left) },
    { column: "right", text: "b", version: nextColumnVersion(right) },
  ];

  const sent = sendSettled(
    columns,
    (column) => {
      events.push(`save ${column.column} ${column.text}`);
      // Promise.withResolvers is ES2024; tsconfig.app.json's lib stops at ES2023.
      return new Promise((resolve) => {
        answers.set(column.column, resolve);
      });
    },
    (shown) => {
      events.push(shown === reply ? "show the right reply" : "show another reply");
    },
  );
  expect(events).toEqual(["save left a", "save right b"]);

  answers.get("right")?.(reply);
  await Promise.resolve();
  expect(events).toEqual(["save left a", "save right b", "show the right reply"]);

  answers.get("left")?.(null);
  await sent;
  expect(events).toEqual(["save left a", "save right b", "show the right reply"]);
});
