<script setup lang="ts">
import { computed, shallowRef, watch } from "vue";
import UserRound from "~icons/lucide/user-round";

import type { Person } from "../ipc";
import { initials, pictureHue } from "../mergeRequests";

type PictureSize = "row" | "stack" | "box";
type Shown = "loading" | "loaded" | "failed";

const props = defineProps<{ person: Person | null; size: PictureSize }>();

const SIZES: Readonly<Record<PictureSize, string>> = {
  row: "size-6 text-[0.625rem]",
  stack: "size-5 text-[0.5rem]",
  box: "size-5 text-[0.5rem]",
};

const shown = shallowRef<Shown>("loading");

const picture = computed(() => props.person?.picture ?? null);
const letters = computed(() => (props.person === null ? "" : initials(props.person)));
const hue = computed(() => ({
  filter: `hue-rotate(${props.person === null ? 0 : pictureHue(props.person.username)}deg)`,
}));

watch(picture, () => {
  shown.value = "loading";
});
</script>

<template>
  <UserRound v-if="person === null" class="shrink-0 text-fg-muted" :class="SIZES[size]" />
  <span
    v-else
    class="relative inline-flex shrink-0 overflow-hidden rounded-full font-semibold"
    :class="SIZES[size]"
  >
    <span
      class="absolute inset-0 flex items-center justify-center bg-primary text-on-primary"
      :style="hue"
      >{{ letters }}</span
    >
    <img
      v-if="picture !== null && shown !== 'failed'"
      referrerpolicy="no-referrer"
      :src="picture"
      alt=""
      class="absolute inset-0 size-full object-cover"
      :class="{ invisible: shown === 'loading' }"
      @load="shown = 'loaded'"
      @error="shown = 'failed'"
    />
  </span>
</template>
