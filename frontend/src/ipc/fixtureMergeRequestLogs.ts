import type * as Generated from "./bindings";
import type { WebPage } from "./domain";
import { TIMED_OUT } from "./fixtureGitLab";
import { LOGGED_OUT_DETAIL } from "./fixtureMergeRequestData";
import type { JobLogReply } from "./mergeRequestDomain";

type RawLine = string | { readonly continues: string };

export const NO_LOG_IID = 632;
export const LOGGED_OUT_LOG_IID = 624;

const LOG_START_MS = Date.parse("2026-10-30T09:00:01.123Z");
const LINE_STEP_MS = 7;
const MICROSECONDS = "456";
const STREAM = "00O ";
const CONTINUED = "00O+";
const UNIT_TESTS = 8998;
const UNIT_FAIL_EVERY = 97;
const UNIT_COLOUR_EVERY = 2;
const NOT_OFFERED: JobLogReply = { kind: "notOffered" };
const E = "\u001b";

const REFUSALS: Readonly<Record<number, Readonly<Record<string, JobLogReply>>>> = {
  [NO_LOG_IID]: {
    "lint:docs": { kind: "noLog" },
    "test:unit": { kind: "failed", message: TIMED_OUT },
  },
  [LOGGED_OUT_LOG_IID]: {
    "lint:docs": { kind: "notLoggedIn", detail: LOGGED_OUT_DETAIL },
    "test:unit": { kind: "glabMissing" },
  },
};

const LINT_LINES: readonly RawLine[] = [
  `${E}]0;title\u0007Running with gitlab-runner 17.5.0 (8ec04662)\r`,
  "  on docker-auto-scale-1 ZxAiwUvB, system ID: s_4c1a2b3d5e6f\r",
  `${E}[0Ksection_start:1730278801:prepare_executor[collapsed=true]\r${E}[0K${E}[36;1mPreparing the "docker+machine" executor${E}[0;m`,
  "Using Docker executor with image node:22-bookworm ...",
  "Pulling docker image node:22-bookworm ...",
  `${E}[0Ksection_end:1730278804:prepare_executor\r${E}[0K`,
  `section_start:1730278805:prepare_script[collapsed=true]\r${E}[0K${E}[36;1mPreparing environment${E}[0;m`,
  "Running on runner-zxaiwuvb-project-42-concurrent-0 via runner-manager-1...",
  `section_end:1730278806:prepare_script\r${E}[0K`,
  `${E}[0Ksection_start:1730278807:get_sources\r${E}[0K${E}[36;1mGetting source from Git repository${E}[0;m`,
  `${E}[32;1mFetching changes with git depth set to 20...${E}[0;m`,
  "Receiving objects:  10% (12/120)\rReceiving objects:  55% (66/120)\rReceiving objects: 100% (120/120), done.",
  `${E}[32;1mChecking out 3f9c2a1b as detached HEAD (ref is refs/merge-requests/632/head)...${E}[0;m`,
  `${E}[0Ksection_end:1730278810:get_sources\r${E}[0K`,
  "",
  `${E}[0Ksection_start:1730278811:step_script\r${E}[0K${E}[36;1mExecuting "step_script" stage of the job script${E}[0;m`,
  `${E}[32;1m$ pnpm install --frozen-lockfile${E}[0;m`,
  "Lockfile is up to date, resolution step is skipped\r",
  "Progress: resolved 812, reused 812, downloaded 0, added 812, done\r",
  `${E}[32;1m$ pnpm lint:docs${E}[0;m`,
  "> taskboard@1.4.0 lint:docs /builds/taskboard/taskboard",
  '> markdownlint "docs/**/*.md"',
  "",
  `docs/setup.md:12 ${E}[31mMD013/line-length${E}[39m Line length [Expected: 120; Actual: 143]`,
  `docs/setup.md:40 ${E}[91mMD040/fenced-code-language${E}[39m Fenced code blocks should have a language specified`,
  `docs/api.md:7 ${E}[33mMD025/single-h1${E}[39m Multiple top-level headings in the same document`,
  `docs/api.md:88 ${E}[93mMD034/no-bare-urls${E}[39m Bare URL used`,
  `${E}[1mSummary:${E}[22m 4 ${E}[1;31merrors${E}[0m in 2 files`,
  `${E}[38;5;208mwarning${E}[39m: docs/changelog.md is older than the last release`,
  `${E}[48;5;196m${E}[97m BLOCKER ${E}[0m the docs build has been broken since 1.3.9`,
  `${E}[38;2;255;0;0mError${E}[0m: markdownlint found 4 problems`,
  "<b>not bold</b> &amp; <script>x</script>",
  "",
  `${E}[34mhint${E}[39m: run ${E}[36mpnpm lint:docs --fix${E}[39m to fix 2 of them`,
  `${E}[35mnote${E}[39m: ${E}[90mthe rules live in .markdownlint.jsonc${E}[39m`,
  "The command stopped at the first error in each file; ",
  { continues: "see the list above for every error." },
  `${E}[41m${E}[30m ELIFECYCLE ${E}[0m ${E}[31mCommand failed with exit code 1.${E}[39m`,
  `${E}[0Ksection_end:1730278838:step_script\r${E}[0K`,
  `${E}[0Ksection_start:1730278839:upload_artifacts_on_failure[collapsed=true]\r${E}[0K${E}[36;1mUploading artifacts for failed job${E}[0;m`,
  `${E}[32;1mUploading artifacts...${E}[0;m`,
  `${E}[0;33mWARNING: report.xml: no matching files. Ensure that the artifact path is relative to the working directory${E}[0;m`,
  `${E}[31;1mERROR: No files to upload${E}[0;m`,
  `${E}[0Ksection_end:1730278840:upload_artifacts_on_failure\r${E}[0K`,
  `${E}[0Ksection_start:1730278841:cleanup_file_variables\r${E}[0K${E}[36;1mCleaning up project directory and file based variables${E}[0;m`,
  `${E}[0Ksection_end:1730278842:cleanup_file_variables\r${E}[0K`,
  "",
  `${E}[31;1mERROR: Job failed: exit code 1${E}[0;m`,
];

