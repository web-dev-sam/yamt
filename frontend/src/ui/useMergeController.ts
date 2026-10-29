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
  type MergeGoTo,
  type MergeOptions,
  type MergeSummary,
  type Preferences,
  type ProblemCounts,
  type ResultLineUp,
  type ResultSnapshot,
  type Side,
} from "../editor";
import type { FileMergeData } from "../ipc";
import type { LanguageServers } from "../lsp";

export type {
  Direction,
  FormatOutcome,
  MergeGoTo,
  MergePane,
  MergeSummary,
  PaneMatch,
  Preferences,
  ProblemCounts,
  ResultLineUp,
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
  readonly resultVersion: Readonly<ShallowRef<number>>;
  applyAllNonConflicting(side: Side): void;
  moveToChange(direction: Direction): void;
  undo(): void;
  redo(): void;
  historyKey(event: KeyboardEvent): boolean;
  snapshot(): ResultSnapshot | null;
  format(): Promise<FormatOutcome | null>;
  lineUp(): ResultLineUp | null;
  goTo(target: MergeGoTo): void;
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
  readonly resultVersion: ShallowRef<number>;
};

type Live = {
  controller: MergeController | null;
  goTo: MergeGoTo | null;
};

function emptyShown(): Shown {
  return {
    summary: shallowRef<MergeSummary | null>(null),
    problems: shallowRef<ProblemCounts | null>(null),
    unsaved: shallowRef(false),
    resultVersion: shallowRef(0),
  };
}

function reloaded(
  previous: MergeController | null,
  build: () => MergeController | null,
  { summary, problems, unsaved, resultVersion }: Shown,
): MergeController | null {
  previous?.destroy();
  const controller = build();
  summary.value = controller?.summary() ?? null;
  problems.value = controller?.problems() ?? null;
  unsaved.value = false;
  if (controller !== null) {
    resultVersion.value += 1;
  }
  controller?.onSummaryChange((next) => {
    summary.value = next;
  });
  controller?.onProblemsChange((next) => {
    problems.value = next;
  });
  controller?.onUnsavedChange((next) => {
    unsaved.value = next;
  });
  controller?.onResultChange(() => {
    resultVersion.value += 1;
  });
  return controller;
}

function rebuild(live: Live, build: () => MergeController | null, shown: Shown): void {
  live.controller = reloaded(live.controller, build, shown);
  if (live.controller !== null && live.goTo !== null) {
    live.controller.goTo(live.goTo);
    live.goTo = null;
  }
}

function askGoTo(live: Live, target: MergeGoTo): void {
  if (live.controller === null) {
    live.goTo = target;
  } else {
    live.controller.goTo(target);
  }
}

function handleOf(shown: Shown, live: Live): MergeHandle {
  return {
    ...shown,
    applyAllNonConflicting: (side) => live.controller?.applyAllNonConflicting(side),
    moveToChange: (direction) => live.controller?.moveToChange(direction),
    undo: () => live.controller?.undo(),
    redo: () => live.controller?.redo(),
    historyKey: (event) => live.controller?.historyKey(event) ?? false,
    snapshot: () => live.controller?.snapshot() ?? null,
    format: () => live.controller?.format() ?? Promise.resolve(null),
    lineUp: () => live.controller?.lineUp() ?? null,
    goTo: (target) => {
      askGoTo(live, target);
    },
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
  const live: Live = { controller: null, goTo: null };

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
      rebuild(live, () => createController(current, options, elements), shown);
    },
    { immediate: true, flush: "post" },
  );

  followWithoutRebuild(() => live.controller, { preferences, collapsed, minimap });

  onScopeDispose(() => {
    rebuild(live, () => null, shown);
  });

  return handleOf(shown, live);
}
