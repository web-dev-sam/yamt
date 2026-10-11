<script setup lang="ts">
import { useWindowFocus } from "@vueuse/core";
import { onMounted, watch } from "vue";

import ChoiceView from "./ChoiceView.vue";
import FileList from "./FileList.vue";
import MergeView from "./MergeView.vue";
import ProblemBar from "./ProblemBar.vue";
import QuestionDialog from "./QuestionDialog.vue";
import { useAppStore } from "./store";

const {
  files,
  opened,
  choices,
  taken,
  active,
  problem,
  question,
  allResolved,
  open,
  refreshFiles,
  dismissProblem,
  answer,
  watchWindowClose,
} = useAppStore();

const focused = useWindowFocus();

watch(focused, (now) => {
  if (now) {
    void refreshFiles();
  }
});

onMounted(() => {
  void watchWindowClose();
});
</script>

<template>
  <div class="flex h-full">
    <FileList :files="files" :active="active" @select="open" />
    <div class="flex min-h-0 min-w-0 flex-1 flex-col">
      <ProblemBar v-if="problem !== null" :problem="problem" @close="dismissProblem" />
      <p
        v-else-if="allResolved"
        role="status"
        class="shrink-0 border-b border-success-border bg-success px-3 py-2 text-fg"
      >
        All files are resolved. Close the window to finish the merge.
      </p>
      <div class="grid min-h-0 min-w-0 flex-1 grid-cols-[minmax(0,1fr)] grid-rows-[minmax(0,1fr)]">
        <MergeView
          v-for="file in opened"
          :key="file.path"
          :data="file"
          :shown="file.path === active"
        />
        <ChoiceView
          v-for="sides in choices"
          :key="sides.path"
          :sides="sides"
          :taken="taken.get(sides.path) ?? null"
          :shown="sides.path === active"
        />
      </div>
    </div>
    <QuestionDialog v-if="question !== null" :question="question" @answer="answer" />
  </div>
</template>
