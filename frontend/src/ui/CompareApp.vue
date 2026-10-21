<script setup lang="ts">
import { useEventListener, useWindowFocus } from "@vueuse/core";
import { onMounted, watch } from "vue";

import { log, onWindowClose } from "../ipc";
import { useCompareStore } from "./compareStore";
import CompareTabList from "./CompareTabList.vue";
import CompareView from "./CompareView.vue";
import NoticeBar from "./NoticeBar.vue";
import { unexpected } from "./problem";
import ProblemBar from "./ProblemBar.vue";
import QuestionDialog from "./QuestionDialog.vue";
import { useThemeAttribute } from "./settingsStore";
import SettingsView from "./SettingsView.vue";

const {
  tabs,
  shown,
  visited,
  detected,
  notices,
  problem,
  question,
  screen,
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
useThemeAttribute();
useEventListener(window, "keydown", (event) => {
  fileListKey(event, navigator.platform);
});

watch(focused, (now) => {
  if (now) {
    void loadSettings();
  }
});

onMounted(() => {
  void watchWindowClose();
});

async function watchWindowClose(): Promise<void> {
  try {
    await onWindowClose(async () => {
      await flushAll();
      return true;
    });
  } catch (error) {
    log.error("compare.close_guard_failed", { ...unexpected(error) });
  }
}
</script>

<template>
  <div class="flex h-full gap-island p-island">
    <CompareTabList
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
          v-for="tab in visited"
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
