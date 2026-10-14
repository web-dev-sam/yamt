import { computed, shallowRef, type ComputedRef } from "vue";

import type { Question } from "./question";

export type Reply = "yes" | "no" | "dismissed";

type Waiting = { readonly question: Question; readonly reply: (reply: Reply) => void };

export type Asking = {
  readonly question: ComputedRef<Question | null>;
  readonly ask: (question: Question) => Promise<Reply>;
  readonly answer: (yes: boolean) => void;
  readonly dismiss: () => void;
};

export function createAsking(): Asking {
  const waiting = shallowRef<Waiting | null>(null);
  function end(reply: Reply): void {
    const current = waiting.value;
    waiting.value = null;
    current?.reply(reply);
  }
  return {
    question: computed(() => waiting.value?.question ?? null),
    ask: (question) => {
      if (waiting.value !== null) {
        return Promise.resolve("dismissed");
      }
      return new Promise((resolve) => {
        waiting.value = { question, reply: resolve };
      });
    },
    answer: (yes) => {
      end(yes ? "yes" : "no");
    },
    dismiss: () => {
      end("dismissed");
    },
  };
}
