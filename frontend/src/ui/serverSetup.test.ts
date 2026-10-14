import { expect, test, vi } from "vitest";
import { shallowRef } from "vue";

import {
  log,
  type AddedServer,
  type FileEntry,
  type HostEvent,
  type LanguageServerSettings,
  type ProgramFound,
  type ProjectFile,
  type RepositoryAnswer,
  type RunId,
  type ServerCommand,
  type ServerContext,
  type ServerHost,
  type StartReply,
} from "../ipc";
import { LanguageServers, type ResultDocument, type ServerState } from "../lsp";
import { createAsking } from "./asking";
import { createServerSetup, parseAddedServer } from "./serverSetup";
import { startSettings } from "./settings";

type Tree = Record<string, string>;

type Run = {
  readonly run: RunId;
  readonly program: string;
  readonly emit: (event: HostEvent) => void;
};

const ROOT = "/repo";
const FILE = "frontend/src/a.ts";
const OTHER_ROOT = "/elsewhere";

const PROJECT: Tree = {
  "frontend/package.json": '{"packageManager":"pnpm@12.0.0"}',
  "frontend/tsconfig.json": "{}",
  "frontend/node_modules/typescript/package.json": '{"version":"5.9.3"}',
  "frontend/node_modules/.bin/oxlint": "",
  "frontend/node_modules/.bin/oxfmt": "",
};

function parentOf(path: string): string {
  return path.slice(0, Math.max(path.lastIndexOf("/"), 0));
}

function isRunId(n: number): n is RunId {
  return Number.isSafeInteger(n);
}

class FakeHost implements ServerHost {
  readonly tree: Tree;
  readonly runs: Run[] = [];
  readonly stopped: string[] = [];
  readonly events: string[] = [];
  holdNextContext: Promise<void> | null = null;
  failingContexts = 0;
  root: string | null = ROOT;

  constructor(tree: Tree) {
    this.tree = { ...tree };
  }

  async context(): Promise<ServerContext> {
    this.events.push("context");
    if (this.failingContexts > 0) {
      this.failingContexts -= 1;
      throw new Error("ipc gone");
    }
    const hold = this.holdNextContext;
    this.holdNextContext = null;
    await hold;
    return { root: this.root, process_id: 7 };
  }

  start(command: ServerCommand, onEvent: (event: HostEvent) => void): Promise<StartReply> {
    const run = this.runs.length + 1;
    if (!isRunId(run)) {
      throw new Error("bad run id");
    }
    this.runs.push({ run, program: command.program, emit: onEvent });
    return Promise.resolve({ kind: "Started", run });
  }

  send(run: RunId, message: string): void {
    const parsed: { id?: number | string; method?: string } = JSON.parse(message);
    const { id, method } = parsed;
    if (id === undefined || method === undefined) {
      return;
    }
    const result = method === "initialize" ? { capabilities: {} } : null;
    queueMicrotask(() => {
      this.#run(run).emit({
        kind: "Message",
        text: JSON.stringify({ jsonrpc: "2.0", id, result }),
      });
    });
  }

  stop(run: RunId): Promise<void> {
    const found = this.#run(run);
    this.stopped.push(found.program);
    queueMicrotask(() => found.emit({ kind: "Exited", code: 0 }));
    return Promise.resolve();
  }

  findProgram(program: string, project: string): Promise<ProgramFound> {
    for (let at = project; ; at = parentOf(at)) {
      const bin = `${at === "" ? "" : `${at}/`}node_modules/.bin/${program}`;
      if (this.tree[bin] !== undefined) {
        return Promise.resolve({ kind: "Found", path: `${ROOT}/${bin}`, place: "Project" });
      }
      if (at === "") {
        return Promise.resolve({ kind: "NotFound", searched: ["/usr/bin"] });
      }
    }
  }

  projectFiles(paths: readonly string[]): Promise<readonly ProjectFile[]> {
    return Promise.resolve(
      paths.map((path): ProjectFile => {
        const text = this.tree[path];
        return text === undefined ? { kind: "Missing" } : { kind: "Text", text };
      }),
    );
  }

  started(): string[] {
    return this.runs.map((run) => run.program);
  }

  #run(run: RunId): Run {
    const found = this.runs.find((candidate) => candidate.run === run);
    if (found === undefined) {
      throw new Error(`no run ${run}`);
    }
    return found;
  }
}

