import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { effectScope, nextTick, shallowRef, type EffectScope, type ShallowRef } from "vue";

import { timeTitle } from "../mergeRequests";
import { useListAge } from "./useListAge";

const T0 = new Date(2026, 10, 3, 12, 0, 17, 250).getTime();
const SECOND_MS = 1_000;

let scope: EffectScope;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(T0);
  scope = effectScope();
});

afterEach(() => {
  scope.stop();
  vi.useRealTimers();
});

function listAge(listedAt: ShallowRef<number | null>): ReturnType<typeof useListAge> {
  const made = scope.run(() => useListAge(listedAt));
  if (made === undefined) {
    throw new Error("scope stopped");
  }
  return made;
}

function seconds(count: number): void {
  vi.advanceTimersByTime(count * SECOND_MS);
}

test("the age reads just now for 59 s and 1 minute ago at 60 s, 2 minutes ago at 120 s (catches a page clock lagging the load)", () => {
  const age = listAge(shallowRef<number | null>(T0));
  seconds(59);
  expect(age.value?.text).toBe("just now");
  seconds(1);
  expect(age.value?.text).toBe("1 minute ago");
  seconds(59);
  expect(age.value?.text).toBe("1 minute ago");
  seconds(1);
  expect(age.value?.text).toBe("2 minutes ago");
});

test("a list loaded 30 s before the page opened turns 1 minute ago 30 s after it (catches a clock counted from mount)", () => {
  const age = listAge(shallowRef<number | null>(T0 - 30 * SECOND_MS));
  seconds(29);
  expect(age.value?.text).toBe("just now");
  seconds(1);
  expect(age.value?.text).toBe("1 minute ago");
});

test("a new listedAt reads just now at once and counts its minute from itself", async () => {
  const listedAt = shallowRef<number | null>(T0);
  const age = listAge(listedAt);
  seconds(90);
  expect(age.value?.text).toBe("1 minute ago");
  listedAt.value = Date.now();
  await nextTick();
  expect(age.value?.text).toBe("just now");
  seconds(59);
  expect(age.value?.text).toBe("just now");
  seconds(1);
  expect(age.value?.text).toBe("1 minute ago");
});

test("no listedAt is no age and no timer; a first one starts both", async () => {
  const listedAt = shallowRef<number | null>(null);
  const age = listAge(listedAt);
  expect(age.value).toBeNull();
  expect(vi.getTimerCount()).toBe(0);
  seconds(30);
  listedAt.value = Date.now();
  await nextTick();
  expect(age.value?.text).toBe("just now");
  seconds(60);
  expect(age.value?.text).toBe("1 minute ago");
});

test("listedAt turning null stops the timer", async () => {
  const listedAt = shallowRef<number | null>(T0);
  const age = listAge(listedAt);
  listedAt.value = null;
  await nextTick();
  expect(age.value).toBeNull();
  expect(vi.getTimerCount()).toBe(0);
});

test("the hover follows the clock across midnight", () => {
  const beforeMidnight = new Date(2026, 10, 3, 23, 59, 30).getTime();
  vi.setSystemTime(beforeMidnight);
  const age = listAge(shallowRef<number | null>(beforeMidnight));
  const today = age.value?.title;
  expect(today).toBe(timeTitle(beforeMidnight, beforeMidnight));
  seconds(60);
  expect(age.value?.title).toBe(timeTitle(beforeMidnight, Date.now()));
  expect(age.value?.title).not.toBe(today);
});

test("unmount stops the timer", () => {
  listAge(shallowRef<number | null>(T0));
  expect(vi.getTimerCount()).toBe(1);
  scope.stop();
  expect(vi.getTimerCount()).toBe(0);
});
