import { createApp } from "vue";

import { createFixtureSource, createTauriSource, log } from "./ipc";
import App from "./ui/App.vue";
import { createAppStore } from "./ui/store";

import "./style.css";

const source =
  import.meta.env.VITE_CHUNK_SOURCE === "tauri" ? createTauriSource() : createFixtureSource(log);
const startTheme = document.documentElement.dataset["theme"] === "light" ? "light" : "dark";
const store = createAppStore(source, startTheme);
void store.loadFiles();
void store.loadSideNames();
createApp(App).mount("#app");