const DOC: ResultDocument = {
  path: FILE,
  take: () => "",
  showProblems: () => undefined,
};

function entry(path: string): FileEntry {
  return { path, status: "Unresolved", unsupported: null };
}

function setUpWith(options: {
  readonly host: FakeHost | null;
  readonly answer?: RepositoryAnswer;
  readonly answerRoot?: string;
  readonly added?: readonly AddedServer[];
  readonly files?: readonly string[];
}) {
  const { added = [], answer, answerRoot = ROOT } = options;
  const disk: { listed: readonly string[]; stored: LanguageServerSettings; writesFail: boolean } = {
    listed: options.files ?? [FILE],
    stored: {
      repositories: answer === undefined ? {} : { [answerRoot]: answer },
      added: [...added],
    },
    writesFail: false,
  };
  const settings = shallowRef({ ...startSettings("dark"), languageServers: disk.stored });
  const files = shallowRef<readonly FileEntry[]>([]);
  const calls: unknown[][] = [];
  const events = options.host?.events ?? [];
  function write(stored: LanguageServerSettings): void {
    if (!disk.writesFail) {
      disk.stored = stored;
      settings.value = { ...settings.value, languageServers: stored };
    }
  }
  async function list(name: string): Promise<void> {
    await Promise.resolve();
    files.value = disk.listed.map(entry);
    events.push(name);
  }
  const servers = new LanguageServers(options.host);
  servers.open(DOC);
  const asking = createAsking();
  const setup = createServerSetup({
    host: options.host,
    servers,
    files,
    settings,
    asking,
    loadFiles: () => list("loadFiles"),
    refreshFiles: () => list("refreshFiles"),
    loadSettings: async () => {
      await Promise.resolve();
      settings.value = { ...settings.value, languageServers: disk.stored };
      events.push("loadSettings");
    },
    setServerAnswer: async (given) => {
      calls.push(["setServerAnswer", given]);
      const repositories = { ...disk.stored.repositories };
      if (given === null) {
        delete repositories[ROOT];
      } else {
        repositories[ROOT] = given;
      }
      write({ ...disk.stored, repositories });
    },
    setAddedServers: async (list) => {
      calls.push(["setAddedServers", list]);
      write({ ...disk.stored, added: [...list] });
    },
  });
  return { setup, servers, asking, calls, settings, files, disk, events };
}

function states(servers: LanguageServers): Record<string, ServerState["kind"]> {
  return Object.fromEntries(servers.views().map((view) => [view.name, view.state.kind]));
}

const FOUND_STOPPED = { oxfmt: "stopped", oxlint: "stopped", TypeScript: "notInstalled" };
const FOUND_RUNNING = { oxfmt: "running", oxlint: "running", TypeScript: "notInstalled" };

test("start: the file list and the settings are in before detection starts", async () => {
  const host = new FakeHost(PROJECT);
  const { setup, servers, events } = setUpWith({ host, answer: "start" });

  await setup.startUp();

  expect(events.slice(0, 3)).toEqual(["loadFiles", "loadSettings", "context"]);
  await vi.waitFor(() => {
    expect(states(servers)).toEqual(FOUND_RUNNING);
  });
});

test("start: no specs means no question and no servers", async () => {
  const host = new FakeHost({});
  const { setup, servers, asking, calls } = setUpWith({ host });

  await setup.startUp();

  expect(asking.question.value).toBeNull();
  expect(servers.views()).toEqual([]);
  expect(calls).toEqual([]);
  expect(setup.serverRoot.value).toBe(ROOT);
});

test("start: a stored Start answers without a question and starts the served servers", async () => {
  const host = new FakeHost(PROJECT);
  const { setup, servers, asking, calls } = setUpWith({ host, answer: "start" });

  await setup.startUp();

  expect(asking.question.value).toBeNull();
  expect(calls).toEqual([]);
  await vi.waitFor(() => {
    expect(states(servers)).toEqual(FOUND_RUNNING);
  });
  expect(host.started().toSorted()).toEqual(["oxfmt", "oxlint"]);
});

test("start: a stored Don't start answers without a question and starts nothing", async () => {
  const host = new FakeHost(PROJECT);
  const { setup, servers, asking, calls } = setUpWith({ host, answer: "dontStart" });

  await setup.startUp();

  expect(asking.question.value).toBeNull();
  expect(calls).toEqual([]);
  expect(states(servers)).toEqual(FOUND_STOPPED);
  expect(host.started()).toEqual([]);
});

