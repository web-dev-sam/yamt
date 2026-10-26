import * as v from "valibot";

import { toAgentStartReply, toCheckoutChanges, toCheckoutReady } from "./agentDomain";
import type { AgentSource } from "./AgentSource";
import type * as Generated from "./bindings";
import { toDifferences, type Difference } from "./compareDomain";
import type { HostEvent, SourceResult } from "./domain";
import { COLUMN_LIMIT_BYTES, DIFFERENCE, parsedCases } from "./fixture";
import type { Log } from "./log";

type Id = number | string;
type Recorded = {
  readonly line: string;
  readonly id: Id | undefined;
  readonly method: string | undefined;
};
type Recording = readonly Recorded[];
type Segment = { readonly id: Id | undefined; readonly lines: Recording };
type DiffCase = {
  readonly left: string;
  readonly right: string;
  readonly differences: Difference[];
};

export type AgentFixtureFiles = {
  readonly recordings: Readonly<Record<string, unknown>>;
  readonly diffs: Readonly<Record<string, unknown>>;
};

type Running = {
  readonly run: number;
  readonly onEvent: (event: HostEvent) => void;
  readonly timers: Map<string, number[]>;
  readonly prompts: Map<string, Id>;
};

type Fixture = {
  readonly log: Log;
  readonly prompts: Recording;
  readonly load: Recording;
  readonly diffs: ReadonlyMap<string, DiffCase>;
  readonly asked: string;
  readonly changes: boolean;
};

type State = {
  prepared: boolean;
  crashed: boolean;
  running: Running | null;
  runs: number;
  sessions: number;
};

// Stryker disable all: Vite needs import.meta.glob arguments as literals
const FILES: AgentFixtureFiles = {
  recordings: import.meta.glob("../../fixtures/agent/*.jsonl", {
    eager: true,
    query: "?raw",
    import: "default",
  }),
  diffs: import.meta.glob("../../fixtures/agent/diffs/*.json", { eager: true, import: "default" }),
};
// Stryker restore all

export const FIXTURE_CHECKOUT = "/fixture/data/yamt/range/repository/main...feature/checkout";

const PLAY_MS = 30;
const CRASH_CODE = 1;
const CRASH_PARTS = 2;
const SCRIPTED: Readonly<Record<string, true>> = { "": true, crash: true, "checkout-fails": true };
const LOAD_CASE = "load";

const LINE = v.object({ from: v.picklist(["agent", "yamt"]), line: v.string() });
const MESSAGE = v.looseObject({
  id: v.optional(v.union([v.number(), v.string()])),
  method: v.optional(v.string()),
  params: v.optional(v.looseObject({ sessionId: v.optional(v.string()) })),
});
const DIFF_CASE = v.object({
  differences: v.array(DIFFERENCE),
  left: v.string(),
  right: v.string(),
});

function recorded(name: string, text: string): Recording {
  return text
    .split("\n")
    .filter((json) => json !== "")
    .map((json, at) => {
      const each = v.safeParse(LINE, JSON.parse(json));
      const message = each.success ? v.safeParse(MESSAGE, JSON.parse(each.output.line)) : null;
      if (!each.success || message === null || !message.success) {
        throw new Error(`agent fixture ${name} line ${at + 1} is not a recorded message`);
      }
      const { id, method } = message.output;
      return each.output.from === "yamt"
        ? { line: "", id, method }
        : { line: each.output.line, id, method: undefined };
    });
}

/** The agent's lines after yamt's recorded `method`, up to yamt's next request or notification. */
function segment(recording: Recording, method: string): Segment | null {
  const at = recording.findIndex((each) => each.method === method);
  const rest = recording.slice(at + 1);
  const end = rest.findIndex((each) => each.method !== undefined);
  const lines = (end === -1 ? rest : rest.slice(0, end)).filter((each) => each.line !== "");
  return at === -1 ? null : { id: recording[at]?.id, lines };
}

/** Puts the checkout and session in, and gives the reply to the recorded request its live id. */
function rewritten(
  { line, id }: Recorded,
  session: string,
  recordedId: Id | undefined,
  liveId: Id,
): string {
  const text = line.replaceAll("{{CHECKOUT}}", FIXTURE_CHECKOUT).replaceAll("{{SESSION}}", session);
  const message = v.parse(MESSAGE, JSON.parse(text));
  const isReply = message.method === undefined && id !== undefined && id === recordedId;
  return isReply ? JSON.stringify({ ...message, id: liveId }) : text;
}

function stopPlaying(running: Running, session: string): void {
  for (const timer of running.timers.get(session) ?? []) {
    globalThis.clearTimeout(timer);
  }
  running.timers.delete(session);
}

function play(running: Running, session: string, texts: readonly string[], then: () => void): void {
  const timers = texts.map((text, at) =>
    globalThis.setTimeout(() => running.onEvent({ kind: "Message", text }), PLAY_MS * (at + 1)),
  );
  timers.push(globalThis.setTimeout(then, PLAY_MS * (texts.length + 1)));
  running.timers.set(session, [...(running.timers.get(session) ?? []), ...timers]);
}

function endRunning(state: State, crashed: boolean): void {
  const { running } = state;
  if (running === null) {
    return;
  }
  for (const session of running.timers.keys()) {
    stopPlaying(running, session);
  }
  state.running = null;
  if (crashed) {
    state.crashed = true;
    running.onEvent({ kind: "Log", line: "fixture agent: crashed mid-turn" });
    running.onEvent({ kind: "Exited", code: CRASH_CODE });
  } else {
    globalThis.setTimeout(() => running.onEvent({ kind: "Exited", code: null }), 0);
  }
}

