import { createLog } from "./log";
import { forwardLog } from "./tauri";
import { guardWindowClose } from "./window";

export type { AgentCommand, AgentStartReply, CheckoutReady } from "./agentDomain";
export type { AgentSource } from "./AgentSource";
export type { ChunkSource, SettingsSource, WriteRequest } from "./ChunkSource";
export { createFixtureAgentSource } from "./fixtureAgent";
export { createTauriAgentSource } from "./tauriAgent";
export type { CompareSource } from "./CompareSource";
export type {
  Column,
  ColumnVersions,
  Comparison,
  Difference,
  TabEntry,
  TabLanguage,
  TabList,
  TabTexts,
} from "./compareDomain";
export type {
  AddedServer,
  AgentRun,
  AgentSettings,
  Antialiasing,
  Chunk,
  CheckoutFolder,
  ClipboardSelection,
  ColumnVersion,
  ContinueReply,
  DiscussionDetails,
  DiskChange,
  DiskResult,
  DiskVersion,
  FileEntry,
  FileMergeData,
  FileSides,
  HostEvent,
  KeysChange,
  LanguageServerSettings,
  Listing,
  NotText,
  OperationKind,
  OperationView,
  ProgramFolders,
  ProgramFound,
  ProgressView,
  ProjectFile,
  RangeFileId,
  RepositoryAnswer,
  RunId,
  ServerCommand,
  ServerContext,
  SettingsRead,
  Side,
  SideContent,
  SideName,
  SideNames,
  SourceFailure,
  SourceResult,
  StartReply,
  StoredSettings,
  TabId,
  Theme,
  WriteReply,
} from "./domain";
export {
  agentSessionId,
  isAgentSessionId,
  isDiscussionId,
  isMergeRequestIid,
  nextColumnVersion,
} from "./domain";
export type { AbortReply, Leftover, MergeView, PushReply, ReturnTo } from "./localMergeDomain";
export type {
  AgentSessionId,
  DiscussionId,
  MergeRequestIid,
  MessageId,
  ThreadId,
  WebPage,
} from "./domain";
export type {
  Description,
  DescriptionBlock,
  DescriptionCell,
  DescriptionImage,
  DescriptionInline,
  DescriptionItem,
  DescriptionLink,
  DescriptionReply,
  DescriptionRow,
} from "./descriptionDomain";
export type {
  DiscussionsAnswer,
  DiscussionThread,
  DiscussionThreadReply,
  DiscussionWriteReply,
  MarkdownPreviewReply,
  OpenDiscussion,
  ReplyKind,
  RowDiscussions,
} from "./discussionDomain";
export type {
  DescriptionLinks,
  LinkedCommit,
  LinkedEpic,
  LinkedIssue,
  LinkedParent,
  LinksReply,
} from "./linksDomain";
export type {
  CheckedRow,
  ContinueMergeReply,
  GitLabProject,
  JobLogReply,
  ListEnd,
  LocalMerge,
  Label,
  MergeRequestPage,
  MergeRequestPeople,
  MergeRequestRow,
  OpenReply,
  PageOpened,
  PeopleChange,
  PeopleChangeReply,
  PeopleGroup,
  PeopleSearchReply,
  Person,
  Readiness,
  Refusal,
  RerequestReply,
  ResolveRefusal,
  ResolveReply,
  Reviewer,
  Started,
} from "./mergeRequestDomain";
export type { MergeRequestSource } from "./MergeRequestSource";
export type {
  GitLabCheck,
  MergeRequestRef,
  Message,
  NotLinedUp,
  Posting,
  SendProgress,
  SendReply,
  Thread,
  ThreadList,
} from "./reviewDomain";
export type { ReviewSource } from "./ReviewSource";
export { createFixtureSource, loadFixture } from "./fixture";
export { createFixtureCompareSource, loadCompareFixture } from "./fixtureCompare";
export { createFixtureRangeSource } from "./fixtureRange";
export { createFixtureServerHost } from "./fixtureServers";
export {
  bindingsOf,
  DEFAULT_KEYS,
  isLetter,
  isLinux,
  isMac,
  KEY_ACTIONS,
  keyLabel,
  keyList,
  keyOfEvent,
  keyText,
  parseKey,
  pressesKey,
  sameKey,
  type Key,
  type KeyAction,
  type KeyBindings,
  type KeyName,
  type KeyProblem,
  type KeysRead,
} from "./keys";
export type {
  RangeChange,
  RangeEntry,
  RangeEntryKind,
  RangeFile,
  RangeLineCounts,
  RangeModeChange,
  RangeSide,
  RangeSides,
  RangeStart,
  SearchText,
  SearchTexts,
} from "./rangeDomain";
export type { RangeSource } from "./RangeSource";
export { createTauriServerHost, createTauriSource, readClipboard } from "./tauri";
export { THEMES, themeKind, themeOf, themeRows } from "./themes";
export { createTauriCompareSource } from "./tauriCompare";
export {
  changedThreadLine,
  diffLineOf,
  isOneLine,
  onePlace,
  sameDiffLine,
  shownColumn,
  shownLine,
  unchangedThreadLine,
  type DiffLine,
  type ShownThread,
  type ThreadLine,
  type ThreadPlace,
} from "./threadLine";
export { createTauriRangeSource } from "./tauriRange";
export type { ServerHost } from "./ServerHost";
export type { SideWords } from "./words";

const IN_APP = import.meta.env.VITE_CHUNK_SOURCE === "tauri";

export const log = createLog(IN_APP ? forwardLog : undefined);

export function onWindowClose(mayClose: () => Promise<boolean>): Promise<void> {
  return IN_APP ? guardWindowClose(mayClose) : Promise.resolve();
}
