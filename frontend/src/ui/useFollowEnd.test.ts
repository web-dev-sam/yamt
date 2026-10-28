import { expect, test } from "vitest";
import { effectScope, nextTick, shallowRef, watch, type ShallowRef } from "vue";

import { useFollowEnd, type FollowEnd } from "./useFollowEnd";

type Box = { scrollTop: number; readonly clientHeight: number; scrollHeight: number };

function box(scrollHeight: number, scrollTop: number): Box {
  let top = scrollTop;
  return {
    clientHeight: 100,
    scrollHeight,
    get scrollTop() {
      return top;
    },
    set scrollTop(value: number) {
      top = Math.max(0, Math.min(value, this.scrollHeight - this.clientHeight));
    },
  };
}

function element(fake: Box): HTMLElement {
  return Object.setPrototypeOf(fake, Object.prototype);
}

function follow(scroller: ShallowRef<HTMLElement | null>, content: ShallowRef<number>): FollowEnd {
  const scope = effectScope();
  const follows = scope.run(() => useFollowEnd(scroller, content));
  if (follows === undefined) {
    throw new Error("scope did not run");
  }
  return follows;
}

test("at the end, a content change scrolls to the new end once the change is laid out", async () => {
  const fake = box(300, 200);
  const content = shallowRef(0);
  const { following } = follow(shallowRef(element(fake)), content);
  watch(content, () => {
    fake.scrollHeight = 700;
  });

  fake.scrollHeight = 500;
  content.value = 1;
  await nextTick();

  expect(fake.scrollTop).toBe(600);
  expect(following.value).toBe(true);
});

test("within 1 px of the end still follows; scrolled further away, a change leaves scrollTop alone", async () => {
  const fake = box(500, 399);
  const content = shallowRef(0);
  const follows = follow(shallowRef(element(fake)), content);
  const { following } = follows;

  follows.scrolled();
  expect(following.value).toBe(true);

  fake.scrollTop = 398;
  follows.scrolled();
  expect(following.value).toBe(false);

  fake.scrollHeight = 800;
  content.value = 1;
  await nextTick();

  expect(fake.scrollTop).toBe(398);
  expect(following.value).toBe(false);
});

test("scrolled back to the end, it follows again", async () => {
  const fake = box(500, 100);
  const content = shallowRef(0);
  const follows = follow(shallowRef(element(fake)), content);
  const { following } = follows;
  follows.scrolled();
  expect(following.value).toBe(false);

  fake.scrollTop = 400;
  follows.scrolled();
  fake.scrollHeight = 800;
  content.value = 1;
  await nextTick();

  expect(following.value).toBe(true);
  expect(fake.scrollTop).toBe(700);
});

test("a scroller that appears starts at its end and follows, even after the reader left the last one", async () => {
  const first = box(500, 0);
  const scroller = shallowRef<HTMLElement | null>(element(first));
  const content = shallowRef(0);
  const follows = follow(scroller, content);
  const { following } = follows;
  follows.scrolled();
  expect(following.value).toBe(false);

  const second = box(300, 0);
  watch(scroller, () => {
    second.scrollHeight = 900;
  });
  scroller.value = element(second);
  await nextTick();

  expect(second.scrollTop).toBe(800);
  expect(following.value).toBe(true);
});

test("no scroller: changes, a scroller leaving and scroll events do nothing and throw nothing", async () => {
  const fake = box(500, 400);
  const scroller = shallowRef<HTMLElement | null>(element(fake));
  const content = shallowRef(0);
  const follows = follow(scroller, content);
  const { following } = follows;

  scroller.value = null;
  await nextTick();
  content.value = 1;
  await nextTick();
  follows.scrolled();

  expect(following.value).toBe(true);
  expect(fake.scrollTop).toBe(400);
});
