import type { ServerHost } from "../ipc";
import { DocEntry, type ResultDocument } from "./internal/documents";
import { format, type FormatReply, type FormattingOptions } from "./internal/formatting";
import { hostContext, type HostContext } from "./internal/handshake";
import { sameValue } from "./internal/json";
import { LogBook, type LogLine } from "./internal/log";
import { Server, type ServerEnv } from "./internal/server";
import type { ServerSpec } from "./internal/spec";
import type { ServerView } from "./internal/state";
import { SYSTEM_TIMERS, type Timers } from "./internal/timers";

export type { DocVersion } from "./internal/version";
export { isDocVersion } from "./internal/version";
export { addedSpecs } from "./internal/added";
export { detect } from "./internal/detect";
export type { ResultDocument } from "./internal/documents";
export type { FormatRefusal, FormatReply, FormattingOptions } from "./internal/formatting";
export type { LogLine } from "./internal/log";
export type { LinePosition, ProblemSeverity, ServerProblem } from "./internal/problems";
export type { InstallHint, PackageManager, PythonManager, ServerSpec } from "./internal/spec";
export type { FailReason, ServerState, ServerView } from "./internal/state";
export type { Timers } from "./internal/timers";

export interface OpenDocument {
  changed(): void;
  format(options: FormattingOptions): Promise<FormatReply>;
  close(): void;
}

export class LanguageServers {
  readonly #host: ServerHost | null;
  readonly #timers: Timers;
  readonly #env: ServerEnv;
  readonly #logs = new LogBook();
  readonly #listeners = new Set<() => void>();
  #retired: Server[] = [];
  #context: Promise<HostContext> | null = null;
  #servers: Server[] = [];
  #documents: DocEntry[] = [];
  #startOnOpen = false;

  constructor(host: ServerHost | null, timers: Timers = SYSTEM_TIMERS) {
    this.#host = host;
    this.#timers = timers;
    this.#env = {
      host,
      timers,
      context: (host) => {
        this.#context ??= hostContext(host);
        return this.#context;
      },
      documents: () => this.#documents,
      log: (name, source, text) => {
        this.#logs.add(name, { at: timers.now(), source, text });
        this.#changed();
      },
      changed: () => this.#changed(),
    };
  }

  setSpecs(specs: readonly ServerSpec[], options: { readonly startOnOpen: boolean }): void {
    this.#startOnOpen = options.startOnOpen;
    const old = this.#servers;
    this.#servers = specs.map(
      (spec) => old.find((server) => sameValue(server.spec, spec)) ?? this.#create(spec, old),
    );
    this.#retire(old.filter((candidate) => !this.#servers.includes(candidate)));
    this.#servers.forEach((server) => this.#startIfServing(server));
    this.#changed();
  }

  haltAll(): void {
    const old = this.#servers;
    this.#servers = old.map((server) => new Server(server.spec, this.#env, server.userStopped));
    this.#retire(old);
    this.#changed();
  }

  start(name: string): void {
    this.#named(name)?.start();
  }

  stop(name: string): void {
    void this.#named(name)?.stop();
  }

  restart(name: string): void {
    this.#named(name)?.restart();
  }

  views(): readonly ServerView[] {
    return this.#servers.map(({ spec, state }) => ({
      name: spec.name,
      project: spec.project,
      state,
    }));
  }

  log(name: string): readonly LogLine[] {
    return this.#logs.lines(name);
  }

  serving(path: string): boolean {
    return this.#servers.some((server) => server.state.kind === "running" && server.serves(path));
  }

  onChange(listener: () => void): () => void {
    function own(): void {
      listener();
    }
    this.#listeners.add(own);
    return () => this.#listeners.delete(own);
  }

  open(doc: ResultDocument): OpenDocument {
    const entry = new DocEntry(doc, this.#timers, {
      synced: (synced, sent) =>
        this.#servers.forEach((server) => server.running?.docs.change(synced, sent)),
      isOpenOnAServer: (open) =>
        this.#servers.some((server) => server.running?.docs.has(open) === true),
    });
    this.#documents = [...this.#documents, entry];
    for (const server of this.#servers.filter((candidate) => candidate.serves(doc.path))) {
      server.running?.docs.open(entry);
      this.#startIfServing(server);
    }
    return {
      changed: () => entry.changed(),
      format: (options) =>
        this.#host === null
          ? Promise.resolve({ kind: "noFormatter" })
          : format(entry, this.#servers, options, this.#timers),
      close: () => this.#close(entry),
    };
  }

  async destroy(): Promise<void> {
    const all = [...this.#retired, ...this.#servers];
    this.#servers = [];
    await Promise.all(all.map((server) => server.halt()));
  }

  #create(spec: ServerSpec, old: readonly Server[]): Server {
    const stopped = old.some(
      (previous) => previous.spec.name === spec.name && previous.userStopped,
    );
    return new Server(spec, this.#env, stopped);
  }

  #retire(removed: readonly Server[]): void {
    removed.forEach((server) => {
      void server.halt().then(() => {
        this.#retired = this.#retired.filter((retired) => retired !== server);
      });
    });
    this.#retired = [...this.#retired, ...removed];
  }

  #startIfServing(server: Server): void {
    const wanted =
      this.#startOnOpen &&
      !server.userStopped &&
      server.state.kind === "stopped" &&
      this.#documents.some((entry) => server.serves(entry.doc.path));
    if (wanted) {
      server.start();
    }
  }

  #close(entry: DocEntry): void {
    this.#servers.forEach((server) => server.running?.docs.close(entry));
    this.#documents = this.#documents.filter((candidate) => candidate !== entry);
  }

  #named(name: string): Server | undefined {
    return this.#servers.find((server) => server.spec.name === name);
  }

  #changed(): void {
    this.#listeners.forEach((listener) => listener());
  }
}