test("start: an answer stored for another repository does not count", async () => {
  const host = new FakeHost(PROJECT);
  const { setup, asking } = setUpWith({ host, answer: "start", answerRoot: OTHER_ROOT });

  void setup.startUp();

  await vi.waitFor(() => {
    expect(asking.question.value?.kind).toBe("servers");
  });
});

async function asked(options: Parameters<typeof setUpWith>[0]) {
  const made = setUpWith(options);
  const done = made.setup.startUp();
  await vi.waitFor(() => {
    expect(made.asking.question.value).not.toBeNull();
  });
  return { ...made, done };
}

test("start: without an answer the question lists each found server with its folder, and the added ones", async () => {
  const host = new FakeHost(PROJECT);
  const { asking, done } = await asked({
    host,
    added: [{ command: ["pylsp"], fileTypes: ["py"] }],
  });

  const question = asking.question.value;
  if (question?.kind !== "servers") {
    throw new Error("no servers question");
  }
  expect(
    question.found.map(({ name, project, install }) => [name, project, install === null]),
  ).toEqual([
    ["oxfmt", "frontend", true],
    ["oxlint", "frontend", true],
    ["TypeScript", "frontend", false],
  ]);
  expect(question.added.map((spec) => spec.name)).toEqual(["pylsp"]);
  asking.answer(false);
  await done;
});

test("start: Start in the question is stored and starts the servers", async () => {
  const host = new FakeHost(PROJECT);
  const { asking, done, calls, servers } = await asked({ host });

  asking.answer(true);
  await done;

  expect(calls).toEqual([["setServerAnswer", "start"]]);
  await vi.waitFor(() => {
    expect(states(servers)).toEqual(FOUND_RUNNING);
  });
});

test("start: Don't start in the question is stored and starts nothing", async () => {
  const host = new FakeHost(PROJECT);
  const { asking, done, calls, servers } = await asked({ host });

  asking.answer(false);
  await done;

  expect(calls).toEqual([["setServerAnswer", "dontStart"]]);
  expect(states(servers)).toEqual(FOUND_STOPPED);
  expect(host.started()).toEqual([]);
});

test("start: Escape stores nothing, so the question comes back next run; the servers show stopped", async () => {
  const host = new FakeHost(PROJECT);
  const { asking, done, calls, servers } = await asked({ host });

  asking.dismiss();
  await done;

  expect(asking.question.value).toBeNull();
  expect(calls).toEqual([]);
  expect(states(servers)).toEqual(FOUND_STOPPED);
  expect(host.started()).toEqual([]);
});

test("start: a Start whose write fails starts nothing", async () => {
  const host = new FakeHost(PROJECT);
  const { asking, done, calls, servers, disk } = await asked({ host });
  disk.writesFail = true;

  asking.answer(true);
  await done;

  expect(calls).toEqual([["setServerAnswer", "start"]]);
  expect(states(servers)).toEqual(FOUND_STOPPED);
  expect(host.started()).toEqual([]);
});

test("start: another question already open stores nothing and leaves that question open", async () => {
  const host = new FakeHost(PROJECT);
  const { setup, asking, calls } = setUpWith({ host });
  void asking.ask({ kind: "exit", files: ["a.ts"] });

  await setup.startUp();

  expect(asking.question.value?.kind).toBe("exit");
  expect(calls).toEqual([]);
});

test("start: as many added servers as found ones still bring the question", async () => {
  const host = new FakeHost(PROJECT);
  const added = ["a", "b", "c"].map((name) => ({ command: [name], fileTypes: ["x"] }));
  const { asking, done } = await asked({ host, added });

  expect(asking.question.value?.kind).toBe("servers");
  asking.answer(false);
  await done;
});

test("start: servers added by hand alone are asked about too", async () => {
  const host = new FakeHost({});
  const { asking, done } = await asked({
    host,
    added: [{ command: ["pylsp"], fileTypes: ["py"] }],
  });

  const question = asking.question.value;
  expect(question?.kind === "servers" && question.added.map((spec) => spec.name)).toEqual([
    "pylsp",
  ]);
  asking.answer(false);
  await done;
});

const PYLSP = { command: ["pylsp"], fileTypes: ["py"] };