let unitLog: string | null = null;

function stamp(at: number, stream: string): string {
  const time = new Date(LOG_START_MS + at * LINE_STEP_MS).toISOString();
  return `${time.replace("Z", `${MICROSECONDS}Z`)} ${stream}`;
}

function stamped(lines: readonly RawLine[]): string {
  const physical = lines.map((line, at) =>
    typeof line === "string" ? stamp(at, STREAM) + line : stamp(at, CONTINUED) + line.continues,
  );
  return `${physical.join("\n")}\n`;
}

function unitLine(test: number): string {
  const file = `t${test}.ts`;
  if (test % UNIT_FAIL_EVERY === 0) {
    return `${E}[31;1mFAIL${E}[0m ${file}`;
  }
  return test % UNIT_COLOUR_EVERY === 0 ? `${E}[32mPASS${E}[0m ${file}` : `PASS ${file}`;
}

function longUnitLog(): string {
  unitLog ??= stamped([
    `${E}[32;1m$ pnpm test:unit${E}[0;m`,
    ...Array.from({ length: UNIT_TESTS }, (_, at) => unitLine(at + 1)),
    `${E}[31;1mERROR: Job failed: exit code 1${E}[0;m`,
  ]);
  return unitLog;
}

function namedLog(name: string): JobLogReply {
  switch (name) {
    case "lint:docs":
      return { kind: "log", log: { text: stamped(LINT_LINES), cut: false } };
    case "test:unit":
      return { kind: "log", log: { text: longUnitLog(), cut: true } };
    default:
      return NOT_OFFERED;
  }
}

/** The fixture's answer for a job page: a failed job of a `listed` row gets its row's scripted refusal or its name's
 *  log; any other page `notOffered` (as Rust, plan §2 row 158). */
export function fixtureJobLog(
  page: WebPage,
  listed: readonly Generated.MergeRequestRow[],
): JobLogReply {
  for (const row of listed) {
    const job = row.pipeline?.failedJobs.find((failed) => failed.page === page);
    if (job !== undefined) {
      return REFUSALS[row.iid]?.[job.name] ?? namedLog(job.name);
    }
  }
  return NOT_OFFERED;
}
