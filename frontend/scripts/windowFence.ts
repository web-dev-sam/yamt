type Root = "merge" | "compare" | "range";

type WindowRoot = Exclude<Root, "merge">;

export type WindowFinding = { readonly rule: "PM7" | "PM9" | "PM10"; readonly reason: string };

const LSP = "src/lsp";
const SOURCE_EXTENSION = /\.(?:ts|vue)$/;
const TEST_SOURCE_EXTENSION = /(?:\.test)?\.(?:ts|vue)$/;
const ROOT_FILES: Readonly<Record<string, Root>> = {
  "src/ui/store": "merge",
  "src/ui/App": "merge",
  "src/ui/compareStore": "compare",
  "src/ui/CompareApp": "compare",
  "src/ui/rangeStore": "range",
  "src/ui/RangeApp": "range",
};
const WINDOW_FILE = /^src\/ui\/(?:use)?(compare|range)[^/]*\.(?:ts|vue)$/i;
const WINDOW_RULES: Readonly<Record<WindowRoot, "PM7" | "PM9">> = {
  compare: "PM7",
  range: "PM9",
};
const SHARED_PAGE_FILE = /^src\/ui\/(?:MergeRequest|mergeRequest|CiStatus)[^/]*\.(?:ts|vue)$/;
const AI_FILES: Readonly<Record<string, true>> = {
  "src/ui/AiTurn": true,
  "src/ui/AiStep": true,
  "src/ui/EditDiff": true,
  "src/ui/AgentSettings": true,
  "src/ui/aiClose": true,
};

function isLsp(target: string): boolean {
  return target === LSP || target.startsWith(`${LSP}/`);
}

function isWindowRoot(name: string): name is WindowRoot {
  return Object.hasOwn(WINDOW_RULES, name);
}

function windowRoot(file: string): string {
  if (Object.hasOwn(AI_FILES, file.replace(TEST_SOURCE_EXTENSION, ""))) {
    return "range";
  }
  return WINDOW_FILE.exec(file)?.[1]?.toLowerCase() ?? "";
}

function rootFinding(file: string, target: string): WindowFinding | undefined {
  const root = windowRoot(file);
  if (!isWindowRoot(root)) {
    return undefined;
  }
  const rule = WINDOW_RULES[root];
  const other = ROOT_FILES[target.replace(SOURCE_EXTENSION, "")];
  if (other !== undefined && other !== root) {
    return { rule, reason: `the ${root} window never imports the ${other} window's root` };
  }
  if (isLsp(target)) {
    return { rule, reason: `the ${root} window never imports lsp/` };
  }
  return undefined;
}

function aiFileFinding(file: string, target: string): WindowFinding | undefined {
  const aiFile = Object.hasOwn(AI_FILES, target.replace(SOURCE_EXTENSION, ""));
  return aiFile && windowRoot(file) !== "range"
    ? { rule: "PM9", reason: "the AI's views and close question are the range window's only" }
    : undefined;
}

function sharedPageFinding(file: string, target: string): WindowFinding | undefined {
  if (!SHARED_PAGE_FILE.test(file)) {
    return undefined;
  }
  const root = ROOT_FILES[target.replace(SOURCE_EXTENSION, "")];
  if (root !== undefined) {
    return {
      rule: "PM10",
      reason: `the merge-request page serves two windows; it never imports the ${root} window's root`,
    };
  }
  return isLsp(target)
    ? { rule: "PM10", reason: "the merge-request page never imports lsp/" }
    : undefined;
}

export function windowFinding(file: string, target: string): WindowFinding | undefined {
  return (
    rootFinding(file, target) ?? aiFileFinding(file, target) ?? sharedPageFinding(file, target)
  );
}
