import { Channel } from "@tauri-apps/api/core";

import {
  commands,
  type HostEvent,
  type LogValue,
  type SettingsRead as SettingsReadDto,
} from "./bindings";
import type { ChunkSource, SettingsSource } from "./ChunkSource";
import {
  toDomain,
  toFileList,
  toSettingsRead,
  toSides,
  toStartReply,
  type SettingsRead,
  type SourceFailure,
  type SourceResult,
} from "./domain";
import type { LogEntry } from "./log";
import type { ServerHost } from "./ServerHost";

// `typedError` (bindings.ts) re-throws only `Error`s and returns any other rejection as the command's
// error. Tauri rejects invalid arguments, unknown commands and ACL denials with a plain JSON value, a
// string so far (tauri 2 `ipc/mod.rs` `InvokeError::from_error`, `webview/mod.rs` "not allowed by ACL").
type CommandResult<T> =
  | { status: "ok"; data: T }
  | { status: "error"; error: SourceFailure | string | number | boolean | null | undefined };

function toResult<T>(result: CommandResult<T>): SourceResult<T> {
  if (result.status === "ok") {
    return { ok: true, value: result.data };
  }
  if (typeof result.error !== "object" || result.error === null) {
    throw new Error(String(result.error));
  }
  return { ok: false, failure: result.error };
}

function toSettingsResult(result: CommandResult<SettingsReadDto>): SourceResult<SettingsRead> {
  const settings = toResult(result);
  return settings.ok ? { ok: true, value: toSettingsRead(settings.value) } : settings;
}

function createTauriSettings(): SettingsSource {
  return {
    async loadSettings(current) {
      return toSettingsResult(await commands.loadSettings(current));
    },
    async setTheme(current, theme) {
      return toSettingsResult(await commands.setTheme(current, theme));
    },
    async setAntialiasing(current, antialiasing) {
      return toSettingsResult(await commands.setAntialiasing(current, antialiasing));
    },
    async setKeys(current, changes) {
      return toSettingsResult(await commands.setKeys(current, [...changes]));
    },
    async moveSettings(current, path) {
      return toSettingsResult(await commands.moveSettings(current, path));
    },
    async setServerAnswer(current, answer) {
      return toSettingsResult(await commands.setServerAnswer(current, answer));
    },
    async setAddedServers(current, added) {
      return toSettingsResult(await commands.setAddedServers(current, [...added]));
    },
  };
}

export function createTauriSource(): ChunkSource {
  return {
    async listFiles() {
      const result = toResult(await commands.listFiles());
      return result.ok ? { ok: true, value: toFileList(result.value) } : result;
    },
    async loadFile(path) {
      const result = toResult(await commands.loadFile(path));
      return result.ok ? { ok: true, value: toDomain(result.value) } : result;
    },
    async finishFile({ path, text, diskVersion }) {
      return toResult(await commands.finishFile(path, text, diskVersion));
    },
    async saveFile({ path, text, diskVersion }) {
      return toResult(await commands.saveFile(path, text, diskVersion));
    },
    async resetFile(path, diskVersion) {
      return toResult(await commands.resetFile(path, diskVersion));
    },
    async describeFile(path) {
      const result = toResult(await commands.describeFile(path));
      return result.ok ? { ok: true, value: toSides(result.value) } : result;
    },
    async takeSide(path, side, diskVersion) {
      return toResult(await commands.takeSide(path, side, diskVersion));
    },
    sideNames() {
      return commands.sideNames();
    },
    ...createTauriSettings(),
  };
}

export function createTauriServerHost(): ServerHost {
  return {
    context: () => commands.serversContext(),
    async start(command, onEvent) {
      const events = new Channel<HostEvent>(onEvent);
      return toStartReply(
        await commands.startServer({ ...command, args: [...command.args] }, events),
      );
    },
    send(run, message) {
      void commands.sendToServer(run, message);
    },
    stop: (run) => commands.stopServer(run),
    findProgram: (program, project) => commands.findProgram(program, project),
    projectFiles: (paths) => commands.projectFiles([...paths]),
  };
}

// JSON.stringify writes NaN and ±Infinity as `null` (ECMA-262 SerializeJSONProperty); the app's
// `f64` field rejects `null`, so the whole entry would be lost.
export function forwardLog(entry: LogEntry): Promise<void> {
  const fields = Object.fromEntries(
    Object.entries(entry.fields).map(([key, value]): [string, LogValue] => [
      key,
      typeof value === "number" && !Number.isFinite(value) ? String(value) : value,
    ]),
  );
  return commands.log({ level: entry.level, event: entry.event, fields });
}
