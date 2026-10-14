import type { WorkspaceFolder } from "./answers";
import { parseWith, type Parsed } from "./messages";
import { INITIALIZE_RESULT } from "./protocol";
import type { Capabilities } from "./serverDocs";
import type { ServerSpec } from "./spec";
import { fileUri } from "./uri";

export type HostContext =
  | { readonly kind: "ready"; readonly root: string; readonly processId: number }
  | { readonly kind: "failed"; readonly message: string };

export type ReadyContext = Extract<HostContext, { kind: "ready" }>;

export const INITIALIZE_TIMEOUT_MS = 30_000;

export function projectFolder(spec: ServerSpec, root: string): WorkspaceFolder {
  const segments = `${root.replaceAll("\\", "/")}/${spec.project}`.split("/");
  const name = segments.filter((segment) => segment !== "").at(-1) ?? root;
  return { uri: fileUri(root, spec.project), name };
}

export function initializeParams(
  spec: ServerSpec,
  context: { readonly root: string; readonly processId: number },
): unknown {
  const folder = projectFolder(spec, context.root);
  return {
    processId: context.processId,
    clientInfo: { name: "yamt" },
    rootUri: folder.uri,
    workspaceFolders: [folder],
    capabilities: {
      general: { positionEncodings: ["utf-16"] },
      textDocument: {
        synchronization: { dynamicRegistration: false, didSave: false },
        publishDiagnostics: { versionSupport: true },
        diagnostic: { dynamicRegistration: false },
        formatting: { dynamicRegistration: false },
      },
      workspace: {
        configuration: true,
        workspaceFolders: true,
        diagnostics: { refreshSupport: true },
      },
    },
    ...(spec.initializationOptions === null
      ? {}
      : { initializationOptions: spec.initializationOptions }),
  };
}

function offered(provider: unknown): boolean {
  return provider === true || (typeof provider === "object" && provider !== null);
}

export function capabilitiesOf(result: unknown): Parsed<Capabilities> {
  const parsed = parseWith(INITIALIZE_RESULT, result);
  if (!parsed.ok) {
    return parsed;
  }
  const { capabilities } = parsed.value;
  return {
    ok: true,
    value: {
      pulls: offered(capabilities.diagnosticProvider),
      formats: offered(capabilities.documentFormattingProvider),
    },
  };
}
