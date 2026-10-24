import { createApp } from "vue";

import {
  createFixtureCompareSource,
  createFixtureRangeSource,
  createFixtureServerHost,
  createFixtureSource,
  createTauriCompareSource,
  createTauriRangeSource,
  createTauriServerHost,
  createTauriSource,
  isLinux,
  log,
  readClipboard,
  themeOf,
  type ServerHost,
  type Theme,
} from "./ipc";
import { LanguageServers } from "./lsp";
import App from "./ui/App.vue";
import CompareApp from "./ui/CompareApp.vue";
import { createCompareStore } from "./ui/compareStore";
import { takeLinuxPastes } from "./ui/linuxPaste";
import RangeApp from "./ui/RangeApp.vue";
import { createRangeStore } from "./ui/rangeStore";
import { createAppStore } from "./ui/store";

import "./style.css";

type WindowKind = "merge" | "compare" | "range";

const IN_APP = import.meta.env.VITE_CHUNK_SOURCE === "tauri";
const SEARCH = window.location.search;

function windowKind(dataset: DOMStringMap): WindowKind {
  if (IN_APP) {
    const kind = dataset["window"];
    return kind === "compare" || kind === "range" ? kind : "merge";
  }
  const params = new URLSearchParams(SEARCH);
  if (params.has("range")) {
    return "range";
  }
  return params.has("diff") ? "compare" : "merge";
}

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

function startRange(startTheme: Theme): void {
  const source = IN_APP ? createTauriRangeSource() : createFixtureRangeSource(log, SEARCH);
  const store = createRangeStore(source, startTheme);
  void store.startUp();
  createApp(RangeApp).mount("#app");
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
const startTheme = themeOf(dataset["theme"]);
const kind = windowKind(dataset);
switch (kind) {
  case "merge":
    startMerge(startTheme);
    break;
  case "compare":
    startCompare(startTheme);
    break;
  case "range":
    startRange(startTheme);
    break;
  default: {
    const _exhaustive: never = kind;
    throw new Error(`unknown window ${String(_exhaustive)}`);
  }
}