function cancel(running: Running, session: string): void {
  stopPlaying(running, session);
  const id = running.prompts.get(session);
  const text = JSON.stringify({ jsonrpc: "2.0", id, result: { stopReason: "cancelled" } });
  if (id !== undefined) {
    running.onEvent({ kind: "Message", text });
  }
}

function received(fixture: Fixture, state: State, running: Running, text: string): void {
  const { id, method, params } = v.parse(MESSAGE, JSON.parse(text));
  const session =
    method === "session/new"
      ? `fixture-session-${(state.sessions += 1)}`
      : (params?.sessionId ?? "");
  if (method === "session/cancel") {
    cancel(running, session);
    return;
  }
  const found =
    method === undefined
      ? null
      : segment(method === "session/load" ? fixture.load : fixture.prompts, method);
  if (found === null || id === undefined) {
    return;
  }
  const texts = found.lines.map((each) => rewritten(each, session, found.id, id));
  const crashes = method === "session/prompt" && fixture.asked === "crash" && !state.crashed;
  if (method === "session/prompt") {
    running.prompts.set(session, id);
  }
  const shown = crashes ? texts.slice(0, Math.floor(texts.length / CRASH_PARTS)) : texts;
  play(running, session, shown, crashes ? () => endRunning(state, true) : () => undefined);
}

function differencesOf(
  fixture: Fixture,
  old: string,
  next: string,
): SourceResult<readonly Difference[]> {
  const encoder = new TextEncoder();
  if (Math.max(encoder.encode(old).length, encoder.encode(next).length) > COLUMN_LIMIT_BYTES) {
    return { ok: false, failure: { kind: "ColumnTooLarge", limit: COLUMN_LIMIT_BYTES } };
  }
  const found = [...fixture.diffs.values()].find(
    (each) => each.left === old && each.right === next,
  );
  if (found === undefined) {
    fixture.log.info("agent.fixture_miss", { old: old.length, next: next.length });
  }
  return { ok: true, value: found?.differences ?? [] };
}

function checkoutActions(
  fixture: Fixture,
  state: State,
): Pick<AgentSource, "prepareCheckout" | "checkoutChanges" | "discardCheckout"> {
  return {
    async prepareCheckout() {
      const fails = fixture.asked === "checkout-fails";
      state.prepared = !fails;
      const reply: Generated.CheckoutReply = fails
        ? { kind: "Failed", message: "fixture: git clone failed" }
        : { kind: "Ready", folder: FIXTURE_CHECKOUT };
      return { ok: true, value: toCheckoutReady(reply) };
    },
    async checkoutChanges() {
      const look: Generated.CheckoutLook = fixture.changes
        ? {
            kind: "Changed",
            folder: FIXTURE_CHECKOUT,
            files: ["README.md"],
            refs: [],
            head_moved: false,
          }
        : { kind: state.prepared ? "Clean" : "Missing" };
      return { ok: true, value: toCheckoutChanges(look) };
    },
    async discardCheckout() {
      endRunning(state, false);
      state.prepared = false;
      return { ok: true, value: null };
    },
  };
}

function fixtureOf(log: Log, search: string, files: AgentFixtureFiles): Fixture {
  const params = new URLSearchParams(search);
  const asked = params.get("ai") ?? "";
  const name = Object.hasOwn(SCRIPTED, asked) ? "edit-and-command" : asked;
  const cases = new Map(
    Object.entries(files.recordings).map(([file, text]) => {
      const each = file.replace(/^.*\//u, "").replace(/\.jsonl$/u, "");
      return [each, recorded(each, typeof text === "string" ? text : "")];
    }),
  );
  const load = cases.get(LOAD_CASE);
  cases.delete(LOAD_CASE);
  const prompts = cases.get(name);
  if (prompts === undefined || load === undefined) {
    throw new Error(`no agent fixture ${name}; known: ${[...cases.keys()].join(", ")}`);
  }
  const diffs = parsedCases(DIFF_CASE, "agent diff fixture", files.diffs, (parsed) => ({
    ...parsed,
    differences: toDifferences(parsed.differences),
  }));
  return { log, prompts, load, diffs, asked, changes: params.has("ai-changes") };
}

/** Fixture mode's agent (`?ai[=<case>]`, `?ai-changes`): plays recorded `omp acp` lines back. */
export function createFixtureAgentSource(
  log: Log,
  search: string,
  files: AgentFixtureFiles = FILES,
): AgentSource {
  const fixture = fixtureOf(log, search, files);
  const state: State = { prepared: false, crashed: false, running: null, runs: 0, sessions: 0 };
  return {
    ...checkoutActions(fixture, state),
    async startAgent(_command, onEvent) {
      endRunning(state, false);
      if (!state.prepared) {
        return { ok: true, value: { kind: "NoCheckout" } };
      }
      state.runs += 1;
      state.running = { run: state.runs, onEvent, timers: new Map(), prompts: new Map() };
      return { ok: true, value: toAgentStartReply({ kind: "Started", run: state.runs }) };
    },
    sendToAgent(run, message) {
      if (state.running?.run === run) {
        received(fixture, state, state.running, message);
      }
    },
    async stopAgent(run) {
      if (state.running?.run === run) {
        endRunning(state, false);
      }
    },
    async diffTexts(old, next) {
      return differencesOf(fixture, old, next);
    },
  };
}
