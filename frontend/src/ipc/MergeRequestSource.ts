import type { MergeRequestIid, SourceResult, WebPage } from "./domain";
import type {
  GitLabProject,
  ListEnd,
  MergeRequestPage,
  OpenReply,
  PageOpened,
} from "./mergeRequestDomain";

export interface MergeRequestSource {
  findGitLabProject(): Promise<SourceResult<GitLabProject>>;
  /** Every page reaches `onPage` before the returned promise settles, and none after. */
  listMergeRequests(onPage: (page: MergeRequestPage) => void): Promise<SourceResult<ListEnd>>;
  openMergeRequest(iid: MergeRequestIid): Promise<SourceResult<OpenReply>>;
  openPage(page: WebPage): Promise<SourceResult<PageOpened>>;
}
