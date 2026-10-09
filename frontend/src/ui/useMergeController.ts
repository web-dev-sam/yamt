import {
  onScopeDispose,
  shallowRef,
  toRef,
  watch,
  type MaybeRefOrGetter,
  type ShallowRef,
} from "vue";

import { MergeController, type MergeSummary } from "../editor";
import type { FileMergeData } from "../ipc";

export type { MergeSummary } from "../editor";

type Host<T> = Readonly<ShallowRef<T | null>>;

export function useMergeController(
  data: MaybeRefOrGetter<FileMergeData | null>,
  hosts: {
    left: Host<HTMLDivElement>;
    center: Host<HTMLDivElement>;
    right: Host<HTMLDivElement>;
    strips: readonly [Host<SVGSVGElement>, Host<SVGSVGElement>];
  },
): {
  summary: Readonly<ShallowRef<MergeSummary | null>>;
  applyAllNonConflicting(side: "local" | "remote"): void;
  undo(): void;
  redo(): void;
  resultText(): string | null;
} {
  const summary = shallowRef<MergeSummary | null>(null);
  let controller: MergeController | null = null;

  function destroyController(): void {
    controller?.destroy();
    controller = null;
    summary.value = null;
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
      controller.onSummaryChange((next) => {
        summary.value = next;
      });
      summary.value = controller.summary();
    },
    { immediate: true, flush: "post" },
  );

  onScopeDispose(destroyController);

  return {
    summary,
    applyAllNonConflicting: (side) => controller?.applyAllNonConflicting(side),
    undo: () => controller?.undo(),
    redo: () => controller?.redo(),
    resultText: () => controller?.resultText() ?? null,
  };
}