test("start: a repository whose path is not UTF-8 has no root, so nothing at all", async () => {
  const warn = vi.spyOn(log, "warn");
  const host = new FakeHost(PROJECT);
  host.root = null;
  const { setup, servers, asking, calls } = setUpWith({ host, added: [PYLSP] });

  await setup.startUp();

  expect(asking.question.value).toBeNull();
  expect(servers.views()).toEqual([]);
  expect(setup.serverRoot.value).toBeNull();
  expect(calls).toEqual([]);
  expect(warn).not.toHaveBeenCalled();
  warn.mockRestore();
});

test("start: a failing host context is logged and asks nothing", async () => {
  const warn = vi.spyOn(log, "warn").mockReturnValue();
  const host = new FakeHost(PROJECT);
  host.failingContexts = 1;
  const { setup, servers, asking } = setUpWith({ host, added: [PYLSP] });

  await setup.startUp();

  expect(asking.question.value).toBeNull();
  expect(servers.views()).toEqual([]);
  expect(setup.serverRoot.value).toBeNull();
  expect(warn).toHaveBeenCalledWith("servers.detect_failed", {
    kind: "Unexpected",
    message: "ipc gone",
  });
  warn.mockRestore();
});

test("focus after a failed start look finds the servers, applies the stored answer and asks nothing", async () => {
  const warn = vi.spyOn(log, "warn").mockReturnValue();
  const host = new FakeHost(PROJECT);
  host.failingContexts = 1;
  const { setup, servers, asking } = setUpWith({ host, answer: "start" });
  await setup.startUp();
  expect(servers.views()).toEqual([]);

  await setup.refocus();

  expect(asking.question.value).toBeNull();
  await vi.waitFor(() => {
    expect(states(servers)).toEqual(FOUND_RUNNING);
  });
  warn.mockRestore();
});

test("focus after a failed start look never asks a repository without an answer", async () => {
  const warn = vi.spyOn(log, "warn").mockReturnValue();
  const host = new FakeHost(PROJECT);
  host.failingContexts = 1;
  const { setup, servers, asking, calls } = setUpWith({ host });
  await setup.startUp();

  await setup.refocus();

  expect(asking.question.value).toBeNull();
  expect(calls).toEqual([]);
  expect(states(servers)).toEqual(FOUND_STOPPED);
  warn.mockRestore();
});

test("fixture mode (no host): the files and settings load; no servers, no question", async () => {
  const warn = vi.spyOn(log, "warn");
  const { setup, servers, asking, calls, events, files } = setUpWith({
    host: null,
    added: [{ command: ["pylsp"], fileTypes: ["py"] }],
  });

  await setup.startUp();
  await setup.refocus();
  await setup.answerServers("start");
  await setup.addServer({ command: ["gopls"], fileTypes: ["go"] });

  expect(events).toEqual(["loadFiles", "loadSettings", "refreshFiles", "loadSettings"]);
  expect(files.value.map((file) => file.path)).toEqual([FILE]);
  expect(asking.question.value).toBeNull();
  expect(servers.views()).toEqual([]);
  expect(setup.serverRoot.value).toBeNull();
  expect(setup.foundServers.value).toEqual([]);
  expect(calls.map(([call]) => call)).toEqual(["setServerAnswer", "setAddedServers"]);
  expect(warn).not.toHaveBeenCalled();
  warn.mockRestore();
});

test("focus: the file list and the settings are refreshed before detection runs again", async () => {
  const host = new FakeHost(PROJECT);
  const { setup, events, disk, servers } = setUpWith({ host, answer: "dontStart" });
  await setup.startUp();
  events.length = 0;
  disk.stored = { ...disk.stored, repositories: { [ROOT]: "start" } };

  await setup.refocus();

  expect(events.slice(0, 3)).toEqual(["refreshFiles", "loadSettings", "context"]);
  await vi.waitFor(() => {
    expect(states(servers)).toEqual(FOUND_RUNNING);
  });
});

test("focus: detection runs again without asking; running servers keep their run and a newly installed one starts", async () => {
  const host = new FakeHost(PROJECT);
  const { setup, servers, asking } = setUpWith({ host, answer: "start" });
  await setup.startUp();
  await vi.waitFor(() => {
    expect(states(servers)).toEqual(FOUND_RUNNING);
  });
  host.tree["frontend/node_modules/.bin/typescript-language-server"] = "";

  await setup.refocus();

  expect(asking.question.value).toBeNull();
  await vi.waitFor(() => {
    expect(states(servers)).toEqual({ oxfmt: "running", oxlint: "running", TypeScript: "running" });
  });
  expect(host.started().toSorted()).toEqual(["oxfmt", "oxlint", "typescript-language-server"]);
  expect(host.stopped).toEqual([]);
});

