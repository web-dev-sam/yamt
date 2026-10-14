import type { Connection } from "./connection";
import type { DocEntry } from "./documents";
import { applyEdits } from "./edits";
import { parseWith } from "./messages";
import { TEXT_EDITS } from "./protocol";
import type { Server } from "./server";
import type { ServerState } from "./state";
import type { Timers } from "./timers";

export type FormattingOptions = { readonly tabSize: number; readonly insertSpaces: boolean };

export type FormatRefusal =
  | { readonly kind: "noFormatter" }
  | { readonly kind: "notRunning"; readonly server: string; readonly state: ServerState }
  | { readonly kind: "failed"; readonly server: string; readonly message: string }
  | { readonly kind: "timedOut"; readonly server: string };

export type FormatReply =
  | {
      readonly kind: "formatted";
      readonly server: string;
      readonly sent: string;
      readonly result: string;
    }
  | { readonly kind: "unchanged"; readonly server: string }
  | FormatRefusal;

const FORMAT_TIMEOUT_MS = 5000;

function within(settled: Promise<void>, ms: number, timers: Timers): Promise<boolean> {
  return new Promise((resolve) => {
    const timer = timers.setTimeout(() => resolve(false), ms);
    void settled.then(() => {
      timers.clearTimeout(timer);
      resolve(true);
    });
  });
}

type Request = {
  readonly server: string;
  readonly connection: Connection;
  readonly uri: string;
  readonly entry: DocEntry;
  readonly options: FormattingOptions;
  readonly timeoutMs: number;
};

async function formatOn(request: Request): Promise<FormatReply> {
  const { server, connection, uri, entry, options, timeoutMs } = request;
  const sent = entry.current();
  const reply = await connection.request(
    "textDocument/formatting",
    { textDocument: { uri }, options },
    timeoutMs,
  );
  switch (reply.kind) {
    case "timedOut":
      return { kind: "timedOut", server };
    case "closed":
      return { kind: "failed", server, message: "the server stopped" };
    case "error":
      return { kind: "failed", server, message: reply.message };
    case "result":
      break;
    default: {
      const _exhaustive: never = reply;
      return _exhaustive;
    }
  }
  const edits = parseWith(TEXT_EDITS, reply.value);
  if (!edits.ok) {
    return { kind: "failed", server, message: `malformed edits: ${edits.reason}` };
  }
  const applied = applyEdits(sent.text, edits.value ?? []);
  if (applied.kind === "overlapping") {
    return { kind: "failed", server, message: "the server sent overlapping edits" };
  }
  return applied.text === sent.text
    ? { kind: "unchanged", server }
    : { kind: "formatted", server, sent: sent.text, result: applied.text };
}

export async function format(
  entry: DocEntry,
  servers: readonly Server[],
  options: FormattingOptions,
  timers: Timers,
): Promise<FormatReply> {
  const deadline = timers.now() + FORMAT_TIMEOUT_MS;
  const candidates = servers.filter(
    (server) => server.spec.formats && server.serves(entry.doc.path),
  );
  for (const server of candidates) {
    const name = server.spec.name;
    if (!(await within(server.settled(), deadline - timers.now(), timers))) {
      return { kind: "timedOut", server: name };
    }
    const running = server.running;
    const uri = running?.docs.uriOf(entry) ?? null;
    if (running !== null && running.capabilities.formats && uri !== null) {
      try {
        return await formatOn({
          server: name,
          connection: running.attempt.connection,
          uri,
          entry,
          options,
          timeoutMs: deadline - timers.now(),
        });
      } catch (error) {
        return { kind: "failed", server: name, message: String(error) };
      }
    }
  }
  const idle = candidates.find((server) => server.running === null);
  return idle === undefined
    ? { kind: "noFormatter" }
    : { kind: "notRunning", server: idle.spec.name, state: idle.state };
}
