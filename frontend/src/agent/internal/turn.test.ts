import { expect, test } from "vitest";

import cancelled from "../../../fixtures/agent/cancelled.jsonl?raw";
import editAndCommand from "../../../fixtures/agent/edit-and-command.jsonl?raw";
import permissionOutside from "../../../fixtures/agent/permission-outside.jsonl?raw";
import type { CheckoutFolder } from "../../ipc";
import { answerRequest } from "./answers";
import { parseUpdate } from "./protocol";
import { stopEnding } from "./session";
import {
  EMPTY_TURN,
  endTurn,
  foldUpdate,
  refuseStep,
  type Step,
  type TurnUpdate,
  type TurnView,
} from "./turn";

const CHECKOUT_TEXT = "/fixture/checkout";

function isFolder(path: string): path is CheckoutFolder {
  return path === CHECKOUT_TEXT;
}

const CHECKOUT = isFolder(CHECKOUT_TEXT) ? CHECKOUT_TEXT : null;

type AgentLine = { readonly method?: string; readonly params?: unknown; readonly id?: number };

function agentLines(jsonl: string): AgentLine[] {
  return jsonl
    .trim()
    .split("\n")
    .map((json) => JSON.parse(json))
    .filter((each) => each.from === "agent")
    .map((each) => JSON.parse(each.line.replaceAll("{{CHECKOUT}}", CHECKOUT_TEXT)));
}

function updatesOf(jsonl: string): TurnUpdate[] {
  if (CHECKOUT === null) {
    throw new Error("no checkout");
  }
  const folder = CHECKOUT;
  return agentLines(jsonl).flatMap((line) => {
    if (line.method !== "session/update") {
      return [];
    }
    const parsed = parseUpdate(line.params, folder);
    if (!parsed.ok) {
      throw new Error(parsed.reason);
    }
    return parsed.value.update === null ? [] : [parsed.value.update];
  });
}

function folded(updates: readonly TurnUpdate[]): TurnView {
  return updates.reduce(foldUpdate, EMPTY_TURN);
}

function steps(turn: TurnView): Step[] {
  return turn.entries.flatMap((entry) => (entry.kind === "step" ? [entry.step] : []));
}

function chunkText(updates: readonly TurnUpdate[], kind: "thought" | "said"): string[] {
  return updates.flatMap((update) => (update.kind === kind ? [update.text] : []));
}

test("the recorded edit and command fold into thinking, three steps and the answer", () => {
  const updates = updatesOf(editAndCommand);
  const turn = endTurn(folded(updates));
  const kinds = turn.entries.map((entry) => (entry.kind === "step" ? entry.step.kind : entry.kind));
  expect(kinds).toEqual(["thought", "read", "edit", "execute", "thought"]);
  expect(steps(turn).map((step) => step.status)).toEqual(["done", "done", "done"]);
  const thoughts = turn.entries.flatMap((entry) => (entry.kind === "thought" ? [entry.text] : []));
  expect(thoughts.join("")).toBe(chunkText(updates, "thought").join(""));
  expect(thoughts[0]).toMatch(/^I should check README\.md first/u);
  expect(turn.answer).toBe(chunkText(updates, "said").join(""));
  expect(turn.answer).toMatch(/^I added `hello` as the last line of `README\.md`/u);
});

test("the recorded edit step carries the whole file before and after, its path relative", () => {
  const edit = steps(folded(updatesOf(editAndCommand)))[1];
  const output = edit?.outputs.find((each) => each.kind === "edit");
  expect(edit?.title).toBe("Appending hello line to README");
  expect(output?.kind === "edit" && output.edit.path).toBe("README.md");
  expect(output?.kind === "edit" && output.edit.oldText?.startsWith("# Taskboard\n")).toBe(true);
  expect(output?.kind === "edit" && output.edit.newText.endsWith("\nhello\n")).toBe(true);
});

test("the recorded command moves pending → running → done and shows its output", () => {
  const updates = updatesOf(editAndCommand);
  const statuses: string[] = [];
  let turn = EMPTY_TURN;
  for (const update of updates) {
    turn = foldUpdate(turn, update);
    const status = steps(turn).find((step) => step.kind === "execute")?.status;
    if (status !== undefined && statuses.at(-1) !== status) {
      statuses.push(status);
    }
  }
  expect(statuses).toEqual(["pending", "running", "done"]);
  const command = steps(turn)[2];
  expect(command?.title).toBe("$ git status");
  expect(command?.outputs.map((output) => output.kind)).toEqual(["text", "text", "text"]);
  expect(command?.outputs[1]).toMatchObject({
    kind: "text",
    text: expect.stringContaining("modified:   README.md"),
  });
});

test("the recorded cancel ends stopped and its unfinished command as noResult", () => {
  const turn = endTurn(folded(updatesOf(cancelled)));
  expect(steps(turn).map((step) => [step.kind, step.status])).toEqual([["execute", "noResult"]]);
  expect(stopEnding("cancelled")).toEqual({ kind: "stopped" });
});

