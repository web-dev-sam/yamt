import {
  errorText,
  notificationText,
  parseIncoming,
  requestText,
  resultText,
  type Incoming,
} from "./messages";
import type { Timers } from "./timers";

export type Answer =
  | { readonly kind: "result"; readonly value: unknown; readonly log: string | null }
  | {
      readonly kind: "error";
      readonly code: number;
      readonly message: string;
      readonly log: string;
    };

export type Reply =
  | { readonly kind: "result"; readonly value: unknown }
  | {
      readonly kind: "error";
      readonly code: number;
      readonly message: string;
      readonly data: unknown;
    }
  | { readonly kind: "timedOut" }
  | { readonly kind: "closed" };

export type ConnectionHandlers = {
  readonly send: (text: string) => void;
  readonly request: (method: string, params: unknown) => Answer;
  readonly notification: (method: string, params: unknown) => void;
  readonly log: (text: string) => void;
};

export type ConnectionOptions = { readonly cancelNotification: string | null };

type Settle = (reply: Reply) => void;

type Pending = {
  readonly method: string;
  readonly timer: number | null;
  readonly settle: Settle;
};

const MS_PER_SECOND = 1000;

export class Connection {
  readonly #handlers: ConnectionHandlers;
  readonly #timers: Timers;
  readonly #options: ConnectionOptions;
  readonly #pending = new Map<number | string | null, Pending>();
  #nextId = 1;
  #closed = false;

  constructor(handlers: ConnectionHandlers, timers: Timers, options: ConnectionOptions) {
    this.#handlers = handlers;
    this.#timers = timers;
    this.#options = options;
  }

  request(method: string, params: unknown, timeoutMs: number): Promise<Reply> {
    return this.#start(method, params, (id, settle) =>
      this.#timers.setTimeout(() => this.#timedOut(id, method, timeoutMs, settle), timeoutMs),
    );
  }

  requestUntilAnswered(method: string, params: unknown): Promise<Reply> {
    return this.#start(method, params, () => null);
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
      this.#clearTimer(pending);
      this.#handlers.log(`No answer to ${pending.method}: the server stopped`);
      pending.settle({ kind: "closed" });
    }
    this.#pending.clear();
  }

  #start(
    method: string,
    params: unknown,
    deadline: (id: number, settle: Settle) => number | null,
  ): Promise<Reply> {
    if (this.#closed) {
      return Promise.resolve({ kind: "closed" });
    }
    const id = this.#nextId;
    this.#nextId += 1;
    return new Promise((settle) => {
      this.#pending.set(id, { method, timer: deadline(id, settle), settle });
      this.#handlers.send(requestText(id, method, params));
    });
  }

  #timedOut(id: number, method: string, timeoutMs: number, settle: Settle): void {
    this.#pending.delete(id);
    const { cancelNotification } = this.#options;
    const within = `No answer to ${method} within ${timeoutMs / MS_PER_SECOND} s`;
    if (cancelNotification === null) {
      this.#handlers.log(within);
    } else {
      this.notify(cancelNotification, { id });
      this.#handlers.log(`${within}; cancelled`);
    }
    settle({ kind: "timedOut" });
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
      case "error": {
        const { code, data } = message;
        this.#settle(message.id, { kind: "error", code, message: message.message, data });
        return;
      }
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
    this.#clearTimer(pending);
    pending.settle(reply);
  }

  #clearTimer(pending: Pending): void {
    if (pending.timer !== null) {
      this.#timers.clearTimeout(pending.timer);
    }
  }
}
