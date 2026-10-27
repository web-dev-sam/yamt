import { WidgetType } from "@codemirror/view";

import type { Column } from "../../ipc";
import type { ThreadRow } from "./threadRows";

export type RowCells = {
  readonly height: (row: string) => number;
  readonly host: (key: string) => HTMLElement | undefined;
  readonly addCell: (column: Column, row: string, cell: HTMLElement) => void;
  readonly dropCell: (column: Column, row: string, cell: HTMLElement) => void;
};

const THREAD_ROW_CLASS = "cm-thread-row";

export class ThreadRowWidget extends WidgetType {
  readonly row: ThreadRow;
  readonly column: Column;
  readonly #cells: RowCells;

  constructor(row: ThreadRow, column: Column, cells: RowCells) {
    super();
    this.row = row;
    this.column = column;
    this.#cells = cells;
  }

  override eq(other: ThreadRowWidget): boolean {
    const keys = this.row.keys[this.column];
    const others = other.row.keys[other.column];
    return (
      other.row.key === this.row.key &&
      other.column === this.column &&
      others.length === keys.length &&
      others.every((key, index) => key === keys[index])
    );
  }

  toDOM(): HTMLElement {
    const cell = document.createElement("div");
    cell.className = THREAD_ROW_CLASS;
    cell.style.height = `${this.#cells.height(this.row.key)}px`;
    for (const key of this.row.keys[this.column]) {
      const host = this.#cells.host(key);
      if (host !== undefined) {
        cell.append(host);
      }
    }
    this.#cells.addCell(this.column, this.row.key, cell);
    return cell;
  }

  override get estimatedHeight(): number {
    return this.#cells.height(this.row.key);
  }

  override destroy(dom: HTMLElement): void {
    this.#cells.dropCell(this.column, this.row.key, dom);
  }
}
