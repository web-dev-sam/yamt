import type { StorageLike } from "@vueuse/core";
import { computed, type ComputedRef, type Ref } from "vue";

import { isMergeRequestIid, type MergeRequestIid } from "../ipc";
import { byDueDate, calendarDayFrom, calendarDayText, type CalendarDay } from "../mergeRequests";
import { storedRecord, type StoredRecord } from "./windowStorage";

const STORAGE_KEY = "yamt.mergeRequests.dueDates";
const DECIMAL = /^\d+$/u;

type Dates = ReadonlyMap<MergeRequestIid, CalendarDay>;

type Dated = { readonly iid: MergeRequestIid; readonly createdAt: number };

export type DueDates = {
  readonly dates: ComputedRef<Dates>;
  set(iid: MergeRequestIid, day: CalendarDay | null): void;
  keepOnly(iids: ReadonlySet<MergeRequestIid>): void;
  readonly dueOf: (iid: number) => CalendarDay | null;
  datedFirst<R extends Dated>(rows: readonly R[]): readonly R[];
};

function datesFrom(stored: unknown): Dates {
  const dates = new Map<MergeRequestIid, CalendarDay>();
  if (typeof stored !== "object" || stored === null) {
    return dates;
  }
  for (const [key, text] of Object.entries(stored)) {
    const iid = Number(key);
    const day = typeof text === "string" ? calendarDayFrom(text) : null;
    if (DECIMAL.test(key) && isMergeRequestIid(iid) && day !== null) {
      dates.set(iid, day);
    }
  }
  return dates;
}

function write(byRepository: StoredRecord, at: string | null, next: Dates): void {
  if (at === null) {
    return;
  }
  if (next.size === 0) {
    byRepository.remove(at);
    return;
  }
  const entry = [...next].map(([iid, day]) => [String(iid), calendarDayText(day)]);
  byRepository.set(at, Object.fromEntries(entry));
}

export function createDueDates(
  repository: Readonly<Ref<string | null>>,
  storage?: StorageLike,
): DueDates {
  const byRepository = storedRecord(STORAGE_KEY, "mergeRequests.due_dates_storage_failed", storage);
  const dates = computed((): Dates => {
    const at = repository.value;
    return at === null ? new Map() : datesFrom(byRepository.entryAt(at));
  });
  function dueOf(iid: number): CalendarDay | null {
    const due: ReadonlyMap<number, CalendarDay> = dates.value;
    return due.get(iid) ?? null;
  }
  return {
    dates,
    set: (iid, day) => {
      const next = new Map(dates.value);
      if (day === null) {
        next.delete(iid);
      } else {
        next.set(iid, day);
      }
      write(byRepository, repository.value, next);
    },
    keepOnly: (iids) => {
      const kept = [...dates.value].filter(([iid]) => iids.has(iid));
      if (kept.length !== dates.value.size) {
        write(byRepository, repository.value, new Map(kept));
      }
    },
    dueOf,
    datedFirst: (rows) => byDueDate(rows, dueOf),
  };
}
