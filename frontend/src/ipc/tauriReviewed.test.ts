import { beforeEach, expect, test, vi } from "vitest";

import type * as Generated from "./bindings";
import { isRangeFileId, type RangeFileId } from "./domain";
import { createTauriReviewed } from "./tauriReviewed";

const commands = vi.hoisted(() => ({
  listReviewed: vi.fn(),
  markReviewed: vi.fn(),
  unmarkReviewed: vi.fn(),
  loadSinceReview: vi.fn(),
}));

vi.mock("./bindings", () => ({ commands }));

const FAILURE: Generated.IpcError = {
  kind: "WriteFailed",
  path: "/data/reviewed.json",
  message: "full",
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

test("listReviewed asks list_reviewed and turns its list into marks by file", async () => {
  commands.listReviewed.mockResolvedValue({
    status: "ok",
    data: [
      { file: 3, mark: "reviewed" },
      { file: 7, mark: "changedSinceReview" },
    ],
  });

  const listed = await createTauriReviewed().listReviewed();

  expect(listed).toEqual({
    ok: true,
    value: new Map([
      [3, "reviewed"],
      [7, "changedSinceReview"],
    ]),
  });
  expect(commands.listReviewed).toHaveBeenCalledWith();
});

test("markReviewed and unmarkReviewed send the file's id and answer null", async () => {
  commands.markReviewed.mockResolvedValue({ status: "ok", data: null });
  commands.unmarkReviewed.mockResolvedValue({ status: "ok", data: null });
  const source = createTauriReviewed();

  expect(await source.markReviewed(fileId(4))).toEqual({ ok: true, value: null });
  expect(await source.unmarkReviewed(fileId(5))).toEqual({ ok: true, value: null });
  expect(commands.markReviewed).toHaveBeenCalledWith(4);
  expect(commands.unmarkReviewed).toHaveBeenCalledWith(5);
});

test("loadSinceReview sends the file's id and converts the texts reply", async () => {
  const difference: Generated.Difference = {
    left: { start: 1, len: 0 },
    right: { start: 1, len: 1 },
    words: { left: { changed: [], removals: [] }, right: { changed: [], removals: [] } },
  };
  const texts = { kind: "texts", reviewed: "a\n", current: "a\nb\n", differences: [difference] };
  commands.loadSinceReview.mockResolvedValue({ status: "ok", data: texts });

  expect(await createTauriReviewed().loadSinceReview(fileId(6))).toEqual({
    ok: true,
    value: texts,
  });
  expect(commands.loadSinceReview).toHaveBeenCalledWith(6);

  commands.loadSinceReview.mockResolvedValue({
    status: "ok",
    data: { ...texts, differences: [{ ...difference, left: { start: -1, len: 0 } }] },
  });
  await expect(createTauriReviewed().loadSinceReview(fileId(6))).rejects.toThrow(
    "differences[0].left.start must be a non-negative safe integer, got -1",
  );
});

test("each command's failure comes back unchanged", async () => {
  for (const command of Object.values(commands)) {
    command.mockResolvedValue({ status: "error", error: FAILURE });
  }
  const source = createTauriReviewed();
  const failed = { ok: false, failure: FAILURE };

  expect(await source.listReviewed()).toEqual(failed);
  expect(await source.markReviewed(fileId(1))).toEqual(failed);
  expect(await source.unmarkReviewed(fileId(1))).toEqual(failed);
  expect(await source.loadSinceReview(fileId(1))).toEqual(failed);
});

test("a list naming a file twice is refused", async () => {
  commands.listReviewed.mockResolvedValue({
    status: "ok",
    data: [
      { file: 3, mark: "reviewed" },
      { file: 3, mark: "reviewed" },
    ],
  });

  await expect(createTauriReviewed().listReviewed()).rejects.toThrow("[1].file 3 is marked twice");
});
