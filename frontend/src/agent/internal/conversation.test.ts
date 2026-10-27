import { expect, test } from "vitest";

import load from "../../../fixtures/agent/load.jsonl?raw";
import type { CheckoutFolder } from "../../ipc";
import { replayTurns } from "./conversation";
import { parseUpdate } from "./protocol";
import type { TurnUpdate } from "./turn";

const CHECKOUT_TEXT = "/fixture/checkout";

function isFolder(path: string): path is CheckoutFolder {
  return path === CHECKOUT_TEXT;
}

function recordedUpdates(jsonl: string): TurnUpdate[] {
  if (!isFolder(CHECKOUT_TEXT)) {
    throw new Error("no checkout");
  }
  const folder = CHECKOUT_TEXT;
  return jsonl
    .trim()
    .split("\n")
    .map((json) => JSON.parse(json))
    .filter((each) => each.from === "agent")
    .map((each) => JSON.parse(each.line.replaceAll("{{CHECKOUT}}", CHECKOUT_TEXT)))
    .filter((message) => message.method === "session/update")
    .flatMap((message) => {
      const parsed = parseUpdate(message.params, folder);
      return parsed.ok && parsed.value.update !== null ? [parsed.value.update] : [];
    });
}

function ASKED(text: string): TurnUpdate {
  return { kind: "asked", text };
}

function SAID(text: string): TurnUpdate {
  return { kind: "said", text };
}

test("the recorded replay is one turn per user message, folded like the live one", () => {
  const updates = recordedUpdates(load);
  const turns = replayTurns(updates);
  expect(turns).toHaveLength(updates.filter((update) => update.kind === "asked").length);
  expect(turns).toHaveLength(1);
  const [turn] = turns;
  expect(
    turn?.entries.map((entry) => (entry.kind === "step" ? entry.step.kind : entry.kind)),
  ).toEqual(["thought", "read", "edit", "execute", "thought"]);
  expect(turn?.answer).toMatch(/^I added `hello` as the last line of `README\.md`/u);
  const edit = turn?.entries[2];
  expect(edit?.kind === "step" && edit.step.outputs[0]).toMatchObject({
    kind: "edit",
    edit: { path: "README.md" },
  });
});

test("a turn starts at each user message; consecutive user chunks are one message", () => {
  const turns = replayTurns([
    SAID("before any message"),
    ASKED("first "),
    ASKED("question"),
    SAID("one"),
    ASKED("second"),
    SAID("two"),
    ASKED("third"),
  ]);
  expect(turns.map((turn) => turn.answer)).toEqual(["one", "two", ""]);
});

test("a replayed step left unfinished ends as noResult", () => {
  const [turn] = replayTurns([
    ASKED("run it"),
    {
      kind: "step",
      step: { id: "a", title: "$ sleep 30", kind: "execute", status: "pending", outputs: null },
    },
  ]);
  expect(turn?.entries).toEqual([
    {
      kind: "step",
      step: { id: "a", title: "$ sleep 30", kind: "execute", status: "noResult", outputs: [] },
    },
  ]);
});

test("a replay without user messages has no turns", () => {
  expect(replayTurns([SAID("x")])).toEqual([]);
});
