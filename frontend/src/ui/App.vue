<script setup lang="ts">
import { useEventListener, useWindowFocus } from "@vueuse/core";
import { computed, onMounted, watch } from "vue";

import { useAltHold } from "./altHold";
import ChoiceView from "./ChoiceView.vue";
import FileList from "./FileList.vue";
import MergeView from "./MergeView.vue";
import NoticeBar from "./NoticeBar.vue";
import OperationBar from "./OperationBar.vue";
import { allResolvedText } from "./operationText";
import ProblemBar from "./ProblemBar.vue";
import QuestionDialog from "./QuestionDialog.vue";
import ServerLogView from "./ServerLogView.vue";
import SettingsView from "./SettingsView.vue";
import StopView from "./StopView.vue";
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
  operation,
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
} = useAppStore();

const focused = useWindowFocus();
const altHeld = useAltHold();
useEventListener(window, "keydown", (event) => {
  fileListKey(event, navigator.platform);
});

const stopShown = computed(
  () => operation.value !== null && files.value.length === 0 && screen.value.kind === "files",
);
const stopped = computed(() =>
  stopShown.value && problem.value?.action === "stopped" ? problem.value.message.trim() : null,
);
const barProblem = computed(() => (stopped.value === null ? problem.value : null));
const resolvedLine = computed(() => allResolvedText(operation.value));

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
    <FileList v-show="fileListShown" :files="files" :active="active" @select="pick" />
    <div class="flex min-h-0 min-w-0 flex-1 flex-col gap-island">
      <OperationBar v-if="operation !== null" :operation="operation" />
      <NoticeBar v-if="notices.length > 0" :notices="notices" @close="dismissNotice" />
      <ProblemBar v-if="barProblem !== null" :problem="barProblem" @close="dismissProblem" />
      <p
        v-else-if="allResolved"
        role="status"
        class="shrink-0 rounded-md border border-success-border bg-success px-3 py-2 text-fg"
      >
        {{ resolvedLine }}
      </p>
      <div class="grid min-h-0 min-w-0 flex-1 grid-cols-[minmax(0,1fr)] grid-rows-[minmax(0,1fr)]">
        <MergeView
          v-for="file in opened"
          :key="file.path"
          :data="file"
          :shown="file.path === active && screen.kind === 'files'"
          :minimap="altHeld"
        />
        <ChoiceView
          v-for="sides in choices"
          :key="sides.path"
          :sides="sides"
          :shown="sides.path === active && screen.kind === 'files'"
        />
        <StopView v-if="stopShown" :message="stopped" />
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
