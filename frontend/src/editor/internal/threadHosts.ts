import type { EditorView } from "@codemirror/view";

import type { Column } from "../../ipc";
import { COLUMNS } from "./compareViews";
import { rowHeight, type ThreadRow } from "./threadRows";
import type { RowCells } from "./threadWidget";

type ThreadViews = Readonly<Record<Column, EditorView>>;
type ColumnHosts = Readonly<Record<Column, HTMLElement>>;
type HostsWiring = {
  readonly views: ThreadViews;
  readonly columns: ColumnHosts;
  readonly hovered: (key: string | null) => void;
};

const HOST_CLASS = "cm-thread-host";
const KEY_ATTRIBUTE = "data-thread";
const LEFT_VAR = "--thread-left";
const WIDTH_VAR = "--thread-width";

function px(value: number): string {
  return `${value}px`;
}

export class ThreadHosts implements RowCells {
  readonly #views: ThreadViews;
  readonly #columns: ColumnHosts;
  readonly #hovered: (key: string | null) => void;
  readonly #hosts = new Map<string, HTMLElement>();
  readonly #measured = new Map<string, number>();
  readonly #heights = new Map<string, number>();
  readonly #cells: Readonly<Record<Column, Map<string, HTMLElement>>> = {
    left: new Map(),
    right: new Map(),
  };
  readonly #observer = new ResizeObserver((entries) => {
    this.#resized(entries);
  });
  #rows: readonly ThreadRow[] = [];
  #focused: HTMLElement | null = null;
  #focusLost = false;

  constructor({ views, columns, hovered }: HostsWiring) {
    this.#views = views;
    this.#columns = columns;
    this.#hovered = hovered;
    for (const column of COLUMNS) {
      const { scrollDOM } = views[column];
      this.#observer.observe(scrollDOM);
      const gutters = scrollDOM.querySelector(":scope > .cm-gutters");
      if (gutters !== null) {
        this.#observer.observe(gutters);
      }
    }
    document.addEventListener("focusin", this.#focusIn, true);
    document.addEventListener("pointerdown", this.#pointerDown, true);
  }

  height(row: string): number {
    return this.#heights.get(row) ?? 0;
  }

  host(key: string): HTMLElement | undefined {
    return this.#hosts.get(key);
  }

  addCell(column: Column, row: string, cell: HTMLElement): void {
    this.#cells[column].set(row, cell);
    if (this.#focused !== null && cell.contains(this.#focused)) {
      this.#focusLost = true;
    }
  }

  dropCell(column: Column, row: string, cell: HTMLElement): void {
    if (this.#cells[column].get(row) === cell) {
      this.#cells[column].delete(row);
    }
  }

  hosts(): ReadonlyMap<string, HTMLElement> {
    return new Map(this.#hosts);
  }

  show(rows: readonly ThreadRow[]): boolean {
    const keys = new Set(rows.flatMap((row) => [...row.keys.left, ...row.keys.right]));
    const rowKeys = new Set(rows.map((row) => row.key));
    let changed = false;
    for (const [key, host] of this.#hosts) {
      if (!keys.has(key)) {
        this.#drop(key, host);
        changed = true;
      }
    }
    for (const key of keys) {
      if (!this.#hosts.has(key)) {
        this.#create(key);
        changed = true;
      }
    }
    for (const row of this.#heights.keys()) {
      if (!rowKeys.has(row)) {
        this.#heights.delete(row);
      }
    }
    this.#rows = rows;
    this.#measure();
    return changed;
  }

  restoreFocus(): void {
    const focused = this.#focused;
    if (focused === null) {
      return;
    }
    if (!focused.isConnected) {
      this.#focusLost = true;
      return;
    }
    const active = document.activeElement;
    if (this.#focusLost && (active === null || active === document.body)) {
      focused.focus({ preventScroll: true });
    }
    this.#focusLost = false;
  }

  destroy(): void {
    this.#observer.disconnect();
    document.removeEventListener("focusin", this.#focusIn, true);
    document.removeEventListener("pointerdown", this.#pointerDown, true);
    for (const [key, host] of this.#hosts) {
      this.#drop(key, host);
    }
    this.#focused = null;
    for (const column of COLUMNS) {
      this.#columns[column].style.removeProperty(LEFT_VAR);
      this.#columns[column].style.removeProperty(WIDTH_VAR);
    }
  }

  readonly #focusIn = (event: FocusEvent): void => {
    const { target } = event;
    this.#focused = target instanceof HTMLElement && this.#inHost(target) ? target : null;
    this.#focusLost = false;
  };

  readonly #pointerDown = (event: PointerEvent): void => {
    const { target } = event;
    if (!(target instanceof Element && this.#inHost(target))) {
      this.#focused = null;
      this.#focusLost = false;
    }
  };

  #inHost(target: Element): boolean {
    const host = target.closest(`.${HOST_CLASS}`);
    return host !== null && this.#hosts.get(host.getAttribute(KEY_ATTRIBUTE) ?? "") === host;
  }

  readonly #enter = (event: PointerEvent): void => {
    const { currentTarget } = event;
    this.#hovered(
      currentTarget instanceof Element ? currentTarget.getAttribute(KEY_ATTRIBUTE) : null,
    );
  };

  readonly #leave = (): void => {
    this.#hovered(null);
  };

  #create(key: string): void {
    const host = document.createElement("div");
    host.className = HOST_CLASS;
    host.setAttribute(KEY_ATTRIBUTE, key);
    host.addEventListener("pointerenter", this.#enter);
    host.addEventListener("pointerleave", this.#leave);
    this.#hosts.set(key, host);
    this.#observer.observe(host);
  }

  #drop(key: string, host: HTMLElement): void {
    this.#observer.unobserve(host);
    host.removeEventListener("pointerenter", this.#enter);
    host.removeEventListener("pointerleave", this.#leave);
    host.remove();
    this.#hosts.delete(key);
    this.#measured.delete(key);
    if (this.#focused !== null && host.contains(this.#focused)) {
      this.#focused = null;
    }
  }

  #resized(entries: readonly ResizeObserverEntry[]): void {
    let columnsResized = false;
    for (const { target, borderBoxSize } of entries) {
      const key = target.getAttribute(KEY_ATTRIBUTE);
      if (key === null) {
        columnsResized = true;
      } else if (target.isConnected) {
        const [size] = borderBoxSize;
        this.#measured.set(key, size?.blockSize ?? target.getBoundingClientRect().height);
      }
    }
    if (columnsResized) {
      this.#placeColumns();
    }
    this.#measure();
  }

  #placeColumns(): void {
    for (const column of COLUMNS) {
      const { contentDOM, scrollDOM } = this.#views[column];
      const left =
        contentDOM.getBoundingClientRect().left -
        scrollDOM.getBoundingClientRect().left +
        scrollDOM.scrollLeft;
      const { style } = this.#columns[column];
      style.setProperty(LEFT_VAR, px(left));
      style.setProperty(WIDTH_VAR, px(scrollDOM.clientWidth - left));
    }
  }

  #measure(): void {
    let changed = false;
    for (const row of this.#rows) {
      const height = rowHeight(row, (key) => this.#measured.get(key) ?? 0);
      if (this.#heights.get(row.key) !== height) {
        this.#heights.set(row.key, height);
        for (const column of COLUMNS) {
          const cell = this.#cells[column].get(row.key);
          if (cell !== undefined) {
            cell.style.height = px(height);
          }
        }
        changed = true;
      }
    }
    if (changed) {
      for (const column of COLUMNS) {
        this.#views[column].requestMeasure();
      }
    }
  }
}
