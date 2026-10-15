import { afterEach, beforeEach, expect, test, vi } from "vitest";

import type {
  HostEvent,
  ProgramFound,
  ProjectFile,
  RunId,
  ServerCommand,
  ServerContext,
  ServerHost,
  StartReply,
} from "../ipc";
import {
  LanguageServers,
  addedSpecs,
  isDocVersion,
  presetChoices,
  type PresetChoice,
  type SpecNote,
  type DocVersion,
  type FailReason,
  type FormatRefusal,
  type FormatReply,
  type FormattingOptions,
  type InstallHint,
  type LinePosition,
  type PackageManager,
  type ProblemSeverity,
  type ResultDocument,
  type ServerProblem,
  type ServerSpec,
  type ServerState,
  type Timers,
} from "./index";

type Json = Record<string, unknown>;

type Received = {
  readonly id?: number | string;
  readonly method?: string;
  readonly params?: unknown;
  readonly result?: unknown;
  readonly error?: unknown;
};

type Handler = (params: unknown, server: FakeServer) => unknown;

const NO_REPLY = Symbol("no reply");

class ReplyError {
  readonly code: number;
  readonly message: string;

  constructor(code: number, message: string) {
    this.code = code;
    this.message = message;
  }
}

function isRunId(n: number): n is RunId {
  return Number.isSafeInteger(n);
}

function runId(n: number): RunId {
  if (!isRunId(n)) {
    throw new Error("bad run id");
  }
  return n;
}

class FakeServer {
  readonly run: RunId;
  readonly command: ServerCommand;
  readonly received: Received[] = [];
  readonly answers = new Map<number | string, Received>();
  capabilities: Json = {};
  handlers: Record<string, Handler> = {};
  ignoresStop = false;
  readonly #emit: (event: HostEvent) => void;
  #nextId = 1;

  constructor(run: RunId, command: ServerCommand, emit: (event: HostEvent) => void) {
    this.run = run;
    this.command = command;
    this.#emit = emit;
  }

  receive(text: string): void {
    const message: Received = JSON.parse(text);
    this.received.push(message);
    if (message.method === undefined && message.id !== undefined) {
      this.answers.set(message.id, message);
      return;
    }
    if (message.method === undefined || message.id === undefined) {
      return;
    }
    const id = message.id;
    const handler = this.handlers[message.method] ?? this.#defaultHandler(message.method);
    queueMicrotask(() => {
      try {
        const result = handler(message.params, this);
        if (result !== NO_REPLY) {
          this.raw({ jsonrpc: "2.0", id, result });
        }
      } catch (error) {
        if (error instanceof ReplyError) {
          this.raw({ jsonrpc: "2.0", id, error: { code: error.code, message: error.message } });
        }
      }
    });
  }

  raw(message: unknown): void {
    this.text(JSON.stringify(message));
  }

  text(text: string): void {
    this.#emit({ kind: "Message", text });
  }

  notify(method: string, params: unknown): void {
    this.raw({ jsonrpc: "2.0", method, params });
  }

  request(method: string, params: unknown): string {
    const id = `s${this.#nextId}`;
    this.#nextId += 1;
    this.raw({ jsonrpc: "2.0", id, method, params });
    return id;
  }

  stderr(line: string): void {
    this.#emit({ kind: "Log", line });
  }

  exit(code: number | null): void {
    this.#emit({ kind: "Exited", code });
  }

  methods(): string[] {
    return this.received.flatMap((message) =>
      message.method === undefined ? [] : [message.method],
    );
  }

  sent(method: string): Received[] {
    return this.received.filter((message) => message.method === method);
  }

  #defaultHandler(method: string): Handler {
    if (method === "initialize") {
      return () => ({ capabilities: this.capabilities });
    }
    return () => null;
  }
}

class FakeHost implements ServerHost {
  readonly servers: FakeServer[] = [];
  readonly stopped: RunId[] = [];
  setup: (server: FakeServer) => void = () => undefined;
  reply: (command: ServerCommand) => StartReply | null = () => null;
  root: string | null = "/repo";
  gate: Promise<void> = Promise.resolve();
  contextCalls = 0;
  contextError: Error | null = null;
  startError: Error | null = null;
  stopError: Error | null = null;

  context(): Promise<ServerContext> {
    this.contextCalls += 1;
    return this.contextError === null
      ? Promise.resolve({ root: this.root, process_id: 4242 })
      : Promise.reject(this.contextError);
  }

  async start(command: ServerCommand, onEvent: (event: HostEvent) => void): Promise<StartReply> {
    await this.gate;
    if (this.startError !== null) {
      throw this.startError;
    }
    const refused = this.reply(command);
    if (refused !== null) {
      return refused;
    }
    const server = new FakeServer(runId(this.servers.length + 1), command, onEvent);
    this.servers.push(server);
    this.setup(server);
    return { kind: "Started", run: server.run };
  }

  send(run: RunId, message: string): void {
    this.server(run).receive(message);
  }

  stop(run: RunId): Promise<void> {
    this.stopped.push(run);
    const server = this.server(run);
    if (!server.ignoresStop) {
      queueMicrotask(() => server.exit(0));
    }
    return this.stopError === null ? Promise.resolve() : Promise.reject(this.stopError);
  }

  findProgram(): Promise<ProgramFound> {
    return Promise.resolve({ kind: "NotFound", searched: [] });
  }

  projectFiles(paths: readonly string[]): Promise<readonly ProjectFile[]> {
    return Promise.resolve(paths.map(() => ({ kind: "Missing" })));
  }

  server(run: RunId): FakeServer {
    const server = this.servers.find((candidate) => candidate.run === run);
    if (server === undefined) {
      throw new Error(`no server ${run}`);
    }
    return server;
  }

  only(program: string): FakeServer {
    const matching = this.servers.filter((server) => server.command.program === program);
    const last = matching.at(-1);
    if (last === undefined) {
      throw new Error(`no server for ${program}`);
    }
    return last;
  }
}

type Shown = {
  readonly server: string;
  readonly version: DocVersion;
  readonly problems: readonly ServerProblem[];
};

class FakeDoc implements ResultDocument {
  readonly path: string;
  text: string;
  readonly taken: { readonly version: DocVersion; readonly text: string }[] = [];
  readonly shown: Shown[] = [];

  constructor(path: string, text: string) {
    this.path = path;
    this.text = text;
  }

  take(version: DocVersion): string {
    this.taken.push({ version, text: this.text });
    return this.text;
  }

  showProblems(server: string, version: DocVersion, problems: readonly ServerProblem[]): void {
    this.shown.push({ server, version, problems });
  }

  lastShown(server: string): Shown | undefined {
    return this.shown.filter((shown) => shown.server === server).at(-1);
  }
}

const TIMERS: Timers = {
  now: () => Date.now(),
  setTimeout: (run, ms) => globalThis.setTimeout(run, ms),
  clearTimeout: (id) => globalThis.clearTimeout(id),
};

function spec(name: string, overrides: Partial<ServerSpec> = {}): ServerSpec {
  return {
    name,
    command: { program: name, args: ["--lsp"] },
    project: "",
    folders: { project: ["node_modules/.bin"], home: [] },
    fileTypes: ["ts"],
    formats: false,
    settings: null,
    initializationOptions: null,
    install: null,
    help: null,
    notes: [],
    ...overrides,
  };
}

const MANAGER: PackageManager = "pnpm";

const INSTALL_HINT: InstallHint = {
  kind: "node",
  package: "typescript-language-server",
  program: "typescript-language-server",
  folder: "frontend",
  manager: MANAGER,
  reason: { kind: "typescript", version: "5.9.3" },
};

const OPTIONS: FormattingOptions = { tabSize: 2, insertSpaces: true };

function diagnostic(line: number, message: string, severity?: number): Json {
  const start: LinePosition = { line, character: 0 };
  return {
    range: { start, end: { line, character: 3 } },
    message,
    ...(severity === undefined ? {} : { severity }),
  };
}

async function settle(): Promise<void> {
  await vi.advanceTimersByTimeAsync(0);
}

let host: FakeHost;

beforeEach(() => {
  vi.useFakeTimers();
  host = new FakeHost();
});

afterEach(() => {
  vi.useRealTimers();
});

function servers(specs: ServerSpec[], startOnOpen = true): LanguageServers {
  const languageServers = new LanguageServers(host, TIMERS);
  languageServers.setSpecs(specs, { startOnOpen });
  return languageServers;
}

function stateOf(languageServers: LanguageServers, name: string): ServerState | undefined {
  return languageServers.views().find((view) => view.name === name)?.state;
}

test("rule 1: a spec serves a path by its extension and its project folder", async () => {
  const languageServers = servers([
    spec("oxlint", { project: "frontend", fileTypes: ["ts", "vue"] }),
  ]);
  languageServers.open(new FakeDoc("backend/a.ts", ""));
  languageServers.open(new FakeDoc("frontend/a.css", ""));
  languageServers.open(new FakeDoc("frontendish/a.ts", ""));
  await settle();
  expect(host.servers).toHaveLength(0);

  languageServers.open(new FakeDoc("frontend/src/App.VUE", "<template/>"));
  await settle();

  expect(host.only("oxlint").sent("textDocument/didOpen")).toEqual([
    expect.objectContaining({
      params: {
        textDocument: {
          uri: "file:///repo/frontend/src/App.VUE",
          languageId: "vue",
          version: 1,
          text: "<template/>",
        },
      },
    }),
  ]);
});

test("rule 1: serving(path) is true only while a running server serves the path", async () => {
  const languageServers = servers(
    [
      spec("oxlint", { project: "frontend", fileTypes: ["ts"] }),
      spec("oxfmt", { fileTypes: ["md"] }),
    ],
    false,
  );
  expect(languageServers.serving("frontend/a.ts")).toBe(false);

  languageServers.start("oxlint");
  await settle();

  expect(languageServers.serving("frontend/a.ts")).toBe(true);
  expect(languageServers.serving("frontend/a.md")).toBe(false);
  expect(languageServers.serving("backend/a.ts")).toBe(false);

  languageServers.stop("oxlint");
  await settle();

  expect(stateOf(languageServers, "oxlint")).toEqual({ kind: "stopped" });
  expect(languageServers.serving("frontend/a.ts")).toBe(false);
});

