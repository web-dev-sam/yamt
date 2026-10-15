import type { ProgramFolders } from "../../ipc";

export type PackageManager = "npm" | "pnpm" | "yarn" | "yarnBerry" | "bun";

export type PythonManager = "uv" | "poetry" | "pdm";

export type TypeScriptProgram = "tsc" | "tsgo";

export type SpecNote = {
  readonly kind: "vueNeedsTypeScript6";
  readonly program: TypeScriptProgram;
  readonly version: string;
};

export type InstallHint =
  | {
      readonly kind: "node";
      readonly package: string;
      readonly program: string;
      readonly folder: string;
      readonly manager: PackageManager | null;
      readonly reason:
        | { readonly kind: "typescript"; readonly version: string }
        | { readonly kind: "eslint" }
        | { readonly kind: "vue" };
    }
  | {
      readonly kind: "python";
      readonly package: string;
      readonly program: string;
      readonly folder: string;
      readonly manager: PythonManager | null;
    }
  | { readonly kind: "rustup"; readonly component: string; readonly program: string }
  | { readonly kind: "go"; readonly module: string; readonly program: string }
  | {
      readonly kind: "download";
      readonly program: string;
      readonly command: string;
      readonly needs: string | null;
    }
  | { readonly kind: "system"; readonly program: string };

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
  readonly help: InstallHint | null;
  readonly notes: readonly SpecNote[];
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
