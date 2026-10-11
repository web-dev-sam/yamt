<script setup lang="ts">
import { onMounted } from "vue";

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
  active,
  problem,
  question,
  allResolved,
  open,
  dismissProblem,
  answer,
  watchWindowClose,
} = useAppStore();

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
          v-for="choice in choices"
          :key="choice.sides.path"
          :choice="choice"
          :shown="choice.sides.path === active"
        />
      </div>
    </div>
    <QuestionDialog v-if="question !== null" :question="question" @answer="answer" />
  </div>
</template>
