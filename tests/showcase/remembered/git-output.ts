<<<<<<< HEAD
export type Column = "backlog" | "todo" | "done";
||||||| base
export type Column = "todo" | "done";
=======
export type Column = "todo" | "doing" | "done";
>>>>>>> feature

<<<<<<< HEAD
export const columns: Column[] = ["backlog", "todo", "done"];
||||||| base
export const columns: Column[] = ["todo", "done"];
=======
export const columns: Column[] = ["todo", "doing", "done"];
>>>>>>> feature

export function title(column: Column): string {
  return column.charAt(0).toUpperCase() + column.slice(1);
}