test("rule 2: a spec starts when the first document it serves opens", async () => {
  const languageServers = servers([spec("oxlint")]);
  expect(stateOf(languageServers, "oxlint")).toEqual({ kind: "stopped" });

  languageServers.open(new FakeDoc("a.ts", "x"));
  expect(stateOf(languageServers, "oxlint")).toEqual({ kind: "starting" });
  await settle();

  expect(stateOf(languageServers, "oxlint")).toEqual({ kind: "running" });
  expect(host.servers).toHaveLength(1);
  expect(host.only("oxlint").command).toEqual({
    program: "oxlint",
    args: ["--lsp"],
    project: "",
    folders: { project: ["node_modules/.bin"], home: [] },
  });
});

test("an added server's start command looks in every ecosystem's folders", async () => {
  const languageServers = servers([
    ...addedSpecs([{ command: ["pylsp"], fileTypes: ["ts"] }], [], "/repo"),
  ]);
  languageServers.open(new FakeDoc("a.ts", "x"));
  await settle();

  expect(host.only("pylsp").command).toEqual({
    program: "pylsp",
    args: [],
    project: "",
    folders: {
      project: [
        "node_modules/.bin",
        ".venv/bin",
        ".venv/Scripts",
        "venv/bin",
        "venv/Scripts",
        "vendor/bin",
      ],
      home: [
        ".local/bin",
        ".cargo/bin",
        "go/bin",
        ".config/composer/vendor/bin",
        ".composer/vendor/bin",
      ],
    },
  });
});

test("rule 2: a document already open at setSpecs starts the spec", async () => {
  const languageServers = new LanguageServers(host, TIMERS);
  languageServers.open(new FakeDoc("a.ts", "x"));
  languageServers.setSpecs([spec("oxlint")], { startOnOpen: true });
  await settle();

  expect(stateOf(languageServers, "oxlint")).toEqual({ kind: "running" });
});

test("rule 2: startOnOpen false stays stopped until start(name)", async () => {
  const languageServers = servers([spec("oxlint")], false);
  const doc = new FakeDoc("a.ts", "x");
  languageServers.open(doc);
  await settle();
  expect(stateOf(languageServers, "oxlint")).toEqual({ kind: "stopped" });
  expect(host.servers).toHaveLength(0);

  languageServers.start("oxlint");
  await settle();

  expect(stateOf(languageServers, "oxlint")).toEqual({ kind: "running" });
  expect(host.only("oxlint").sent("textDocument/didOpen")).toHaveLength(1);
});

test("rule 2: a spec with install is notInstalled and never started", async () => {
  const languageServers = servers([spec("tsserver", { install: INSTALL_HINT })]);
  languageServers.open(new FakeDoc("a.ts", "x"));
  languageServers.start("tsserver");
  languageServers.restart("tsserver");
  await settle();

  expect(stateOf(languageServers, "tsserver")).toEqual({
    kind: "notInstalled",
    hint: INSTALL_HINT,
  });
  expect(host.servers).toHaveLength(0);
});

test("rule 2: a user stop survives setSpecs, even with startOnOpen, until start", async () => {
  const languageServers = servers([spec("oxlint")]);
  languageServers.open(new FakeDoc("a.ts", "x"));
  await settle();
  languageServers.stop("oxlint");
  expect(stateOf(languageServers, "oxlint")).toEqual({ kind: "stopping" });
  await settle();
  expect(stateOf(languageServers, "oxlint")).toEqual({ kind: "stopped" });

  languageServers.setSpecs([spec("oxlint")], { startOnOpen: true });
  languageServers.setSpecs([spec("oxlint", { command: { program: "oxlint", args: [] } })], {
    startOnOpen: true,
  });
  languageServers.open(new FakeDoc("b.ts", "y"));
  await settle();
  expect(stateOf(languageServers, "oxlint")).toEqual({ kind: "stopped" });
  expect(host.servers).toHaveLength(1);

  languageServers.start("oxlint");
  await settle();
  expect(stateOf(languageServers, "oxlint")).toEqual({ kind: "running" });
});

test("haltAll stops every run without a user stop; Start on open starts them again", async () => {
  const languageServers = servers([spec("oxlint"), spec("oxfmt")]);
  languageServers.open(new FakeDoc("a.ts", "x"));
  await settle();
  const [lint, format] = [host.only("oxlint"), host.only("oxfmt")];

  languageServers.haltAll();
  languageServers.setSpecs([spec("oxlint"), spec("oxfmt")], { startOnOpen: false });
  await settle();
  expect(host.stopped).toEqual([lint.run, format.run]);
  expect(languageServers.views().map((view) => view.state.kind)).toEqual(["stopped", "stopped"]);

  languageServers.setSpecs([spec("oxlint"), spec("oxfmt")], { startOnOpen: true });
  await settle();
  expect(languageServers.views().map((view) => view.state.kind)).toEqual(["running", "running"]);
  expect(host.servers).toHaveLength(4);
});

test("haltAll shows a crashed server as stopped and tells onChange listeners", async () => {
  const languageServers = servers([spec("oxlint")]);
  languageServers.open(new FakeDoc("a.ts", "x"));
  await settle();
  host.only("oxlint").exit(3);
  await settle();
  expect(stateOf(languageServers, "oxlint")).toEqual({ kind: "crashed", code: 3 });
  const listener = vi.fn();
  languageServers.onChange(listener);

  languageServers.haltAll();

  expect(listener).toHaveBeenCalledTimes(1);
  expect(stateOf(languageServers, "oxlint")).toEqual({ kind: "stopped" });
});

test("haltAll leaves startOnOpen as it was and starts nothing until a document opens", async () => {
  const languageServers = servers([spec("oxlint")]);
  languageServers.open(new FakeDoc("a.ts", "x"));
  await settle();

  languageServers.haltAll();
  await settle();
  expect(stateOf(languageServers, "oxlint")).toEqual({ kind: "stopped" });
  expect(host.servers).toHaveLength(1);

  languageServers.open(new FakeDoc("b.ts", "y"));
  await settle();
  expect(stateOf(languageServers, "oxlint")).toEqual({ kind: "running" });
});

test("a Start on open right after haltAll, while the old run still stops, starts a new run", async () => {
  host.setup = (server) => {
    server.ignoresStop = true;
  };
  const languageServers = servers([spec("oxlint")]);
  languageServers.open(new FakeDoc("a.ts", "x"));
  await settle();

  languageServers.haltAll();
  languageServers.setSpecs([spec("oxlint")], { startOnOpen: true });
  await settle();

  expect(host.servers).toHaveLength(2);
  expect(stateOf(languageServers, "oxlint")).toEqual({ kind: "running" });
});

test("a server the user stopped stays stopped after haltAll and a Start on open", async () => {
  const languageServers = servers([spec("oxlint"), spec("oxfmt")]);
  languageServers.open(new FakeDoc("a.ts", "x"));
  await settle();
  languageServers.stop("oxlint");
  await settle();

  languageServers.haltAll();
  languageServers.setSpecs([spec("oxlint"), spec("oxfmt")], { startOnOpen: true });
  await settle();

  expect(languageServers.views().map((view) => view.state.kind)).toEqual(["stopped", "running"]);
  expect(host.servers.map((server) => server.command.program)).toEqual([
    "oxlint",
    "oxfmt",
    "oxfmt",
  ]);
});

test("destroy waits for runs halted by haltAll", async () => {
  host.setup = (server) => {
    server.ignoresStop = true;
  };
  const languageServers = servers([spec("oxlint")]);
  languageServers.open(new FakeDoc("a.ts", "x"));
  await settle();
  languageServers.haltAll();
  let destroyed = false;
  void languageServers.destroy().then(() => {
    destroyed = true;
  });
  await settle();
  expect(destroyed).toBe(false);

  host.only("oxlint").exit(0);
  await settle();
  expect(destroyed).toBe(true);
});

test("rule 9: stop sends didClose, shutdown, exit, then host.stop, and waits for Exited", async () => {
  const languageServers = servers([spec("oxlint")]);
  languageServers.open(new FakeDoc("a.ts", "x"));
  await settle();
  const server = host.only("oxlint");
  server.ignoresStop = true;

  languageServers.stop("oxlint");
  await settle();

  expect(server.methods().slice(-3)).toEqual(["textDocument/didClose", "shutdown", "exit"]);
  expect(host.stopped).toEqual([server.run]);
  expect(stateOf(languageServers, "oxlint")).toEqual({ kind: "stopping" });

  server.exit(0);
  await settle();
  expect(stateOf(languageServers, "oxlint")).toEqual({ kind: "stopped" });
});

test("rule 9: a shutdown without an answer waits 2 s, then exit and host.stop", async () => {
  host.setup = (server) => {
    server.handlers = { shutdown: () => NO_REPLY };
  };
  const languageServers = servers([spec("oxlint")]);
  languageServers.open(new FakeDoc("a.ts", "x"));
  await settle();

  languageServers.stop("oxlint");
  await vi.advanceTimersByTimeAsync(1999);
  expect(host.stopped).toEqual([]);
  await vi.advanceTimersByTimeAsync(1);

  expect(host.only("oxlint").methods().slice(-3)).toEqual(["shutdown", "$/cancelRequest", "exit"]);
  expect(host.stopped).toHaveLength(1);
  expect(stateOf(languageServers, "oxlint")).toEqual({ kind: "stopped" });
});

test("rule 3: setSpecs keeps an unchanged spec's run and starts a newly installed one", async () => {
  const languageServers = servers([
    spec("oxlint", { settings: { a: [1, { b: 2 }] } }),
    spec("tsserver", { install: INSTALL_HINT }),
  ]);
  languageServers.open(new FakeDoc("a.ts", "x"));
  await settle();
  expect(host.servers.map((server) => server.command.program)).toEqual(["oxlint"]);

  const help = { kind: "system", program: "tsserver" } as const;
  const notes = [{ kind: "vueNeedsTypeScript6", version: "7.0.0" }] as const;
  languageServers.setSpecs(
    [spec("oxlint", { settings: { a: [1, { b: 2 }] } }), spec("tsserver", { help, notes })],
    { startOnOpen: true },
  );
  await settle();

  expect(host.servers.map((server) => server.command.program)).toEqual(["oxlint", "tsserver"]);
  expect(host.stopped).toEqual([]);
  expect(languageServers.views()).toEqual([
    { name: "oxlint", project: "", state: { kind: "running" }, help: null, notes: [] },
    { name: "tsserver", project: "", state: { kind: "running" }, help, notes },
  ]);
});

