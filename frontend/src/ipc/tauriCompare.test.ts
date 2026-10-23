import { beforeEach, expect, test, vi } from "vitest";

import type * as Generated from "./bindings";
import { toColumnVersions, toTabList } from "./compareDomain";
import { createTauriCompareSource } from "./tauriCompare";

const commands = vi.hoisted(() => ({
  openCompare: vi.fn(),
  loadTab: vi.fn(),
  setColumn: vi.fn(),
  addTab: vi.fn(),
  closeTab: vi.fn(),
  renameTab: vi.fn(),
  setTabLanguage: vi.fn(),
  showTab: vi.fn(),
}));

vi.mock("./bindings", () => ({ commands }));

vi.mock("@tauri-apps/api/core", () => ({ Channel: class {} }));

const LIST: Generated.TabList = {
  tabs: [{ id: 2, name: "Compare 1", language: { kind: "auto" }, holds_text: true }],
  shown: 2,
};

const DOMAIN_LIST = {
  tabs: [{ id: 2, name: "Compare 1", language: { kind: "auto" }, holdsText: true }],
  shown: 2,
};

const COMPARISON: Generated.Comparison = {
  versions: { left: 1, right: 5 },
  differences: [
    {
      left: { start: 0, len: 1 },
      right: { start: 0, len: 2 },
      words: {
        left: { changed: [{ line: 0, start: 1, len: 2 }], removals: [] },
        right: { changed: [], removals: [{ at: { line: 1, column: 0 }, text: "y" }] },
      },
    },
  ],
};

const UNKNOWN: Generated.IpcError = { kind: "UnknownTab", tab: 9 };

beforeEach(() => {
  vi.resetAllMocks();
});

test("openCompare and loadTab turn the app's replies into domain data", async () => {
  commands.openCompare.mockResolvedValue({
    status: "ok",
    data: { list: LIST, column_limit: 8_388_608 },
  });
  commands.loadTab.mockResolvedValue({
    status: "ok",
    data: { left: "a\n", right: "b\nc\n", comparison: COMPARISON },
  });
  const source = createTauriCompareSource();
  const tab = toTabList(LIST).shown;

  expect(await source.openCompare()).toEqual({
    ok: true,
    value: { list: DOMAIN_LIST, columnLimit: 8_388_608 },
  });
  expect(await source.loadTab(tab)).toEqual({
    ok: true,
    value: { left: "a\n", right: "b\nc\n", comparison: COMPARISON },
  });
  expect(commands.loadTab).toHaveBeenCalledWith(2);
});

test("setColumn sends the tab, column, text and version and returns the comparison", async () => {
  commands.setColumn.mockResolvedValue({ status: "ok", data: COMPARISON });
  const tab = toTabList(LIST).shown;
  const version = toColumnVersions({ left: 3, right: 0 }).left;

  const reply = await createTauriCompareSource().setColumn({
    tab,
    column: "right",
    text: "b\n",
    version,
  });

  expect(reply).toEqual({ ok: true, value: COMPARISON });
  expect(commands.setColumn).toHaveBeenCalledWith(2, "right", "b\n", 3);
});

test("each tab command returns the list in domain data, or the app's error unchanged", async () => {
  const tab = toTabList(LIST).shown;
  const source = createTauriCompareSource();
  for (const command of [
    commands.addTab,
    commands.closeTab,
    commands.renameTab,
    commands.setTabLanguage,
    commands.showTab,
  ]) {
    command.mockResolvedValueOnce({ status: "ok", data: LIST });
    command.mockResolvedValueOnce({ status: "error", error: UNKNOWN });
  }

  for (let round = 0; round < 2; round += 1) {
    const expected =
      round === 0 ? { ok: true, value: DOMAIN_LIST } : { ok: false, failure: UNKNOWN };
    expect(await source.addTab()).toEqual(expected);
    expect(await source.closeTab(tab)).toEqual(expected);
    expect(await source.renameTab(tab, "x")).toEqual(expected);
    expect(await source.setTabLanguage(tab, { kind: "picked", name: "JSON" })).toEqual(expected);
    expect(await source.showTab(tab)).toEqual(expected);
  }
  expect(commands.renameTab).toHaveBeenCalledWith(2, "x");
  expect(commands.setTabLanguage).toHaveBeenCalledWith(2, { kind: "picked", name: "JSON" });
});

test("a reply with a fractional tab id is refused, naming the field", async () => {
  commands.showTab.mockResolvedValue({ status: "ok", data: { ...LIST, shown: 1.5 } });

  await expect(createTauriCompareSource().showTab(toTabList(LIST).shown)).rejects.toThrow(
    "shown must be a non-negative safe integer, got 1.5",
  );
});

test("a string error from Tauri's IPC layer rejects the call with that message", async () => {
  commands.openCompare.mockResolvedValue({ status: "error", error: "open_compare not allowed" });

  await expect(createTauriCompareSource().openCompare()).rejects.toThrow(
    new Error("open_compare not allowed"),
  );
});
