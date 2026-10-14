import { createApp } from "vue";

import { createFixtureSource, createTauriServerHost, createTauriSource, log } from "./ipc";
import { LanguageServers } from "./lsp";
import App from "./ui/App.vue";
import { createAppStore } from "./ui/store";

import "./style.css";

const IN_APP = import.meta.env.VITE_CHUNK_SOURCE === "tauri";
const source = IN_APP ? createTauriSource() : createFixtureSource(log);
const servers = new LanguageServers(IN_APP ? createTauriServerHost() : null);
const startTheme = document.documentElement.dataset["theme"] === "light" ? "light" : "dark";
const store = createAppStore(source, startTheme, servers);
void store.loadFiles();
void store.loadSideNames();
createApp(App).mount("#app");
