import { shallowRef, type ShallowRef } from "vue";

import type { SourceResult } from "../ipc";
import { landed, type Stop } from "./currentStop";
import { attempt, type Outcome } from "./problem";

type GitCall<T> = {
  readonly call: () => Promise<SourceResult<T>>;
  readonly endsApp: (value: T) => boolean;
  readonly landing: (outcome: Outcome<T>) => Promise<void>;
};

export type GitRun = {
  readonly running: Readonly<ShallowRef<boolean>>;
  run<T>(stop: Readonly<Stop>, git: GitCall<T>): Promise<void>;
};

export function createGitRun(): GitRun {
  const running = shallowRef(false);

  async function run<T>(stop: Readonly<Stop>, git: GitCall<T>): Promise<void> {
    running.value = true;
    const outcome = await landed(stop, () => attempt(git.call));
    if (outcome !== null) {
      await git.landing(outcome);
      if (outcome.ok && git.endsApp(outcome.value)) {
        return;
      }
    }
    running.value = false;
  }

  return { running, run };
}
