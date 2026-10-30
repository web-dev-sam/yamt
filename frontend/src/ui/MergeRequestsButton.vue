<script setup lang="ts">
import GitPullRequest from "~icons/lucide/git-pull-request";

import { useMergeRequests } from "./mergeRequestsStore";

const { project, show } = useMergeRequests();
</script>

<template>
  <button
    v-if="project.kind === 'found'"
    type="button"
    title="Merge requests"
    aria-label="Merge requests"
    class="rounded p-1.5 hover:bg-hover"
    @click="show"
  >
    <GitPullRequest class="size-4" aria-hidden="true" />
  </button>
</template>
