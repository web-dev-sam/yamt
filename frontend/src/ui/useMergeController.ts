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
  type Side,
} from "../editor";
import type { FileMergeData } from "../ipc";
import type { LanguageServers } from "../lsp";

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
  readonly servers: MaybeRefOrGetter<LanguageServers | null>;
};

export type MergeHandle = {
  readonly summary: Readonly<ShallowRef<MergeSummary | null>>;
  readonly problems: Readonly<ShallowRef<ProblemCounts | null>>;
  applyAllNonConflicting(side: Side): void;
  moveToChange(direction: Direction): void;
  undo(): void;
  redo(): void;
  historyKey(event: KeyboardEvent): boolean;
  resultText(): string | null;
  unsaved(): boolean;
  markSaved(text: string): void;
  format(): Promise<FormatOutcome | null>;
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

type Shown = {
  readonly summary: ShallowRef<MergeSummary | null>;
  readonly problems: ShallowRef<ProblemCounts | null>;
};

function emptyShown(): Shown {
  return {
    summary: shallowRef<MergeSummary | null>(null),
    problems: shallowRef<ProblemCounts | null>(null),
  };
}

function reloaded(
  previous: Loaded | null,
  build: () => MergeController | null,
  { summary, problems }: Shown,
): Loaded | null {
  previous?.controller.destroy();
  const controller = build();
  summary.value = controller?.summary() ?? null;
  problems.value = controller?.problems() ?? null;
  if (controller === null) {
    return null;
  }
  controller.onSummaryChange((next) => {
    summary.value = next;
  });
  controller.onProblemsChange((next) => {
    problems.value = next;
  });
  return { controller, saved: controller.resultText() };
}

function handleOf(
  { summary, problems }: Pick<MergeHandle, "summary" | "problems">,
  current: () => Loaded | null,
): MergeHandle {
  return {
    summary,
    problems,
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
    format: () => current()?.controller.format() ?? Promise.resolve(null),
  };
}

export function useMergeController(
  data: MaybeRefOrGetter<FileMergeData | null>,
  hosts: Hosts,
  { readOnly, preferences, collapsed, servers }: ControllerOptions,
): MergeHandle {
  const shown = emptyShown();
  let loaded: Loaded | null = null;

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
        servers: currentServers,
      };
      loaded = reloaded(loaded, () => createController(current, options, elements), shown);
    },
    { immediate: true, flush: "post" },
  );

  watch(toRef(preferences), (next) => {
    loaded?.controller.setPreferences(next);
  });

  watch(toRef(collapsed), (on) => {
    loaded?.controller.setCollapsed(on);
  });

  onScopeDispose(() => {
    loaded = reloaded(loaded, () => null, shown);
  });

  return handleOf(shown, () => loaded);
}
