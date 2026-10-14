export const FOLD_RUN_ATTRIBUTE = "data-fold-run";
export const HOVER_CLASS = "fold-wave-hover";

export function foldRunAt(target: EventTarget | null): number | null {
  const wave = target instanceof Element ? target.closest(`[${FOLD_RUN_ATTRIBUTE}]`) : null;
  const run = wave?.getAttribute(FOLD_RUN_ATTRIBUTE);
  return run === undefined || run === null ? null : Number(run);
}

function primaryRun(event: Event): number | null {
  return event instanceof MouseEvent && event.button === 0 ? foldRunAt(event.target) : null;
}

export class Folding {
  readonly #hosts: readonly Element[];
  readonly #listeners = new AbortController();
  #hovered: number | null = null;

  constructor(hosts: readonly Element[], show: (run: number) => void) {
    this.#hosts = hosts;
    const handlers: Readonly<Record<string, (event: Event) => void>> = {
      pointerover: (event) => {
        this.#hover(foldRunAt(event.target));
      },
      pointerleave: () => {
        this.#hover(null);
      },
      mousedown: (event) => {
        if (primaryRun(event) !== null) {
          event.preventDefault();
        }
      },
      click: (event) => {
        const run = primaryRun(event);
        if (run !== null) {
          show(run);
          this.#hover(null);
        }
      },
    };
    const signal = this.#listeners.signal;
    for (const host of hosts) {
      for (const [type, handler] of Object.entries(handlers)) {
        host.addEventListener(type, handler, { signal });
      }
    }
  }

  hovered(): number | null {
    return this.#hovered;
  }

  destroy(): void {
    this.#listeners.abort();
  }

  #hover(run: number | null): void {
    if (run === this.#hovered) {
      return;
    }
    this.#mark(this.#hovered, false);
    this.#hovered = run;
    this.#mark(run, true);
  }

  #mark(run: number | null, hovered: boolean): void {
    if (run === null) {
      return;
    }
    for (const host of this.#hosts) {
      for (const wave of host.querySelectorAll(`[${FOLD_RUN_ATTRIBUTE}="${run}"]`)) {
        wave.classList.toggle(HOVER_CLASS, hovered);
      }
    }
  }
}
