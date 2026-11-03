<script setup lang="ts">
import { computed } from "vue";
import ArrowDownWideNarrow from "~icons/lucide/arrow-down-wide-narrow";

import { reviewFailedText, reviewSortedText, type Viewer } from "../mergeRequests";
import type { ReviewSort } from "./mergeRequestsShown";
import { discussionsFailedText } from "./mergeRequestsText";
import { vTooltip } from "./tooltip";

const props = defineProps<{ sort: ReviewSort; viewer: Viewer }>();

const text = computed(() => {
  const { sort, viewer } = props;
  switch (sort.kind) {
    case "sorted":
      return reviewSortedText(viewer, sort.loading);
    case "failed":
      return reviewFailedText(
        viewer,
        sort.iid,
        discussionsFailedText(sort.failure, navigator.platform),
      );
    default: {
      const _exhaustive: never = sort;
      return _exhaustive;
    }
  }
});
</script>

<template>
  <span v-tooltip="text" role="img" :aria-label="text" class="flex items-center px-1">
    <ArrowDownWideNarrow
      class="size-4"
      :class="sort.kind === 'failed' ? 'text-problem-error' : 'text-primary'"
      aria-hidden="true"
    />
  </span>
</template>
