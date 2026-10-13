import { beforeEach, expect, test, vi } from "vitest";

import type * as Generated from "./bindings";
import type { DiskVersion } from "./domain";
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
  loadSettings: vi.fn(),
  setTheme: vi.fn(),
  setKeys: vi.fn(),
  moveSettings: vi.fn(),
}));

vi.mock("./bindings", () => ({ commands }));

const LINE = { start: 0, len: 1 };

const DTO: Generated.FileMergeData = {
  path: "src/a.ts",
  middle: { kind: "Disk", text: "m\n" },
  local: "l\n",
  remote: "r\n",
  deleted: "local",
  eol: "CrLf",
  disk_version: 2,
  chunks: [
    {
      chunk: { id: 0, kind: "Conflict", base: { start: 3, len: 2 }, local: LINE, remote: LINE },
      middle: LINE,
      words: {
        chunk: 0,
        local: { changed: [{ line: 0, start: 0, len: 1 }], removed_at: [] },
        remote: { changed: [], removed_at: [{ line: 0, column: 1 }] },
      },
    },
  ],
};

const ENTRIES: Generated.FileEntry[] = [
  { path: "src/a.ts", status: "Resolved", unsupported: null },
  { path: "logo.bin", status: "Unresolved", unsupported: "Binary" },
];

const CHANGE: Generated.DiskChange = {
  path: "src/a.ts",
  result: { kind: "MarkersLeft", conflicts: 2 },
};

const WRITTEN: Generated.WriteReply = { kind: "Written", files: ENTRIES };

const CHANGED: Generated.WriteReply = { kind: "ChangedOnDisk", files: ENTRIES, change: CHANGE };

async function versionOfLoaded(): Promise<DiskVersion> {
  commands.loadFile.mockResolvedValueOnce({ status: "ok", data: DTO });
  const loaded = await createTauriSource().loadFile("src/a.ts");
  if (!loaded.ok) {
    throw new Error("expected the DTO to load");
  }
  return loaded.value.diskVersion;
}

beforeEach(() => {
  vi.resetAllMocks();
});

