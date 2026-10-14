import type { Answer } from "./answers";
import {
  errorText,
  notificationText,
  parseIncoming,
  requestText,
  resultText,
  type Incoming,
} from "./messages";
import type { Timers } from "./timers";

export type Reply =
  | { readonly kind: "result"; readonly value: unknown }
  | { readonly kind: "error"; readonly message: string }
  | { readonly kind: "timedOut" }
  | { readonly kind: "closed" };

export type ConnectionHandlers = {
  readonly send: (text: string) => void;
  readonly request: (method: string, params: unknown) => Answer;
  readonly notification: (method: string, params: unknown) => void;
  readonly log: (text: string) => void;
};

type Pending = {
  readonly method: string;
  readonly timer: number;
  readonly settle: (reply: Reply) => void;
};

const MS_PER_SECOND = 1000;

export class Connection {
  readonly #handlers: ConnectionHandlers;
  readonly #timers: Timers;
  readonly #pending = new Map<number | string | null, Pending>();
  #nextId = 1;
  #closed = false;

  constructor(handlers: ConnectionHandlers, timers: Timers) {
    this.#handlers = handlers;
    this.#timers = timers;
  }

  request(method: string, params: unknown, timeoutMs: number): Promise<Reply> {
    if (this.#closed) {
      return Promise.resolve({ kind: "closed" });
    }
    const id = this.#nextId;
    this.#nextId += 1;
    return new Promise((settle) => {
      const timer = this.#timers.setTimeout(() => {
        this.#pending.delete(id);
        this.notify("$/cancelRequest", { id });
        this.#handlers.log(
          `No answer to ${method} within ${timeoutMs / MS_PER_SECOND} s; cancelled`,
        );
        settle({ kind: "timedOut" });
      }, timeoutMs);
      this.#pending.set(id, { method, timer, settle });
      this.#handlers.send(requestText(id, method, params));
    });
  }

  notify(method: string, params: unknown): void {
    if (!this.#closed) {
      this.#handlers.send(notificationText(method, params));
    }
  }

  receive(text: string): void {
    const parsed = parseIncoming(text);
    if (parsed.ok) {
      this.#dispatch(parsed.value);
    } else {
      this.#handlers.log(`Dropped a malformed message from the server: ${parsed.reason}`);
    }
  }

  close(): void {
    this.#closed = true;
    for (const pending of this.#pending.values()) {
      this.#timers.clearTimeout(pending.timer);
      this.#handlers.log(`No answer to ${pending.method}: the server stopped`);
      pending.settle({ kind: "closed" });
    }
    this.#pending.clear();
  }

  #dispatch(message: Incoming): void {
    switch (message.kind) {
      case "request":
        this.#answer(message.id, message.method, message.params);
        return;
      case "notification":
        this.#handlers.notification(message.method, message.params);
        return;
      case "result":
        this.#settle(message.id, { kind: "result", value: message.value });
        return;
      case "error":
        this.#settle(message.id, { kind: "error", message: message.message });
        return;
      default: {
        const _exhaustive: never = message;
        return _exhaustive;
      }
    }
  }

  #answer(id: number | string, method: string, params: unknown): void {
    const answer = this.#handlers.request(method, params);
    if (answer.log !== null) {
      this.#handlers.log(answer.log);
    }
    if (this.#closed) {
      return;
    }
    this.#handlers.send(
      answer.kind === "result"
        ? resultText(id, answer.value)
        : errorText(id, answer.code, answer.message),
    );
  }

  #settle(id: number | string | null, reply: Reply): void {
    const pending = this.#pending.get(id);
    if (pending === undefined) {
      return;
    }
    this.#pending.delete(id);
    this.#timers.clearTimeout(pending.timer);
    pending.settle(reply);
  }
}