test("focus: a repository still without an answer is never asked and keeps its servers stopped", async () => {
  const host = new FakeHost(PROJECT);
  const { setup, servers, asking, done, calls } = await asked({ host });
  asking.dismiss();
  await done;
  host.tree["frontend/node_modules/.bin/typescript-language-server"] = "";

  await setup.refocus();

  expect(asking.question.value).toBeNull();
  expect(calls).toEqual([]);
  expect(states(servers)).toEqual({ oxfmt: "stopped", oxlint: "stopped", TypeScript: "stopped" });
  expect(host.started()).toEqual([]);
});

test("focus: an older detection that answers last is dropped", async () => {
  const host = new FakeHost(PROJECT);
  const { setup, servers, disk } = setUpWith({ host, answer: "dontStart" });
  await setup.startUp();
  const releases: (() => void)[] = [];
  host.holdNextContext = new Promise((resolve) => {
    releases.push(resolve);
  });

  const older = setup.refocus();
  await vi.waitFor(() => {
    expect(host.holdNextContext).toBeNull();
  });
  disk.listed = [];
  await setup.refocus();
  releases.forEach((release) => release());
  await older;

  expect(servers.views()).toEqual([]);
  expect(setup.foundServers.value).toEqual([]);
});

test("focus: before the start set-up has finished, focus refreshes but does not detect", async () => {
  const host = new FakeHost(PROJECT);
  const { setup, servers, asking, done, events } = await asked({ host });
  events.length = 0;

  await setup.refocus();

  expect(events).toEqual(["refreshFiles", "loadSettings"]);
  expect(servers.views()).toEqual([]);
  asking.answer(false);
  await done;
});

test("settings: answering Start applies at once; Don't start stops the running servers; Start again starts them", async () => {
  const host = new FakeHost(PROJECT);
  const { setup, servers, asking, done, calls } = await asked({ host });
  asking.dismiss();
  await done;

  await setup.answerServers("start");
  await vi.waitFor(() => {
    expect(states(servers)).toEqual(FOUND_RUNNING);
  });

  await setup.answerServers("dontStart");
  await vi.waitFor(() => {
    expect(host.stopped.toSorted()).toEqual(["oxfmt", "oxlint"]);
  });
  expect(states(servers)).toEqual(FOUND_STOPPED);

  await setup.answerServers("start");
  await vi.waitFor(() => {
    expect(states(servers)).toEqual(FOUND_RUNNING);
  });
  const runs = host.runs.length;

  await setup.answerServers("start");

  expect(host.runs).toHaveLength(runs);
  expect(host.stopped.toSorted()).toEqual(["oxfmt", "oxlint"]);
  expect(states(servers)).toEqual(FOUND_RUNNING);
  expect(calls).toEqual([
    ["setServerAnswer", "start"],
    ["setServerAnswer", "dontStart"],
    ["setServerAnswer", "start"],
    ["setServerAnswer", "start"],
  ]);
});

test("settings: a Don't start whose write fails leaves the running servers running", async () => {
  const host = new FakeHost(PROJECT);
  const { setup, servers, disk, calls } = setUpWith({ host, answer: "start" });
  await setup.startUp();
  await vi.waitFor(() => {
    expect(states(servers)).toEqual(FOUND_RUNNING);
  });
  disk.writesFail = true;

  await setup.answerServers("dontStart");
  await setup.refocus();

  expect(calls).toEqual([["setServerAnswer", "dontStart"]]);
  expect(states(servers)).toEqual(FOUND_RUNNING);
  expect(host.stopped).toEqual([]);
  expect(host.started().toSorted()).toEqual(["oxfmt", "oxlint"]);
});

test("settings: a Start whose write fails leaves the servers stopped", async () => {
  const host = new FakeHost(PROJECT);
  const { setup, servers, disk, calls } = setUpWith({ host, answer: "dontStart" });
  await setup.startUp();
  disk.writesFail = true;

  await setup.answerServers("start");
  await setup.refocus();

  expect(calls).toEqual([["setServerAnswer", "start"]]);
  expect(states(servers)).toEqual(FOUND_STOPPED);
  expect(host.started()).toEqual([]);
});

