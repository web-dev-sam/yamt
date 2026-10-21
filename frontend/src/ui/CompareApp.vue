<script setup lang="ts">
import { useEventListener, useWindowFocus } from "@vueuse/core";
import { computed, onMounted, shallowRef, watch } from "vue";

import { onWindowClose, type TabId } from "../ipc";
import { useCompareStore } from "./compareStore";
import CompareView from "./CompareView.vue";
import NoticeBar from "./NoticeBar.vue";
import ProblemBar from "./ProblemBar.vue";
import QuestionDialog from "./QuestionDialog.vue";
import SettingsView from "./SettingsView.vue";
import TabList from "./TabList.vue";

const {
  tabs,
  shown,
  detected,
  notices,
  problem,
  question,
  screen,
  settings,
  fileListShown,
  loadSettings,
  addTab,
  showTab,
  closeTab,
  renameTab,
  flushAll,
  fileListKey,
  dismissNotice,
  dismissProblem,
  answer,
  dismissQuestion,
} = useCompareStore();

const focused = useWindowFocus();
useEventListener(window, "keydown", (event) => {
  fileListKey(event, navigator.platform);
});
const visited = shallowRef<ReadonlySet<TabId>>(new Set());

const mounted = computed(() => tabs.value.filter((tab) => visited.value.has(tab.id)));

watch(
  [shown, tabs],
  ([tab, listed]) => {
    const open = new Set(listed.map((entry) => entry.id));
    const kept = [...visited.value, ...(tab === null ? [] : [tab])].filter((id) => open.has(id));
    visited.value = new Set(kept);
  },
  { immediate: true },
);
watch(focused, (now) => {
  if (now) {
    void loadSettings();
  }
});
watch(
  () => settings.value.theme,
  (theme) => {
    document.documentElement.dataset["theme"] = theme;
  },
  { immediate: true },
);

onMounted(() => {
  void onWindowClose(async () => {
    await flushAll();
    return true;
  });
});
</script>

<template>
  <div class="flex h-full gap-island p-island">
    <TabList
      v-show="fileListShown"
      :tabs="tabs"
      :shown="shown"
      :detected="detected"
      @add="addTab"
      @select="showTab"
      @close="closeTab"
      @rename="renameTab"
    />
    <div class="flex min-h-0 min-w-0 flex-1 flex-col gap-island">
      <NoticeBar v-if="notices.length > 0" :rows="notices" @close="dismissNotice" />
      <ProblemBar v-if="problem !== null" :problem="problem" @close="dismissProblem" />
      <div class="grid min-h-0 min-w-0 flex-1 grid-cols-[minmax(0,1fr)] grid-rows-[minmax(0,1fr)]">
        <CompareView
          v-for="tab in mounted"
          :key="tab.id"
          :tab="tab"
          :shown="tab.id === shown && screen.kind === 'files'"
        />
        <SettingsView v-if="screen.kind === 'settings'" />
      </div>
    </div>
    <QuestionDialog
      v-if="question !== null"
      :question="question"
      @answer="answer"
      @dismiss="dismissQuestion"
    />
  </div>
</template>
