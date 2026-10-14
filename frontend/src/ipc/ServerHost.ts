export type RunId = number & { readonly __brand: "RunId" };

export type ServerCommand = {
  readonly program: string;
  readonly args: readonly string[];
  /** Repo-relative folder, "" = the repository root; the server's working directory. */
  readonly project: string;
};

export type HostEvent =
  | { readonly kind: "Message"; readonly text: string }
  | { readonly kind: "Log"; readonly line: string }
  | { readonly kind: "Exited"; readonly code: number | null };

export type StartReply =
  | { readonly kind: "Started"; readonly run: RunId }
  | { readonly kind: "NotFound"; readonly program: string; readonly searched: readonly string[] }
  | { readonly kind: "SpawnFailed"; readonly program: string; readonly message: string }
  | { readonly kind: "OutsideRepository"; readonly project: string };

export type ServerContext = { readonly root: string | null; readonly process_id: number };

export type ProgramFound =
  | { readonly kind: "Found"; readonly path: string; readonly place: "Project" | "Path" }
  | { readonly kind: "NotFound"; readonly searched: readonly string[] };

export type ProjectFile =
  | { readonly kind: "Missing" }
  | { readonly kind: "Folder" }
  | { readonly kind: "Text"; readonly text: string }
  | { readonly kind: "TooLarge" }
  | { readonly kind: "NotText" };

export interface ServerHost {
  context(): Promise<ServerContext>;
  start(command: ServerCommand, onEvent: (event: HostEvent) => void): Promise<StartReply>;
  /** Fire and forget; the host frames the message. */
  send(run: RunId, message: string): void;
  /** Signals the run (the host kills it 2 s later); its `Exited` event always follows. */
  stop(run: RunId): Promise<void>;
  findProgram(program: string, project: string): Promise<ProgramFound>;
  projectFiles(paths: readonly string[]): Promise<readonly ProjectFile[]>;
}
