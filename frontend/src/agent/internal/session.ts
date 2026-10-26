export type AgentSessionId = string & { readonly __brand: "AgentSessionId" };

export function isAgentSessionId(text: string): text is AgentSessionId {
  return text !== "";
}

export function agentSessionId(text: string): AgentSessionId | null {
  return isAgentSessionId(text) ? text : null;
}
