export type ListedFile = { readonly path: string };

export type TreeRow<F extends ListedFile> =
  | {
      readonly kind: "folder";
      readonly path: string;
      readonly label: string;
      readonly depth: number;
      readonly open: boolean;
    }
  | {
      readonly kind: "file";
      readonly file: F;
      readonly label: string;
      readonly depth: number;
    };

type Folder<F extends ListedFile> = {
  readonly folders: Map<string, Folder<F>>;
  readonly files: { readonly name: string; readonly file: F }[];
};

const NAME_ORDER = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

function compareNames(a: string, b: string): number {
  const natural = NAME_ORDER.compare(a, b);
  if (natural !== 0) {
    return natural;
  }
  if (a === b) {
    return 0;
  }
  return a < b ? -1 : 1;
}

function folderTree<F extends ListedFile>(files: readonly F[]): Folder<F> {
  const root: Folder<F> = { folders: new Map(), files: [] };
  for (const file of files) {
    const names = file.path.split("/");
    let folder = root;
    for (const name of names.slice(0, -1)) {
      const known = folder.folders.get(name);
      const child: Folder<F> = known ?? { folders: new Map(), files: [] };
      if (known === undefined) {
        folder.folders.set(name, child);
      }
      folder = child;
    }
    folder.files.push({ name: names.at(-1) ?? file.path, file });
  }
  return root;
}

type Place = { readonly parent: string; readonly depth: number };

function pushFolderRows<F extends ListedFile>(
  rows: TreeRow<F>[],
  [name, folder]: readonly [string, Folder<F>],
  place: Place,
  closed: ReadonlySet<string>,
): void {
  const names = [name];
  let shown = folder;
  while (shown.files.length === 0 && shown.folders.size === 1) {
    const [only] = [...shown.folders];
    if (only === undefined) {
      break;
    }
    names.push(only[0]);
    shown = only[1];
  }
  const label = names.join("/");
  const path = place.parent === "" ? label : `${place.parent}/${label}`;
  const open = !closed.has(path);
  rows.push({ kind: "folder", path, label, depth: place.depth, open });
  if (open) {
    pushRows(rows, shown, { parent: path, depth: place.depth + 1 }, closed);
  }
}

function pushRows<F extends ListedFile>(
  rows: TreeRow<F>[],
  folder: Folder<F>,
  place: Place,
  closed: ReadonlySet<string>,
): void {
  const folders = [...folder.folders].sort(([a], [b]) => compareNames(a, b));
  for (const entry of folders) {
    pushFolderRows(rows, entry, place, closed);
  }
  const files = [...folder.files].sort((a, b) => compareNames(a.name, b.name));
  for (const { name, file } of files) {
    rows.push({ kind: "file", file, label: name, depth: place.depth });
  }
}

export function treeRows<F extends ListedFile>(
  files: readonly F[],
  closed: ReadonlySet<string>,
): readonly TreeRow<F>[] {
  const rows: TreeRow<F>[] = [];
  pushRows(rows, folderTree(files), { parent: "", depth: 0 }, closed);
  return rows;
}

export function folderPaths(path: string): readonly string[] {
  const names = path.split("/").slice(0, -1);
  return names.map((_, index) => names.slice(0, index + 1).join("/"));
}

export function revealed(closed: ReadonlySet<string>, path: string): ReadonlySet<string> {
  const holding = folderPaths(path);
  if (!holding.some((folder) => closed.has(folder))) {
    return closed;
  }
  return new Set([...closed].filter((folder) => !holding.includes(folder)));
}
