import type { ProgramFolders } from "../../ipc";

export type PackageManager = "npm" | "pnpm" | "yarn" | "yarnBerry" | "bun";

export const PROGRAM_FOLDERS: ProgramFolders = { project: ["node_modules/.bin"], home: [] };

export type InstallHint = {
  readonly package: string;
  readonly program: string;
  readonly folder: string;
  readonly manager: PackageManager | null;
  readonly reason:
    | { readonly kind: "typescript"; readonly version: string }
    | { readonly kind: "eslint" };
};

export type ServerSpec = {
  readonly name: string;
  readonly command: { readonly program: string; readonly args: readonly string[] };
  readonly project: string;
  readonly folders: ProgramFolders;
  readonly fileTypes: readonly string[];
  readonly formats: boolean;
  readonly settings: unknown;
  readonly initializationOptions: unknown;
  readonly install: InstallHint | null;
};

export function extensionOf(path: string): string {
  const name = path.slice(path.lastIndexOf("/") + 1);
  const dot = name.lastIndexOf(".");
  return dot <= 0 ? "" : name.slice(dot + 1).toLowerCase();
}

export function serves(spec: ServerSpec, path: string): boolean {
  const underProject = spec.project === "" || path.startsWith(`${spec.project}/`);
  return underProject && spec.fileTypes.includes(extensionOf(path));
}
