import { shallowRef, watch, type ShallowRef, type WatchSource } from "vue";

export type FollowEnd = {
  /** True while the scroller's end is in view; false once the reader scrolls away; true again back at the end. */
  readonly following: Readonly<ShallowRef<boolean>>;
  /** The scroller's `@scroll` listener. */
  scrolled(): void;
};

/** While following, keeps `scroller` at its end after each change of `content` (post flush) and when the scroller
 *  element appears (an opened list starts at its end, following). Sets `scrollTop` only: never scrolls an ancestor. */
export function useFollowEnd(
  scroller: Readonly<ShallowRef<HTMLElement | null>>,
  content: WatchSource,
): FollowEnd {
  const following = shallowRef(true);

  watch(
    scroller,
    (element) => {
      if (element !== null) {
        following.value = true;
        element.scrollTop = element.scrollHeight;
      }
    },
    { flush: "post" },
  );
  watch(
    content,
    () => {
      const element = scroller.value;
      if (following.value && element !== null) {
        element.scrollTop = element.scrollHeight;
      }
    },
    { flush: "post" },
  );

  function scrolled(): void {
    const element = scroller.value;
    if (element !== null) {
      following.value = element.scrollTop + element.clientHeight >= element.scrollHeight - 1;
    }
  }

  return { following, scrolled };
}
