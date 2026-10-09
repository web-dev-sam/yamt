import { onScopeDispose, toRef, watch, type MaybeRefOrGetter, type ShallowRef } from "vue";

import { MergeController, type MergeTexts } from "../editor";

export function useMergeController(
  texts: MaybeRefOrGetter<MergeTexts | null>,
  hosts: {
    left: Readonly<ShallowRef<HTMLDivElement | null>>;
    center: Readonly<ShallowRef<HTMLDivElement | null>>;
    right: Readonly<ShallowRef<HTMLDivElement | null>>;
  },
): void {
  let controller: MergeController | null = null;

  function destroyController(): void {
    controller?.destroy();
    controller = null;
  }

  watch(
    [toRef(texts), hosts.left, hosts.center, hosts.right],
    ([current, left, center, right]) => {
      destroyController();
      if (current === null || left === null || center === null || right === null) {
        return;
      }
      controller = new MergeController(current, { left, center, right });
    },
    { immediate: true, flush: "post" },
  );

  onScopeDispose(destroyController);
}
