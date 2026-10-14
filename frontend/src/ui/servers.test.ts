import { expect, test, vi } from "vitest";
import { computed, shallowRef, type ShallowRef } from "vue";

import type { HostEvent, RunId, ServerHost, StartReply } from "../ipc";
import { LanguageServers, type ServerSpec } from "../lsp";
import type { Screen } from "./screen";
import { createServers, type Servers } from "./servers";

type Request = { readonly id?: number; readonly method?: string };

function isRunId(n: number): n is RunId {
  return Number.isSafeInteger(n);
}

const RUN = 1;

function answeringHost(): ServerHost {
  const listeners: ((event: HostEvent) => void)[] = [];
  function emit(event: HostEvent): void {
    listeners.forEach((listener) => listener(event));
  }
  return {
    context: () => Promise.resolve({ root: "/repo", process_id: 1 }),
    start(_, onEvent): Promise<StartReply> {
      listeners.splice(0, listeners.length, onEvent);
      emit({ kind: "Log", line: "listening" });
      if (!isRunId(RUN)) {
        throw new Error("bad run id");
      }
      return Promise.resolve({ kind: "Started", run: RUN });
    },
    send(_, text) {
      const message: Request = JSON.parse(text);
      if (message.id !== undefined) {
        const result = message.method === "initialize" ? { capabilities: {} } : null;
        queueMicrotask(() => {
          emit({
            kind: "Message",
            text: JSON.stringify({ jsonrpc: "2.0", id: message.id, result }),
          });
        });
      }
    },
    stop() {
      queueMicrotask(() => {
        emit({ kind: "Exited", code: 0 });
      });
      return Promise.resolve();
    },
    findProgram: () => Promise.resolve({ kind: "NotFound", searched: [] }),
    projectFiles: (paths) => Promise.resolve(paths.map(() => ({ kind: "Missing" }))),
  };
}

function spec(name: string, project: string): ServerSpec {
  return {
    name,
    command: { program: name, args: ["--lsp"] },
    project,
    fileTypes: ["ts"],
    formats: false,
    settings: null,
    initializationOptions: null,
    install: null,
  };
}

function created(host: ServerHost | null): {
  servers: LanguageServers;
  screen: ShallowRef<Screen>;
  slice: Servers;
} {
  const servers = new LanguageServers(host);
  const screen = shallowRef<Screen>({ kind: "files" });
  return { servers, screen, slice: createServers(screen, servers) };
}

test("serverViews follow LanguageServers.onChange", () => {
  const { servers, slice } = created(null);
  expect(slice.serverViews.value).toEqual([]);

  servers.setSpecs([spec("oxlint", "")], { startOnOpen: false });

  expect(slice.serverViews.value).toEqual([
    { name: "oxlint", project: "", state: { kind: "failed", reason: { kind: "noHost" } } },
  ]);
});

test("the actions map onto start, stop and restart by name", () => {
  const { servers, slice } = created(null);
  const start = vi.spyOn(servers, "start");
  const stop = vi.spyOn(servers, "stop");
  const restart = vi.spyOn(servers, "restart");

  slice.startServer("oxlint");
  slice.stopServer("oxfmt");
  slice.restartServer("tsgo");

  expect(start).toHaveBeenCalledWith("oxlint");
  expect(stop).toHaveBeenCalledWith("oxfmt");
  expect(restart).toHaveBeenCalledWith("tsgo");
});

test("a shown log follows new lines; other logs and other screens show none", async () => {
  const { servers, screen, slice } = created(answeringHost());
  expect(slice.shownLog.value).toEqual([]);
  servers.setSpecs([spec("oxlint", ""), spec("oxfmt", "")], { startOnOpen: false });

  slice.showServerLog("oxlint");
  expect(screen.value).toEqual({ kind: "serverLog", name: "oxlint" });
  expect(slice.shownLog.value).toEqual([]);
  slice.startServer("oxlint");
  await vi.waitFor(() => {
    expect(slice.serverViews.value[0]?.state).toEqual({ kind: "running" });
  });

  expect(slice.shownLog.value.map((line) => [line.source, line.text])).toEqual(
    expect.arrayContaining([
      ["yamt", "Starting oxlint --lsp in the repository root"],
      ["stderr", "listening"],
    ]),
  );
  slice.showServerLog("oxfmt");
  expect(slice.shownLog.value).toEqual([]);

  slice.closeServerLog();
  expect(screen.value).toEqual({ kind: "files" });
});

test.each<Screen>([{ kind: "files" }, { kind: "settings" }])(
  "leaving a shown log for $kind by any writer empties shownLog",
  async (next) => {
    const { servers, screen, slice } = created(answeringHost());
    servers.setSpecs([spec("oxlint", "")], { startOnOpen: false });
    slice.showServerLog("oxlint");
    slice.startServer("oxlint");
    await vi.waitFor(() => {
      expect(slice.shownLog.value).not.toEqual([]);
    });

    screen.value = next;

    expect(slice.shownLog.value).toEqual([]);
  },
);

test("serving follows lsp's rule per path, whatever the other servers do", async () => {
  const { servers, slice } = created(answeringHost());
  servers.setSpecs([spec("oxlint", "frontend"), spec("oxfmt", "frontend")], {
    startOnOpen: false,
  });
  expect(slice.serving("frontend/a.ts")).toBe(false);

  slice.startServer("oxlint");
  await vi.waitFor(() => {
    expect(slice.serverViews.value[0]?.state).toEqual({ kind: "running" });
  });

  expect(slice.serverViews.value[1]?.state).toEqual({ kind: "stopped" });
  expect(slice.serving("frontend/a.ts")).toBe(true);
  expect(slice.serving("backend/a.ts")).toBe(false);
});

test("a computed over serving turns true when the server starts", async () => {
  const { servers, slice } = created(answeringHost());
  servers.setSpecs([spec("oxlint", "frontend")], { startOnOpen: false });
  const served = computed(() => slice.serving("frontend/a.ts"));
  expect(served.value).toBe(false);

  slice.startServer("oxlint");
  await vi.waitFor(() => {
    expect(slice.serverViews.value[0]?.state).toEqual({ kind: "running" });
  });

  expect(served.value).toBe(true);
});
