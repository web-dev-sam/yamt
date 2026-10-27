// Records one conversation with `omp acp` as a fixture of the window's agent client (plan §2 #109):
// `tsx scripts/record-agent.ts <case> <checkout> <prompt>` sends initialize, session/new and session/prompt;
// the case `load` takes a session id instead of the prompt and sends session/load in a fresh process;
// the case `cancelled` sends session/cancel once a command's step arrives. Permission requests get the
// answers of agent/internal/answers.ts (scripts cannot import src/: tsconfig.node.json and PM5). Every
// line both ways is written to fixtures/agent/<case>.jsonl as { from, line }, the checkout as
// {{CHECKOUT}} and the session id as {{SESSION}}.
import { spawn } from "node:child_process";
import { mkdirSync, realpathSync, writeFileSync } from "node:fs";
import { createInterface } from "node:readline";
import type { Writable } from "node:stream";

import * as v from "valibot";

type Recorded = { readonly from: "agent" | "yamt"; readonly line: string };
type Message = v.InferOutput<typeof MESSAGE>;
type Recorder = {
  readonly name: string;
  readonly folder: string;
  readonly toAgent: Writable;
  readonly recorded: Recorded[];
  readonly waiting: Map<number, (message: Message) => void>;
  nextId: number;
  session: string;
  cancelled: boolean;
};

const PROTOCOL_VERSION = 1;
const GIVE_UP_MS = 300_000;
const METHOD_NOT_FOUND = -32601;
const ARGUMENTS_FROM = 2;

const MESSAGE = v.looseObject({
  id: v.optional(v.union([v.number(), v.string()])),
  method: v.optional(v.string()),
  params: v.optional(v.unknown()),
  result: v.optional(v.unknown()),
});
const PERMISSION = v.object({
  toolCall: v.looseObject({
    kind: v.nullish(v.string()),
    locations: v.nullish(v.array(v.looseObject({ path: v.string() }))),
  }),
  options: v.array(v.looseObject({ optionId: v.string(), kind: v.string() })),
});
const COMMAND_STEP = v.object({
  update: v.looseObject({ sessionUpdate: v.literal("tool_call"), kind: v.literal("execute") }),
});
const CREATED = v.looseObject({ sessionId: v.string() });

const SEPARATOR = /[\\/]/u;
const ROOTED = /^(?:[\\/]|[A-Za-z]:)/u;
const DRIVE = /^[A-Za-z]:$/u;

function fail(message: string): never {
  process.stderr.write(`record-agent: ${message}\n`);
  process.exit(1);
}

function lexical(path: string): string[] {
  const kept: string[] = [];
  for (const segment of path.split(SEPARATOR)) {
    if (segment === "..") {
      kept.pop();
    } else if (segment !== "" && segment !== ".") {
      kept.push(segment);
    }
  }
  return kept;
}

/** inside.ts's rule: `.`/`..` resolved without the disk, case folded under a drive letter. */
function inside(path: string, folder: string): boolean {
  const foldsCase = DRIVE.test(lexical(folder)[0] ?? "");
  const base = lexical(foldsCase ? folder.toLowerCase() : folder);
  const rooted = ROOTED.test(path) ? path : `${folder}/${path}`;
  const target = lexical(foldsCase ? rooted.toLowerCase() : rooted);
  return target.length > base.length && base.every((segment, at) => segment === target[at]);
}

function permissionAnswer(params: unknown, folder: string): unknown {
  const { toolCall, options } = v.parse(PERMISSION, params);
  const paths = (toolCall.locations ?? []).map((location) => location.path);
  const allowed =
    toolCall.kind === "execute" ||
    (paths.length > 0 && paths.every((path) => inside(path, folder)));
  const option = options.find((each) => each.kind === (allowed ? "allow_once" : "reject_once"));
  return option === undefined
    ? { outcome: { outcome: "cancelled" } }
    : { outcome: { outcome: "selected", optionId: option.optionId } };
}

