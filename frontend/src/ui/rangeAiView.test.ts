import { expect, test } from "vitest";

import { agentSessionId, type AgentSessionId, type TurnEnd, type TurnView } from "../agent";
import type { Message } from "../ipc";
import { IDLE, type ThreadAi } from "./rangeAi";
import { answerView, liveTurn, postBody } from "./rangeAiView";

function session(text: string): AgentSessionId {
  const id = agentSessionId(text);
  if (id === null) {
    throw new Error(`${text} is no session`);
  }
  return id;
}

function view(answer: string): TurnView {
  return { entries: [], answer };
}

function message(body: Message["body"]): Message["body"] {
  return body;
}

const S1 = session("s1");
const FIRST = view("first");
const SECOND = view("second");
const LOADED: ThreadAi = {
  ...IDLE,
  session: S1,
  loaded: { kind: "loaded", turns: [FIRST, SECOND] },
};

test("an answer of the loaded session shows its turn, finished unless this window saw it end", () => {
  const stopped: TurnEnd = { kind: "stopped", turn: SECOND };

  expect(answerView(LOADED, { kind: "aiAnswer", session: "s1", turn: 0 })).toEqual({
    kind: "turn",
    turn: FIRST,
    end: { kind: "finished", turn: FIRST },
  });
  expect(
    answerView({ ...LOADED, end: stopped }, { kind: "aiAnswer", session: "s1", turn: 1 }),
  ).toEqual({
    kind: "turn",
    turn: SECOND,
    end: stopped,
  });
  expect(
    answerView({ ...LOADED, end: stopped }, { kind: "aiAnswer", session: "s1", turn: 0 }),
  ).toEqual({
    kind: "turn",
    turn: FIRST,
    end: { kind: "finished", turn: FIRST },
  });
});

test.each<[string, ThreadAi, string, number, unknown]>([
  ["nothing loaded yet", IDLE, "s1", 0, { kind: "loading" }],
  ["a load in flight", { ...IDLE, session: S1 }, "s1", 0, { kind: "loading" }],
  [
    "a load the closing window stopped",
    { ...IDLE, session: S1, loaded: { kind: "stopped" } },
    "s1",
    0,
    { kind: "loading" },
  ],
  ["an older session", LOADED, "s0", 0, { kind: "gone" }],
  ["a turn the replay lacks", LOADED, "s1", 2, { kind: "gone" }],
  [
    "a lost session",
    { ...IDLE, session: S1, loaded: { kind: "failed", failure: { kind: "sessionGone" } } },
    "s1",
    0,
    { kind: "gone" },
  ],
  [
    "a failed load",
    { ...IDLE, session: S1, loaded: { kind: "failed", failure: { kind: "noCommand" } } },
    "s1",
    0,
    { kind: "failed", failure: { kind: "noCommand" } },
  ],
])("an answer with %s", (_case, ai, answerSession, turn, expected) => {
  expect(answerView(ai, { kind: "aiAnswer", session: answerSession, turn })).toEqual(expected);
});

test("the live turn: the running view, then its end until a message shows it", () => {
  const ended: TurnEnd = { kind: "finished", turn: SECOND };
  const failed: TurnEnd = { kind: "failed", turn: view("x"), failure: { kind: "busy" } };

  expect(liveTurn(IDLE)).toBeNull();
  expect(liveTurn({ ...IDLE, running: FIRST })).toEqual({ turn: FIRST, end: null });
  expect(liveTurn({ ...LOADED, running: SECOND, end: ended })).toEqual({
    turn: SECOND,
    end: ended,
  });
  expect(liveTurn({ ...LOADED, end: ended })).toBeNull();
  expect(liveTurn({ ...LOADED, end: failed })).toEqual({ turn: failed.turn, end: failed });
  expect(liveTurn({ ...IDLE, end: ended })).toEqual({ turn: SECOND, end: ended });
});

test("Post offers a note's text, a loaded answer's final text, or why it cannot", () => {
  const answer = message({ kind: "aiAnswer", session: "s1", turn: 1 });

  expect(postBody(message({ kind: "note", text: "Why?" }), null)).toEqual({
    kind: "text",
    text: "Why?",
  });
  expect(postBody(answer, LOADED)).toEqual({ kind: "text", text: "second" });
  expect(postBody(answer, null)).toEqual({
    kind: "none",
    why: "An AI answer — start yamt with --ai to see it",
  });
  expect(postBody(answer, IDLE)).toEqual({ kind: "none", why: "Loading the AI's answer…" });
  expect(postBody(message({ kind: "aiAnswer", session: "s0", turn: 0 }), LOADED)).toEqual({
    kind: "none",
    why: "omp no longer has this answer",
  });
  expect(
    postBody(answer, {
      ...IDLE,
      session: S1,
      loaded: { kind: "failed", failure: { kind: "noCommand" } },
    }),
  ).toEqual({ kind: "none", why: "The AI's conversation could not be loaded" });
});