test("listFiles returns the app's entries and disk changes, and its failure unchanged", async () => {
  const git: Generated.IpcError = { kind: "Git", message: "git ls-files failed" };
  commands.listFiles.mockResolvedValueOnce({
    status: "ok",
    data: { files: ENTRIES, disk_changes: [CHANGE] },
  });
  commands.listFiles.mockResolvedValueOnce({ status: "error", error: git });
  const source = createTauriSource();

  expect(await source.listFiles()).toEqual({
    ok: true,
    value: { files: ENTRIES, diskChanges: [CHANGE] },
  });
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

test("loadFile turns the app's data into domain data: the middle range, not base", async () => {
  commands.loadFile.mockResolvedValue({ status: "ok", data: DTO });

  const result = await createTauriSource().loadFile("src/a.ts");

  expect(commands.loadFile).toHaveBeenCalledWith("src/a.ts");
  expect(result).toEqual({
    ok: true,
    value: {
      path: "src/a.ts",
      middle: { kind: "Disk", text: "m\n" },
      local: "l\n",
      remote: "r\n",
      deleted: "local",
      eol: "CrLf",
      diskVersion: 2,
      chunks: [
        {
          id: 0,
          kind: "Conflict",
          middle: LINE,
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

test("loadFile rejects data whose chunk has a negative middle line, naming the field", async () => {
  const [merged] = DTO.chunks;
  if (merged === undefined) {
    throw new Error("the DTO lost its chunk");
  }
  commands.loadFile.mockResolvedValue({
    status: "ok",
    data: { ...DTO, chunks: [{ ...merged, middle: { start: -1, len: 1 } }] },
  });

  await expect(createTauriSource().loadFile("src/a.ts")).rejects.toThrow(
    "chunks[0].middle.start must be a non-negative safe integer, got -1",
  );
});

test("each command's error arrives as the failure, unchanged", async () => {
  const version = await versionOfLoaded();
  const unsupported: Generated.IpcError = {
    kind: "Unsupported",
    path: "logo.bin",
    reason: "Binary",
  };
  const git: Generated.IpcError = { kind: "Git", message: "git add failed" };
  const unknown: Generated.IpcError = { kind: "UnknownPath", path: "x.ts" };
  const notAFile: Generated.IpcError = { kind: "NotAFile", path: "src/a.ts" };
  const readFailed: Generated.IpcError = {
    kind: "ReadFailed",
    path: "src/a.ts",
    message: "permission denied",
  };
  commands.loadFile.mockResolvedValue({ status: "error", error: unsupported });
  commands.finishFile.mockResolvedValueOnce({ status: "error", error: notAFile });
  commands.finishFile.mockResolvedValueOnce({ status: "error", error: readFailed });
  commands.resetFile.mockResolvedValue({ status: "error", error: unknown });
  commands.describeFile.mockResolvedValue({ status: "error", error: unknown });
  commands.takeSide.mockResolvedValue({ status: "error", error: git });
  const source = createTauriSource();

  expect(await source.loadFile("logo.bin")).toEqual({ ok: false, failure: unsupported });
  expect(await source.finishFile({ path: "src/a.ts", text: "text", diskVersion: version })).toEqual(
    {
      ok: false,
      failure: notAFile,
    },
  );
  expect(await source.finishFile({ path: "src/a.ts", text: "text", diskVersion: version })).toEqual(
    {
      ok: false,
      failure: readFailed,
    },
  );
  expect(await source.resetFile("x.ts", version)).toEqual({ ok: false, failure: unknown });
  expect(await source.describeFile("x.ts")).toEqual({ ok: false, failure: unknown });
  expect(await source.takeSide("logo.bin", "local", version)).toEqual({
    ok: false,
    failure: git,
  });
});

test("finishFile and resetFile send their arguments with the disk version and return the reply", async () => {
  const version = await versionOfLoaded();
  commands.finishFile.mockResolvedValue({ status: "ok", data: CHANGED });
  commands.resetFile.mockResolvedValue({ status: "ok", data: WRITTEN });
  const source = createTauriSource();

  expect(
    await source.finishFile({ path: "src/a.ts", text: "merged\r\n", diskVersion: version }),
  ).toEqual({
    ok: true,
    value: CHANGED,
  });
  expect(await source.resetFile("src/a.ts", version)).toEqual({ ok: true, value: WRITTEN });
  expect(commands.finishFile).toHaveBeenCalledWith("src/a.ts", "merged\r\n", 2);
  expect(commands.resetFile).toHaveBeenCalledWith("src/a.ts", 2);
});

test("describeFile and takeSide send their arguments and return the app's answer", async () => {
  const version = await versionOfLoaded();
  const sides: Generated.FileSides = {
    path: "logo.bin",
    reason: "Binary",
    local: { kind: "Binary", bytes: 12 },
    remote: { kind: "Missing" },
    disk_version: 4,
  };
  commands.describeFile.mockResolvedValue({ status: "ok", data: sides });
  commands.takeSide.mockResolvedValue({ status: "ok", data: WRITTEN });
  const source = createTauriSource();

  expect(await source.describeFile("logo.bin")).toEqual({
    ok: true,
    value: {
      path: "logo.bin",
      reason: "Binary",
      local: { kind: "Binary", bytes: 12 },
      remote: { kind: "Missing" },
      diskVersion: 4,
    },
  });
  expect(await source.takeSide("logo.bin", "remote", version)).toEqual({
    ok: true,
    value: WRITTEN,
  });
  expect(commands.describeFile).toHaveBeenCalledWith("logo.bin");
  expect(commands.takeSide).toHaveBeenCalledWith("logo.bin", "remote", 2);
});

test("a rejected command rejects the call", async () => {
  commands.loadFile.mockRejectedValue(new Error("ipc down"));

  await expect(createTauriSource().loadFile("src/a.ts")).rejects.toThrow("ipc down");
});

test("a string error from Tauri's IPC layer rejects the call with that message", async () => {
  const version = await versionOfLoaded();
  commands.finishFile.mockResolvedValue({ status: "error", error: "finish_file not allowed" });

  await expect(
    createTauriSource().finishFile({ path: "src/a.ts", text: "text", diskVersion: version }),
  ).rejects.toThrow(new Error("finish_file not allowed"));
});

test("a string error from describeFile or takeSide rejects the call with that message", async () => {
  const version = await versionOfLoaded();
  commands.describeFile.mockResolvedValue({ status: "error", error: "describe_file not allowed" });
  commands.takeSide.mockResolvedValue({ status: "error", error: "take_side not allowed" });
  const source = createTauriSource();

  await expect(source.describeFile("logo.bin")).rejects.toThrow(
    new Error("describe_file not allowed"),
  );
  await expect(source.takeSide("logo.bin", "local", version)).rejects.toThrow(
    new Error("take_side not allowed"),
  );
});

test.each([null, 404])("a %s error from Tauri's IPC layer rejects the call", async (error) => {
  const version = await versionOfLoaded();
  commands.resetFile.mockResolvedValue({ status: "error", error });

  await expect(createTauriSource().resetFile("src/a.ts", version)).rejects.toThrow(
    new Error(String(error)),
  );
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

const STORED: Generated.StoredSettings = { theme: "light", keys: { undo: ["Alt-Backspace"] } };
const SETTINGS_DTO: Generated.SettingsRead = {
  path: "/home/me/.config/yamt/settings.json",
  default_path: "/home/me/.config/yamt/settings.json",
  stored: STORED,
};
const SETTINGS_READ = {
  path: SETTINGS_DTO.path,
  defaultPath: SETTINGS_DTO.default_path,
  stored: STORED,
};

test("the four settings commands send their arguments and return the read with its default path", async () => {
  for (const command of [
    commands.loadSettings,
    commands.setTheme,
    commands.setKeys,
    commands.moveSettings,
  ]) {
    command.mockResolvedValue({ status: "ok", data: SETTINGS_DTO });
  }
  const source = createTauriSource();
  const changes = [{ action: "undo", keys: null }];

  expect(await source.loadSettings(STORED)).toEqual({ ok: true, value: SETTINGS_READ });
  expect(await source.setTheme(STORED, "dark")).toEqual({ ok: true, value: SETTINGS_READ });
  expect(await source.setKeys(STORED, changes)).toEqual({ ok: true, value: SETTINGS_READ });
  expect(await source.moveSettings(STORED, "~/s.json")).toEqual({ ok: true, value: SETTINGS_READ });
  expect(commands.loadSettings).toHaveBeenCalledWith(STORED);
  expect(commands.setTheme).toHaveBeenCalledWith(STORED, "dark");
  expect(commands.setKeys).toHaveBeenCalledWith(STORED, changes);
  expect(commands.moveSettings).toHaveBeenCalledWith(STORED, "~/s.json");
});

test("a settings failure comes back as the app's error", async () => {
  const broken = {
    kind: "SettingsBroken",
    path: SETTINGS_DTO.path,
    message: "x at line 3 column 7",
  };
  commands.loadSettings.mockResolvedValue({ status: "error", error: broken });

  expect(await createTauriSource().loadSettings(STORED)).toEqual({ ok: false, failure: broken });
});
