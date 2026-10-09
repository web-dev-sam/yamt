import { onScopeDispose, toRef, watch, type MaybeRefOrGetter, type ShallowRef } from "vue";

import { MergeController } from "../editor";
import type { FileMergeData } from "../ipc";

type Host<T> = Readonly<ShallowRef<T | null>>;

export function useMergeController(
  data: MaybeRefOrGetter<FileMergeData | null>,
  hosts: {
    left: Host<HTMLDivElement>;
    center: Host<HTMLDivElement>;
    right: Host<HTMLDivElement>;
    strips: readonly [Host<SVGSVGElement>, Host<SVGSVGElement>];
  },
): void {
  let controller: MergeController | null = null;

  function destroyController(): void {
    controller?.destroy();
    controller = null;
  }

  watch(
    [toRef(data), hosts.left, hosts.center, hosts.right, ...hosts.strips],
    ([current, left, center, right, leftStrip, rightStrip]) => {
      destroyController();
      if (
        current === null ||
        left === null ||
        center === null ||
        right === null ||
        leftStrip === null ||
        rightStrip === null
      ) {
        return;
      }
      controller = new MergeController(current, {
        left,
        center,
        right,
        strips: [leftStrip, rightStrip],
      });
    },
    { immediate: true, flush: "post" },
  );

  onScopeDispose(destroyController);
}
