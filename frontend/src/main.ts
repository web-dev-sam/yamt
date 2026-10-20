import { createApp } from "vue";

import {
  createFixtureServerHost,
  createFixtureSource,
  createTauriServerHost,
  createTauriSource,
  log,
  type ServerHost,
} from "./ipc";
import { LanguageServers } from "./lsp";
import App from "./ui/App.vue";
import { createAppStore } from "./ui/store";

import "./style.css";

const IN_APP = import.meta.env.VITE_CHUNK_SOURCE === "tauri";

function serverHost(): ServerHost | null {
  if (IN_APP) {
    return createTauriServerHost();
  }
  return new URLSearchParams(window.location.search).has("servers")
    ? createFixtureServerHost()
    : null;
}

const source = IN_APP ? createTauriSource() : createFixtureSource(log);
const host = serverHost();
const servers = new LanguageServers(host);
const startTheme = document.documentElement.dataset["theme"] === "light" ? "light" : "dark";
const store = createAppStore(source, startTheme, servers, host);
void store.startUp();
void store.loadSideNames();
createApp(App).mount("#app");
