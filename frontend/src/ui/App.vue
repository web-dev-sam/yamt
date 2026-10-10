<script setup lang="ts">
import FileList from "./FileList.vue";
import MergeView from "./MergeView.vue";
import ProblemBar from "./ProblemBar.vue";
import { useAppStore } from "./store";

const { files, active, data, problem, open, finish, reset, dismissProblem } = useAppStore();
</script>

<template>
  <div class="flex h-full">
    <FileList :files="files" :active="active" @select="open" />
    <div class="flex min-h-0 min-w-0 flex-1 flex-col">
      <ProblemBar v-if="problem !== null" :problem="problem" @close="dismissProblem" />
      <MergeView :data="data" @finish="finish" @reset="reset" />
    </div>
  </div>
</template>
