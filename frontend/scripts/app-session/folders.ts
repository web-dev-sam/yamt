import { basename, dirname, isAbsolute, relative, sep } from "node:path";

export const TEMP_PREFIX = "yamt-app-session-";

function isInside(path: string, folder: string): boolean {
  const rel = relative(folder, path);
  return rel === "" || (rel !== ".." && !rel.startsWith(`..${sep}`) && !isAbsolute(rel));
}

export function isOwnTempFolder(folder: string, tmpRoot: string): boolean {
  return dirname(folder) === tmpRoot && basename(folder).startsWith(TEMP_PREFIX);
}

export function ownerConfigClash(
  configDir: string,
  ownerFolders: readonly string[],
): string | null {
  const clash = ownerFolders.find((folder) => isInside(configDir, folder));
  return clash === undefined
    ? null
    : `refusing to start: config folder ${configDir} is inside the owner's ${clash}`;
}
