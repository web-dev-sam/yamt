import { expect, test } from "vitest";

import { agentSessionId, type AgentSessionId } from "../ipc";
import { answersIn, isGone } from "./rangeAiRules";
import { IDLE, type ThreadAi } from "./rangeAiView";

function session(text: string): AgentSessionId {
  const id = agentSessionId(text);
  if (id === null) {
    throw new Error(`${text} is no session`);
  }
  return id;
}

test("a session is gone only when omp lost that session's load", () => {
  const lost: ThreadAi = {
    ...IDLE,
    loadedSession: session("s1"),
    loaded: { kind: "failed", failure: { kind: "sessionGone" } },
  };

  expect(isGone(lost, session("s1"))).toBe(true);
  expect(isGone(lost, session("s2"))).toBe(false);
});

test("a thread not listed holds no answers", () => {
  expect(answersIn(undefined, session("s1"))).toBe(0);
});
