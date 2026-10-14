import { shallowRef, watch, type ShallowRef } from "vue";

import type { LanguageServers, LogLine, ServerView } from "../lsp";
import type { Screen } from "./screen";

export type Servers = {
  readonly servers: LanguageServers;
  readonly serverViews: Readonly<ShallowRef<readonly ServerView[]>>;
  readonly shownLog: Readonly<ShallowRef<readonly LogLine[]>>;
  serving(path: string): boolean;
  startServer(name: string): void;
  stopServer(name: string): void;
  restartServer(name: string): void;
  showServerLog(name: string): void;
  closeServerLog(): void;
};

export function createServers(screen: ShallowRef<Screen>, servers: LanguageServers): Servers {
  const serverViews = shallowRef(servers.views());
  const shownLog = shallowRef<readonly LogLine[]>([]);
  function readLog(): void {
    shownLog.value = screen.value.kind === "serverLog" ? servers.log(screen.value.name) : [];
  }
  servers.onChange(() => {
    serverViews.value = servers.views();
    readLog();
  });
  watch(screen, readLog, { flush: "sync" });
  return {
    servers,
    serverViews,
    shownLog,
    serving: (path) => {
      // Reading serverViews subscribes a caller's computed to onChange; servers.serving is not reactive.
      void serverViews.value;
      return servers.serving(path);
    },
    startServer: (name) => servers.start(name),
    stopServer: (name) => servers.stop(name),
    restartServer: (name) => servers.restart(name),
    showServerLog: (name) => {
      screen.value = { kind: "serverLog", name };
    },
    closeServerLog: () => {
      screen.value = { kind: "files" };
    },
  };
}
