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

export type MergeHandle = {
  readonly summary: Readonly<ShallowRef<MergeSummary | null>>;
  applyAllNonConflicting(side: Side): void;
  undo(): void;
  redo(): void;
  resultText(): string | null;
  unsaved(): boolean;
  markSaved(text: string): void;
};

type Loaded = { readonly controller: MergeController; saved: string };

type HostElements = readonly [
  HTMLDivElement | null,
  HTMLDivElement | null,
  HTMLDivElement | null,
  SVGSVGElement | null,
  SVGSVGElement | null,
];

function createController(
  data: FileMergeData | null,
  readOnly: boolean,
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
  return new MergeController(
    data,
    { left, center, right, strips: [leftStrip, rightStrip] },
    { readOnly },
  );
}

export function useMergeController(
  data: MaybeRefOrGetter<FileMergeData | null>,
  hosts: Hosts,
  readOnly: MaybeRefOrGetter<boolean>,
): MergeHandle {
  const summary = shallowRef<MergeSummary | null>(null);
  let loaded: Loaded | null = null;

  function destroyController(): void {
    loaded?.controller.destroy();
    loaded = null;
    summary.value = null;
  }

  watch(
    [toRef(data), toRef(readOnly), hosts.left, hosts.center, hosts.right, ...hosts.strips],
    ([current, currentReadOnly, ...elements]) => {
      destroyController();
      const controller = createController(current, currentReadOnly, elements);
      controller?.onSummaryChange((next) => {
        summary.value = next;
      });
      summary.value = controller?.summary() ?? null;
      loaded = controller === null ? null : { controller, saved: controller.resultText() };
    },
    { immediate: true, flush: "post" },
  );

  onScopeDispose(destroyController);

  return {
    summary,
    applyAllNonConflicting: (side) => loaded?.controller.applyAllNonConflicting(side),
    undo: () => loaded?.controller.undo(),
    redo: () => loaded?.controller.redo(),
    resultText: () => loaded?.controller.resultText() ?? null,
    unsaved: () => loaded !== null && loaded.controller.resultText() !== loaded.saved,
    markSaved: (text) => {
      if (loaded !== null) {
        loaded.saved = text;
      }
    },
  };
}
