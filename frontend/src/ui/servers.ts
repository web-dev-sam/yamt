import { shallowRef, type ShallowRef } from "vue";

import type { LanguageServers, LogLine, ServerView } from "../lsp";

export type Screen =
  | { readonly kind: "files" }
  | { readonly kind: "settings" }
  | { readonly kind: "serverLog"; readonly name: string };

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
  return {
    servers,
    serverViews,
    shownLog,
    serving: (path) =>
      serverViews.value.some((view) => view.state.kind === "running") && servers.serving(path),
    startServer: (name) => servers.start(name),
    stopServer: (name) => servers.stop(name),
    restartServer: (name) => servers.restart(name),
    showServerLog: (name) => {
      screen.value = { kind: "serverLog", name };
      readLog();
    },
    closeServerLog: () => {
      screen.value = { kind: "files" };
    },
  };
}
