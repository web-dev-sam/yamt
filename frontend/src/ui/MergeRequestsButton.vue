<script setup lang="ts">
import GitPullRequest from "~icons/lucide/git-pull-request";

import { useMergeRequests } from "./mergeRequestsStore";
import { PAGE_TITLE } from "./mergeRequestsText";
import { vTooltip } from "./tooltip";

const { project, show } = useMergeRequests();
</script>

<template>
  <button
    v-if="project.kind === 'found'"
    v-tooltip="PAGE_TITLE"
    type="button"
    :aria-label="PAGE_TITLE"
    class="rounded p-1.5 hover:bg-hover"
    @click="show"
  >
    <GitPullRequest class="size-4" aria-hidden="true" />
  </button>
</template>
