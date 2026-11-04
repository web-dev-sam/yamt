import type { DescriptionReply, UploadKey } from "./descriptionDomain";
import type { MergeRequestIid, SourceResult, WebPage } from "./domain";
import type { LinksReply } from "./linksDomain";
import type {
  CheckedRow,
  ContinueMergeReply,
  GitLabProject,
  JobLogReply,
  ListEnd,
  LocalMerge,
  MergeRequestPage,
  OpenReply,
  PageOpened,
  PeopleChange,
  PeopleChangeReply,
  PeopleSearchReply,
  RerequestReply,
  ResolveReply,
  RowDiscussions,
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
  /** A failed job's log, read only when this window's list offered `page` (plan §2 row 158). */
  readJobLog(page: WebPage): Promise<SourceResult<JobLogReply>>;
  /** The open discussions of the first rows of `iids` (at most Rust's DISCUSSION_BATCH), in their order, each once: a
   *  non-empty answer for a non-empty ask; ask again for the rest (plan §2 row 162). */
  readDiscussions(
    iids: readonly MergeRequestIid[],
  ): Promise<SourceResult<readonly RowDiscussions[]>>;
  /** The project's people whose name, username or public email matches `text` (GitLab's autocomplete, ≤ 20, plan §2 row 169). */
  searchPeople(text: string): Promise<SourceResult<PeopleSearchReply>>;
  /** One person added to or removed from one list of merge request `iid`, against GitLab's list at that moment. */
  changePeople(
    iid: MergeRequestIid,
    change: PeopleChange,
  ): Promise<SourceResult<PeopleChangeReply>>;
  /** A merge request's description as GitLab renders it, reduced by Rust; asked afresh on every call (plan §2 row 171). */
  readDescription(iid: MergeRequestIid): Promise<SourceResult<DescriptionReply>>;
  /** The address the window loads an uploaded description image from (the app: `convertFileSrc(key, PICTURE_SCHEME)`,
   *  `yamt-picture://localhost/<key>`; served only once a reply offered it). */
  uploadedImage(key: UploadKey): string;
  /** The epics, issues and commits a merge request's description links to, with titles, states and parents; asked
   *  on a row's first hover (plan §2 rows 176–177). */
  readLinks(iid: MergeRequestIid): Promise<SourceResult<LinksReply>>;
}
