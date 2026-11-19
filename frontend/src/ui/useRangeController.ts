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
  RangeController,
  type Direction,
  type Preferences,
  type RangeEvents,
  type RangeGoTo,
  type RangeOptions,
  type RangeTexts,
  type ShownThread,
} from "../editor";
import type { Difference, RangeEntry, RangeFile, ReviewMark, SinceReview } from "../ipc";
import { useRangeStore, type RangeStore } from "./rangeStore";
import { fileSentence, modeNote, SINCE_NO_TEXT } from "./rangeText";
import type { RangeThreads } from "./rangeThreads";

type Host<T> = Readonly<ShallowRef<T | null>>;

type HostRefs<D, S> = {
  readonly left: Host<D>;
  readonly right: Host<D>;
  readonly strip: Host<S>;
};

export type RangeViewKind = "whole" | "sinceReview";

export type RangeShown =
  | {
      readonly kind: "texts";
      readonly left: string;
      readonly right: string;
      readonly differences: readonly Difference[];
      readonly note: string | null;
    }
  | { readonly kind: "sentence"; readonly text: string };

type RangeContent =
  | { readonly kind: "loading" }
  | { readonly kind: "columns"; readonly note: string | null }
  | { readonly kind: "sentence"; readonly text: string };

export type ShownRange = Pick<
  RangeController,
  "setPreferences" | "setCollapsed" | "moveToChange" | "goTo" | "showThreads" | "destroy"
>;

type ThreadHosts = ReadonlyMap<string, HTMLElement>;

export type RangeHandle = {
  readonly content: Readonly<ShallowRef<RangeContent>>;
  readonly threadHosts: Readonly<ShallowRef<ThreadHosts>>;
  readonly sentenceFocusAsks: Readonly<ShallowRef<number>>;
  moveToChange(direction: Direction): void;
  goTo(target: RangeGoTo): void;
};

export type RangeParts<H> = {
  readonly path: string;
  readonly load: () => Promise<RangeShown | null>;
  readonly hosts: () => H | null;
  readonly preferences: MaybeRefOrGetter<Preferences>;
  readonly collapsed: MaybeRefOrGetter<boolean>;
  readonly threads: () => readonly ShownThread[];
  readonly listed: () => boolean;
  readonly events: Pick<RangeEvents, "startThread" | "toggleThreads">;
  readonly startsThreads: boolean;
  readonly build: (
    texts: RangeTexts,
    hosts: H,
    options: RangeOptions,
    events: RangeEvents,
  ) => ShownRange;
};

type Live = {
  readonly content: ShallowRef<RangeContent>;
  readonly threadHosts: ShallowRef<ThreadHosts>;
  readonly sentenceFocusAsks: ShallowRef<number>;
  waiting: RangeTexts | null;
  controller: ShownRange | null;
  goTo: RangeGoTo | null;
  disposed: boolean;
};

export function viewKind(mark: ReviewMark | undefined): RangeViewKind {
  return mark === "changedSinceReview" ? "sinceReview" : "whole";
}

export function takesSearchMove(view: RangeViewKind, pane: RangeGoTo["pane"]): boolean {
  return view === "whole" || pane === "right";
}

export function wholeShown(file: RangeFile): RangeShown {
  if (file.kind !== "texts") {
    return { kind: "sentence", text: fileSentence(file) };
  }
  const { left, right, differences, mode } = file;
  return { kind: "texts", left, right, differences, note: modeNote(mode) };
}

export function sinceShown(since: SinceReview): RangeShown {
  if (since.kind !== "texts") {
    return { kind: "sentence", text: SINCE_NO_TEXT };
  }
  const { reviewed, current, differences } = since;
  return { kind: "texts", left: reviewed, right: current, differences, note: null };
}

function land(live: Live, path: string, shown: RangeShown | null): void {
  if (live.disposed || shown === null) {
    return;
  }
  if (shown.kind === "sentence") {
    live.content.value = shown;
    if (live.goTo !== null) {
      live.goTo = null;
      live.sentenceFocusAsks.value += 1;
    }
    return;
  }
  const { left, right, differences, note } = shown;
  live.waiting = { path, left, right, differences };
  live.content.value = { kind: "columns", note };
}

