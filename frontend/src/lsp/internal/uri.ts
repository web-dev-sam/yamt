const DRIVE = /^[A-Za-z]:$/;
const DRIVE_URI = /^file:\/\/\/([A-Za-z]):/;
const SLASHED_DRIVE = /^\/([A-Za-z]:)/;
const VERBATIM_PREFIX = "//?/";
const UNC_PREFIX = "//";

function encodeSegment(segment: string): string {
  return DRIVE.test(segment) ? segment.toUpperCase() : encodeURIComponent(segment);
}

function slashedPath(root: string, path: string): string {
  let slashed = root.replaceAll("\\", "/");
  if (slashed.startsWith(VERBATIM_PREFIX)) {
    slashed = slashed.slice(VERBATIM_PREFIX.length);
  }
  const folder = (slashed.startsWith("/") ? slashed : `/${slashed}`).replace(/\/$/, "");
  return path === "" ? folder : `${folder}/${path}`;
}

export function fileUri(root: string, path: string): string {
  const joined = slashedPath(root, path);
  const encoded = joined.split("/").map(encodeSegment).join("/");
  return joined.startsWith(UNC_PREFIX) ? `file:${encoded}` : `file://${encoded}`;
}

export function absolutePath(root: string, path: string): string {
  const joined = slashedPath(root, path).replace(SLASHED_DRIVE, "$1");
  return root.includes("\\") ? joined.replaceAll("/", "\\") : joined;
}

export function sameFile(ours: string, theirs: string): boolean {
  try {
    const decoded = decodeURIComponent(theirs).replace(
      DRIVE_URI,
      (_, drive: string) => `file:///${drive.toUpperCase()}:`,
    );
    return decoded === decodeURIComponent(ours);
  } catch {
    return false;
  }
}