test("settings: Don't start while Don't start is stored keeps a server started by hand", async () => {
  const host = new FakeHost(PROJECT);
  const { setup, servers } = setUpWith({ host, answer: "dontStart" });
  await setup.startUp();
  servers.start("oxlint");
  await vi.waitFor(() => {
    expect(states(servers)["oxlint"]).toBe("running");
  });

  await setup.answerServers("dontStart");

  expect(states(servers)["oxlint"]).toBe("running");
  expect(host.stopped).toEqual([]);
});

test("settings: a server the user stopped stays stopped through Don't start and Start", async () => {
  const host = new FakeHost(PROJECT);
  const { setup, servers } = setUpWith({ host, answer: "start" });
  await setup.startUp();
  await vi.waitFor(() => {
    expect(states(servers)).toEqual(FOUND_RUNNING);
  });
  servers.stop("oxlint");

  await setup.answerServers("dontStart");
  await setup.answerServers("start");

  await vi.waitFor(() => {
    expect(states(servers)).toEqual({ ...FOUND_RUNNING, oxlint: "stopped" });
  });
  expect(host.started().toSorted()).toEqual(["oxfmt", "oxfmt", "oxlint"]);
});

test("settings: an added server is stored, appears after the found ones and starts under Start; Remove drops it", async () => {
  const host = new FakeHost(PROJECT);
  const { setup, servers, calls } = setUpWith({ host, answer: "start", files: [FILE, "tool.py"] });
  servers.open({ ...DOC, path: "tool.py" });
  await setup.startUp();
  const pylsp = parseAddedServer("pylsp  --stdio", ".py, PYI  rst");
  if (pylsp === null) {
    throw new Error("pylsp does not parse");
  }

  await setup.addServer(pylsp);
  await setup.addServer({ command: ["oxlint"], fileTypes: ["md"] });

  expect(calls.slice(0, 1)).toEqual([
    ["setAddedServers", [{ command: ["pylsp", "--stdio"], fileTypes: ["py", "pyi", "rst"] }]],
  ]);
  expect(servers.views().map((view) => view.name)).toEqual([
    "oxfmt",
    "oxlint",
    "TypeScript",
    "pylsp",
    "oxlint (2)",
  ]);
  await vi.waitFor(() => {
    expect(states(servers)["pylsp"]).toBe("running");
  });

  await setup.removeServer(0);

  expect(calls.at(-1)).toEqual(["setAddedServers", [{ command: ["oxlint"], fileTypes: ["md"] }]]);
  expect(servers.views().map((view) => view.name)).toEqual([
    "oxfmt",
    "oxlint",
    "TypeScript",
    "oxlint (2)",
  ]);
  await vi.waitFor(() => {
    expect(host.stopped).toEqual(["pylsp"]);
  });
});

test("settings: Remove drops only the server at its index", async () => {
  const host = new FakeHost({});
  const first = { command: ["a"], fileTypes: ["x"] };
  const second = { command: ["b"], fileTypes: ["y"] };
  const third = { command: ["c"], fileTypes: ["z"] };
  const { setup, calls } = setUpWith({ host, added: [first, second, third] });

  await setup.removeServer(1);

  expect(calls).toEqual([["setAddedServers", [first, third]]]);
});

test("the add form: Command splits on spaces, File types on commas or spaces with leading dots dropped", () => {
  expect(parseAddedServer("pylsp", "py")).toEqual({ command: ["pylsp"], fileTypes: ["py"] });
  expect(parseAddedServer("  ruff  server --preview ", "..py,pyi ,  .PYW")).toEqual({
    command: ["ruff", "server", "--preview"],
    fileTypes: ["py", "pyi", "pyw"],
  });
  expect(parseAddedServer("", "py")).toBeNull();
  expect(parseAddedServer("   ", "py")).toBeNull();
  expect(parseAddedServer("pylsp", "")).toBeNull();
  expect(parseAddedServer("pylsp", " , . ")).toBeNull();
});

test("the add form: a file type with a dot inside can never match a file, so it gives null", () => {
  expect(parseAddedServer("tsserver", "d.ts")).toBeNull();
  expect(parseAddedServer("tsserver", "ts, .d.ts")).toBeNull();
});
