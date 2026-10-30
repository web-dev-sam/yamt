import type { JobPage, MergeRequestIid, SourceResult } from "./domain";
import type {
  GitLabProject,
  JobOpened,
  ListEnd,
  MergeRequestPage,
  OpenReply,
} from "./mergeRequestDomain";

export interface MergeRequestSource {
  findGitLabProject(): Promise<SourceResult<GitLabProject>>;
  listMergeRequests(onPage: (page: MergeRequestPage) => void): Promise<SourceResult<ListEnd>>;
  openMergeRequest(iid: MergeRequestIid): Promise<SourceResult<OpenReply>>;
  openJobPage(page: JobPage): Promise<SourceResult<JobOpened>>;
}
