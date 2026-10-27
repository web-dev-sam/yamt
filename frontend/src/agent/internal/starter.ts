import type { AgentSource, CheckoutFolder } from "../../ipc";
import type { Timers } from "../../jsonrpc";
import { agentCommand } from "./command";
import type { AgentFailure } from "./failure";
import { AgentProcess, type Outcome } from "./process";

export type StarterSetup = {
  readonly source: AgentSource;
  readonly command: () => readonly string[];
  readonly timers: Timers;
};

export type Started =
  | { readonly kind: "started"; readonly agent: AgentProcess }
  | { readonly kind: "failed"; readonly failure: AgentFailure }
  | { readonly kind: "dropped" };

const DROPPED: Started = { kind: "dropped" };

/** The checkout's folder (made once) and one process at a time; a failure is not kept. */
export class Starter {
  readonly #setup: StarterSetup;
  #checkout: Promise<Outcome<CheckoutFolder>> | null = null;
  #agent: Promise<Outcome<AgentProcess>> | null = null;
  #destroyed = false;

  constructor(setup: StarterSetup) {
    this.#setup = setup;
  }

  isDestroyed(): boolean {
    return this.#destroyed;
  }

  /** The process; `dropped` after `destroy`, or when `wanted` turns false while the checkout is made. */
  async ready(wanted: () => boolean): Promise<Started> {
    if (this.isDestroyed()) {
      return DROPPED;
    }
    const folder = await this.#folder();
    if (this.isDestroyed() || !wanted()) {
      return DROPPED;
    }
    if (!folder.ok) {
      return { kind: "failed", failure: folder.failure };
    }
    const starting = this.#agent ?? this.#start(folder.value);
    this.#agent = starting;
    const started = await starting;
    if (this.isDestroyed()) {
      return DROPPED;
    }
    if (started.ok) {
      return { kind: "started", agent: started.value };
    }
    if (this.#agent === starting) {
      this.#agent = null;
      if (started.failure.kind === "checkoutFailed") {
        this.#checkout = null;
      }
    }
    return { kind: "failed", failure: started.failure };
  }

  /** Stops the process, also one still starting; nothing starts afterwards. */
  destroy(): void {
    this.#destroyed = true;
    void this.#agent?.then((agent) => (agent.ok ? agent.value.stop() : undefined));
  }

  async #folder(): Promise<Outcome<CheckoutFolder>> {
    const preparing = this.#checkout ?? this.#prepare();
    this.#checkout = preparing;
    const prepared = await preparing;
    if (!prepared.ok && this.#checkout === preparing) {
      this.#checkout = null;
    }
    return prepared;
  }

  async #prepare(): Promise<Outcome<CheckoutFolder>> {
    try {
      const result = await this.#setup.source.prepareCheckout();
      if (!result.ok) {
        return { ok: false, failure: { kind: "app", failure: result.failure } };
      }
      const ready = result.value;
      return ready.kind === "Ready"
        ? { ok: true, value: ready.folder }
        : { ok: false, failure: { kind: "checkoutFailed", message: ready.message } };
    } catch (error) {
      return { ok: false, failure: { kind: "checkoutFailed", message: String(error) } };
    }
  }

  #start(folder: CheckoutFolder): Promise<Outcome<AgentProcess>> {
    const command = agentCommand(this.#setup.command());
    if (command === null) {
      return Promise.resolve({ ok: false, failure: { kind: "noCommand" } });
    }
    const starting = AgentProcess.start({
      source: this.#setup.source,
      command,
      folder,
      timers: this.#setup.timers,
      exited: () => {
        if (this.#agent === starting) {
          this.#agent = null;
        }
      },
    });
    return starting;
  }
}
