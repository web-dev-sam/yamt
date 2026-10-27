const SEPARATOR = /[\\/]/u;
const ROOTED = /^(?:[\\/]|[A-Za-z]:)/u;
const DRIVE = /^[A-Za-z]:$/u;

function lexical(path: string): string[] {
  const kept: string[] = [];
  for (const segment of path.split(SEPARATOR)) {
    if (segment === "..") {
      kept.pop();
    } else if (segment !== "" && segment !== ".") {
      kept.push(segment);
    }
  }
  return kept;
}

/**
 * The path relative to the folder, `/`-separated, when it lies strictly inside it. `.` and `..` are
 * resolved without the disk, so symlinks are not followed; a drive-letter folder compares without case.
 */
export function relativeInside(path: string, folder: string): string | null {
  const base = lexical(folder);
  const target = lexical(ROOTED.test(path) ? path : `${folder}/${path}`);
  const foldsCase = DRIVE.test(base[0] ?? "");
  const compared = foldsCase ? target.map((segment) => segment.toLowerCase()) : target;
  const inside = base.every(
    (segment, at) => (foldsCase ? segment.toLowerCase() : segment) === compared[at],
  );
  return inside && target.length > base.length ? target.slice(base.length).join("/") : null;
}
