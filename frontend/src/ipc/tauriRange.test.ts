import { beforeEach, expect, test, vi } from "vitest";

import type * as Generated from "./bindings";
import { isRangeFileId, type RangeFileId } from "./domain";
import { createTauriRangeSource } from "./tauriRange";

const commands = vi.hoisted(() => ({
  openRange: vi.fn(),
  loadRangeFile: vi.fn(),
  listThreads: vi.fn(),
}));

vi.mock("./bindings", () => ({ commands }));

vi.mock("@tauri-apps/api/core", () => ({ Channel: class {} }));

const START: Generated.RangeStart = {
  range: "main...feature",
  left: {
    label: { kind: "mergeBase", left: "main", right: "feature" },
    short_id: "1b2cfed",
    subject: "Start",
  },
  right: { label: { kind: "named", name: "feature" }, short_id: "2b3b4b5", subject: "Remind" },
  files: [
    {
      id: 0,
      path: "docs/keys.md",
      change: { kind: "renamed", old_path: "docs/shortcuts.md" },
      lines: { kind: "counted", added: 2, removed: 0 },
    },
  ],
};

const DIFFERENCE: Generated.Difference = {
  left: { start: 0, len: 1 },
  right: { start: 0, len: 2 },
  words: {
    left: { changed: [{ line: 0, start: 1, len: 2 }], removals: [] },
    right: { changed: [], removals: [{ at: { line: 1, column: 0 }, text: "y" }] },
  },
};

const TEXTS: Generated.RangeFile = {
  kind: "texts",
  left: "a\n",
  right: "b\nc\n",
  differences: [DIFFERENCE],
  mode: { kind: "changed", old: "file", new: "executable" },
};

function fileId(n: number): RangeFileId {
  if (!isRangeFileId(n)) {
    throw new Error(`${n} is no file id`);
  }
  return n;
}

beforeEach(() => {
  vi.resetAllMocks();
});

test("openRange and loadRangeFile turn the app's replies into domain data", async () => {
  commands.openRange.mockResolvedValue(START);
  commands.loadRangeFile.mockResolvedValue({ status: "ok", data: TEXTS });
  const source = createTauriRangeSource();

  expect(await source.openRange()).toEqual({
    ok: true,
    value: {
      range: "main...feature",
      left: {
        label: { kind: "mergeBase", left: "main", right: "feature" },
        shortId: "1b2cfed",
        subject: "Start",
      },
      right: { label: { kind: "named", name: "feature" }, shortId: "2b3b4b5", subject: "Remind" },
      files: [
        {
          id: 0,
          path: "docs/keys.md",
          change: { kind: "renamed", oldPath: "docs/shortcuts.md" },
          lines: { kind: "counted", added: 2, removed: 0 },
        },
      ],
    },
  });
  expect(await source.loadRangeFile(fileId(4))).toEqual({ ok: true, value: TEXTS });
  expect(commands.loadRangeFile).toHaveBeenCalledWith(4);
});

test("an UnknownRangeFile error comes back unchanged", async () => {
  const failure: Generated.IpcError = { kind: "UnknownRangeFile", file: 7 };
  commands.loadRangeFile.mockResolvedValue({ status: "error", error: failure });

  expect(await createTauriRangeSource().loadRangeFile(fileId(7))).toEqual({ ok: false, failure });
});

test("a texts reply with a negative difference line is refused, naming the field", async () => {
  commands.loadRangeFile.mockResolvedValue({
    status: "ok",
    data: { ...TEXTS, differences: [{ ...DIFFERENCE, left: { start: -1, len: 1 } }] },
  });

  await expect(createTauriRangeSource().loadRangeFile(fileId(0))).rejects.toThrow(
    "differences[0].left.start must be a non-negative safe integer, got -1",
  );
});

test("the range source answers listThreads through the app's command", async () => {
  commands.listThreads.mockResolvedValue({ status: "ok", data: { threads: [] } });

  expect(await createTauriRangeSource().listThreads()).toEqual({
    ok: true,
    value: { threads: [] },
  });
  expect(commands.listThreads).toHaveBeenCalledOnce();
});
