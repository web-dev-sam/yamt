export type Timers = {
  readonly now: () => number;
  readonly setTimeout: (run: () => void, ms: number) => number;
  readonly clearTimeout: (id: number | undefined) => void;
};

export const SYSTEM_TIMERS: Timers = {
  now: () => Date.now(),
  setTimeout: (run, ms) => globalThis.setTimeout(run, ms),
  clearTimeout: (id) => globalThis.clearTimeout(id),
};
