import { nextTick } from "vue";

export async function returnFocus(before: Element | null): Promise<void> {
  await nextTick();
  if (
    before instanceof HTMLElement &&
    before.isConnected &&
    getComputedStyle(before).visibility === "visible"
  ) {
    before.focus();
  }
}
