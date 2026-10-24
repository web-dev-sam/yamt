import {
  onScopeDispose,
  shallowRef,
  toRef,
  toValue,
  watch,
  type MaybeRefOrGetter,
  type ShallowRef,
} from "vue";

import { RangeController, type Direction, type Preferences, type RangeTexts } from "../editor";
import type { RangeEntry, RangeFile } from "../ipc";
import { useRangeStore } from "./rangeStore";
import { fileSentence, modeNote } from "./rangeText";

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

export type ShownRange = Pick<RangeController, "setPreferences" | "moveToChange" | "destroy">;

export type RangeHandle = {
  readonly content: Readonly<ShallowRef<RangeContent>>;
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
  readonly content: ShallowRef<RangeContent>;
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

export function followRange<H>(parts: RangeParts<H>): RangeHandle {
  const live: Live = {
    content: shallowRef<RangeContent>({ kind: "loading" }),
    waiting: null,
    controller: null,
    disposed: false,
  };

  watch(
    [live.content, parts.hosts],
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
    content: live.content,
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
    build: (texts, shown, preferences) => new RangeController(texts, shown, { preferences }),
  });
}
