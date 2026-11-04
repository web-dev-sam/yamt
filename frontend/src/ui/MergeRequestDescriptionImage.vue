<script setup lang="ts">
import { computed, shallowRef, useTemplateRef, watch } from "vue";

import type { DescriptionImage, DescriptionInline } from "../ipc";
import { IMAGE_STAND_IN } from "./mergeRequestDescriptionText";
import { imageStyle, type NaturalSize } from "./mergeRequestImageSize";
import { useMergeRequests } from "./mergeRequestsStore";

type ImageSize = Extract<DescriptionInline, { kind: "image" }>["size"];

const props = defineProps<{ image: DescriptionImage; caption: string; size: ImageSize }>();

const { imageAddress } = useMergeRequests();
const picture = useTemplateRef<HTMLImageElement>("picture");
const failed = shallowRef(false);
const natural = shallowRef<NaturalSize | null>(null);

const address = computed(() => imageAddress(props.image));
const standIn = computed(() => {
  if (props.caption !== "") {
    return props.caption;
  }
  return props.image.kind === "web" ? props.image.address : IMAGE_STAND_IN;
});
const style = computed(() => imageStyle(props.size, natural.value));

watch(address, () => {
  failed.value = false;
  natural.value = null;
});

function loaded(): void {
  const element = picture.value;
  if (element !== null) {
    natural.value = { width: element.naturalWidth, height: element.naturalHeight };
  }
}
</script>

<template>
  <span v-if="address === null || failed" class="text-fg-muted">{{ standIn }}</span>
  <img
    v-else
    ref="picture"
    :src="address"
    :alt="caption"
    referrerpolicy="no-referrer"
    loading="lazy"
    draggable="false"
    class="inline"
    :style="style"
    @load="loaded"
    @error="failed = true"
  />
</template>
