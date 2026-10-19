import type { StorageLike } from "@vueuse/core";
import type { Ref } from "vue";

import type { Side } from "../ipc";
import { storedValue } from "./windowStorage";

export type PaneSplit = { readonly local: number; readonly remote: number };
export type PaneWidths = {
  readonly local: number;
  readonly center: number;
  readonly remote: number;
};
export type Gutter = "strip" | "gap";

export type PaneSplitState = {
  readonly paneSplit: Readonly<Ref<PaneSplit>>;
  setPaneSplit(split: PaneSplit): void;
  resetPaneSplit(): void;
};

const STORAGE_KEY = "yamt.panes.split";
const PANES = 3;
const HALF = 0.5;
const MIN_PANE_PX = 220;
const MIN_SHARE = 0.01;
const FR_PER_SHARE = 100;
const GUTTER_WIDTH: Readonly<Record<Gutter, string>> = { strip: "2.5rem", gap: "1px" };

export const EQUAL_SPLIT: PaneSplit = { local: 1 / PANES, remote: 1 / PANES };

export function paneColumns(split: PaneSplit, gutter: Gutter): string {
  const width = GUTTER_WIDTH[gutter];
  const least = `min(${MIN_PANE_PX}px, calc((100% - 2 * ${width}) / ${PANES}))`;
  function track(share: number): string {
    return `minmax(${least}, ${share * FR_PER_SHARE}fr)`;
  }
  const center = 1 - split.local - split.remote;
  return [track(split.local), width, track(center), width, track(split.remote)].join(" ");
}

export function dragged(widths: PaneWidths, boundary: Side, dx: number): PaneSplit {
  const total = widths.local + widths.center + widths.remote;
  const least = Math.min(MIN_PANE_PX, total / PANES);
  const moved = boundary === "local" ? widths.local : widths.remote;
  const kept = boundary === "local" ? widths.remote : widths.local;
  const pair = moved + widths.center;
  const floor = Math.min(least, pair * HALF);
  const toward = boundary === "local" ? dx : -dx;
  const width = Math.min(Math.max(moved + toward, floor), pair - floor);
  return boundary === "local"
    ? { local: width / total, remote: kept / total }
    : { local: kept / total, remote: width / total };
}

function parsed(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function readSplit(raw: string): PaneSplit {
  const value = parsed(raw);
  if (typeof value !== "object" || value === null || !("local" in value) || !("remote" in value)) {
    return EQUAL_SPLIT;
  }
  const { local, remote } = value;
  const valid =
    typeof local === "number" &&
    typeof remote === "number" &&
    local >= MIN_SHARE &&
    remote >= MIN_SHARE &&
    local + remote <= 1 - MIN_SHARE;
  return valid ? { local, remote } : EQUAL_SPLIT;
}

export function createPaneSplit(storage?: StorageLike): PaneSplitState {
  const paneSplit = storedValue<PaneSplit>(
    STORAGE_KEY,
    EQUAL_SPLIT,
    { read: readSplit, write: ({ local, remote }) => JSON.stringify({ local, remote }) },
    "panes.storage_failed",
    storage,
  );
  return {
    paneSplit,
    setPaneSplit: (split) => {
      paneSplit.value = split;
    },
    resetPaneSplit: () => {
      paneSplit.value = EQUAL_SPLIT;
    },
  };
}
