import type { ServerProblem } from "./problems";
import type { Timers } from "./timers";
import { nextVersion, type DocVersion } from "./version";

export interface ResultDocument {
  readonly path: string;
  take(version: DocVersion): string;
  showProblems(server: string, version: DocVersion, problems: readonly ServerProblem[]): void;
}

export type Sent = { readonly version: DocVersion; readonly text: string };

const SYNC_DELAY_MS = 300;

export type DocEvents = {
  readonly synced: (entry: DocEntry, sent: Sent) => void;
  readonly isOpenOnAServer: (entry: DocEntry) => boolean;
};

export class DocEntry {
  readonly doc: ResultDocument;
  readonly #timers: Timers;
  readonly #events: DocEvents;
  #version: DocVersion | null = null;
  #unchanged: Sent | null = null;
  #timer: number | undefined;

  constructor(doc: ResultDocument, timers: Timers, events: DocEvents) {
    this.doc = doc;
    this.#timers = timers;
    this.#events = events;
  }

  changed(): void {
    this.#unchanged = null;
    this.#timers.clearTimeout(this.#timer);
    this.#timer = this.#timers.setTimeout(() => {
      if (this.#events.isOpenOnAServer(this)) {
        this.sync();
      }
    }, SYNC_DELAY_MS);
  }

  current(): Sent {
    return this.#unchanged ?? this.sync();
  }

  sync(): Sent {
    this.#timers.clearTimeout(this.#timer);
    const version = nextVersion(this.#version);
    const sent = { version, text: this.doc.take(version) };
    this.#version = version;
    this.#unchanged = sent;
    this.#events.synced(this, sent);
    return sent;
  }
}
