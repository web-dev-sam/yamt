import { createApp } from "vue";

import { createFixtureSource, createTauriSource, log } from "./ipc";
import App from "./ui/App.vue";
import { createAppStore } from "./ui/store";

import "./style.css";

const source =
  import.meta.env.VITE_CHUNK_SOURCE === "tauri" ? createTauriSource() : createFixtureSource(log);
const store = createAppStore(source);
void store.loadFiles();
void store.loadRemoteName();
createApp(App).mount("#app");
