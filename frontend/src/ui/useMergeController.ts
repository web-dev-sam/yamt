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
  type FormatOutcome,
  type MergeOptions,
  type MergeSummary,
  type Preferences,
  type ProblemCounts,
  type ResultSnapshot,
  type Side,
} from "../editor";
import type { FileMergeData } from "../ipc";
import type { LanguageServers } from "../lsp";

export type {
  Direction,
  FormatOutcome,
  MergeSummary,
  Preferences,
  ProblemCounts,
  ResultSnapshot,
} from "../editor";

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
  readonly minimap: MaybeRefOrGetter<boolean>;
  readonly servers: MaybeRefOrGetter<LanguageServers | null>;
};

export type MergeHandle = {
  readonly summary: Readonly<ShallowRef<MergeSummary | null>>;
  readonly problems: Readonly<ShallowRef<ProblemCounts | null>>;
  readonly unsaved: Readonly<ShallowRef<boolean>>;
  applyAllNonConflicting(side: Side): void;
  moveToChange(direction: Direction): void;
  undo(): void;
  redo(): void;
  historyKey(event: KeyboardEvent): boolean;
  snapshot(): ResultSnapshot | null;
  format(): Promise<FormatOutcome | null>;
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

type Shown = {
  readonly summary: ShallowRef<MergeSummary | null>;
  readonly problems: ShallowRef<ProblemCounts | null>;
  readonly unsaved: ShallowRef<boolean>;
};

function emptyShown(): Shown {
  return {
    summary: shallowRef<MergeSummary | null>(null),
    problems: shallowRef<ProblemCounts | null>(null),
    unsaved: shallowRef(false),
  };
}

function reloaded(
  previous: MergeController | null,
  build: () => MergeController | null,
  { summary, problems, unsaved }: Shown,
): MergeController | null {
  previous?.destroy();
  const controller = build();
  summary.value = controller?.summary() ?? null;
  problems.value = controller?.problems() ?? null;
  unsaved.value = false;
  controller?.onSummaryChange((next) => {
    summary.value = next;
  });
  controller?.onProblemsChange((next) => {
    problems.value = next;
  });
  controller?.onUnsavedChange((next) => {
    unsaved.value = next;
  });
  return controller;
}

function handleOf(shown: Shown, current: () => MergeController | null): MergeHandle {
  return {
    ...shown,
    applyAllNonConflicting: (side) => current()?.applyAllNonConflicting(side),
    moveToChange: (direction) => current()?.moveToChange(direction),
    undo: () => current()?.undo(),
    redo: () => current()?.redo(),
    historyKey: (event) => current()?.historyKey(event) ?? false,
    snapshot: () => current()?.snapshot() ?? null,
    format: () => current()?.format() ?? Promise.resolve(null),
  };
}

function followWithoutRebuild(
  current: () => MergeController | null,
  {
    preferences,
    collapsed,
    minimap,
  }: Pick<ControllerOptions, "preferences" | "collapsed" | "minimap">,
): void {
  watch(toRef(preferences), (next) => {
    current()?.setPreferences(next);
  });
  watch(toRef(collapsed), (on) => {
    current()?.setCollapsed(on);
  });
  watch(toRef(minimap), (shown) => {
    current()?.showMinimap(shown);
  });
}

export function useMergeController(
  data: MaybeRefOrGetter<FileMergeData | null>,
  hosts: Hosts,
  { readOnly, preferences, collapsed, minimap, servers }: ControllerOptions,
): MergeHandle {
  const shown = emptyShown();
  let controller: MergeController | null = null;

  watch(
    [
      toRef(data),
      toRef(readOnly),
      () => toValue(servers),
      hosts.left,
      hosts.center,
      hosts.right,
      ...hosts.strips,
    ],
    ([current, currentReadOnly, currentServers, ...elements]) => {
      const options = {
        readOnly: currentReadOnly,
        preferences: toValue(preferences),
        collapsed: toValue(collapsed),
        minimap: toValue(minimap),
        servers: currentServers,
      };
      controller = reloaded(controller, () => createController(current, options, elements), shown);
    },
    { immediate: true, flush: "post" },
  );

  followWithoutRebuild(() => controller, { preferences, collapsed, minimap });

  onScopeDispose(() => {
    controller = reloaded(controller, () => null, shown);
  });

  return handleOf(shown, () => controller);
}
