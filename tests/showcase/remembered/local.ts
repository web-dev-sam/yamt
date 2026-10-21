export type Column = "backlog" | "todo" | "done";

export const columns: Column[] = ["backlog", "todo", "done"];

export function title(column: Column): string {
  return column.toUpperCase();
}
