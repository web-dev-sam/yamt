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
  type RangeOptions,
  type RangeTexts,
  type ShownThread,
} from "../editor";
import type { RangeEntry, RangeFile } from "../ipc";
import { useRangeStore } from "./rangeStore";
import { fileSentence, modeNote } from "./rangeText";
import type { RangeThreads } from "./rangeThreads";

type Host<T> = Readonly<ShallowRef<T | null>>;

type HostRefs<D, S> = {
  readonly left: Host<D>;
  readonly right: Host<D>;
  readonly strip: Host<S>;
};

type RangeContent =
  | { readonly kind: "loading" }
  | { readonly kind: "columns"; readonly note: string | null }
  | { readonly kind: "sentence"; readonly text: string };

export type ShownRange = Pick<
  RangeController,
  "setPreferences" | "setCollapsed" | "moveToChange" | "showThreads" | "destroy"
>;

type ThreadHosts = ReadonlyMap<string, HTMLElement>;

export type RangeHandle = {
  readonly content: Readonly<ShallowRef<RangeContent>>;
  readonly threadHosts: Readonly<ShallowRef<ThreadHosts>>;
  moveToChange(direction: Direction): void;
};

export type RangeParts<H> = {
  readonly path: string;
  readonly load: () => Promise<RangeFile | null>;
  readonly hosts: () => H | null;
  readonly preferences: MaybeRefOrGetter<Preferences>;
  readonly collapsed: MaybeRefOrGetter<boolean>;
  readonly threads: () => readonly ShownThread[];
  readonly listed: () => boolean;
  readonly events: Pick<RangeEvents, "startThread" | "toggleThreads">;
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
  waiting: RangeTexts | null;
  controller: ShownRange | null;
  disposed: boolean;
};

function land(live: Live, path: string, file: RangeFile | null): void {
  if (live.disposed || file === null) {
    return;
  }
  if (file.kind !== "texts") {
    live.content.value = { kind: "sentence", text: fileSentence(file) };
    return;
  }
  const { left, right, differences, mode } = file;
  live.waiting = { path, left, right, differences };
  live.content.value = { kind: "columns", note: modeNote(mode) };
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
  };
  live.controller = parts.build(live.waiting, hosts, options, events);
  live.waiting = null;
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

export function followRange<H>(parts: RangeParts<H>): RangeHandle {
  const live: Live = {
    content: shallowRef<RangeContent>({ kind: "loading" }),
    threadHosts: shallowRef<ThreadHosts>(new Map()),
    waiting: null,
    controller: null,
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
  void parts.load().then((file) => {
    land(live, parts.path, file);
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
    moveToChange: (direction) => {
      live.controller?.moveToChange(direction);
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
      startThread: (line) => {
        threads.startThread(file.id, line);
      },
      toggleThreads: (keys) => {
        threads.toggle(keys);
      },
    },
  };
}

export function useRangeController(
  file: RangeEntry,
  hosts: HostRefs<HTMLDivElement, SVGSVGElement>,
  options: { readonly preferences: MaybeRefOrGetter<Preferences> },
): RangeHandle {
  const store = useRangeStore();
  return followRange({
    path: file.path,
    load: () => store.loadFile(file),
    hosts: () => shownHosts(hosts),
    preferences: options.preferences,
    collapsed: store.collapsing,
    ...rangeThreadParts(store.threads, file),
    build: (texts, shown, chosen, events) => new RangeController(texts, shown, chosen, events),
  });
}
