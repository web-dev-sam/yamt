import { beforeEach, expect, test, vi } from "vitest";

import type * as Generated from "./bindings";
import type { DiskVersion, StoredSettings } from "./domain";
import { createTauriServerHost, createTauriSource, forwardLog } from "./tauri";

const commands = vi.hoisted(() => ({
  loadFile: vi.fn(),
  finishFile: vi.fn(),
  saveFile: vi.fn(),
  resetFile: vi.fn(),
  describeFile: vi.fn(),
  takeSide: vi.fn(),
  listStop: vi.fn(),
  continueOperation: vi.fn(),
  abortOperation: vi.fn(),
  log: vi.fn(),
  loadSettings: vi.fn(),
  setTheme: vi.fn(),
  setAntialiasing: vi.fn(),
  setKeys: vi.fn(),
  moveSettings: vi.fn(),
  setServerAnswer: vi.fn(),
  setServerSwitch: vi.fn(),
  setAddedServers: vi.fn(),
  serversContext: vi.fn(),
  startServer: vi.fn(),
  sendToServer: vi.fn(),
  stopServer: vi.fn(),
  findProgram: vi.fn(),
  projectFiles: vi.fn(),
}));

vi.mock("./bindings", () => ({ commands }));

vi.mock("@tauri-apps/api/core", () => ({
  Channel: class {
    readonly onmessage: (message: unknown) => void;

    constructor(onmessage: (message: unknown) => void) {
      this.onmessage = onmessage;
    }
  },
}));

const LINE = { start: 0, len: 1 };

const MARKERS: Generated.Waiting = {
  kind: "Markers",
  open: "<<<<<<< ours",
  first: "local",
  between: ["||||||| base", "b", "======="],
  close: ">>>>>>> theirs",
};

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
        local: { changed: [{ line: 0, start: 0, len: 1 }], removals: [] },
        remote: { changed: [], removals: [{ at: { line: 0, column: 1 }, text: ";" }] },
      },
      waiting: MARKERS,
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

test("a string error from listStop rejects the call with that message", async () => {
  commands.listStop.mockResolvedValue({ status: "error", error: "list_stop not allowed" });

  await expect(createTauriSource().listStop()).rejects.toThrow(new Error("list_stop not allowed"));
});

test("listStop turns the app's files list into domain data and passes MovedOn and a failure on", async () => {
  const operation: Generated.OperationView = {
    kind: "Rebase",
    branch: "feature",
    onto: { kind: "Branch", name: "main" },
    replaying: null,
    progress: { step: 2, total: 3 },
    editor_steps_ahead: false,
  };
  const sides: Generated.SideNames = { local: null, remote: { kind: "Branch", name: "main" } };
  const files: Generated.FileEntry[] = [{ path: "a.ts", status: "Unresolved", unsupported: null }];
  const change: Generated.DiskChange = { path: "a.ts", result: { kind: "Staged" } };
  const listing = { kind: "Files", files, disk_changes: [change], operation, sides };
  const running: Generated.IpcError = { kind: "GitRunning" };
  commands.listStop.mockResolvedValueOnce({ status: "ok", data: listing });
  commands.listStop.mockResolvedValueOnce({ status: "ok", data: { kind: "MovedOn" } });
  commands.listStop.mockResolvedValueOnce({ status: "error", error: running });
  const source = createTauriSource();

  expect(await source.listStop()).toEqual({
    ok: true,
    value: { kind: "Files", files, diskChanges: [change], operation, sides },
  });
  expect(await source.listStop()).toEqual({ ok: true, value: { kind: "MovedOn" } });
  expect(await source.listStop()).toEqual({ ok: false, failure: running });
});

