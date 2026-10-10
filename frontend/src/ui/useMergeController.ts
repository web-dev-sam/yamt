import {
  onScopeDispose,
  shallowRef,
  toRef,
  watch,
  type MaybeRefOrGetter,
  type ShallowRef,
} from "vue";

import { MergeController, type MergeSummary, type Side } from "../editor";
import type { FileMergeData } from "../ipc";

export type { MergeSummary } from "../editor";

type Host<T> = Readonly<ShallowRef<T | null>>;

type Hosts = {
  readonly left: Host<HTMLDivElement>;
  readonly center: Host<HTMLDivElement>;
  readonly right: Host<HTMLDivElement>;
  readonly strips: readonly [Host<SVGSVGElement>, Host<SVGSVGElement>];
};

type MergeHandle = {
  readonly summary: Readonly<ShallowRef<MergeSummary | null>>;
  applyAllNonConflicting(side: Side): void;
  undo(): void;
  redo(): void;
  resultText(): string | null;
  loadedText(): string | null;
};

type HostElements = readonly [
  HTMLDivElement | null,
  HTMLDivElement | null,
  HTMLDivElement | null,
  SVGSVGElement | null,
  SVGSVGElement | null,
];

function createController(
  data: FileMergeData | null,
  [left, center, right, leftStrip, rightStrip]: HostElements,
): MergeController | null {
  if (
    data === null ||
    left === null ||
    center === null ||
    right === null ||
    leftStrip === null ||
    rightStrip === null
  ) {
    return null;
  }
  return new MergeController(data, { left, center, right, strips: [leftStrip, rightStrip] });
}

export function useMergeController(
  data: MaybeRefOrGetter<FileMergeData | null>,
  hosts: Hosts,
): MergeHandle {
  const summary = shallowRef<MergeSummary | null>(null);
  let controller: MergeController | null = null;
  let loaded: string | null = null;

  function destroyController(): void {
    controller?.destroy();
    controller = null;
    loaded = null;
    summary.value = null;
  }

  watch(
    [toRef(data), hosts.left, hosts.center, hosts.right, ...hosts.strips],
    ([current, ...elements]) => {
      destroyController();
      const created = createController(current, elements);
      created?.onSummaryChange((next) => {
        summary.value = next;
      });
      controller = created;
      summary.value = created?.summary() ?? null;
      loaded = created?.resultText() ?? null;
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
    loadedText: () => loaded,
  };
}
