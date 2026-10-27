import { expect, test } from "vitest";

import type { TurnEnd, TurnView } from "../agent";
import { agentSessionId, type AgentSessionId, type Message } from "../ipc";
import { failureText } from "./aiText";
import { IDLE, type ThreadAi } from "./rangeAi";
import { answering, answerText, answerView, liveTurn, postBody } from "./rangeAiView";

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

function answerOf(text: string, turn: number): Extract<Message["body"], { kind: "aiAnswer" }> {
  return { kind: "aiAnswer", session: session(text), turn };
}

const LINUX = "Linux x86_64";
const S1 = session("s1");
const FIRST = view("first");
const SECOND = view("second");
const LOADED: ThreadAi = {
  ...IDLE,
  loadedSession: S1,
  loaded: { kind: "loaded", turns: [FIRST, SECOND] },
};

test("an answer of the loaded session shows its turn, finished unless this window saw it end", () => {
  const stopped: TurnEnd = { kind: "stopped", turn: SECOND };

  expect(answerView(LOADED, answerOf("s1", 0))).toEqual({
    kind: "turn",
    turn: FIRST,
    end: { kind: "finished", turn: FIRST },
  });
  expect(answerView({ ...LOADED, end: stopped }, answerOf("s1", 1))).toEqual({
    kind: "turn",
    turn: SECOND,
    end: stopped,
  });
  expect(answerView({ ...LOADED, end: stopped }, answerOf("s1", 0))).toEqual({
    kind: "turn",
    turn: FIRST,
    end: { kind: "finished", turn: FIRST },
  });
});

test.each<[string, ThreadAi, string, number, unknown]>([
  ["nothing loaded yet", IDLE, "s1", 0, { kind: "loading" }],
  ["a load in flight", { ...IDLE, loadedSession: S1 }, "s1", 0, { kind: "loading" }],
  [
    "a load the closing window stopped",
    { ...IDLE, loadedSession: S1, loaded: { kind: "stopped" } },
    "s1",
    0,
    { kind: "loading" },
  ],
  ["an older session", LOADED, "s0", 0, { kind: "gone" }],
  ["a turn the replay lacks", LOADED, "s1", 2, { kind: "gone" }],
  [
    "a lost session",
    { ...IDLE, loadedSession: S1, loaded: { kind: "failed", failure: { kind: "sessionGone" } } },
    "s1",
    0,
    { kind: "gone" },
  ],
  [
    "a failed load",
    { ...IDLE, loadedSession: S1, loaded: { kind: "failed", failure: { kind: "noCommand" } } },
    "s1",
    0,
    { kind: "failed", failure: { kind: "noCommand" } },
  ],
])("an answer with %s", (_case, ai, answerSession, turn, expected) => {
  expect(answerView(ai, answerOf(answerSession, turn))).toEqual(expected);
});

test("the live turn: the running view, then its end until a message shows it", () => {
  const ended: TurnEnd = { kind: "finished", turn: SECOND };
  const failed: TurnEnd = { kind: "failed", turn: view("x"), failure: { kind: "busy" } };

  expect(liveTurn(IDLE)).toBeNull();
  expect(liveTurn({ ...IDLE, running: FIRST })).toEqual({ turn: FIRST, end: null });
  expect(liveTurn({ ...LOADED, running: FIRST })).toEqual({ turn: FIRST, end: null });
  expect(liveTurn({ ...LOADED, running: SECOND, end: ended })).toEqual({
    turn: SECOND,
    end: ended,
  });
  expect(liveTurn({ ...LOADED, end: ended })).toBeNull();
  expect(liveTurn({ ...LOADED, end: failed })).toEqual({ turn: failed.turn, end: failed });
  expect(liveTurn({ ...IDLE, end: ended })).toEqual({ turn: SECOND, end: ended });
});

test("a turn is answering while it runs without an end; Stop gives way to Ask AI after it ends", () => {
  const ended: TurnEnd = { kind: "stopped", turn: FIRST };

  expect(answering(IDLE)).toBe(false);
  expect(answering({ ...LOADED, running: FIRST })).toBe(true);
  expect(answering({ ...LOADED, running: FIRST, end: ended })).toBe(false);
  expect(answering({ ...LOADED, end: ended })).toBe(false);
});

test("an answer not shown reads why: no AI, loading, gone, or the failure in words", () => {
  expect(answerText(null, LINUX)).toBe("An AI answer — start yamt with --ai to see it");
  expect(answerText({ kind: "loading" }, LINUX)).toBe("Loading the AI's answer…");
  expect(answerText({ kind: "gone" }, LINUX)).toBe("omp no longer has this answer");
  expect(answerText({ kind: "failed", failure: { kind: "noCommand" } }, LINUX)).toBe(
    failureText({ kind: "noCommand" }, LINUX),
  );
});

test("Post offers a note's text, a loaded answer's final text, or why it cannot", () => {
  const answer = answerOf("s1", 1);

  expect(postBody({ kind: "note", text: "Why?" }, null)).toEqual({
    kind: "text",
    text: "Why?",
  });
  expect(postBody(answer, LOADED)).toEqual({ kind: "text", text: "second" });
  expect(postBody(answer, null)).toEqual({
    kind: "none",
    why: "An AI answer — start yamt with --ai to see it",
  });
  expect(postBody(answer, IDLE)).toEqual({ kind: "none", why: "Loading the AI's answer…" });
  expect(postBody(answerOf("s0", 0), LOADED)).toEqual({
    kind: "none",
    why: "omp no longer has this answer",
  });
  expect(
    postBody(answer, {
      ...IDLE,
      loadedSession: S1,
      loaded: { kind: "failed", failure: { kind: "noCommand" } },
    }),
  ).toEqual({ kind: "none", why: "The AI's conversation could not be loaded" });
});
