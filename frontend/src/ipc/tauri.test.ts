import { beforeEach, expect, test, vi } from "vitest";

import type * as Generated from "./bindings";
import { createTauriSource, forwardLog } from "./tauri";

const commands = vi.hoisted(() => ({
  listFiles: vi.fn(),
  loadFile: vi.fn(),
  finishFile: vi.fn(),
  resetFile: vi.fn(),
  log: vi.fn(),
}));

vi.mock("./bindings", () => ({ commands }));

const LINE = { start: 0, len: 1 };

const DTO: Generated.FileMergeData = {
  path: "src/a.ts",
  base: "b\n",
  local: "l\n",
  remote: "r\n",
  eol: "CrLf",
  chunks: [{ id: 0, kind: "Conflict", base: LINE, local: LINE, remote: LINE }],
  word_changes: [
    {
      chunk: 0,
      local: { changed: [{ line: 0, start: 0, len: 1 }], removed_at: [] },
      remote: { changed: [], removed_at: [{ line: 0, column: 1 }] },
    },
  ],
};

const ENTRIES: Generated.FileEntry[] = [
  { path: "src/a.ts", status: "Resolved", unsupported: null },
  { path: "logo.bin", status: "Unresolved", unsupported: "Binary" },
];

beforeEach(() => {
  vi.resetAllMocks();
});

test("listFiles returns the app's entries", async () => {
  commands.listFiles.mockResolvedValue(ENTRIES);

  expect(await createTauriSource().listFiles()).toEqual(ENTRIES);
});

test("loadFile turns the app's data into domain data", async () => {
  commands.loadFile.mockResolvedValue({ status: "ok", data: DTO });

  const result = await createTauriSource().loadFile("src/a.ts");

  expect(commands.loadFile).toHaveBeenCalledWith("src/a.ts");
  expect(result).toEqual({
    ok: true,
    value: {
      path: "src/a.ts",
      base: "b\n",
      local: "l\n",
      remote: "r\n",
      eol: "CrLf",
      chunks: [
        {
          id: 0,
          kind: "Conflict",
          base: LINE,
          local: LINE,
          remote: LINE,
          words: {
            local: { changed: [{ line: 0, start: 0, len: 1 }], removedAt: [] },
            remote: { changed: [], removedAt: [{ line: 0, column: 1 }] },
          },
        },
      ],
    },
  });
});

test("each command's error arrives as the failure, unchanged", async () => {
  const unsupported: Generated.IpcError = {
    kind: "Unsupported",
    path: "logo.bin",
    reason: "Binary",
  };
  const git: Generated.IpcError = { kind: "Git", message: "git add failed" };
  const unknown: Generated.IpcError = { kind: "UnknownPath", path: "x.ts" };
  commands.loadFile.mockResolvedValue({ status: "error", error: unsupported });
  commands.finishFile.mockResolvedValue({ status: "error", error: git });
  commands.resetFile.mockResolvedValue({ status: "error", error: unknown });
  const source = createTauriSource();

  expect(await source.loadFile("logo.bin")).toEqual({ ok: false, failure: unsupported });
  expect(await source.finishFile("src/a.ts", "text")).toEqual({ ok: false, failure: git });
  expect(await source.resetFile("x.ts")).toEqual({ ok: false, failure: unknown });
});

test("finishFile and resetFile send their arguments and return the app's list", async () => {
  commands.finishFile.mockResolvedValue({ status: "ok", data: ENTRIES });
  commands.resetFile.mockResolvedValue({ status: "ok", data: ENTRIES });
  const source = createTauriSource();

  expect(await source.finishFile("src/a.ts", "merged\r\n")).toEqual({ ok: true, value: ENTRIES });
  expect(await source.resetFile("src/a.ts")).toEqual({ ok: true, value: ENTRIES });
  expect(commands.finishFile).toHaveBeenCalledWith("src/a.ts", "merged\r\n");
  expect(commands.resetFile).toHaveBeenCalledWith("src/a.ts");
});

test("a rejected command rejects the call", async () => {
  commands.loadFile.mockRejectedValue(new Error("ipc down"));

  await expect(createTauriSource().loadFile("src/a.ts")).rejects.toThrow("ipc down");
});

test("the forward stringifies non-finite numbers and keeps every other value", async () => {
  commands.log.mockResolvedValue(undefined);

  await forwardLog({
    level: "warn",
    event: "scroll.drift",
    fields: { nan: Number.NaN, up: Infinity, down: -Infinity, lines: 3.5, ok: true, name: "a" },
  });

  expect(commands.log).toHaveBeenCalledWith({
    level: "warn",
    event: "scroll.drift",
    fields: { nan: "NaN", up: "Infinity", down: "-Infinity", lines: 3.5, ok: true, name: "a" },
  });
});