test("rule 3: a changed spec is stopped and started again; a removed one is stopped", async () => {
  const languageServers = servers([spec("oxlint"), spec("oxfmt")]);
  const doc = new FakeDoc("a.ts", "x");
  languageServers.open(doc);
  await settle();
  const oldLint = host.only("oxlint");
  const oldFormat = host.only("oxfmt");
  oldLint.notify("textDocument/publishDiagnostics", {
    uri: "file:///repo/a.ts",
    diagnostics: [diagnostic(0, "lint")],
  });
  await settle();

  languageServers.setSpecs([spec("oxlint", { settings: { changed: true } })], {
    startOnOpen: true,
  });
  await settle();

  expect(new Set(host.stopped)).toEqual(new Set([oldLint.run, oldFormat.run]));
  expect(host.only("oxlint")).not.toBe(oldLint);
  expect(languageServers.views().map((view) => [view.name, view.state.kind])).toEqual([
    ["oxlint", "running"],
  ]);
  expect(
    doc.shown.filter((shown) => shown.server === "oxlint").map((s) => s.problems.length),
  ).toEqual([1, 0]);
});

test("rule 3: once Vue's plugin is installed, the next detection drops Vue and restarts TypeScript serving .vue", async () => {
  const vueHint: InstallHint = {
    ...INSTALL_HINT,
    package: "@vue/typescript-plugin",
    reason: { kind: "vue" },
  };
  const typescript = spec("TypeScript");
  const languageServers = servers([
    typescript,
    spec("Vue", { fileTypes: ["vue"], install: vueHint }),
  ]);
  languageServers.open(new FakeDoc("a.ts", "x"));
  languageServers.open(new FakeDoc("App.vue", "x"));
  await settle();
  const before = host.only("TypeScript");

  const plugins = {
    plugins: [{ name: "@vue/typescript-plugin", location: "/repo", languages: ["vue"] }],
  };
  languageServers.setSpecs(
    [spec("TypeScript", { fileTypes: ["ts", "vue"], initializationOptions: plugins })],
    { startOnOpen: true },
  );
  await settle();

  expect(host.stopped).toEqual([before.run]);
  expect(host.only("TypeScript")).not.toBe(before);
  expect(languageServers.views().map((view) => [view.name, view.state.kind])).toEqual([
    ["TypeScript", "running"],
  ]);
  expect(languageServers.serving("App.vue")).toBe(true);
});

test("a spec's notes are part of it: a TypeScript 7 spec gaining the Vue note is a changed spec", async () => {
  const note: SpecNote = { kind: "vueNeedsTypeScript6", version: "7.0.0" };
  const languageServers = servers([spec("TypeScript")]);
  languageServers.open(new FakeDoc("a.ts", "x"));
  await settle();
  const before = host.only("TypeScript");

  languageServers.setSpecs([spec("TypeScript", { notes: [note] })], { startOnOpen: true });
  await settle();

  expect(host.stopped).toEqual([before.run]);
});

test("presetChoices is the public preset list for Settings", () => {
  const first: PresetChoice | undefined = presetChoices()[0];

  expect(first).toEqual({
    name: "oxfmt",
    command: ["oxfmt", "--lsp"],
    fileTypes: expect.arrayContaining(["ts", "vue"]),
  });
});

test("rule 4: initialize carries the project, capabilities and options; then initialized and configuration", async () => {
  const languageServers = servers([
    spec("oxlint", {
      project: "frontend",
      fileTypes: ["ts"],
      settings: { run: "onType" },
      initializationOptions: [
        { workspaceUri: "file:///repo/frontend", options: { run: "onType" } },
      ],
    }),
  ]);
  languageServers.open(new FakeDoc("frontend/a.ts", "x"));
  await settle();
  const server = host.only("oxlint");

  expect(server.command.project).toBe("frontend");
  expect(server.methods().slice(0, 4)).toEqual([
    "initialize",
    "initialized",
    "workspace/didChangeConfiguration",
    "textDocument/didOpen",
  ]);
  expect(server.sent("initialize")[0]?.params).toEqual({
    processId: 4242,
    clientInfo: { name: "yamt" },
    rootUri: "file:///repo/frontend",
    workspaceFolders: [{ uri: "file:///repo/frontend", name: "frontend" }],
    capabilities: {
      general: { positionEncodings: ["utf-16"] },
      textDocument: {
        synchronization: { dynamicRegistration: false, didSave: false },
        publishDiagnostics: { versionSupport: true },
        diagnostic: { dynamicRegistration: false },
        formatting: { dynamicRegistration: false },
      },
      workspace: {
        configuration: true,
        workspaceFolders: true,
        diagnostics: { refreshSupport: true },
      },
    },
    initializationOptions: [{ workspaceUri: "file:///repo/frontend", options: { run: "onType" } }],
  });
  expect(server.sent("workspace/didChangeConfiguration")[0]?.params).toEqual({
    settings: { run: "onType" },
  });
  expect(languageServers.log("oxlint").map((line) => line.text)).toContain(
    "Starting oxlint --lsp in frontend",
  );
});

test("rule 4: initialize without initializationOptions omits them; the root folder is named after the repository", async () => {
  const languageServers = servers([spec("oxlint")]);
  languageServers.open(new FakeDoc("a.ts", "x"));
  await settle();
  const params = host.only("oxlint").sent("initialize")[0]?.params;

  expect(params).not.toHaveProperty("initializationOptions");
  expect(params).toMatchObject({
    rootUri: "file:///repo",
    workspaceFolders: [{ uri: "file:///repo", name: "repo" }],
  });
  expect(languageServers.log("oxlint").map((line) => line.text)).toContain(
    "Starting oxlint --lsp in the repository root",
  );
});

test("rule 4: no answer to initialize within 30 s fails timedOut and stops the run", async () => {
  host.setup = (server) => {
    server.handlers = { initialize: () => NO_REPLY };
  };
  const languageServers = servers([spec("oxlint")]);
  languageServers.open(new FakeDoc("a.ts", "x"));
  await vi.advanceTimersByTimeAsync(29_999);
  expect(stateOf(languageServers, "oxlint")).toEqual({ kind: "starting" });

  await vi.advanceTimersByTimeAsync(1);

  expect(stateOf(languageServers, "oxlint")).toEqual({
    kind: "failed",
    reason: { kind: "timedOut" },
  });
  expect(host.stopped).toEqual([host.only("oxlint").run]);
  await settle();
  expect(stateOf(languageServers, "oxlint")).toEqual({
    kind: "failed",
    reason: { kind: "timedOut" },
  });
});

test("rule 4: an error reply to initialize fails initializeFailed", async () => {
  host.setup = (server) => {
    server.handlers = {
      initialize: () => {
        throw new ReplyError(-32603, "bad config");
      },
    };
  };
  const languageServers = servers([spec("oxlint")]);
  languageServers.open(new FakeDoc("a.ts", "x"));
  await settle();

  expect(stateOf(languageServers, "oxlint")).toEqual({
    kind: "failed",
    reason: { kind: "initializeFailed", message: "bad config" },
  });
  expect(languageServers.log("oxlint").map((line) => line.text)).toContain(
    "Initialize failed: bad config",
  );
  expect(host.only("oxlint").methods()).toEqual(["initialize"]);
});

test("rule 4: a malformed initialize result fails initializeFailed", async () => {
  host.setup = (server) => {
    server.handlers = { initialize: () => ({ nothing: true }) };
  };
  const languageServers = servers([spec("oxlint")]);
  languageServers.open(new FakeDoc("a.ts", "x"));
  await settle();

  expect(stateOf(languageServers, "oxlint")).toMatchObject({
    kind: "failed",
    reason: { kind: "initializeFailed" },
  });
});

test("rule 4: start replies map to failed reasons", async () => {
  host.reply = (command) => {
    switch (command.program) {
      case "a":
        return {
          kind: "NotFound",
          program: "a",
          searched: ["/repo/node_modules/.bin", "/usr/bin"],
        };
      case "b":
        return { kind: "SpawnFailed", program: "b", message: "permission denied" };
      case "c":
        return { kind: "OutsideRepository", project: "../x" };
      default:
        return null;
    }
  };
  const languageServers = servers([spec("a"), spec("b"), spec("c")]);
  languageServers.open(new FakeDoc("a.ts", "x"));
  await settle();

  expect(languageServers.views().map((view) => view.state)).toEqual([
    {
      kind: "failed",
      reason: { kind: "notFound", program: "a", searched: ["/repo/node_modules/.bin", "/usr/bin"] },
    },
    { kind: "failed", reason: { kind: "spawnFailed", message: "permission denied" } },
    { kind: "failed", reason: { kind: "outsideRepository", project: "../x" } },
  ]);
  expect(languageServers.log("a").at(-1)?.text).toBe(
    "Not found: a (searched /repo/node_modules/.bin, /usr/bin)",
  );
});

test("rule 4: a repository path that is not text fails every start", async () => {
  host.root = null;
  const languageServers = servers([spec("oxlint")]);
  languageServers.open(new FakeDoc("a.ts", "x"));
  await settle();

  expect(stateOf(languageServers, "oxlint")).toMatchObject({
    kind: "failed",
    reason: { kind: "initializeFailed" },
  });
  expect(host.servers).toHaveLength(0);
});

test("rule 5: sync sends the full text 300 ms after the last change, with rising versions", async () => {
  const languageServers = servers([spec("oxlint")]);
  const doc = new FakeDoc("a.ts", "one\r\n");
  const open = languageServers.open(doc);
  await settle();
  const server = host.only("oxlint");

  doc.text = "one\r\ntwo\r\n";
  open.changed();
  await vi.advanceTimersByTimeAsync(200);
  open.changed();
  await vi.advanceTimersByTimeAsync(299);
  expect(server.sent("textDocument/didChange")).toEqual([]);

  await vi.advanceTimersByTimeAsync(1);
  doc.text = "one\r\ntwo\r\nthree";
  open.changed();
  await vi.advanceTimersByTimeAsync(300);

  expect(server.sent("textDocument/didChange").map((message) => message.params)).toEqual([
    {
      textDocument: { uri: "file:///repo/a.ts", version: 2 },
      contentChanges: [{ text: "one\r\ntwo\r\n" }],
    },
    {
      textDocument: { uri: "file:///repo/a.ts", version: 3 },
      contentChanges: [{ text: "one\r\ntwo\r\nthree" }],
    },
  ]);
  expect(doc.taken.map((taken) => taken.version)).toEqual([1, 2, 3]);
});

test("rule 5: one take serves every server; close sends didClose and shows no more problems", async () => {
  const languageServers = servers([spec("oxlint"), spec("oxfmt")]);
  const doc = new FakeDoc("a.ts", "x");
  const open = languageServers.open(doc);
  await settle();
  doc.text = "y";
  open.changed();
  await vi.advanceTimersByTimeAsync(300);
  expect(doc.taken).toHaveLength(2);
  expect(host.only("oxfmt").sent("textDocument/didChange")).toHaveLength(1);

  open.close();
  host.only("oxlint").notify("textDocument/publishDiagnostics", {
    uri: "file:///repo/a.ts",
    diagnostics: [diagnostic(0, "late")],
  });
  await settle();

  expect(host.only("oxlint").sent("textDocument/didClose")).toHaveLength(1);
  expect(doc.shown).toEqual([]);
  open.changed();
  await vi.advanceTimersByTimeAsync(300);
  expect(doc.taken).toHaveLength(2);
});

