import { nextColumnVersion, type Column, type ColumnVersions } from "../../ipc";

export const SETTLE_PAUSE_MS = 300;

const COLUMNS = ["left", "right"] as const satisfies readonly Column[];

export type Timers = {
  readonly set: (run: () => void, ms: number) => number;
  readonly clear: (id: number) => void;
};

const SYSTEM_TIMERS: Timers = {
  set: (run, ms) => globalThis.setTimeout(run, ms),
  clear: (id) => globalThis.clearTimeout(id),
};

export class Settle {
  #versions: ColumnVersions;
  readonly #settled: (columns: readonly Column[]) => void;
  readonly #timers: Timers;
  readonly #edited = new Set<Column>();
  #timer: number | null = null;

  constructor(
    versions: ColumnVersions,
    settled: (columns: readonly Column[]) => void,
    timers: Timers = SYSTEM_TIMERS,
  ) {
    this.#versions = versions;
    this.#settled = settled;
    this.#timers = timers;
  }

  edited(column: Column): void {
    const { left, right } = this.#versions;
    this.#versions =
      column === "left"
        ? { left: nextColumnVersion(left), right }
        : { left, right: nextColumnVersion(right) };
    this.#edited.add(column);
    this.#cancel();
    this.#timer = this.#timers.set(() => {
      this.#timer = null;
      const columns = this.#take();
      if (columns.length > 0) {
        this.#settled(columns);
      }
    }, SETTLE_PAUSE_MS);
  }

  versions(): ColumnVersions {
    return this.#versions;
  }

  accepts(versions: ColumnVersions): boolean {
    return versions.left === this.#versions.left && versions.right === this.#versions.right;
  }

  settleNow(): readonly Column[] {
    this.#cancel();
    return this.#take();
  }

  destroy(): void {
    this.#cancel();
    this.#edited.clear();
  }

  #take(): readonly Column[] {
    const columns = COLUMNS.filter((column) => this.#edited.has(column));
    this.#edited.clear();
    return columns;
  }

  #cancel(): void {
    if (this.#timer !== null) {
      this.#timers.clear(this.#timer);
      this.#timer = null;
    }
  }
}
