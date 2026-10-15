export type Command = { readonly program: string; readonly args: readonly string[] };

type Installable = { readonly command: Command; readonly package: string };

export type Formats =
  | { readonly kind: "always" }
  | { readonly kind: "never" }
  | { readonly kind: "withConfig"; readonly files: readonly string[] }
  | { readonly kind: "withIntegration" };

export type Integration = {
  readonly key: string;
  readonly bin: string;
  readonly configs: readonly string[];
  readonly formats: boolean;
};

export type FromProject =
  | { readonly kind: "nothing" }
  | { readonly kind: "integrations"; readonly integrations: readonly Integration[] }
  | { readonly kind: "venvPython" };

export type Tool = {
  readonly name: string;
  readonly formats: Formats;
  readonly settings: unknown;
  readonly initializationOptions: ((workspaceUri: string) => unknown) | null;
  readonly fromProject: FromProject;
};

export type Recipe =
  | { readonly kind: "python"; readonly package: string }
  | { readonly kind: "rustup"; readonly component: string }
  | { readonly kind: "go"; readonly module: string }
  | { readonly kind: "download"; readonly command: string; readonly needs: string | null }
  | { readonly kind: "system" };

export type Sign =
  | { readonly kind: "manifest" }
  | { readonly kind: "file"; readonly name: string }
  | { readonly kind: "section"; readonly file: string; readonly line: RegExp };

export type Look =
  | { readonly kind: "projectProgram"; readonly command: Command }
  | {
      readonly kind: "used";
      readonly signs: readonly Sign[];
      readonly orProjectProgram: boolean;
      readonly command: Command;
      readonly recipe: Recipe;
      readonly orElse: readonly (Tool & { readonly command: Command })[];
    }
  | {
      readonly kind: "typescript";
      readonly configs: readonly string[];
      readonly package: string;
      readonly firstLspMajor: number;
      readonly compiler: Command;
      readonly nativePreview: Command;
      readonly server: Installable;
    }
  | {
      readonly kind: "eslint";
      readonly configs: readonly string[];
      readonly package: string;
      readonly server: Installable;
    };
