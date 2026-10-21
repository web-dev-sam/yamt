export type Column = "todo" | "done";

export const columns: Column[] = ["todo", "done"];

export function title(column: Column): string {
  return column.toUpperCase();
}
