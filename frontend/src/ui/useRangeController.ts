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
  type CompareHosts,
  type Direction,
  type Preferences,
  type RangeTexts,
} from "../editor";
import type { RangeEntry, RangeFile } from "../ipc";
import { useRangeStore } from "./rangeStore";
import { fileSentence, modeNote } from "./rangeText";

type Host<T> = Readonly<ShallowRef<T | null>>;

type RangeHostRefs = {
  readonly left: Host<HTMLDivElement>;
  readonly right: Host<HTMLDivElement>;
  readonly strip: Host<SVGSVGElement>;
};

type RangeShown =
  | { readonly kind: "loading" }
  | { readonly kind: "columns"; readonly note: string | null }
  | { readonly kind: "sentence"; readonly text: string };

export type ShownRange = Pick<RangeController, "setPreferences" | "moveToChange" | "destroy">;

export type RangeHandle = {
  readonly shown: Readonly<ShallowRef<RangeShown>>;
  moveToChange(direction: Direction): void;
};

export type RangeParts<H> = {
  readonly path: string;
  readonly load: () => Promise<RangeFile | null>;
  readonly hosts: () => H | null;
  readonly preferences: MaybeRefOrGetter<Preferences>;
  readonly build: (texts: RangeTexts, hosts: H, preferences: Preferences) => ShownRange;
};

type Live = {
  readonly shown: ShallowRef<RangeShown>;
  waiting: RangeTexts | null;
  controller: ShownRange | null;
  disposed: boolean;
};

function land(live: Live, path: string, file: RangeFile | null): void {
  if (live.disposed || file === null) {
    return;
  }
  if (file.kind !== "texts") {
    live.shown.value = { kind: "sentence", text: fileSentence(file) };
    return;
  }
  const { left, right, differences, mode } = file;
  live.waiting = { path, left, right, differences };
  live.shown.value = { kind: "columns", note: modeNote(mode) };
}

export function followRange<H>(parts: RangeParts<H>): RangeHandle {
  const live: Live = {
    shown: shallowRef<RangeShown>({ kind: "loading" }),
    waiting: null,
    controller: null,
    disposed: false,
  };

  watch(
    [live.shown, parts.hosts],
    () => {
      const hosts = parts.hosts();
      if (live.waiting === null || hosts === null) {
        return;
      }
      live.controller = parts.build(live.waiting, hosts, toValue(parts.preferences));
      live.waiting = null;
    },
    { flush: "post" },
  );
  watch(toRef(parts.preferences), (next) => {
    live.controller?.setPreferences(next);
  });
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
    shown: live.shown,
    moveToChange: (direction) => {
      live.controller?.moveToChange(direction);
    },
  };
}

function shownHosts({ left, right, strip }: RangeHostRefs): CompareHosts | null {
  return left.value === null || right.value === null || strip.value === null
    ? null
    : { left: left.value, right: right.value, strip: strip.value };
}

export function useRangeController(
  file: RangeEntry,
  hosts: RangeHostRefs,
  options: { readonly preferences: MaybeRefOrGetter<Preferences> },
): RangeHandle {
  const store = useRangeStore();
  return followRange({
    path: file.path,
    load: () => store.loadFile(file.id),
    hosts: () => shownHosts(hosts),
    preferences: options.preferences,
    build: (texts, shown, preferences) => new RangeController(texts, shown, { preferences }),
  });
}
