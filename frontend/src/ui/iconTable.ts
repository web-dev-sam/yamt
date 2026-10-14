export type IconTable<T> = Readonly<Record<string, T>>;
export type IconRow<T> = readonly [icon: T, names: string];

export function iconTable<T>(rows: readonly IconRow<T>[]): IconTable<T> {
  return Object.fromEntries(
    rows.flatMap(([icon, names]) => names.split(" ").map((name) => [name, icon])),
  );
}

export function nameKey(path: string): string {
  return path.slice(path.lastIndexOf("/") + 1).toLowerCase();
}

export function lookup<T>(table: IconTable<T>, key: string): T | undefined {
  return Object.hasOwn(table, key) ? table[key] : undefined;
}
