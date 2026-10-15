import type { PackageManager, PythonManager } from "./spec";

export const LOCK_FILES = [
  "pnpm-lock.yaml",
  "yarn.lock",
  "bun.lock",
  "bun.lockb",
  "package-lock.json",
] as const;

export type LockFile = (typeof LOCK_FILES)[number];

const LOCK_MANAGER: Readonly<Record<LockFile, PackageManager>> = {
  "pnpm-lock.yaml": "pnpm",
  "yarn.lock": "yarn",
  "bun.lock": "bun",
  "bun.lockb": "bun",
  "package-lock.json": "npm",
};

const DECLARED = /^(npm|pnpm|yarn|bun)@(\d+)/;
const CLASSIC_YARN_MAJOR = 1;

function declaredManager(declared: string | null): PackageManager | null {
  const [, name, major] = DECLARED.exec(declared ?? "") ?? [];
  if (name === "yarn") {
    return Number(major) === CLASSIC_YARN_MAJOR ? "yarn" : "yarnBerry";
  }
  return name === "npm" || name === "pnpm" || name === "bun" ? name : null;
}

export function packageManager(
  declared: string | null,
  nearestLock: LockFile | null,
): PackageManager | null {
  return declaredManager(declared) ?? (nearestLock === null ? null : LOCK_MANAGER[nearestLock]);
}

export const PYTHON_LOCK_FILES = ["uv.lock", "poetry.lock", "pdm.lock"] as const;

export const PYTHON_LOCK_MANAGER: Readonly<
  Record<(typeof PYTHON_LOCK_FILES)[number], PythonManager>
> = {
  "uv.lock": "uv",
  "poetry.lock": "poetry",
  "pdm.lock": "pdm",
};
