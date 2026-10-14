import type {
  HostEvent,
  ProgramFound,
  ProjectFile,
  RunId,
  ServerCommand,
  ServerContext,
  StartReply,
} from "./domain";

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