test("the recorded refusal of a delete outside shows on its step, which fails", () => {
  if (CHECKOUT === null) {
    throw new Error("no checkout");
  }
  const folder = CHECKOUT;
  let turn = EMPTY_TURN;
  for (const line of agentLines(permissionOutside)) {
    if (line.method === "session/request_permission") {
      const { refused } = answerRequest(line.method, line.params, folder);
      turn = refused === null ? turn : refuseStep(turn, refused.refusal);
    } else if (line.method === "session/update") {
      const parsed = parseUpdate(line.params, folder);
      turn =
        parsed.ok && parsed.value.update !== null ? foldUpdate(turn, parsed.value.update) : turn;
    }
  }
  const deleted = steps(turn)[1];
  expect(deleted).toMatchObject({ kind: "edit", status: "failed", title: "Deleting outside file" });
  expect(deleted?.outputs).toEqual([
    {
      kind: "refused",
      title: "Delete /tmp/yamt-record-outside.txt",
      paths: ["/tmp/yamt-record-outside.txt"],
    },
    { kind: "text", text: "Tool call rejected by user (edit)" },
  ]);
  expect(turn.answer).toMatch(/^I couldn't delete/u);
});

test.each([
  ["end_turn", { kind: "finished" }],
  ["cancelled", { kind: "stopped" }],
  ["max_tokens", { kind: "failed", failure: { kind: "ended", reason: "max_tokens" } }],
  [
    "max_turn_requests",
    { kind: "failed", failure: { kind: "ended", reason: "max_turn_requests" } },
  ],
  ["refusal", { kind: "failed", failure: { kind: "ended", reason: "refusal" } }],
  ["something new", { kind: "failed", failure: { kind: "ended", reason: "something new" } }],
])("stopReason %s ends the turn as %j", (stopReason, ending) => {
  expect(stopEnding(stopReason)).toEqual(ending);
});

const READ: TurnUpdate = {
  kind: "step",
  step: { id: "a", title: "Read a", kind: "read", status: "pending", outputs: null },
};

test("text said before a step becomes a said entry, so the answer is the text after the last step", () => {
  const turn = folded([
    { kind: "said", text: "Let me " },
    { kind: "said", text: "look." },
    READ,
    { kind: "said", text: "Done." },
  ]);
  expect(turn.entries.map((entry) => entry.kind)).toEqual(["said", "step"]);
  expect(turn.entries[0]).toEqual({ kind: "said", text: "Let me look." });
  expect(turn.answer).toBe("Done.");
});

test("a thought after a step starts a new thought entry", () => {
  const turn = folded([
    { kind: "thought", text: "a" },
    { kind: "thought", text: "b" },
    READ,
    { kind: "thought", text: "c" },
  ]);
  expect(turn.entries).toEqual([
    { kind: "thought", text: "ab" },
    expect.objectContaining({ kind: "step" }),
    { kind: "thought", text: "c" },
  ]);
});

test("an update changes only what it names; content replaces the outputs but keeps a refusal", () => {
  const refused = refuseStep(folded([READ]), { step: "a", title: "Read a", paths: ["/x"] });
  const updated = [
    {
      kind: "step",
      step: {
        id: "a",
        title: null,
        kind: null,
        status: "running",
        outputs: [{ kind: "text", text: "1" }],
      },
    },
    {
      kind: "step",
      step: {
        id: "a",
        title: null,
        kind: null,
        status: null,
        outputs: [{ kind: "text", text: "2" }],
      },
    },
  ] satisfies TurnUpdate[];
  const step = steps(updated.reduce(foldUpdate, refused))[0];
  expect(step).toEqual({
    id: "a",
    kind: "read",
    title: "Read a",
    status: "running",
    outputs: [
      { kind: "refused", title: "Read a", paths: ["/x"] },
      { kind: "text", text: "2" },
    ],
  });
});

test("a refusal before its step's tool_call creates the step, which the tool_call then names", () => {
  const refused = refuseStep(EMPTY_TURN, { step: "a", title: "Delete /x", paths: ["/x"] });
  expect(steps(refused)[0]).toMatchObject({ kind: "other", title: "Delete /x", status: "pending" });
  const named = steps(foldUpdate(refused, READ))[0];
  expect(named).toMatchObject({ kind: "read", title: "Read a", status: "pending" });
  expect(named?.outputs).toEqual([{ kind: "refused", title: "Delete /x", paths: ["/x"] }]);
});

test("a step with no kind, title or status starts as other, untitled, pending", () => {
  const turn = folded([
    { kind: "step", step: { id: "z", title: null, kind: null, status: null, outputs: null } },
  ]);
  expect(steps(turn)).toEqual([
    { id: "z", kind: "other", title: "", status: "pending", outputs: [] },
  ]);
});

test("ending a turn turns only pending and running steps into noResult", () => {
  const turn = folded(
    (["pending", "running", "done", "failed"] as const).map((status, at): TurnUpdate => ({
      kind: "step",
      step: { id: String(at), title: null, kind: null, status, outputs: null },
    })),
  );
  expect(steps(endTurn(turn)).map((step) => step.status)).toEqual([
    "noResult",
    "noResult",
    "done",
    "failed",
  ]);
});

test("a user chunk leaves a live turn unchanged", () => {
  expect(foldUpdate(EMPTY_TURN, { kind: "asked", text: "hi" })).toBe(EMPTY_TURN);
});