function send(recorder: Recorder, message: object): void {
  const line = JSON.stringify({ jsonrpc: "2.0", ...message });
  recorder.recorded.push({ from: "yamt", line });
  recorder.toAgent.write(`${line}\n`);
}

function request(recorder: Recorder, method: string, params: unknown): Promise<Message> {
  recorder.nextId += 1;
  const id = recorder.nextId;
  send(recorder, { id, method, params });
  return new Promise((settle) => recorder.waiting.set(id, settle));
}

function received(recorder: Recorder, line: string): void {
  recorder.recorded.push({ from: "agent", line });
  const message = v.parse(MESSAGE, JSON.parse(line));
  const { id, method } = message;
  if (method === undefined && typeof id === "number") {
    recorder.waiting.get(id)?.(message);
    recorder.waiting.delete(id);
  } else if (method === "session/request_permission" && id !== undefined) {
    send(recorder, { id, result: permissionAnswer(message.params, recorder.folder) });
  } else if (method !== undefined && id !== undefined) {
    send(recorder, { id, error: { code: METHOD_NOT_FOUND, message: `${method} not handled` } });
  } else if (
    recorder.name === "cancelled" &&
    !recorder.cancelled &&
    v.is(COMMAND_STEP, message.params)
  ) {
    recorder.cancelled = true;
    send(recorder, { method: "session/cancel", params: { sessionId: recorder.session } });
  }
}

async function converse(recorder: Recorder, input: string): Promise<void> {
  const { folder } = recorder;
  await request(recorder, "initialize", {
    protocolVersion: PROTOCOL_VERSION,
    clientCapabilities: { fs: { readTextFile: false, writeTextFile: false }, terminal: false },
    clientInfo: { name: "yamt" },
  });
  if (recorder.name === "load") {
    await request(recorder, "session/load", { sessionId: input, cwd: folder, mcpServers: [] });
    return;
  }
  const created = await request(recorder, "session/new", { cwd: folder, mcpServers: [] });
  const parsed = v.safeParse(CREATED, created.result);
  recorder.session = parsed.success
    ? parsed.output.sessionId
    : fail(`session/new: ${JSON.stringify(created)}`);
  const prompt = [{ type: "text", text: input }];
  await request(recorder, "session/prompt", { sessionId: recorder.session, prompt });
}

function fixtureText({ recorded, folder, session }: Recorder): string {
  return recorded
    .map(({ from, line }) => {
      const replaced = line.replaceAll(folder, "{{CHECKOUT}}").replaceAll(session, "{{SESSION}}");
      return `${JSON.stringify({ from, line: replaced })}\n`;
    })
    .join("");
}

async function record(name: string, folder: string, input: string): Promise<void> {
  const agent = spawn("omp", ["acp"], { cwd: folder, stdio: ["pipe", "pipe", "inherit"] });
  const recorder: Recorder = {
    name,
    folder,
    toAgent: agent.stdin,
    recorded: [],
    waiting: new Map(),
    nextId: 0,
    session: name === "load" ? input : "",
    cancelled: false,
  };
  createInterface({ input: agent.stdout }).on("line", (line) => received(recorder, line));
  const giveUp = setTimeout(() => fail("no end within 300 s"), GIVE_UP_MS);
  await converse(recorder, input);
  clearTimeout(giveUp);
  agent.kill();
  const into = new URL("../fixtures/agent/", import.meta.url);
  mkdirSync(into, { recursive: true });
  writeFileSync(new URL(`${name}.jsonl`, into), fixtureText(recorder));
  process.stdout.write(`record-agent: ${name} session ${recorder.session}\n`);
}

const [name, folder, input] = process.argv.slice(ARGUMENTS_FROM);
if (name === undefined || folder === undefined || input === undefined) {
  fail("usage: record-agent <case> <checkout> <prompt | session id for load>");
}
await record(name, realpathSync(folder), input);
