import { beforeEach, expect, test, vi } from "vitest";

import type * as Generated from "./bindings";
import { createTauriSource, forwardLog } from "./tauri";

const commands = vi.hoisted(() => ({
  listFiles: vi.fn(),
  loadFile: vi.fn(),
  finishFile: vi.fn(),
  resetFile: vi.fn(),
  describeFile: vi.fn(),
  takeSide: vi.fn(),
  remoteName: vi.fn(),
  log: vi.fn(),
}));

vi.mock("./bindings", () => ({ commands }));

const LINE = { start: 0, len: 1 };

const DTO: Generated.FileMergeData = {
  path: "src/a.ts",
  base: "b\n",
  local: "l\n",
  remote: "r\n",
  deleted: "local",
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

test("listFiles returns the app's entries and its failure unchanged", async () => {
  const git: Generated.IpcError = { kind: "Git", message: "git ls-files failed" };
  commands.listFiles.mockResolvedValueOnce({ status: "ok", data: ENTRIES });
  commands.listFiles.mockResolvedValueOnce({ status: "error", error: git });
  const source = createTauriSource();

  expect(await source.listFiles()).toEqual({ ok: true, value: ENTRIES });
  expect(await source.listFiles()).toEqual({ ok: false, failure: git });
});

test("a string error from listFiles rejects the call with that message", async () => {
  commands.listFiles.mockResolvedValue({ status: "error", error: "list_files not allowed" });

  await expect(createTauriSource().listFiles()).rejects.toThrow(
    new Error("list_files not allowed"),
  );
});

test("remoteName returns the app's answer", async () => {
  const name: Generated.RemoteName = {
    kind: "Commit",
    short_id: "1a2b3c4",
    subject: "Fix parser crash",
    message: "Fix parser crash\n\nThe lexer read past the end.",
  };
  commands.remoteName.mockResolvedValueOnce(name);
  commands.remoteName.mockResolvedValueOnce(null);
  const source = createTauriSource();

  expect(await source.remoteName()).toEqual(name);
  expect(await source.remoteName()).toBeNull();
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
      deleted: "local",
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
  commands.describeFile.mockResolvedValue({ status: "error", error: unknown });
  commands.takeSide.mockResolvedValue({ status: "error", error: git });
  const source = createTauriSource();

  expect(await source.loadFile("logo.bin")).toEqual({ ok: false, failure: unsupported });
  expect(await source.finishFile("src/a.ts", "text")).toEqual({ ok: false, failure: git });
  expect(await source.resetFile("x.ts")).toEqual({ ok: false, failure: unknown });
  expect(await source.describeFile("x.ts")).toEqual({ ok: false, failure: unknown });
  expect(await source.takeSide("logo.bin", "local")).toEqual({ ok: false, failure: git });
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

test("describeFile and takeSide send their arguments and return the app's answer", async () => {
  const sides: Generated.FileSides = {
    path: "logo.bin",
    reason: "Binary",
    local: { kind: "Binary", bytes: 12 },
    remote: { kind: "Missing" },
  };
  commands.describeFile.mockResolvedValue({ status: "ok", data: sides });
  commands.takeSide.mockResolvedValue({ status: "ok", data: ENTRIES });
  const source = createTauriSource();

  expect(await source.describeFile("logo.bin")).toEqual({ ok: true, value: sides });
  expect(await source.takeSide("logo.bin", "remote")).toEqual({ ok: true, value: ENTRIES });
  expect(commands.describeFile).toHaveBeenCalledWith("logo.bin");
  expect(commands.takeSide).toHaveBeenCalledWith("logo.bin", "remote");
});

test("a rejected command rejects the call", async () => {
  commands.loadFile.mockRejectedValue(new Error("ipc down"));

  await expect(createTauriSource().loadFile("src/a.ts")).rejects.toThrow("ipc down");
});

test("a string error from Tauri's IPC layer rejects the call with that message", async () => {
  commands.finishFile.mockResolvedValue({ status: "error", error: "finish_file not allowed" });

  await expect(createTauriSource().finishFile("src/a.ts", "text")).rejects.toThrow(
    new Error("finish_file not allowed"),
  );
});

test("a string error from describeFile or takeSide rejects the call with that message", async () => {
  commands.describeFile.mockResolvedValue({ status: "error", error: "describe_file not allowed" });
  commands.takeSide.mockResolvedValue({ status: "error", error: "take_side not allowed" });
  const source = createTauriSource();

  await expect(source.describeFile("logo.bin")).rejects.toThrow(
    new Error("describe_file not allowed"),
  );
  await expect(source.takeSide("logo.bin", "local")).rejects.toThrow(
    new Error("take_side not allowed"),
  );
});

test.each([null, 404])("a %s error from Tauri's IPC layer rejects the call", async (error) => {
  commands.resetFile.mockResolvedValue({ status: "error", error });

  await expect(createTauriSource().resetFile("src/a.ts")).rejects.toThrow(new Error(String(error)));
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