test("continueOperation answers Finished or Stopped with git's message, and a failure unchanged", async () => {
  const stopped: Generated.ContinueReply = { kind: "Stopped", message: "CONFLICT in b.ts" };
  const refused: Generated.IpcError = { kind: "Git", message: "b.ts: needs merge" };
  commands.continueOperation.mockResolvedValueOnce({ status: "ok", data: stopped });
  commands.continueOperation.mockResolvedValueOnce({ status: "ok", data: { kind: "Finished" } });
  commands.continueOperation.mockResolvedValueOnce({ status: "error", error: refused });
  const source = createTauriSource();

  expect(await source.continueOperation()).toEqual({ ok: true, value: stopped });
  expect(await source.continueOperation()).toEqual({ ok: true, value: { kind: "Finished" } });
  expect(await source.continueOperation()).toEqual({ ok: false, failure: refused });
});

test("abortOperation answers null, and a moved-on stop or no operation as the failure unchanged", async () => {
  const movedOn: Generated.IpcError = { kind: "StopMovedOn" };
  const none: Generated.IpcError = { kind: "NoOperation" };
  commands.abortOperation.mockResolvedValueOnce({ status: "ok", data: null });
  commands.abortOperation.mockResolvedValueOnce({ status: "error", error: movedOn });
  commands.abortOperation.mockResolvedValueOnce({ status: "error", error: none });
  const source = createTauriSource();

  expect(await source.abortOperation()).toEqual({ ok: true, value: null });
  expect(await source.abortOperation()).toEqual({ ok: false, failure: movedOn });
  expect(await source.abortOperation()).toEqual({ ok: false, failure: none });
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
            local: { changed: [{ line: 0, start: 0, len: 1 }], removals: [] },
            remote: { changed: [], removals: [{ at: { line: 0, column: 1 }, text: ";" }] },
          },
          waiting: MARKERS,
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

test("saveFile sends its three arguments and returns the reply or the app's error", async () => {
  const version = await versionOfLoaded();
  const failed: Generated.IpcError = {
    kind: "WriteFailed",
    path: "src/a.ts",
    message: "disk full",
  };
  commands.saveFile.mockResolvedValueOnce({ status: "ok", data: WRITTEN });
  commands.saveFile.mockResolvedValueOnce({ status: "error", error: failed });
  const source = createTauriSource();

  expect(
    await source.saveFile({ path: "src/a.ts", text: "saved\r\n", diskVersion: version }),
  ).toEqual({ ok: true, value: WRITTEN });
  expect(await source.saveFile({ path: "src/a.ts", text: "x", diskVersion: version })).toEqual({
    ok: false,
    failure: failed,
  });
  expect(commands.saveFile).toHaveBeenNthCalledWith(1, "src/a.ts", "saved\r\n", 2);
  expect(commands.finishFile).not.toHaveBeenCalled();
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

const STORED: StoredSettings = {
  theme: "light",
  antialiasing: "subpixel",
  keys: { undo: ["Alt-Backspace"] },
  languageServers: { repositories: { "/home/me/yamt": "start" }, off: {}, added: [] },
};
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

test("the five settings commands send their arguments and return the read with its default path", async () => {
  for (const command of [
    commands.loadSettings,
    commands.setTheme,
    commands.setAntialiasing,
    commands.setKeys,
    commands.moveSettings,
  ]) {
    command.mockResolvedValue({ status: "ok", data: SETTINGS_DTO });
  }
  const source = createTauriSource();
  const changes = [{ action: "undo", keys: null }];

  expect(await source.loadSettings(STORED)).toEqual({ ok: true, value: SETTINGS_READ });
  expect(await source.setTheme(STORED, "dark")).toEqual({ ok: true, value: SETTINGS_READ });
  expect(await source.setAntialiasing(STORED, "greyscale")).toEqual({
    ok: true,
    value: SETTINGS_READ,
  });
  expect(await source.setKeys(STORED, changes)).toEqual({ ok: true, value: SETTINGS_READ });
  expect(await source.moveSettings(STORED, "~/s.json")).toEqual({ ok: true, value: SETTINGS_READ });
  expect(commands.loadSettings).toHaveBeenCalledWith(STORED);
  expect(commands.setTheme).toHaveBeenCalledWith(STORED, "dark");
  expect(commands.setAntialiasing).toHaveBeenCalledWith(STORED, "greyscale");
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

test("a read without off has nothing switched off; one with off keeps it", async () => {
  const old: Generated.SettingsRead = {
    ...SETTINGS_DTO,
    stored: { ...STORED, languageServers: { repositories: {}, added: [] } },
  };
  const off = { "/home/me/yamt": ["oxlint (repository root)"] };
  const switched: Generated.SettingsRead = {
    ...SETTINGS_DTO,
    stored: { ...STORED, languageServers: { ...STORED.languageServers, off } },
  };
  commands.loadSettings.mockResolvedValueOnce({ status: "ok", data: old });
  commands.loadSettings.mockResolvedValueOnce({ status: "ok", data: switched });
  const source = createTauriSource();

  const first = await source.loadSettings(STORED);
  const second = await source.loadSettings(STORED);

  expect(first.ok && first.value.stored.languageServers.off).toEqual({});
  expect(second.ok && second.value.stored.languageServers.off).toEqual(off);
});

test("setServerAnswer and setAddedServers send their arguments and return the read", async () => {
  commands.setServerAnswer.mockResolvedValue({ status: "ok", data: SETTINGS_DTO });
  commands.setAddedServers.mockResolvedValue({ status: "ok", data: SETTINGS_DTO });
  const source = createTauriSource();
  const added = [{ command: ["taplo", "lsp", "stdio"], fileTypes: ["toml"] }];

  expect(await source.setServerAnswer(STORED, "dontStart")).toEqual({
    ok: true,
    value: SETTINGS_READ,
  });
  expect(await source.setServerAnswer(STORED, null)).toEqual({ ok: true, value: SETTINGS_READ });
  expect(await source.setAddedServers(STORED, added)).toEqual({ ok: true, value: SETTINGS_READ });
  expect(commands.setServerAnswer.mock.calls).toEqual([
    [STORED, "dontStart"],
    [STORED, null],
  ]);
  expect(commands.setAddedServers).toHaveBeenCalledWith(STORED, added);
});

test("setServerAnswer and setAddedServers return the app's error", async () => {
  const broken = { kind: "SettingsBroken", path: SETTINGS_DTO.path, message: "x" };
  commands.setServerAnswer.mockResolvedValue({ status: "error", error: broken });
  commands.setAddedServers.mockResolvedValue({ status: "error", error: broken });
  const source = createTauriSource();

  expect(await source.setServerAnswer(STORED, "start")).toEqual({ ok: false, failure: broken });
  expect(await source.setAddedServers(STORED, [])).toEqual({ ok: false, failure: broken });
});

test("setServerSwitch sends the settings in use, the server and on, and returns the read", async () => {
  const switched: Generated.SettingsRead = {
    ...SETTINGS_DTO,
    stored: {
      ...STORED,
      languageServers: {
        ...STORED.languageServers,
        off: { "/home/me/yamt": ["oxlint (repository root)"] },
      },
    },
  };
  commands.setServerSwitch.mockResolvedValue({ status: "ok", data: switched });
  const source = createTauriSource();

  expect(await source.setServerSwitch(STORED, "oxlint (repository root)", false)).toEqual({
    ok: true,
    value: { ...SETTINGS_READ, stored: switched.stored },
  });
  expect(await source.setServerSwitch(STORED, "oxfmt (repository root)", true)).toEqual({
    ok: true,
    value: { ...SETTINGS_READ, stored: switched.stored },
  });
  expect(commands.setServerSwitch.mock.calls).toEqual([
    [STORED, "oxlint (repository root)", false],
    [STORED, "oxfmt (repository root)", true],
  ]);
});

test("setServerSwitch returns the app's error", async () => {
  const broken = { kind: "SettingsBroken", path: SETTINGS_DTO.path, message: "x" };
  commands.setServerSwitch.mockResolvedValue({ status: "error", error: broken });

  expect(await createTauriSource().setServerSwitch(STORED, "oxlint", false)).toEqual({
    ok: false,
    failure: broken,
  });
});

type ChannelLike = { readonly onmessage: (event: Generated.HostEvent) => void };

test("the server host starts a run with a channel whose messages reach onEvent, branding the run", async () => {
  const channels: ChannelLike[] = [];
  commands.startServer.mockImplementation(
    (_: Generated.ServerCommand, events: ChannelLike): Promise<Generated.StartReply> => {
      channels.push(events);
      return Promise.resolve({ kind: "Started", run: 7 });
    },
  );
  const heard: Generated.HostEvent[] = [];
  const folders = { project: ["node_modules/.bin"], home: ["go/bin"] };
  const command = { program: "oxlint", args: ["--lsp"], project: "frontend", folders };

  const reply = await createTauriServerHost().start(command, (event) => heard.push(event));
  channels[0]?.onmessage({ kind: "Message", text: "{}" });
  channels[0]?.onmessage({ kind: "Exited", code: 0 });

  expect(reply).toEqual({ kind: "Started", run: 7 });
  expect(commands.startServer).toHaveBeenCalledWith(command, channels[0]);
  expect(heard).toEqual([
    { kind: "Message", text: "{}" },
    { kind: "Exited", code: 0 },
  ]);
});

test("the server host passes a refused start through and rejects a run id that is not one", async () => {
  const notFound = {
    kind: "NotFound",
    program: "oxlint",
    searched: ["frontend/node_modules/.bin"],
  };
  commands.startServer.mockResolvedValueOnce(notFound);
  commands.startServer.mockResolvedValueOnce({ kind: "Started", run: -1 });
  const host = createTauriServerHost();
  const command = { program: "oxlint", args: [], project: "", folders: { project: [], home: [] } };

  expect(await host.start(command, () => undefined)).toEqual(notFound);
  await expect(host.start(command, () => undefined)).rejects.toThrow("run");
});

test("the server host maps send, stop, context, findProgram and projectFiles onto the commands", async () => {
  const context = { root: "/repo", process_id: 42 };
  const found = { kind: "Found", path: "/repo/node_modules/.bin/oxlint", place: "Project" };
  const files = [{ kind: "Missing" }, { kind: "Text", text: "{}" }];
  commands.sendToServer.mockResolvedValue(undefined);
  commands.stopServer.mockResolvedValue(undefined);
  commands.serversContext.mockResolvedValue(context);
  commands.findProgram.mockResolvedValue(found);
  commands.projectFiles.mockResolvedValue(files);
  commands.startServer.mockResolvedValue({ kind: "Started", run: 3 });
  const host = createTauriServerHost();
  const noFolders = { project: [], home: [] };
  const reply = await host.start(
    { program: "a", args: [], project: "", folders: noFolders },
    () => undefined,
  );
  if (reply.kind !== "Started") {
    throw new Error("not started");
  }

  host.send(reply.run, '{"id":1}');
  await host.stop(reply.run);

  expect(commands.sendToServer).toHaveBeenCalledWith(3, '{"id":1}');
  expect(commands.stopServer).toHaveBeenCalledWith(3);
  expect(await host.context()).toEqual(context);
  const folders = { project: ["node_modules/.bin"], home: [".local/bin"] };
  expect(await host.findProgram("oxlint", "frontend", folders)).toEqual(found);
  expect(commands.findProgram).toHaveBeenCalledWith("oxlint", "frontend", folders);
  expect(await host.projectFiles(["a", "package.json"])).toEqual(files);
  expect(commands.projectFiles).toHaveBeenCalledWith(["a", "package.json"]);
});
