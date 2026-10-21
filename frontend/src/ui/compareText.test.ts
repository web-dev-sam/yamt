import { expect, test } from "vitest";

import { createFixtureCompareSource, log, type TabEntry, type TabId } from "../ipc";
import { compareNoticeRow, tabName } from "./compareText";

const { tabs } = await listed();
const [ENTRY] = tabs;

async function listed(): Promise<{ readonly tabs: readonly TabEntry[] }> {
  const source = createFixtureCompareSource(log, "", {});
  await source.addTab();
  const reply = await source.addTab();
  if (!reply.ok) {
    throw new Error("the fixture did not add a tab");
  }
  return reply.value;
}

function tabOf(entry: TabEntry | undefined): TabId {
  if (entry === undefined) {
    throw new Error("no tab");
  }
  return entry.id;
}

test("a Format failure names the tab, the column, the language, the line and the parser's message (catches a notice without its column)", () => {
  expect(
    compareNoticeRow({
      kind: "format",
      tab: tabOf(ENTRY),
      name: "Compare 2",
      column: "left",
      language: "JSON",
      message: "Expected ',' or '}'",
      line: 3,
    }),
  ).toEqual({
    key: `${tabOf(ENTRY)}:left`,
    text: "Compare 2, left: not valid JSON (line 3): Expected ',' or '}'",
    closeLabel: "Close the notice about Compare 2, left",
  });
});

test("a refused edit names the column and the limit in MiB (catches the limit written in bytes)", () => {
  const notice = {
    kind: "refused",
    tab: tabOf(ENTRY),
    name: "Compare 2",
    column: "right",
    limit: 8_388_608,
  } as const;

  expect(compareNoticeRow(notice)).toEqual({
    key: `${tabOf(ENTRY)}:right`,
    text: "Compare 2, right: not pasted — a column holds up to 8 MiB",
    closeLabel: "Close the notice about Compare 2, right",
  });
  expect(compareNoticeRow({ ...notice, limit: 4_194_304 }).text).toBe(
    "Compare 2, right: not pasted — a column holds up to 4 MiB",
  );
});

test("notices about one tab's column share a key whatever they say; other tabs and columns differ (catches a key per kind)", () => {
  const where = { tab: tabOf(ENTRY), name: "Compare 1", column: "left" } as const;
  const refused = compareNoticeRow({ kind: "refused", ...where, limit: 1 }).key;
  const format = { kind: "format", ...where, language: "XML", message: "m", line: 1 } as const;

  expect(compareNoticeRow(format).key).toBe(refused);
  expect(compareNoticeRow({ ...format, column: "right" }).key).not.toBe(refused);
  expect(compareNoticeRow({ ...format, tab: tabOf(tabs[1]) }).key).not.toBe(refused);
});

test("a tab's name comes from the list, a tab not listed is named by its id (catches a missing tab named by another's name)", () => {
  expect(tabName(tabs, tabOf(tabs[1]))).toBe("Compare 2");
  expect(tabName(tabs.slice(1), tabOf(ENTRY))).toBe(`Tab ${tabOf(ENTRY)}`);
});
