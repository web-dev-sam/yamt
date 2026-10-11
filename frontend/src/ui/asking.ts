import { computed, shallowRef, type ComputedRef } from "vue";

import type { Question } from "./question";

type Waiting = { readonly question: Question; readonly answer: (yes: boolean) => void };

export type Asking = {
  readonly question: ComputedRef<Question | null>;
  readonly ask: (question: Question) => Promise<boolean>;
  readonly answer: (yes: boolean) => void;
};

export function createAsking(): Asking {
  const waiting = shallowRef<Waiting | null>(null);
  return {
    question: computed(() => waiting.value?.question ?? null),
    ask: (question) => {
      if (waiting.value !== null) {
        return Promise.resolve(false);
      }
      return new Promise((resolve) => {
        waiting.value = { question, answer: resolve };
      });
    },
    answer: (yes) => {
      const current = waiting.value;
      waiting.value = null;
      current?.answer(yes);
    },
  };
}
