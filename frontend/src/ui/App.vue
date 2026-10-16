<script setup lang="ts">
import { useEventListener, useWindowFocus } from "@vueuse/core";
import { onMounted, watch } from "vue";

import ChoiceView from "./ChoiceView.vue";
import FileList from "./FileList.vue";
import MergeView from "./MergeView.vue";
import NoticeBar from "./NoticeBar.vue";
import ProblemBar from "./ProblemBar.vue";
import QuestionDialog from "./QuestionDialog.vue";
import ServerLogView from "./ServerLogView.vue";
import SettingsView from "./SettingsView.vue";
import { useAppStore } from "./store";

const {
  files,
  opened,
  choices,
  active,
  screen,
  fileListShown,
  problem,
  notices,
  question,
  allResolved,
  pick,
  refocus,
  settings,
  dismissProblem,
  dismissNotice,
  answer,
  dismissQuestion,
  watchWindowClose,
  fileListKey,
  abortButton,
  abortMerge,
} = useAppStore();

const focused = useWindowFocus();
useEventListener(window, "keydown", (event) => {
  fileListKey(event, navigator.platform);
});

watch(focused, (now) => {
  if (now) {
    void refocus();
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
});
</script>

<template>
  <div class="flex h-full gap-island p-island">
    <FileList
      v-show="fileListShown"
      :files="files"
      :active="active"
      :abort-button="abortButton"
      @select="pick"
      @abort="abortMerge"
    />
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
          :shown="file.path === active && screen.kind === 'files'"
        />
        <ChoiceView
          v-for="sides in choices"
          :key="sides.path"
          :sides="sides"
          :shown="sides.path === active && screen.kind === 'files'"
        />
        <SettingsView v-if="screen.kind === 'settings'" />
        <ServerLogView
          v-else-if="screen.kind === 'serverLog'"
          :key="screen.name"
          :name="screen.name"
        />
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
