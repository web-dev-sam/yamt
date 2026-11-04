<script setup lang="ts">
import { computed, shallowRef, watch } from "vue";

import type { DescriptionImage } from "../ipc";
import { IMAGE_STAND_IN } from "./mergeRequestDescriptionText";
import { useMergeRequests } from "./mergeRequestsStore";

const props = defineProps<{ image: DescriptionImage; caption: string }>();

const { imageAddress } = useMergeRequests();
const failed = shallowRef(false);

const address = computed(() => imageAddress(props.image));
const standIn = computed(() => {
  if (props.caption !== "") {
    return props.caption;
  }
  return props.image.kind === "web" ? props.image.address : IMAGE_STAND_IN;
});

watch(address, () => {
  failed.value = false;
});
</script>

<template>
  <span v-if="address === null || failed" class="text-fg-muted">{{ standIn }}</span>
  <img
    v-else
    :src="address"
    :alt="caption"
    referrerpolicy="no-referrer"
    loading="lazy"
    draggable="false"
    class="inline h-auto max-w-full"
    @error="failed = true"
  />
</template>
