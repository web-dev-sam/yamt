import { expect, test, vi } from "vitest";
import { shallowRef } from "vue";

import {
  log,
  type AddedServer,
  type FileEntry,
  type HostEvent,
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
  holdNextContext: Promise<void> | null = null;
  root: string | null = ROOT;

  constructor(tree: Tree) {
    this.tree = { ...tree };
  }

  async context(): Promise<ServerContext> {
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
  const settings = shallowRef(startSettings("dark"));
  const { added = [], answer, answerRoot = ROOT } = options;
  settings.value = {
    ...settings.value,
    languageServers: {
      repositories: answer === undefined ? {} : { [answerRoot]: answer },
      added: [...added],
    },
  };
  const calls: unknown[][] = [];
  const servers = new LanguageServers(options.host);
  servers.open(DOC);
  const asking = createAsking();
  const files = shallowRef((options.files ?? [FILE]).map(entry));
  const setup = createServerSetup({
    host: options.host,
    servers,
    files,
    settings,
    asking,
    setServerAnswer: async (given) => {
      calls.push(["setServerAnswer", given]);
      const { languageServers } = settings.value;
      const repositories = { ...languageServers.repositories };
      if (given === null) {
        delete repositories[ROOT];
      } else {
        repositories[ROOT] = given;
      }
      settings.value = { ...settings.value, languageServers: { ...languageServers, repositories } };
    },
    setAddedServers: async (list) => {
      calls.push(["setAddedServers", list]);
      const { languageServers } = settings.value;
      settings.value = {
        ...settings.value,
        languageServers: { ...languageServers, added: [...list] },
      };
    },
  });
  return { setup, servers, asking, calls, settings, files };
}

function states(servers: LanguageServers): Record<string, ServerState["kind"]> {
  return Object.fromEntries(servers.views().map((view) => [view.name, view.state.kind]));
}

const FOUND_STOPPED = { oxfmt: "stopped", oxlint: "stopped", TypeScript: "notInstalled" };
const FOUND_RUNNING = { oxfmt: "running", oxlint: "running", TypeScript: "notInstalled" };

test("start: no specs means no question and no servers", async () => {
  const host = new FakeHost({});
  const { setup, servers, asking, calls } = setUpWith({ host });

  await setup.setUpServers();

  expect(asking.question.value).toBeNull();
  expect(servers.views()).toEqual([]);
  expect(calls).toEqual([]);
  expect(setup.serverRoot.value).toBe(ROOT);
});

test("start: a stored Start answers without a question and starts the served servers", async () => {
  const host = new FakeHost(PROJECT);
  const { setup, servers, asking, calls } = setUpWith({ host, answer: "start" });

  await setup.setUpServers();

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

  await setup.setUpServers();

  expect(asking.question.value).toBeNull();
  expect(calls).toEqual([]);
  expect(states(servers)).toEqual(FOUND_STOPPED);
  expect(host.started()).toEqual([]);
});

test("start: an answer stored for another repository does not count", async () => {
  const host = new FakeHost(PROJECT);
  const { setup, asking } = setUpWith({ host, answer: "start", answerRoot: OTHER_ROOT });

  void setup.setUpServers();

  await vi.waitFor(() => {
    expect(asking.question.value?.kind).toBe("servers");
  });
});

async function asked(options: Parameters<typeof setUpWith>[0]) {
  const made = setUpWith(options);
  const done = made.setup.setUpServers();
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
  const { setup, asking, done, calls, servers } = await asked({ host });

  setup.dismissQuestion();
  await done;

  expect(asking.question.value).toBeNull();
  expect(calls).toEqual([]);
  expect(states(servers)).toEqual(FOUND_STOPPED);
  expect(host.started()).toEqual([]);
});

test("start: another question already open counts as Escape", async () => {
  const host = new FakeHost(PROJECT);
  const { setup, asking, calls } = setUpWith({ host });
  void asking.ask({ kind: "exit", files: ["a.ts"] });

  await setup.setUpServers();

  expect(asking.question.value?.kind).toBe("exit");
  expect(calls).toEqual([]);
});

