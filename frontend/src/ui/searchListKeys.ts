import type { ListRow } from "../search";

export type ListStep =
  | { readonly kind: "activate"; readonly index: number }
  | { readonly kind: "toggle"; readonly path: string }
  | { readonly kind: "press"; readonly index: number }
  | { readonly kind: "ignore" };

const IGNORE: ListStep = { kind: "ignore" };

function activate(rows: readonly ListRow<string>[], index: number): ListStep {
  const clamped = Math.min(Math.max(index, 0), rows.length - 1);
  return clamped === -1 ? IGNORE : { kind: "activate", index: clamped };
}

function groupIndex(rows: readonly ListRow<string>[], path: string): number {
  return rows.findIndex((row) => row.path === path);
}

function sideways(
  rows: readonly ListRow<string>[],
  row: ListRow<string>,
  opening: boolean,
): ListStep {
  if (row.kind === "place") {
    return opening ? IGNORE : activate(rows, groupIndex(rows, row.path));
  }
  if (row.open !== opening) {
    return { kind: "toggle", path: row.path };
  }
  return opening ? activate(rows, groupIndex(rows, row.path) + 1) : IGNORE;
}

export function stepSearchList(
  rows: readonly ListRow<string>[],
  active: number | null,
  key: string,
): ListStep {
  const index = active ?? -1;
  const row = rows[index];
  switch (key) {
    case "ArrowDown":
      return activate(rows, index + 1);
    case "ArrowUp":
      return activate(rows, index - 1);
    case "ArrowLeft":
    case "ArrowRight":
      return row === undefined ? IGNORE : sideways(rows, row, key === "ArrowRight");
    case "Enter":
      return row === undefined ? IGNORE : { kind: "press", index };
    default:
      return IGNORE;
  }
}