test("rule 5: changes while no server has the document open are taken at the next open", async () => {
  const languageServers = servers([spec("oxlint")], false);
  const doc = new FakeDoc("a.ts", "x");
  const open = languageServers.open(doc);
  open.changed();
  await vi.advanceTimersByTimeAsync(300);
  expect(doc.taken).toEqual([]);

  languageServers.start("oxlint");
  await settle();

  expect(doc.taken).toHaveLength(1);
});

test("rule 6: pushed problems with and without a version land in one slot", async () => {
  const languageServers = servers([spec("oxlint")]);
  const doc = new FakeDoc("a.ts", "x");
  const open = languageServers.open(doc);
  await settle();
  doc.text = "xy";
  open.changed();
  await vi.advanceTimersByTimeAsync(300);
  const server = host.only("oxlint");

  server.notify("textDocument/publishDiagnostics", {
    uri: "file:///repo/a.ts",
    version: 1,
    diagnostics: [diagnostic(0, "old", 2)],
  });
  server.notify("textDocument/publishDiagnostics", {
    uri: "file:///repo/a.ts",
    diagnostics: [{ ...diagnostic(0, "now", 1), source: "oxlint", code: 42 }],
  });
  server.notify("textDocument/publishDiagnostics", {
    uri: "file:///repo/a.ts",
    version: 9,
    diagnostics: [],
  });
  server.notify("textDocument/publishDiagnostics", {
    uri: "file:///repo/other.ts",
    diagnostics: [],
  });
  await settle();

  expect(doc.shown).toEqual([
    {
      server: "oxlint",
      version: 1,
      problems: [
        {
          from: { line: 0, character: 0 },
          to: { line: 0, character: 3 },
          severity: "warning",
          message: "old",
          source: null,
          code: null,
        },
      ],
    },
    {
      server: "oxlint",
      version: 2,
      problems: [
        {
          from: { line: 0, character: 0 },
          to: { line: 0, character: 3 },
          severity: "error",
          message: "now",
          source: "oxlint",
          code: "42",
        },
      ],
    },
  ]);
  expect(languageServers.log("oxlint").at(-1)?.text).toBe(
    "Dropped problems for a version yamt never sent: 9",
  );
});

test("rule 6: severities map 1-4 to error, warning, info, hint; none means error", async () => {
  const languageServers = servers([spec("oxlint")]);
  const doc = new FakeDoc("a.ts", "x");
  languageServers.open(doc);
  await settle();
  host.only("oxlint").notify("textDocument/publishDiagnostics", {
    uri: "file:///repo/a.ts",
    diagnostics: [1, 2, 3, 4, undefined].map((severity) => diagnostic(0, "m", severity)),
  });
  await settle();

  const severities: ProblemSeverity[] = ["error", "warning", "info", "hint", "error"];
  expect(doc.lastShown("oxlint")?.problems.map((problem) => problem.severity)).toEqual(severities);
});

function pullServer(server: FakeServer, reports: Json[]): Received[] {
  const requests: Received[] = [];
  server.capabilities = { diagnosticProvider: { interFileDependencies: true } };
  server.handlers = {
    "textDocument/diagnostic": (params) => {
      requests.push({ params });
      return reports.shift() ?? NO_REPLY;
    },
  };
  return requests;
}

test("rule 6: pulled problems: after open and every sync, previousResultId sent, unchanged keeps items", async () => {
  let requests: Received[] = [];
  host.setup = (server) => {
    requests = pullServer(server, [
      { kind: "full", resultId: "r1", items: [diagnostic(0, "first")] },
      { kind: "unchanged", resultId: "r2" },
    ]);
  };
  const languageServers = servers([spec("tsgo")]);
  const doc = new FakeDoc("a.ts", "x");
  const open = languageServers.open(doc);
  await settle();
  expect(doc.lastShown("tsgo")).toMatchObject({ version: 1, problems: [{ message: "first" }] });

  open.changed();
  await vi.advanceTimersByTimeAsync(300);

  expect(requests.map((request) => request.params)).toEqual([
    { textDocument: { uri: "file:///repo/a.ts" } },
    { textDocument: { uri: "file:///repo/a.ts" }, previousResultId: "r1" },
  ]);
  expect(doc.lastShown("tsgo")).toMatchObject({ version: 2, problems: [{ message: "first" }] });
});

test("rule 6: a pull answered for an older version is pulled again; one pull in flight per document", async () => {
  const pending: ((report: Json) => void)[] = [];
  let server: FakeServer | undefined;
  host.setup = (created) => {
    server = created;
    created.capabilities = { diagnosticProvider: {} };
    created.handlers = {
      "textDocument/diagnostic": (_, self) => {
        const id = self.received.at(-1)?.id;
        pending.push((report) => self.raw({ jsonrpc: "2.0", id, result: report }));
        return NO_REPLY;
      },
    };
  };
  const languageServers = servers([spec("tsgo")]);
  const doc = new FakeDoc("a.ts", "x");
  const open = languageServers.open(doc);
  await settle();
  expect(pending).toHaveLength(1);

  open.changed();
  await vi.advanceTimersByTimeAsync(300);
  open.changed();
  await vi.advanceTimersByTimeAsync(300);
  expect(pending).toHaveLength(1);

  pending.shift()?.({ kind: "full", items: [diagnostic(0, "stale")] });
  await settle();

  expect(doc.lastShown("tsgo")).toMatchObject({ version: 1, problems: [{ message: "stale" }] });
  expect(pending).toHaveLength(1);
  pending.shift()?.({ kind: "full", items: [diagnostic(0, "fresh")] });
  await settle();
  expect(doc.lastShown("tsgo")).toMatchObject({ version: 3, problems: [{ message: "fresh" }] });
  expect(pending).toHaveLength(0);
  expect(server?.sent("textDocument/diagnostic")).toHaveLength(2);
});

test("rule 6: a late pull never replaces a newer push, nor a late push a newer pull", async () => {
  const pending: ((report: Json) => void)[] = [];
  host.setup = (server) => {
    server.capabilities = { diagnosticProvider: {} };
    server.handlers = {
      "textDocument/diagnostic": (_, self) => {
        const id = self.received.at(-1)?.id;
        pending.push((report) => self.raw({ jsonrpc: "2.0", id, result: report }));
        return NO_REPLY;
      },
    };
  };
  const languageServers = servers([spec("tsgo")]);
  const doc = new FakeDoc("a.ts", "x");
  const open = languageServers.open(doc);
  await settle();
  open.changed();
  await vi.advanceTimersByTimeAsync(300);
  const server = host.only("tsgo");

  server.notify("textDocument/publishDiagnostics", {
    uri: "file:///repo/a.ts",
    version: 2,
    diagnostics: [diagnostic(0, "pushed")],
  });
  await settle();
  pending.shift()?.({ kind: "full", items: [diagnostic(0, "late pull")] });
  await settle();
  pending.shift()?.({ kind: "full", items: [diagnostic(0, "pulled")] });
  await settle();
  server.notify("textDocument/publishDiagnostics", {
    uri: "file:///repo/a.ts",
    version: 1,
    diagnostics: [diagnostic(0, "late push")],
  });
  await settle();

  expect(doc.shown.map(({ version, problems }) => [version, problems[0]?.message])).toEqual([
    [2, "pushed"],
    [2, "pulled"],
  ]);
  expect(logOf(languageServers, "tsgo").slice(-2)).toEqual([
    "yamt: Dropped problems for version 1: version 2 is shown",
    "yamt: Dropped problems for version 1: version 2 is shown",
  ]);
});

test("rule 6: a sync of one document pulls every document on that server", async () => {
  let requests: Received[] = [];
  host.setup = (server) => {
    requests = pullServer(
      server,
      Array.from({ length: 10 }, () => ({ kind: "full", items: [] })),
    );
  };
  const languageServers = servers([spec("tsgo")]);
  const first = languageServers.open(new FakeDoc("a.ts", "x"));
  languageServers.open(new FakeDoc("b.ts", "y"));
  await settle();
  requests.length = 0;

  first.changed();
  await vi.advanceTimersByTimeAsync(300);

  expect(requests.map((request) => request.params)).toEqual([
    { textDocument: { uri: "file:///repo/a.ts" } },
    { textDocument: { uri: "file:///repo/b.ts" } },
  ]);
});

test("rule 6: workspace/diagnostic/refresh is answered null, then pulled again", async () => {
  let requests: Received[] = [];
  host.setup = (server) => {
    requests = pullServer(server, [
      { kind: "full", items: [] },
      { kind: "full", items: [diagnostic(0, "refreshed")] },
    ]);
  };
  const languageServers = servers([spec("eslint")]);
  const doc = new FakeDoc("a.ts", "x");
  languageServers.open(doc);
  await settle();
  const server = host.only("eslint");

  const id = server.request("workspace/diagnostic/refresh", null);
  await settle();

  expect(server.answers.get(id)).toEqual({ jsonrpc: "2.0", id, result: null });
  expect(requests).toHaveLength(2);
  expect(doc.lastShown("eslint")).toMatchObject({ problems: [{ message: "refreshed" }] });
});

test("rule 6: a failed or malformed pull is logged and shows nothing", async () => {
  host.setup = (server) => {
    server.capabilities = { diagnosticProvider: {} };
    server.handlers = {
      "textDocument/diagnostic": () => {
        throw new ReplyError(-32603, "boom");
      },
    };
  };
  const languageServers = servers([spec("tsgo")]);
  const doc = new FakeDoc("a.ts", "x");
  languageServers.open(doc);
  await settle();

  expect(doc.shown).toEqual([]);
  expect(languageServers.log("tsgo").at(-1)?.text).toBe("textDocument/diagnostic failed: boom");
});

test("rule 6: problems are cleared on stop, crash and removal", async () => {
  const languageServers = servers([spec("a"), spec("b"), spec("c")]);
  const doc = new FakeDoc("a.ts", "x");
  languageServers.open(doc);
  await settle();
  for (const name of ["a", "b", "c"]) {
    host.only(name).notify("textDocument/publishDiagnostics", {
      uri: "file:///repo/a.ts",
      diagnostics: [diagnostic(0, name)],
    });
  }
  await settle();

  languageServers.stop("a");
  host.only("b").exit(3);
  languageServers.setSpecs([spec("a"), spec("b")], { startOnOpen: true });
  await settle();

  for (const name of ["a", "b", "c"]) {
    expect(doc.lastShown(name)).toEqual({ server: name, version: 1, problems: [] });
  }
});

