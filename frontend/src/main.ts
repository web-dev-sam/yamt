import { createApp } from "vue";

import { createFixtureSource, log } from "./ipc";
import App from "./ui/App.vue";
import { createAppStore } from "./ui/store";

import "./style.css";

const store = createAppStore(createFixtureSource(log));
void store.loadFiles();
createApp(App).mount("#app");
