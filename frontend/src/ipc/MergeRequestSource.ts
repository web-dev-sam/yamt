import type { MergeRequestIid, SourceResult, WebPage } from "./domain";
import type {
  CheckedRow,
  ContinueMergeReply,
  GitLabProject,
  ListEnd,
  LocalMerge,
  MergeRequestPage,
  OpenReply,
  PageOpened,
  RerequestReply,
  ResolveReply,
} from "./mergeRequestDomain";

export interface MergeRequestSource {
  findGitLabProject(): Promise<SourceResult<GitLabProject>>;
  /**
   * Every page reaches `onPage` before the returned promise settles, and none after. `onChecked` gets this load's
   * local results (rows yamt's own merge changed), after the promise settled, and never another load's.
   */
  listMergeRequests(
    onPage: (page: MergeRequestPage) => void,
    onChecked: (row: CheckedRow) => void,
  ): Promise<SourceResult<ListEnd>>;
  openMergeRequest(iid: MergeRequestIid): Promise<SourceResult<OpenReply>>;
  openPage(page: WebPage): Promise<SourceResult<PageOpened>>;
  resolveMergeRequest(iid: MergeRequestIid): Promise<SourceResult<ResolveReply>>;
  continueMergeRequest(iid: MergeRequestIid): Promise<SourceResult<ContinueMergeReply>>;
  findLocalMerge(): Promise<SourceResult<LocalMerge>>;
  rerequestReview(iid: MergeRequestIid, username: string): Promise<SourceResult<RerequestReply>>;
}
