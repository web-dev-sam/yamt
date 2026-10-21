export type Column = "backlog" | "todo" | "doing" | "done";

export const columns: Column[] = ["backlog", "todo", "doing", "done"];

export function title(column: Column): string {
  return column.charAt(0).toUpperCase() + column.slice(1);
}
