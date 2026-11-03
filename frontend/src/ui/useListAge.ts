import { useTimeoutFn } from "@vueuse/core";
import { computed, shallowRef, toRef, watch, type ComputedRef, type MaybeRefOrGetter } from "vue";

import { agoText, timeTitle } from "../mergeRequests";

const MINUTE_MS = 60_000;

interface ListAge {
  readonly text: string;
  readonly title: string;
}

export function useListAge(listedAt: MaybeRefOrGetter<number | null>): ComputedRef<ListAge | null> {
  const at = toRef(listedAt);
  const now = shallowRef(Date.now());
  const delay = shallowRef(MINUTE_MS);
  const tick = useTimeoutFn(read, delay, { immediate: false });
  watch(at, read, { immediate: true });

  function read(): void {
    now.value = Date.now();
    if (at.value === null) {
      tick.stop();
      return;
    }
    delay.value = untilNextMinute(at.value, now.value);
    tick.start();
  }

  return computed(() =>
    at.value === null
      ? null
      : { text: agoText(at.value, now.value), title: timeTitle(at.value, now.value) },
  );
}

function untilNextMinute(at: number, now: number): number {
  return MINUTE_MS - ((now - at) % MINUTE_MS);
}
