import type { FileSides, Side, SideContent } from "../ipc";

const BYTES_PER_KB = 1024;
const SHORT_COMMIT_LENGTH = 7;

function oneDecimal(value: number): string {
  const rounded = value.toFixed(1);
  return rounded.endsWith(".0") ? rounded.slice(0, -".0".length) : rounded;
}

function sizeText(bytes: number): string {
  if (bytes < BYTES_PER_KB) {
    return `${bytes} B`;
  }
  const kb = oneDecimal(bytes / BYTES_PER_KB);
  if (Number(kb) < BYTES_PER_KB) {
    return `${kb} KB`;
  }
  return `${oneDecimal(bytes / BYTES_PER_KB / BYTES_PER_KB)} MB`;
}

export function sideSentence(content: SideContent): string {
  switch (content.kind) {
    case "Missing":
      return "Deleted in this branch.";
    case "Text":
      return `A text file, ${content.lines} ${content.lines === 1 ? "line" : "lines"}.`;
    case "Binary":
      return `A binary file, ${sizeText(content.bytes)}.`;
    case "NonUtf8":
      return `Not UTF-8 text, ${sizeText(content.bytes)}.`;
    case "TooLarge":
      return `A text file too large to show, ${sizeText(content.bytes)}.`;
    case "Link":
      return `A symbolic link to ${content.target}.`;
    case "Commit":
      return `Submodule at commit ${content.id.slice(0, SHORT_COMMIT_LENGTH)}.`;
    default: {
      const _exhaustive: never = content;
      return _exhaustive;
    }
  }
}

export function sideTooltip(content: SideContent): string | undefined {
  return content.kind === "Commit" ? content.id : undefined;
}

export function sideButton(sides: FileSides, side: Side): string {
  if (sides[side].kind === "Missing") {
    return "Delete";
  }
  const other = side === "local" ? "remote" : "local";
  if (sides[other].kind === "Missing") {
    return "Keep";
  }
  return side === "local" ? "Take left" : "Take right";
}

export function resolvedLine(sides: FileSides, taken: Side): string {
  if (sides[taken].kind === "Missing") {
    return "Resolved by deleting the file.";
  }
  return taken === "local" ? "Resolved with the left version." : "Resolved with the right version.";
}
