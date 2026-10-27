import { Channel } from "@tauri-apps/api/core";

import {
  fromAgentCommand,
  toAgentStartReply,
  toCheckoutChanges,
  toCheckoutReady,
} from "./agentDomain";
import type { AgentSource } from "./AgentSource";
import { commands, type HostEvent } from "./bindings";
import { toDifferences } from "./compareDomain";
import type { AgentRun } from "./domain";
import type { Log } from "./log";
import { converted, toResult } from "./tauri";

type Replied = { readonly status: "ok" } | { readonly status: "error"; readonly error: unknown };

async function logged(
  log: Log,
  event: string,
  run: AgentRun,
  reply: Promise<Replied>,
): Promise<void> {
  try {
    const result = await reply;
    if (result.status === "error") {
      log.warn(event, { run, failure: JSON.stringify(result.error) });
    }
  } catch (error) {
    log.warn(event, { run, failure: String(error) });
  }
}

export function createTauriAgentSource(log: Log): AgentSource {
  return {
    async prepareCheckout() {
      return converted(toResult(await commands.prepareCheckout()), toCheckoutReady);
    },
    async startAgent(command, onEvent) {
      const events = new Channel<HostEvent>(onEvent);
      const reply = await commands.startAgent(fromAgentCommand(command), events);
      return converted(toResult(reply), toAgentStartReply);
    },
    sendToAgent(run, message) {
      void logged(log, "agent.send_failed", run, commands.sendToAgent(run, message));
    },
    stopAgent: (run) => logged(log, "agent.stop_failed", run, commands.stopAgent(run)),
    async checkoutChanges() {
      return converted(toResult(await commands.checkoutChanges()), toCheckoutChanges);
    },
    async discardCheckout() {
      return toResult(await commands.discardCheckout());
    },
    async diffTexts(old, next) {
      return converted(toResult(await commands.diffTexts(old, next)), toDifferences);
    },
  };
}
