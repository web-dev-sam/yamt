import { createApp } from "vue";

import {
  createFixtureCompareSource,
  createFixtureServerHost,
  createFixtureSource,
  createTauriCompareSource,
  createTauriServerHost,
  createTauriSource,
  isLinux,
  log,
  readClipboard,
  type ServerHost,
  type Theme,
} from "./ipc";
import { LanguageServers } from "./lsp";
import App from "./ui/App.vue";
import CompareApp from "./ui/CompareApp.vue";
import { createCompareStore } from "./ui/compareStore";
import { takeLinuxPastes } from "./ui/linuxPaste";
import { createAppStore } from "./ui/store";

import "./style.css";

const IN_APP = import.meta.env.VITE_CHUNK_SOURCE === "tauri";
const SEARCH = window.location.search;

function serverHost(): ServerHost | null {
  if (IN_APP) {
    return createTauriServerHost();
  }
  return new URLSearchParams(SEARCH).has("servers") ? createFixtureServerHost() : null;
}

function startCompare(startTheme: Theme): void {
  const source = IN_APP ? createTauriCompareSource() : createFixtureCompareSource(log, SEARCH);
  const store = createCompareStore(source, startTheme);
  void store.startUp();
  createApp(CompareApp).mount("#app");
}

function startMerge(startTheme: Theme): void {
  const source = IN_APP ? createTauriSource() : createFixtureSource(log, SEARCH);
  const host = serverHost();
  const servers = new LanguageServers(host);
  const store = createAppStore(source, startTheme, servers, host);
  void store.startUp();
  createApp(App).mount("#app");
}

if (IN_APP && isLinux(navigator.platform)) {
  takeLinuxPastes(window, readClipboard);
}
const { dataset } = document.documentElement;
const startTheme = dataset["theme"] === "light" ? "light" : "dark";
const comparing = IN_APP
  ? dataset["window"] === "compare"
  : new URLSearchParams(SEARCH).has("diff");
if (comparing) {
  startCompare(startTheme);
} else {
  startMerge(startTheme);
}