test("Escape on another question still means its cancel", async () => {
  const { setup, asking } = setUpWith({ host: new FakeHost(PROJECT) });
  const exit = asking.ask({ kind: "exit", files: ["a.ts"] });

  setup.dismissQuestion();

  await expect(exit).resolves.toBe(false);
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

  await setup.setUpServers();

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
  host.context = () => Promise.reject(new Error("ipc gone"));
  const { setup, servers, asking } = setUpWith({ host, added: [PYLSP] });

  await setup.setUpServers();

  expect(asking.question.value).toBeNull();
  expect(servers.views()).toEqual([]);
  expect(setup.serverRoot.value).toBeNull();
  expect(warn).toHaveBeenCalledWith("servers.detect_failed", {
    kind: "Unexpected",
    message: "ipc gone",
  });
  warn.mockRestore();
});

test("fixture mode (no host): nothing at all", async () => {
  const warn = vi.spyOn(log, "warn");
  const { setup, servers, asking, calls } = setUpWith({
    host: null,
    added: [{ command: ["pylsp"], fileTypes: ["py"] }],
  });

  await setup.setUpServers();
  await setup.findServers();
  await setup.answerServers("start");
  await setup.addServer({ command: ["gopls"], fileTypes: ["go"] });

  expect(asking.question.value).toBeNull();
  expect(servers.views()).toEqual([]);
  expect(setup.serverRoot.value).toBeNull();
  expect(setup.foundServers.value).toEqual([]);
  expect(calls.map(([call]) => call)).toEqual(["setServerAnswer", "setAddedServers"]);
  expect(warn).not.toHaveBeenCalled();
  warn.mockRestore();
});

test("focus: detection runs again without asking; running servers keep their run and a newly installed one starts", async () => {
  const host = new FakeHost(PROJECT);
  const { setup, servers, asking } = setUpWith({ host, answer: "start" });
  await setup.setUpServers();
  await vi.waitFor(() => {
    expect(states(servers)).toEqual(FOUND_RUNNING);
  });
  host.tree["frontend/node_modules/.bin/typescript-language-server"] = "";

  await setup.findServers();

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
  setup.dismissQuestion();
  await done;
  host.tree["frontend/node_modules/.bin/typescript-language-server"] = "";

  await setup.findServers();

  expect(asking.question.value).toBeNull();
  expect(calls).toEqual([]);
  expect(states(servers)).toEqual({ oxfmt: "stopped", oxlint: "stopped", TypeScript: "stopped" });
  expect(host.started()).toEqual([]);
});

test("focus: an older detection that answers last is dropped", async () => {
  const host = new FakeHost(PROJECT);
  const { setup, servers, files } = setUpWith({ host, answer: "dontStart" });
  await setup.setUpServers();
  const releases: (() => void)[] = [];
  host.holdNextContext = new Promise((resolve) => {
    releases.push(resolve);
  });

  const older = setup.findServers();
  files.value = [];
  await setup.findServers();
  releases.forEach((release) => release());
  await older;

  expect(servers.views()).toEqual([]);
  expect(setup.foundServers.value).toEqual([]);
});

test("focus: before the start set-up has finished, focus does nothing", async () => {
  const host = new FakeHost(PROJECT);
  const { setup, servers, asking, done } = await asked({ host });

  await setup.findServers();

  expect(servers.views()).toEqual([]);
  asking.answer(false);
  await done;
});

test("settings: answering Start applies at once; Don't start stops the running servers; Start again starts them", async () => {
  const host = new FakeHost(PROJECT);
  const { setup, servers, done, calls } = await asked({ host });
  setup.dismissQuestion();
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

test("settings: an added server is stored, appears after the found ones and starts under Start; Remove drops it", async () => {
  const host = new FakeHost(PROJECT);
  const { setup, servers, calls } = setUpWith({ host, answer: "start", files: [FILE, "tool.py"] });
  servers.open({ ...DOC, path: "tool.py" });
  await setup.setUpServers();
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
  expect(parseAddedServer("tsserver", "d.ts")).toEqual({
    command: ["tsserver"],
    fileTypes: ["d.ts"],
  });
});
