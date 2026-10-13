<script setup lang="ts">
import { useWindowFocus } from "@vueuse/core";
import { onMounted, watch } from "vue";

import ChoiceView from "./ChoiceView.vue";
import FileList from "./FileList.vue";
import MergeView from "./MergeView.vue";
import NoticeBar from "./NoticeBar.vue";
import ProblemBar from "./ProblemBar.vue";
import QuestionDialog from "./QuestionDialog.vue";
import SettingsView from "./SettingsView.vue";
import { useAppStore } from "./store";

const {
  files,
  opened,
  choices,
  active,
  settingsOpen,
  problem,
  notices,
  question,
  allResolved,
  pick,
  refreshFiles,
  loadSettings,
  settings,
  dismissProblem,
  dismissNotice,
  answer,
  watchWindowClose,
} = useAppStore();

const focused = useWindowFocus();

watch(focused, (now) => {
  if (now) {
    void refreshFiles();
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
  void watchWindowClose();
  void loadSettings();
});
</script>

<template>
  <div class="flex h-full gap-island p-island">
    <FileList :files="files" :active="active" @select="pick" />
    <div class="flex min-h-0 min-w-0 flex-1 flex-col gap-island">
      <NoticeBar v-if="notices.length > 0" :notices="notices" @close="dismissNotice" />
      <ProblemBar v-if="problem !== null" :problem="problem" @close="dismissProblem" />
      <p
        v-else-if="allResolved"
        role="status"
        class="shrink-0 rounded-md border border-success-border bg-success px-3 py-2 text-fg"
      >
        All files are resolved. Close the window to finish the merge.
      </p>
      <div class="grid min-h-0 min-w-0 flex-1 grid-cols-[minmax(0,1fr)] grid-rows-[minmax(0,1fr)]">
        <MergeView
          v-for="file in opened"
          :key="file.path"
          :data="file"
          :shown="file.path === active && !settingsOpen"
        />
        <ChoiceView
          v-for="sides in choices"
          :key="sides.path"
          :sides="sides"
          :shown="sides.path === active && !settingsOpen"
        />
        <SettingsView v-if="settingsOpen" />
      </div>
    </div>
    <QuestionDialog v-if="question !== null" :question="question" @answer="answer" />
  </div>
</template>
