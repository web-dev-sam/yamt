import type { AgentCommand, AgentStartReply, CheckoutChanges, CheckoutReady } from "./agentDomain";
import type { Difference } from "./compareDomain";
import type { AgentRun, HostEvent, SourceResult } from "./domain";

export interface AgentSource {
  prepareCheckout(): Promise<SourceResult<CheckoutReady>>;
  startAgent(
    command: AgentCommand,
    onEvent: (event: HostEvent) => void,
  ): Promise<SourceResult<AgentStartReply>>;
  /** Fire and forget; the app frames the line and a failure is logged. */
  sendToAgent(run: AgentRun, message: string): void;
  /** Signals the run (the app kills it 2 s later); its `Exited` event always follows. */
  stopAgent(run: AgentRun): Promise<void>;
  checkoutChanges(): Promise<SourceResult<CheckoutChanges>>;
  discardCheckout(): Promise<SourceResult<null>>;
  diffTexts(old: string, next: string): Promise<SourceResult<readonly Difference[]>>;
}