test("rule 7: server requests are answered from the table, unknown ones -32601 and logged", async () => {
  const languageServers = servers([
    spec("eslint", { project: "web", settings: { validate: "on", rules: { x: 1 } } }),
  ]);
  languageServers.open(new FakeDoc("web/a.ts", "x"));
  await settle();
  const server = host.only("eslint");

  const configuration = server.request("workspace/configuration", {
    items: [{ section: "" }, { section: "rules.x" }],
  });
  const folders = server.request("workspace/workspaceFolders", null);
  const register = server.request("client/registerCapability", { registrations: [] });
  const unknown = server.request("workspace/willRenameFiles", {});
  await settle();

  expect(server.answers.get(configuration)?.result).toEqual([
    { validate: "on", rules: { x: 1 } },
    1,
  ]);
  expect(server.answers.get(folders)?.result).toEqual([{ uri: "file:///repo/web", name: "web" }]);
  expect(server.answers.get(register)).toEqual({ jsonrpc: "2.0", id: register, result: null });
  expect(server.answers.get(unknown)?.error).toEqual({
    code: -32601,
    message: "method not found: workspace/willRenameFiles",
  });
  expect(languageServers.log("eslint").at(-1)?.text).toBe(
    "The server sent a request yamt does not answer: workspace/willRenameFiles",
  );
});

test("rule 7: log and show messages go to the log; progress and telemetry are dropped", async () => {
  const languageServers = servers([spec("oxlint")]);
  languageServers.open(new FakeDoc("a.ts", "x"));
  await settle();
  const server = host.only("oxlint");
  const before = languageServers.log("oxlint").length;

  server.notify("window/logMessage", { type: 3, message: "hello" });
  server.notify("window/showMessage", { type: 1, message: "oops" });
  server.notify("$/progress", { token: 1, value: {} });
  server.notify("telemetry/event", {});
  server.stderr("warning on stderr");
  await settle();

  expect(
    languageServers
      .log("oxlint")
      .slice(before)
      .map(({ source, text }) => [source, text]),
  ).toEqual([
    ["server", "hello"],
    ["server", "oops"],
    ["stderr", "warning on stderr"],
  ]);
});

test("rule 11: a malformed message is logged and dropped", async () => {
  const languageServers = servers([spec("oxlint")]);
  const doc = new FakeDoc("a.ts", "x");
  languageServers.open(doc);
  await settle();
  const server = host.only("oxlint");

  server.text("{not json");
  server.raw({ jsonrpc: "2.0", method: 42 });
  server.notify("textDocument/publishDiagnostics", { uri: "file:///repo/a.ts", diagnostics: "x" });
  await settle();

  expect(stateOf(languageServers, "oxlint")).toEqual({ kind: "running" });
  expect(doc.shown).toEqual([]);
  const texts = languageServers.log("oxlint").map((line) => line.text);
  expect(texts.filter((text) => text.startsWith("Dropped a malformed message"))).toHaveLength(2);
  expect(logOf(languageServers, "oxlint").at(-1)).toMatch(
    /^yamt: Dropped malformed problems from the server: /,
  );
});

function formatter(server: FakeServer, edits: () => unknown): Received[] {
  const requests: Received[] = [];
  server.capabilities = { documentFormattingProvider: true };
  server.handlers = {
    "textDocument/formatting": (params) => {
      requests.push({ params });
      return edits();
    },
  };
  return requests;
}

test("rule 8: the first formats spec whose server offers formatting formats; edits use UTF-16 positions", async () => {
  let requests: Received[] = [];
  host.setup = (server) => {
    if (server.command.program === "oxfmt") {
      requests = formatter(server, () => [
        {
          range: { start: { line: 0, character: 15 }, end: { line: 0, character: 15 } },
          newText: "\n",
        },
        {
          range: { start: { line: 1, character: 0 }, end: { line: 3, character: 0 } },
          newText: "joined\n",
        },
      ]);
    }
  };
  const languageServers = servers([
    spec("tsgo", { formats: true }),
    spec("oxlint"),
    spec("oxfmt", { formats: true }),
  ]);
  const doc = new FakeDoc("a.ts", "const a = '😀';let b=1\nx\ny\nz\n");
  const open = languageServers.open(doc);
  await settle();
  doc.text = "const a = '😀';let b=1\nx\ny\nz\n";
  open.changed();

  const reply = await open.format(OPTIONS);

  const formatted: FormatReply = {
    kind: "formatted",
    server: "oxfmt",
    sent: "const a = '😀';let b=1\nx\ny\nz\n",
    result: "const a = '😀';\nlet b=1\njoined\nz\n",
  };
  expect(reply).toEqual(formatted);
  expect(requests.map((request) => request.params)).toEqual([
    { textDocument: { uri: "file:///repo/a.ts" }, options: { tabSize: 2, insertSpaces: true } },
  ]);
  expect(host.only("oxfmt").sent("textDocument/didChange")).toHaveLength(1);
});

test("rule 8: no edits, or edits that change nothing, are unchanged", async () => {
  const replies: unknown[] = [
    null,
    [],
    [{ range: { start: { line: 0, character: 0 }, end: { line: 0, character: 1 } }, newText: "x" }],
  ];
  host.setup = (server) => {
    formatter(server, () => replies.shift());
  };
  const languageServers = servers([spec("oxfmt", { formats: true })]);
  const open = languageServers.open(new FakeDoc("a.ts", "x"));
  await settle();

  for (let i = 0; i < 3; i += 1) {
    expect(await open.format({ tabSize: 2, insertSpaces: true })).toEqual({
      kind: "unchanged",
      server: "oxfmt",
    });
  }
  expect(vi.getTimerCount()).toBe(0);
});

test("rule 8: a formatter still starting is waited for", async () => {
  host.setup = (server) => {
    formatter(server, () => [
      {
        range: { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } },
        newText: "// ",
      },
    ]);
    server.handlers = { ...server.handlers, initialize: () => NO_REPLY };
  };
  const languageServers = servers([spec("oxfmt", { formats: true })]);
  const open = languageServers.open(new FakeDoc("a.ts", "x"));
  const reply = open.format({ tabSize: 2, insertSpaces: true });
  await vi.advanceTimersByTimeAsync(1000);
  const server = host.only("oxfmt");
  const id = server.sent("initialize")[0]?.id;
  server.raw({ jsonrpc: "2.0", id, result: { capabilities: { documentFormattingProvider: {} } } });

  expect(await reply).toEqual({ kind: "formatted", server: "oxfmt", sent: "x", result: "// x" });
});

test("rule 8: 5 s in total, including the wait for a starting server, then timedOut", async () => {
  host.setup = (server) => {
    server.handlers = { initialize: () => NO_REPLY };
  };
  const languageServers = servers([spec("oxfmt", { formats: true })]);
  const open = languageServers.open(new FakeDoc("a.ts", "x"));
  const reply = open.format({ tabSize: 2, insertSpaces: true });
  let settled = false;
  void reply.then(() => {
    settled = true;
  });
  await vi.advanceTimersByTimeAsync(4999);
  expect(settled).toBe(false);
  await vi.advanceTimersByTimeAsync(1);

  const timedOut: FormatRefusal = { kind: "timedOut", server: "oxfmt" };
  expect(await reply).toEqual(timedOut);
});

test("rule 8: a formatting request without an answer times out at 5 s total and is cancelled", async () => {
  host.setup = (server) => {
    formatter(server, () => NO_REPLY);
  };
  const languageServers = servers([spec("oxfmt", { formats: true })]);
  const open = languageServers.open(new FakeDoc("a.ts", "x"));
  await vi.advanceTimersByTimeAsync(2000);
  const reply = open.format({ tabSize: 2, insertSpaces: true });
  await vi.advanceTimersByTimeAsync(5000);

  expect(await reply).toEqual({ kind: "timedOut", server: "oxfmt" });
  const server = host.only("oxfmt");
  const id = server.sent("textDocument/formatting")[0]?.id;
  expect(server.sent("$/cancelRequest").map((message) => message.params)).toEqual([{ id }]);
});

test("rule 8: noFormatter when no spec formats the document, the document is closed, or no host", async () => {
  host.setup = (server) => {
    formatter(server, () => []);
  };
  const languageServers = servers([
    spec("oxlint"),
    spec("oxfmt", { formats: true, fileTypes: ["css"] }),
  ]);
  const open = languageServers.open(new FakeDoc("a.ts", "x"));
  await settle();
  expect(await open.format({ tabSize: 2, insertSpaces: true })).toEqual({ kind: "noFormatter" });

  const formatted = languageServers.open(new FakeDoc("b.css", "x"));
  await settle();
  formatted.close();
  expect(await formatted.format(OPTIONS)).toEqual({ kind: "noFormatter" });
  expect(host.only("oxfmt").sent("textDocument/formatting")).toEqual([]);

  const offline = new LanguageServers(null, TIMERS);
  offline.setSpecs([spec("oxfmt", { formats: true })], { startOnOpen: true });
  expect(
    await offline.open(new FakeDoc("a.ts", "x")).format({ tabSize: 2, insertSpaces: true }),
  ).toEqual({ kind: "noFormatter" });
});

test("rule 8: a running server that does not offer formatting is skipped", async () => {
  const languageServers = servers([spec("tsgo", { formats: true })]);
  const open = languageServers.open(new FakeDoc("a.ts", "x"));
  await settle();

  expect(await open.format({ tabSize: 2, insertSpaces: true })).toEqual({ kind: "noFormatter" });
});

test("rule 8: a formats spec that is stopped, crashed or failed is notRunning", async () => {
  const languageServers = servers([spec("oxfmt", { formats: true })], false);
  const open = languageServers.open(new FakeDoc("a.ts", "x"));
  expect(await open.format({ tabSize: 2, insertSpaces: true })).toEqual({
    kind: "notRunning",
    server: "oxfmt",
    state: { kind: "stopped" },
  });

  languageServers.start("oxfmt");
  await settle();
  host.only("oxfmt").exit(1);
  await settle();
  expect(await open.format({ tabSize: 2, insertSpaces: true })).toEqual({
    kind: "notRunning",
    server: "oxfmt",
    state: { kind: "crashed", code: 1 },
  });
});

