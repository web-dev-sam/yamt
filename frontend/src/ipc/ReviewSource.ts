import type { MessageId, RangeFileId, SourceResult, ThreadId } from "./domain";
import type { GitLabCheck, SendProgress, SendReply, ThreadAdded, ThreadList } from "./reviewDomain";
import type { ThreadLine } from "./threadLine";

export interface ReviewSource {
  listThreads(): Promise<SourceResult<ThreadList>>;
  addThread(file: RangeFileId, line: ThreadLine, text: string): Promise<SourceResult<ThreadAdded>>;
  addNote(thread: ThreadId, text: string): Promise<SourceResult<ThreadList>>;
  queueMessage(message: MessageId, text: string): Promise<SourceResult<ThreadList>>;
  unqueueMessage(message: MessageId): Promise<SourceResult<ThreadList>>;
  setThreadSession(thread: ThreadId, session: string): Promise<SourceResult<ThreadList>>;
  addAiAnswer(thread: ThreadId, session: string): Promise<SourceResult<ThreadList>>;
  checkGitLab(): Promise<SourceResult<GitLabCheck>>;
  sendQueue(onProgress: (progress: SendProgress) => void): Promise<SourceResult<SendReply>>;
}
