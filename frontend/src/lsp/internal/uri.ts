const DRIVE = /^[A-Za-z]:$/;
const DRIVE_URI = /^file:\/\/\/([A-Za-z]):/;
const VERBATIM_PREFIX = "//?/";
const UNC_PREFIX = "//";

function encodeSegment(segment: string): string {
  return DRIVE.test(segment) ? segment.toUpperCase() : encodeURIComponent(segment);
}

export function fileUri(root: string, path: string): string {
  let slashed = root.replaceAll("\\", "/");
  if (slashed.startsWith(VERBATIM_PREFIX)) {
    slashed = slashed.slice(VERBATIM_PREFIX.length);
  }
  const folder = (slashed.startsWith("/") ? slashed : `/${slashed}`).replace(/\/$/, "");
  const joined = path === "" ? folder : `${folder}/${path}`;
  const encoded = joined.split("/").map(encodeSegment).join("/");
  return joined.startsWith(UNC_PREFIX) ? `file:${encoded}` : `file://${encoded}`;
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