test("rule 8: an error reply or overlapping edits are failed", async () => {
  const replies: (() => unknown)[] = [
    () => {
      throw new ReplyError(-32603, "syntax error");
    },
    () => [
      { range: { start: { line: 0, character: 0 }, end: { line: 0, character: 2 } }, newText: "a" },
      { range: { start: { line: 0, character: 1 }, end: { line: 0, character: 3 } }, newText: "b" },
    ],
    () => [{ range: "nope", newText: "" }],
  ];
  host.setup = (server) => {
    formatter(server, () => replies.shift()?.());
  };
  const languageServers = servers([spec("oxfmt", { formats: true })]);
  const open = languageServers.open(new FakeDoc("a.ts", "xyz"));
  await settle();
  const options = { tabSize: 2, insertSpaces: true };

  expect(await open.format(options)).toEqual({
    kind: "failed",
    server: "oxfmt",
    message: "syntax error",
  });
  expect(await open.format(options)).toEqual({
    kind: "failed",
    server: "oxfmt",
    message: "the server sent overlapping edits",
  });
  expect(await open.format(options)).toMatchObject({ kind: "failed", server: "oxfmt" });
});

test("rule 9: an exit yamt did not ask for is crashed{code}; pending requests fail; it stays crashed", async () => {
  host.setup = (server) => {
    formatter(server, () => NO_REPLY);
  };
  const languageServers = servers([spec("oxfmt", { formats: true })]);
  const open = languageServers.open(new FakeDoc("a.ts", "x"));
  await settle();
  const reply = open.format({ tabSize: 2, insertSpaces: true });
  await settle();

  host.only("oxfmt").exit(137);
  await settle();

  expect(await reply).toEqual({ kind: "failed", server: "oxfmt", message: "the server stopped" });
  expect(stateOf(languageServers, "oxfmt")).toEqual({ kind: "crashed", code: 137 });
  const texts = languageServers.log("oxfmt").map((line) => line.text);
  expect(texts).toContain("Exited with code 137");
  expect(texts).toContain("No answer to textDocument/formatting: the server stopped");

  languageServers.open(new FakeDoc("b.ts", "y"));
  languageServers.setSpecs([spec("oxfmt", { formats: true })], { startOnOpen: true });
  await settle();
  expect(stateOf(languageServers, "oxfmt")).toEqual({ kind: "crashed", code: 137 });
  expect(host.servers).toHaveLength(1);

  languageServers.restart("oxfmt");
  await settle();
  expect(stateOf(languageServers, "oxfmt")).toEqual({ kind: "running" });
  expect(host.servers).toHaveLength(2);
});

test("rule 9: restart of a running server stops it and starts a new run", async () => {
  const languageServers = servers([spec("oxlint")]);
  languageServers.open(new FakeDoc("a.ts", "x"));
  await settle();
  const first = host.only("oxlint");

  languageServers.restart("oxlint");
  await settle();

  expect(host.stopped).toEqual([first.run]);
  expect(host.servers).toHaveLength(2);
  expect(stateOf(languageServers, "oxlint")).toEqual({ kind: "running" });
});

test("rule 9: a stop before the host replied stops the run once it starts", async () => {
  let open: (() => void) | undefined;
  host.gate = new Promise((resolve) => {
    open = resolve;
  });
  const languageServers = servers([spec("oxlint")]);
  languageServers.open(new FakeDoc("a.ts", "x"));
  await settle();
  languageServers.stop("oxlint");
  expect(stateOf(languageServers, "oxlint")).toEqual({ kind: "stopping" });

  open?.();
  await settle();

  expect(host.stopped).toEqual([host.only("oxlint").run]);
  expect(host.only("oxlint").methods()).toEqual([]);
  expect(stateOf(languageServers, "oxlint")).toEqual({ kind: "stopped" });
});

test("rule 9: a stop before the host refused the start ends stopped", async () => {
  let open: (() => void) | undefined;
  host.gate = new Promise((resolve) => {
    open = resolve;
  });
  host.reply = (command) => ({ kind: "NotFound", program: command.program, searched: [] });
  const languageServers = servers([spec("oxlint")]);
  languageServers.open(new FakeDoc("a.ts", "x"));
  await settle();
  languageServers.stop("oxlint");

  open?.();
  await settle();

  expect(host.stopped).toEqual([]);
  expect(stateOf(languageServers, "oxlint")).toEqual({ kind: "stopped" });
});

test("rule 9: a stop before the repository context arrived starts nothing", async () => {
  const languageServers = servers([spec("oxlint")]);
  languageServers.open(new FakeDoc("a.ts", "x"));
  languageServers.stop("oxlint");
  await settle();

  expect(host.servers).toEqual([]);
  expect(stateOf(languageServers, "oxlint")).toEqual({ kind: "stopped" });
  expect(logOf(languageServers, "oxlint")).toEqual([
    "yamt: Starting oxlint --lsp in the repository root",
  ]);
});

test("destroy stops every server and resolves when all exited", async () => {
  const languageServers = servers([spec("a"), spec("b")]);
  languageServers.open(new FakeDoc("a.ts", "x"));
  await settle();

  await languageServers.destroy();

  expect(host.stopped).toHaveLength(2);
  expect(languageServers.views()).toEqual([]);
});

test("rule 10: the log keeps the last 2,000 lines across restarts", async () => {
  const languageServers = servers([spec("oxlint")]);
  languageServers.open(new FakeDoc("a.ts", "x"));
  await settle();
  for (let i = 0; i < 2100; i += 1) {
    host.only("oxlint").stderr(`line ${i}`);
  }
  languageServers.restart("oxlint");
  await settle();

  const log = languageServers.log("oxlint");
  expect(log).toHaveLength(2000);
  expect(log.at(-1)?.text).toBe("Starting oxlint --lsp in the repository root");
  expect(log.find((line) => line.source === "stderr")?.text).toMatch(/^line \d+$/);
  expect(log.some((line) => line.text === "line 2099")).toBe(true);
  expect(log.some((line) => line.text === "line 0")).toBe(false);
});

test("rule 10: log lines carry the clock's time; onChange fires and unsubscribes", async () => {
  vi.setSystemTime(1_000_000);
  const languageServers = servers([spec("oxlint")]);
  const listener = vi.fn();
  const unsubscribe = languageServers.onChange(listener);
  languageServers.open(new FakeDoc("a.ts", "x"));
  await settle();
  expect(listener).toHaveBeenCalled();
  expect(languageServers.log("oxlint")[0]).toEqual({
    at: 1_000_000,
    source: "yamt",
    text: "Starting oxlint --lsp in the repository root",
  });

  unsubscribe();
  listener.mockClear();
  host.only("oxlint").stderr("x");
  expect(listener).not.toHaveBeenCalled();
});

test("rule 2: no host makes every spec failed{noHost}", () => {
  const languageServers = new LanguageServers(null);
  languageServers.setSpecs([spec("oxlint"), spec("ts", { install: INSTALL_HINT })], {
    startOnOpen: true,
  });
  languageServers.open(new FakeDoc("a.ts", "x"));
  languageServers.start("oxlint");

  const noHost: FailReason = { kind: "noHost" };
  expect(languageServers.views().map((view) => view.state)).toEqual([
    { kind: "failed", reason: noHost },
    { kind: "failed", reason: noHost },
  ]);
  expect(languageServers.log("oxlint")).toEqual([]);
});

function logOf(languageServers: LanguageServers, name: string): string[] {
  return languageServers.log(name).map(({ source, text }) => `${source}: ${text}`);
}

test("rule 10: a failed initialize logs start, failure and exit as yamt lines", async () => {
  host.setup = (server) => {
    server.handlers = {
      initialize: () => {
        throw new ReplyError(-32603, "bad config");
      },
    };
  };
  const languageServers = servers([spec("oxlint")]);
  languageServers.open(new FakeDoc("a.ts", "x"));
  await settle();

  expect(logOf(languageServers, "oxlint")).toEqual([
    "yamt: Starting oxlint --lsp in the repository root",
    "yamt: Initialize failed: bad config",
    "yamt: Exited with code 0",
  ]);
});

test("rule 10: an initialize time-out is logged as cancelled, then as the failure", async () => {
  host.setup = (server) => {
    server.handlers = { initialize: () => NO_REPLY };
  };
  const languageServers = servers([spec("oxlint")]);
  languageServers.open(new FakeDoc("a.ts", "x"));
  await vi.advanceTimersByTimeAsync(30_000);

  expect(logOf(languageServers, "oxlint")).toEqual([
    "yamt: Starting oxlint --lsp in the repository root",
    "yamt: No answer to initialize within 30 s; cancelled",
    "yamt: Stopped: the server did not answer initialize",
    "yamt: Exited with code 0",
  ]);
});

test("rule 10: start failures are logged in words", async () => {
  host.reply = (command) =>
    command.program === "b"
      ? { kind: "SpawnFailed", program: "b", message: "permission denied" }
      : { kind: "OutsideRepository", project: "../x" };
  const languageServers = servers([spec("b"), spec("c")]);
  languageServers.open(new FakeDoc("a.ts", "x"));
  await settle();

  expect(logOf(languageServers, "b").at(-1)).toBe("yamt: Could not start: permission denied");
  expect(logOf(languageServers, "c").at(-1)).toBe(
    "yamt: The project folder ../x is outside the repository",
  );
});

test("rule 9: an exit without a code is crashed{null} and logged", async () => {
  const languageServers = servers([spec("oxlint")]);
  languageServers.open(new FakeDoc("a.ts", "x"));
  await settle();
  host.only("oxlint").exit(null);
  await settle();

  expect(stateOf(languageServers, "oxlint")).toEqual({ kind: "crashed", code: null });
  expect(logOf(languageServers, "oxlint").at(-1)).toBe("yamt: Exited without a code");
});

test("rule 9: a crash during initialize is crashed, and messages before running are dropped", async () => {
  host.setup = (server) => {
    server.handlers = { initialize: () => NO_REPLY };
  };
  const languageServers = servers([spec("eslint")]);
  const doc = new FakeDoc("a.ts", "x");
  languageServers.open(doc);
  await settle();
  const server = host.only("eslint");
  const refresh = server.request("workspace/diagnostic/refresh", null);
  server.notify("textDocument/publishDiagnostics", {
    uri: "file:///repo/a.ts",
    diagnostics: [diagnostic(0, "early")],
  });
  await settle();
  expect(server.answers.get(refresh)?.result).toBeNull();

  server.exit(2);
  await settle();

  expect(stateOf(languageServers, "eslint")).toEqual({ kind: "crashed", code: 2 });
  expect(doc.shown).toEqual([]);
});

