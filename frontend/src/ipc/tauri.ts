import { commands, type LogValue } from "./bindings";
import type { ChunkSource } from "./ChunkSource";
import { toDomain, type SourceFailure, type SourceResult } from "./domain";
import type { LogEntry } from "./log";

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

export function createTauriSource(): ChunkSource {
  return {
    listFiles() {
      return commands.listFiles();
    },
    async loadFile(path) {
      const result = toResult(await commands.loadFile(path));
      return result.ok ? { ok: true, value: toDomain(result.value) } : result;
    },
    async finishFile(path, text) {
      return toResult(await commands.finishFile(path, text));
    },
    async resetFile(path) {
      return toResult(await commands.resetFile(path));
    },
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
