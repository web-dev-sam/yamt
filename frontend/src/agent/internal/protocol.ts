import * as v from "valibot";

import type { CheckoutFolder } from "../../ipc";
import { parseWith, type Parsed } from "../../jsonrpc";
import { relativeInside } from "./inside";
import { isAgentSessionId, type AgentSessionId } from "./session";
import type { StepKind, StepOutput, StepStatus, StepUpdate, TurnUpdate } from "./turn";

export const PROTOCOL_VERSION = 1;

export type SessionUpdate = {
  readonly session: AgentSessionId;
  readonly update: TurnUpdate | null;
};

const STEP_KINDS: Readonly<Record<string, StepKind>> = {
  read: "read",
  edit: "edit",
  delete: "delete",
  move: "move",
  search: "search",
  execute: "execute",
  think: "think",
  fetch: "fetch",
};

const STEP_STATUSES: Readonly<Record<string, StepStatus>> = {
  pending: "pending",
  in_progress: "running",
  completed: "done",
  failed: "failed",
};

const CHUNK_UPDATES = ["agent_thought_chunk", "agent_message_chunk", "user_message_chunk"] as const;

const STEP_UPDATES = ["tool_call", "tool_call_update"] as const;

const READ_UPDATES: readonly string[] = [...CHUNK_UPDATES, ...STEP_UPDATES];

const CHUNK_KINDS: Readonly<
  Record<(typeof CHUNK_UPDATES)[number], Exclude<TurnUpdate["kind"], "step">>
> = {
  agent_thought_chunk: "thought",
  agent_message_chunk: "said",
  user_message_chunk: "asked",
};

const SESSION_ID = v.custom<AgentSessionId>(
  (input) => typeof input === "string" && isAgentSessionId(input),
  "sessionId must be a non-empty string",
);

export const INITIALIZE_RESULT = v.object({ protocolVersion: v.number() });

export const NEW_SESSION_RESULT = v.object({ sessionId: SESSION_ID });

export const PROMPT_RESULT = v.object({ stopReason: v.string() });

const TEXT_BLOCK = v.object({ type: v.literal("text"), text: v.string() });

const CONTENT = v.variant("type", [
  v.object({ type: v.literal("content"), content: v.unknown() }),
  v.object({
    type: v.literal("diff"),
    path: v.string(),
    oldText: v.nullish(v.string()),
    newText: v.string(),
  }),
]);

const MAYBE_TEXT = v.nullish(v.string());

const UPDATE = v.variant("sessionUpdate", [
  v.object({
    sessionUpdate: v.picklist(CHUNK_UPDATES),
    content: v.unknown(),
  }),
  v.object({
    sessionUpdate: v.picklist(STEP_UPDATES),
    toolCallId: v.string(),
    title: MAYBE_TEXT,
    kind: MAYBE_TEXT,
    status: MAYBE_TEXT,
    content: v.nullish(v.array(v.unknown())),
  }),
]);

const UPDATE_PARAMS = v.object({ sessionId: SESSION_ID, update: v.unknown() });

const UPDATE_KIND = v.object({ sessionUpdate: v.string() });

export const PERMISSION_REQUEST = v.object({
  sessionId: SESSION_ID,
  toolCall: v.object({
    toolCallId: v.string(),
    title: MAYBE_TEXT,
    kind: MAYBE_TEXT,
    locations: v.nullish(v.array(v.object({ path: v.string() }))),
  }),
  options: v.array(v.object({ optionId: v.string(), kind: v.string() })),
});

export type PermissionRequest = v.InferOutput<typeof PERMISSION_REQUEST>;

function blockText(content: unknown): string {
  const text = parseWith(TEXT_BLOCK, content);
  return text.ok ? text.value.text : "";
}

function stepOutput(item: unknown, folder: CheckoutFolder): StepOutput[] {
  const parsed = parseWith(CONTENT, item);
  if (!parsed.ok) {
    return [];
  }
  const content = parsed.value;
  if (content.type === "content") {
    const text = parseWith(TEXT_BLOCK, content.content);
    return text.ok ? [{ kind: "text", text: text.value.text }] : [];
  }
  const path = relativeInside(content.path, folder) ?? content.path;
  return [
    { kind: "edit", edit: { path, oldText: content.oldText ?? null, newText: content.newText } },
  ];
}

function toUpdate(update: v.InferOutput<typeof UPDATE>, folder: CheckoutFolder): TurnUpdate {
  if (update.sessionUpdate === "tool_call" || update.sessionUpdate === "tool_call_update") {
    const { toolCallId: id, title, kind, status, content } = update;
    const step: StepUpdate = {
      id,
      title: title ?? null,
      kind: kind === undefined || kind === null ? null : (STEP_KINDS[kind] ?? "other"),
      status: status === undefined || status === null ? null : (STEP_STATUSES[status] ?? null),
      outputs:
        content === undefined || content === null
          ? null
          : content.flatMap((item) => stepOutput(item, folder)),
    };
    return { kind: "step", step };
  }
  return { kind: CHUNK_KINDS[update.sessionUpdate], text: blockText(update.content) };
}

export function parseUpdate(params: unknown, folder: CheckoutFolder): Parsed<SessionUpdate> {
  const envelope = parseWith(UPDATE_PARAMS, params);
  if (!envelope.ok) {
    return envelope;
  }
  const { sessionId: session, update } = envelope.value;
  const parsed = parseWith(UPDATE, update);
  if (parsed.ok) {
    return { ok: true, value: { session, update: toUpdate(parsed.value, folder) } };
  }
  const read = parseWith(UPDATE_KIND, update);
  const isRead = read.ok && READ_UPDATES.includes(read.value.sessionUpdate);
  return isRead ? parsed : { ok: true, value: { session, update: null } };
}