test("rule 2: start and stop act on the named spec only; an unknown name does nothing", async () => {
  const languageServers = servers([spec("a"), spec("b")], false);
  languageServers.open(new FakeDoc("a.ts", "x"));
  languageServers.start("b");
  languageServers.start("nope");
  languageServers.stop("nope");
  languageServers.restart("nope");
  await settle();

  expect(languageServers.views().map((view) => view.state.kind)).toEqual(["stopped", "running"]);
});

test("rule 2: start on a running server starts no second process", async () => {
  const languageServers = servers([spec("oxlint")]);
  languageServers.open(new FakeDoc("a.ts", "x"));
  await settle();
  languageServers.start("oxlint");
  await settle();

  expect(host.servers).toHaveLength(1);
});

test("rule 3: a user stop of one name does not keep a new spec of another name stopped", async () => {
  const languageServers = servers([spec("a")]);
  languageServers.open(new FakeDoc("a.ts", "x"));
  await settle();
  languageServers.stop("a");
  await settle();

  languageServers.setSpecs([spec("a"), spec("b")], { startOnOpen: true });
  await settle();

  expect(languageServers.views().map((view) => view.state.kind)).toEqual(["stopped", "running"]);
});

test("rule 3: restart clears a user stop, so a changed spec of that name starts", async () => {
  const languageServers = servers([spec("a")]);
  languageServers.open(new FakeDoc("a.ts", "x"));
  await settle();
  languageServers.stop("a");
  await settle();
  languageServers.restart("a");
  await settle();

  languageServers.setSpecs([spec("a", { settings: { changed: true } })], { startOnOpen: true });
  await settle();

  expect(stateOf(languageServers, "a")).toEqual({ kind: "running" });
  expect(host.servers).toHaveLength(3);
});

test("rule 9: an initialize answer that arrives after stop does not make the server run", async () => {
  host.setup = (server) => {
    server.handlers = { initialize: () => NO_REPLY };
    server.ignoresStop = true;
  };
  const languageServers = servers([spec("oxlint")]);
  languageServers.open(new FakeDoc("a.ts", "x"));
  await settle();
  languageServers.stop("oxlint");
  await settle();
  const server = host.only("oxlint");
  const id = server.sent("initialize")[0]?.id;

  server.raw({ jsonrpc: "2.0", id, result: { capabilities: {} } });
  await settle();
  expect(server.methods()).toEqual(["initialize"]);
  expect(stateOf(languageServers, "oxlint")).toEqual({ kind: "stopping" });

  server.exit(0);
  await settle();
  expect(stateOf(languageServers, "oxlint")).toEqual({ kind: "stopped" });
});

test("rule 9: a stop before a failing context arrives ends stopped, not failed", async () => {
  host.root = null;
  const languageServers = servers([spec("oxlint")]);
  languageServers.open(new FakeDoc("a.ts", "x"));
  languageServers.stop("oxlint");
  await settle();

  expect(stateOf(languageServers, "oxlint")).toEqual({ kind: "stopped" });
  expect(logOf(languageServers, "oxlint")).toEqual([
    "yamt: Starting oxlint --lsp in the repository root",
  ]);
});

test("rule 4: the context is read once; a failing context fails the start with its message", async () => {
  host.contextError = new Error("no window");
  const languageServers = servers([spec("a"), spec("b")]);
  languageServers.open(new FakeDoc("a.ts", "x"));
  await settle();

  expect(host.contextCalls).toBe(1);
  expect(languageServers.views().map((view) => view.state)).toEqual([
    { kind: "failed", reason: { kind: "initializeFailed", message: "Error: no window" } },
    { kind: "failed", reason: { kind: "initializeFailed", message: "Error: no window" } },
  ]);
});

test("rule 4: a repository path that is not text names the reason", async () => {
  host.root = null;
  const languageServers = servers([spec("oxlint")]);
  languageServers.open(new FakeDoc("a.ts", "x"));
  await settle();

  expect(stateOf(languageServers, "oxlint")).toEqual({
    kind: "failed",
    reason: {
      kind: "initializeFailed",
      message: "the repository's folder path is not valid UTF-8",
    },
  });
});

test("rule 6/8: null or false providers mean no pulls and no formatting", async () => {
  host.setup = (server) => {
    server.capabilities = { diagnosticProvider: null, documentFormattingProvider: false };
  };
  const languageServers = servers([spec("oxfmt", { formats: true })]);
  const open = languageServers.open(new FakeDoc("a.ts", "x"));
  await settle();

  expect(host.only("oxfmt").sent("textDocument/diagnostic")).toEqual([]);
  expect(await open.format(OPTIONS)).toEqual({ kind: "noFormatter" });
});

test("rule 7: answering a request other than refresh pulls nothing", async () => {
  let requests: Received[] = [];
  host.setup = (server) => {
    requests = pullServer(server, [{ kind: "full", items: [] }]);
  };
  const languageServers = servers([spec("eslint")]);
  languageServers.open(new FakeDoc("a.ts", "x"));
  await settle();
  host.only("eslint").request("workspace/configuration", { items: [{}] });
  await settle();

  expect(requests).toHaveLength(1);
});

test("rule 9: a stop logs the pulls it leaves unanswered", async () => {
  host.setup = (server) => {
    pullServer(server, []);
  };
  const languageServers = servers([spec("tsgo")]);
  languageServers.open(new FakeDoc("a.ts", "x"));
  await settle();
  languageServers.stop("tsgo");
  await vi.advanceTimersByTimeAsync(2000);

  expect(logOf(languageServers, "tsgo")).toContain(
    "yamt: No answer to textDocument/diagnostic: the server stopped",
  );
});

test("rule 9: a server that exits during shutdown is not stopped again", async () => {
  host.setup = (server) => {
    server.handlers = {
      shutdown: (_, self) => {
        self.exit(0);
        return NO_REPLY;
      },
    };
  };
  const languageServers = servers([spec("oxlint")]);
  languageServers.open(new FakeDoc("a.ts", "x"));
  await settle();
  languageServers.stop("oxlint");
  await settle();
  const server = host.only("oxlint");

  expect(host.stopped).toEqual([]);
  expect(stateOf(languageServers, "oxlint")).toEqual({ kind: "stopped" });
  expect(server.methods().at(-1)).toBe("shutdown");
  expect(logOf(languageServers, "oxlint").join("\n")).not.toContain("No answer to shutdown within");
});

function startLines(languageServers: LanguageServers, name: string): string[] {
  return logOf(languageServers, name).filter((line) => line.startsWith("yamt: Starting"));
}

async function restartWithoutExit(): Promise<LanguageServers> {
  host.setup = (server) => {
    server.ignoresStop = true;
  };
  const languageServers = servers([spec("oxlint")]);
  languageServers.open(new FakeDoc("a.ts", "x"));
  await settle();
  languageServers.restart("oxlint");
  return languageServers;
}

test("rule 9: a stop after restart, during the old run's shutdown, keeps it stopped", async () => {
  const languageServers = await restartWithoutExit();
  languageServers.stop("oxlint");
  await settle();
  expect(stateOf(languageServers, "oxlint")).toEqual({ kind: "stopping" });
  host.only("oxlint").exit(0);
  await settle();

  expect(host.servers).toHaveLength(1);
  expect(stateOf(languageServers, "oxlint")).toEqual({ kind: "stopped" });
  expect(startLines(languageServers, "oxlint")).toHaveLength(1);
});

test("rule 3: a spec removed after restart, during the old run's shutdown, starts nothing", async () => {
  const languageServers = await restartWithoutExit();
  languageServers.setSpecs([], { startOnOpen: true });
  await settle();
  host.only("oxlint").exit(0);
  await settle();

  expect(host.servers).toHaveLength(1);
  expect(languageServers.views()).toEqual([]);
  expect(startLines(languageServers, "oxlint")).toHaveLength(1);
});

test("destroy after restart, during the old run's shutdown, starts nothing", async () => {
  const languageServers = await restartWithoutExit();
  let destroyed = false;
  void languageServers.destroy().then(() => {
    destroyed = true;
  });
  await settle();
  host.only("oxlint").exit(0);
  await settle();

  expect(destroyed).toBe(true);
  expect(host.servers).toHaveLength(1);
  expect(startLines(languageServers, "oxlint")).toHaveLength(1);
});

test("rule 5: a document opened by a listener when its server starts running is opened once", async () => {
  const languageServers = servers([spec("oxlint")]);
  languageServers.open(new FakeDoc("a.ts", "x"));
  let opened = false;
  languageServers.onChange(() => {
    if (!opened && stateOf(languageServers, "oxlint")?.kind === "running") {
      opened = true;
      languageServers.open(new FakeDoc("b.ts", "y"));
    }
  });
  await settle();

  expect(host.only("oxlint").sent("textDocument/didOpen")).toHaveLength(2);
});

test("rule 8: formatting syncs a pending change once; the pending sync does not repeat it", async () => {
  host.setup = (server) => {
    formatter(server, () => []);
  };
  const languageServers = servers([spec("oxfmt", { formats: true })]);
  const doc = new FakeDoc("a.ts", "x");
  const open = languageServers.open(doc);
  await settle();
  doc.text = "y";
  open.changed();
  await open.format(OPTIONS);
  await vi.advanceTimersByTimeAsync(300);

  expect(host.only("oxfmt").sent("textDocument/didChange")).toHaveLength(1);
});

test("rule 8: malformed edits are failed with the reason", async () => {
  host.setup = (server) => {
    formatter(server, () => [{ range: "nope", newText: "" }]);
  };
  const languageServers = servers([spec("oxfmt", { formats: true })]);
  const open = languageServers.open(new FakeDoc("a.ts", "x"));
  await settle();

  const reply = await open.format(OPTIONS);
  expect(reply).toMatchObject({ kind: "failed", server: "oxfmt" });
  expect(reply.kind === "failed" ? reply.message : "").toMatch(/^malformed edits: /);
});

test("rule 8: after a 2 s wait for a starting formatter, its request gets the 3 s left", async () => {
  host.setup = (server) => {
    formatter(server, () => NO_REPLY);
    server.handlers = { ...server.handlers, initialize: () => NO_REPLY };
  };
  const languageServers = servers([spec("oxfmt", { formats: true })]);
  const open = languageServers.open(new FakeDoc("a.ts", "x"));
  const reply = open.format(OPTIONS);
  await vi.advanceTimersByTimeAsync(2000);
  const server = host.only("oxfmt");
  const id = server.sent("initialize")[0]?.id;
  server.raw({
    jsonrpc: "2.0",
    id,
    result: { capabilities: { documentFormattingProvider: true } },
  });
  let settled = false;
  void reply.then(() => {
    settled = true;
  });
  await vi.advanceTimersByTimeAsync(2999);
  expect(settled).toBe(false);
  await vi.advanceTimersByTimeAsync(1);

  expect(await reply).toEqual({ kind: "timedOut", server: "oxfmt" });
});