function build<H>(live: Live, parts: RangeParts<H>): void {
  const hosts = parts.hosts();
  if (live.waiting === null || hosts === null || !parts.listed()) {
    return;
  }
  const events: RangeEvents = {
    ...parts.events,
    hosts: (next) => {
      live.threadHosts.value = next;
    },
  };
  const options: RangeOptions = {
    preferences: toValue(parts.preferences),
    collapsed: toValue(parts.collapsed),
    threads: parts.threads(),
    startsThreads: parts.startsThreads,
  };
  live.controller = parts.build(live.waiting, hosts, options, events);
  live.waiting = null;
  if (live.goTo !== null) {
    live.controller.goTo(live.goTo);
    live.goTo = null;
  }
}

function followLive<H>(live: Live, parts: RangeParts<H>): void {
  watch(toRef(parts.preferences), (next) => {
    live.controller?.setPreferences(next);
  });
  watch(toRef(parts.collapsed), (on) => {
    live.controller?.setCollapsed(on);
  });
  watch(parts.threads, (next) => {
    live.controller?.showThreads(next);
  });
}

function askGoTo(live: Live, target: RangeGoTo): void {
  if (live.content.value.kind === "sentence") {
    live.sentenceFocusAsks.value += 1;
  } else if (live.controller === null) {
    live.goTo = target;
  } else {
    live.controller.goTo(target);
  }
}

export function followRange<H>(parts: RangeParts<H>): RangeHandle {
  const live: Live = {
    content: shallowRef<RangeContent>({ kind: "loading" }),
    threadHosts: shallowRef<ThreadHosts>(new Map()),
    sentenceFocusAsks: shallowRef(0),
    waiting: null,
    controller: null,
    goTo: null,
    disposed: false,
  };

  watch(
    [live.content, parts.hosts, parts.listed],
    () => {
      build(live, parts);
    },
    { flush: "post" },
  );
  followLive(live, parts);
  void parts.load().then((shown) => {
    land(live, parts.path, shown);
  });

  onScopeDispose(() => {
    live.disposed = true;
    live.waiting = null;
    live.controller?.destroy();
    live.controller = null;
  });

  return {
    content: live.content,
    threadHosts: live.threadHosts,
    sentenceFocusAsks: live.sentenceFocusAsks,
    moveToChange: (direction) => {
      live.controller?.moveToChange(direction);
    },
    goTo: (target) => {
      askGoTo(live, target);
    },
  };
}

export function shownHosts<D, S>({
  left,
  right,
  strip,
}: HostRefs<D, S>): { readonly left: D; readonly right: D; readonly strip: S } | null {
  return left.value === null || right.value === null || strip.value === null
    ? null
    : { left: left.value, right: right.value, strip: strip.value };
}

export function rangeThreadParts(
  threads: RangeThreads,
  file: Pick<RangeEntry, "id">,
): Pick<RangeParts<unknown>, "threads" | "listed" | "events"> {
  return {
    threads: () => threads.shownFor(file.id),
    listed: () => threads.listed.value,
    events: {
      startThread: (place) => {
        threads.startThread(file.id, place);
      },
      toggleThreads: (keys) => {
        threads.toggle(keys);
      },
    },
  };
}

export function viewParts(
  store: Pick<RangeStore, "loadFile" | "threads" | "reviewed">,
  file: RangeEntry,
  view: RangeViewKind,
): Pick<RangeParts<unknown>, "load" | "threads" | "listed" | "events" | "startsThreads"> {
  const threadParts = rangeThreadParts(store.threads, file);
  switch (view) {
    case "whole":
      return {
        ...threadParts,
        load: async () => {
          const loaded = await store.loadFile(file);
          return loaded === null ? null : wholeShown(loaded);
        },
        startsThreads: true,
      };
    case "sinceReview":
      return {
        events: threadParts.events,
        threads: () => [],
        listed: () => true,
        load: async () => {
          const since = await store.reviewed.loadSince(file);
          return since === null ? null : sinceShown(since);
        },
        startsThreads: false,
      };
  }
}

export function useRangeController(
  file: RangeEntry,
  hosts: HostRefs<HTMLDivElement, SVGSVGElement>,
  options: { readonly preferences: MaybeRefOrGetter<Preferences>; readonly view: RangeViewKind },
): RangeHandle {
  const store = useRangeStore();
  return followRange({
    path: file.path,
    hosts: () => shownHosts(hosts),
    preferences: options.preferences,
    collapsed: store.collapsing,
    ...viewParts(store, file, options.view),
    build: (texts, shown, chosen, events) => new RangeController(texts, shown, chosen, events),
  });
}
