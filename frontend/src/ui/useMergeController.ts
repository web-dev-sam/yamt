import {
  onScopeDispose,
  shallowRef,
  toRef,
  toValue,
  watch,
  type MaybeRefOrGetter,
  type ShallowRef,
} from "vue";

import {
  MergeController,
  type Direction,
  type MergeOptions,
  type MergeSummary,
  type Preferences,
  type Side,
} from "../editor";
import type { FileMergeData } from "../ipc";

export type { Direction, MergeSummary, Preferences } from "../editor";

type Host<T> = Readonly<ShallowRef<T | null>>;

type Hosts = {
  readonly left: Host<HTMLDivElement>;
  readonly center: Host<HTMLDivElement>;
  readonly right: Host<HTMLDivElement>;
  readonly strips: readonly [Host<SVGSVGElement>, Host<SVGSVGElement>];
};

type ControllerOptions = {
  readonly readOnly: MaybeRefOrGetter<boolean>;
  readonly preferences: MaybeRefOrGetter<Preferences>;
  readonly collapsed: MaybeRefOrGetter<boolean>;
};

export type MergeHandle = {
  readonly summary: Readonly<ShallowRef<MergeSummary | null>>;
  applyAllNonConflicting(side: Side): void;
  moveToChange(direction: Direction): void;
  undo(): void;
  redo(): void;
  historyKey(event: KeyboardEvent): boolean;
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
  options: MergeOptions,
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
    options,
  );
}

function handleOf(summary: MergeHandle["summary"], current: () => Loaded | null): MergeHandle {
  return {
    summary,
    applyAllNonConflicting: (side) => current()?.controller.applyAllNonConflicting(side),
    moveToChange: (direction) => current()?.controller.moveToChange(direction),
    undo: () => current()?.controller.undo(),
    redo: () => current()?.controller.redo(),
    historyKey: (event) => current()?.controller.historyKey(event) ?? false,
    resultText: () => current()?.controller.resultText() ?? null,
    unsaved: () => {
      const loaded = current();
      return loaded !== null && loaded.controller.resultText() !== loaded.saved;
    },
    markSaved: (text) => {
      const loaded = current();
      if (loaded !== null) {
        loaded.saved = text;
      }
    },
  };
}

export function useMergeController(
  data: MaybeRefOrGetter<FileMergeData | null>,
  hosts: Hosts,
  { readOnly, preferences, collapsed }: ControllerOptions,
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
      const options = {
        readOnly: currentReadOnly,
        preferences: toValue(preferences),
        collapsed: toValue(collapsed),
      };
      const controller = createController(current, options, elements);
      controller?.onSummaryChange((next) => {
        summary.value = next;
      });
      summary.value = controller?.summary() ?? null;
      loaded = controller === null ? null : { controller, saved: controller.resultText() };
    },
    { immediate: true, flush: "post" },
  );

  watch(toRef(preferences), (next) => {
    loaded?.controller.setPreferences(next);
  });

  watch(toRef(collapsed), (on) => {
    loaded?.controller.setCollapsed(on);
  });

  onScopeDispose(destroyController);

  return handleOf(summary, () => loaded);
}