test("rule 6: a first pull answered unchanged shows no problems", async () => {
  host.setup = (server) => {
    pullServer(server, [{ kind: "unchanged", resultId: "r" }]);
  };
  const languageServers = servers([spec("tsgo")]);
  const doc = new FakeDoc("a.ts", "x");
  languageServers.open(doc);
  await settle();

  expect(doc.shown).toEqual([{ server: "tsgo", version: 1, problems: [] }]);
});

test("rule 6: a timed-out pull is logged as such and shows nothing", async () => {
  host.setup = (server) => {
    pullServer(server, []);
  };
  const languageServers = servers([spec("tsgo")]);
  const doc = new FakeDoc("a.ts", "x");
  languageServers.open(doc);
  await vi.advanceTimersByTimeAsync(30_000);

  expect(doc.shown).toEqual([]);
  expect(logOf(languageServers, "tsgo").at(-1)).toBe(
    "yamt: No answer to textDocument/diagnostic within 30 s; cancelled",
  );
});

test("rule 6: a malformed pull report is logged and shows nothing", async () => {
  host.setup = (server) => {
    pullServer(server, [{ kind: "full" }]);
  };
  const languageServers = servers([spec("tsgo")]);
  const doc = new FakeDoc("a.ts", "x");
  languageServers.open(doc);
  await settle();

  expect(doc.shown).toEqual([]);
  expect(logOf(languageServers, "tsgo").at(-1)).toMatch(
    /^yamt: Dropped malformed problems from the server: /,
  );
});

test("rule 6: a pull answered after its document closed shows nothing", async () => {
  const pending: ((report: Json) => void)[] = [];
  host.setup = (server) => {
    server.capabilities = { diagnosticProvider: {} };
    server.handlers = {
      "textDocument/diagnostic": (_, self) => {
        const id = self.received.at(-1)?.id;
        pending.push((report) => self.raw({ jsonrpc: "2.0", id, result: report }));
        return NO_REPLY;
      },
    };
  };
  const languageServers = servers([spec("tsgo")]);
  const doc = new FakeDoc("a.ts", "x");
  const open = languageServers.open(doc);
  await settle();
  open.close();

  pending.shift()?.({ kind: "full", items: [diagnostic(0, "late")] });
  await settle();

  expect(doc.shown).toEqual([]);
});

test("rule 6: pushed versions that are not positive integers are dropped", async () => {
  const languageServers = servers([spec("oxlint")]);
  const doc = new FakeDoc("a.ts", "x");
  languageServers.open(doc);
  await settle();
  for (const version of [0, 1.5]) {
    host.only("oxlint").notify("textDocument/publishDiagnostics", {
      uri: "file:///repo/a.ts",
      version,
      diagnostics: [],
    });
  }
  await settle();

  expect(doc.shown).toEqual([]);
  expect(logOf(languageServers, "oxlint").slice(-2)).toEqual([
    "yamt: Dropped problems for a version yamt never sent: 0",
    "yamt: Dropped problems for a version yamt never sent: 1.5",
  ]);
});

test("a document version is a positive safe integer", () => {
  expect([0, 1, 1.5, Number.MAX_SAFE_INTEGER + 1].map(isDocVersion)).toEqual([
    false,
    true,
    false,
    false,
  ]);
});

test("rule 1/5: a document a running server does not serve is never opened or closed on it", async () => {
  const languageServers = servers([spec("oxlint")]);
  languageServers.open(new FakeDoc("a.ts", "x"));
  await settle();
  const css = languageServers.open(new FakeDoc("a.css", "y"));
  css.close();
  await settle();

  expect(host.only("oxlint").sent("textDocument/didOpen")).toHaveLength(1);
  expect(host.only("oxlint").sent("textDocument/didClose")).toEqual([]);
});

test("rule 5: close sends didClose with the document's URI", async () => {
  const languageServers = servers([spec("oxlint")]);
  const open = languageServers.open(new FakeDoc("a b.ts", "x"));
  await settle();
  open.close();

  expect(host.only("oxlint").sent("textDocument/didClose")[0]?.params).toEqual({
    textDocument: { uri: "file:///repo/a%20b.ts" },
  });
});

test("rule 5: a change syncs when any one server has the document open", async () => {
  const languageServers = servers([spec("oxlint"), spec("stylelint", { fileTypes: ["css"] })]);
  languageServers.open(new FakeDoc("a.css", "x"));
  const doc = new FakeDoc("a.ts", "x");
  const open = languageServers.open(doc);
  await settle();
  open.changed();
  await vi.advanceTimersByTimeAsync(300);

  expect(host.only("oxlint").sent("textDocument/didChange")).toHaveLength(1);
});

test("rule 5: a closed document is not opened on a server started later", async () => {
  const languageServers = servers([spec("oxlint")], false);
  const open = languageServers.open(new FakeDoc("a.ts", "x"));
  languageServers.open(new FakeDoc("b.ts", "y"));
  open.close();
  languageServers.start("oxlint");
  await settle();

  expect(
    host
      .only("oxlint")
      .sent("textDocument/didOpen")
      .map((message) => message.params),
  ).toEqual([
    {
      textDocument: { uri: "file:///repo/b.ts", languageId: "typescript", version: 1, text: "y" },
    },
  ]);
});

test("onChange fires for setSpecs, for a state change and for a log line", async () => {
  const languageServers = new LanguageServers(host, TIMERS);
  const listener = vi.fn();
  languageServers.onChange(listener);
  languageServers.setSpecs([spec("oxlint")], { startOnOpen: true });
  expect(listener).toHaveBeenCalledTimes(1);
  languageServers.open(new FakeDoc("a.ts", "x"));
  await settle();

  listener.mockClear();
  languageServers.stop("oxlint");
  expect(listener).toHaveBeenCalledTimes(1);
  await settle();
  listener.mockClear();
  host.only("oxlint").stderr("late line");
  expect(listener).toHaveBeenCalledTimes(1);
});

test("rule 4: a Windows repository root names the folder and makes a drive URI", async () => {
  host.root = "C:\\work\\my repo";
  const languageServers = servers([spec("oxlint")]);
  languageServers.open(new FakeDoc("src/a.ts", "x"));
  await settle();

  expect(host.only("oxlint").sent("initialize")[0]?.params).toMatchObject({
    rootUri: "file:///C:/work/my%20repo",
    workspaceFolders: [{ uri: "file:///C:/work/my%20repo", name: "my repo" }],
  });
  expect(host.only("oxlint").sent("textDocument/didOpen")[0]?.params).toMatchObject({
    textDocument: { uri: "file:///C:/work/my%20repo/src/a.ts" },
  });
});

test("destroy waits for a stop already under way", async () => {
  host.setup = (server) => {
    server.ignoresStop = true;
  };
  const languageServers = servers([spec("oxlint")]);
  languageServers.open(new FakeDoc("a.ts", "x"));
  await settle();
  languageServers.stop("oxlint");
  await settle();
  let destroyed = false;
  void languageServers.destroy().then(() => {
    destroyed = true;
  });
  await settle();
  expect(destroyed).toBe(false);

  host.only("oxlint").exit(0);
  await settle();
  expect(destroyed).toBe(true);
});

test("destroy waits for servers removed by setSpecs", async () => {
  host.setup = (server) => {
    server.ignoresStop = true;
  };
  const languageServers = servers([spec("oxlint")]);
  languageServers.open(new FakeDoc("a.ts", "x"));
  await settle();
  languageServers.setSpecs([], { startOnOpen: true });
  let destroyed = false;
  void languageServers.destroy().then(() => {
    destroyed = true;
  });
  await settle();
  expect(destroyed).toBe(false);

  host.only("oxlint").exit(0);
  await settle();
  expect(destroyed).toBe(true);
});

test("destroy waits for a removed server still stopping after another removed one stopped", async () => {
  host.setup = (server) => {
    server.ignoresStop = server.command.program === "tsgo";
  };
  const languageServers = servers([spec("oxlint"), spec("tsgo")]);
  languageServers.open(new FakeDoc("a.ts", "x"));
  await settle();
  languageServers.setSpecs([], { startOnOpen: true });
  await settle();
  let destroyed = false;
  void languageServers.destroy().then(() => {
    destroyed = true;
  });
  await settle();
  expect(destroyed).toBe(false);

  host.only("tsgo").exit(0);
  await settle();
  expect(destroyed).toBe(true);
});

test("rule 4: a host that throws while starting is spawnFailed", async () => {
  host.startError = new Error("channel closed");
  const languageServers = servers([spec("oxlint")]);
  languageServers.open(new FakeDoc("a.ts", "x"));
  await settle();

  expect(stateOf(languageServers, "oxlint")).toEqual({
    kind: "failed",
    reason: { kind: "spawnFailed", message: "Error: channel closed" },
  });
});

test("rule 9: a host that fails to stop a run is logged; the run's exit still ends the stop", async () => {
  host.stopError = new Error("gone");
  const languageServers = servers([spec("oxlint")]);
  languageServers.open(new FakeDoc("a.ts", "x"));
  await settle();
  languageServers.stop("oxlint");
  await settle();

  expect(logOf(languageServers, "oxlint")).toContain(
    "yamt: Could not stop the server: Error: gone",
  );
  expect(stateOf(languageServers, "oxlint")).toEqual({ kind: "stopped" });
});

test("rule 8: a document that throws when taken fails the format, never rejects", async () => {
  host.setup = (server) => {
    formatter(server, () => []);
  };
  const languageServers = servers([spec("oxfmt", { formats: true })]);
  const doc = new FakeDoc("a.ts", "x");
  const open = languageServers.open(doc);
  await settle();
  doc.take = () => {
    throw new Error("view destroyed");
  };
  open.changed();

  expect(await open.format(OPTIONS)).toEqual({
    kind: "failed",
    server: "oxfmt",
    message: "Error: view destroyed",
  });
});

test("rule 7: a log message without text is logged with its reason", async () => {
  const languageServers = servers([spec("oxlint")]);
  languageServers.open(new FakeDoc("a.ts", "x"));
  await settle();
  host.only("oxlint").notify("window/logMessage", { type: 3 });
  await settle();

  expect(logOf(languageServers, "oxlint").at(-1)).toMatch(/^server: window\/logMessage: \S/);
});
