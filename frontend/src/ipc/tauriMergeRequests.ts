import { Channel, convertFileSrc } from "@tauri-apps/api/core";

import { commands, type ListMessage } from "./bindings";
import { toDescriptionReply } from "./descriptionDomain";
import {
  toDiscussionThreadReply,
  toMarkdownPreviewReply,
  toRowDiscussions,
} from "./discussionDomain";
import type { SourceResult } from "./domain";
import { toLinksReply } from "./linksDomain";
import {
  toCheckedRow,
  toMergeRequestPage,
  toOpenReply,
  toPeopleChangeReply,
  toPeopleSearchReply,
  toRerequestReply,
  type CheckedRow,
  type ListEnd,
  type MergeRequestPage,
} from "./mergeRequestDomain";
import type { MergeRequestSource } from "./MergeRequestSource";
import { converted, toResult } from "./tauri";

// Rust's `PICTURE_SCHEME` in src-tauri/src/merge_requests/pictures.rs registers this scheme.
export const PICTURE_SCHEME = "yamt-picture";

function uploadedPicture(key: string): string {
  return convertFileSrc(key, PICTURE_SCHEME);
}

function listed(
  onPage: (page: MergeRequestPage) => void,
  onChecked: (row: CheckedRow) => void,
): Promise<SourceResult<ListEnd>> {
  return new Promise((resolve, reject) => {
    let settled = false;
    function end(result: SourceResult<ListEnd>): void {
      settled = true;
      resolve(result);
    }
    function fail(error: unknown): void {
      settled = true;
      reject(error);
    }
    const messages = new Channel<ListMessage>((message) => {
      if (message.kind === "checked") {
        onChecked(toCheckedRow(message.row));
        return;
      }
      if (settled) {
        return;
      }
      if (message.kind === "end") {
        end({ ok: true, value: message.end });
        return;
      }
      try {
        onPage(toMergeRequestPage(message.page, uploadedPicture));
      } catch (error) {
        fail(error);
      }
    });
    commands.listMergeRequests(messages).then((reply) => {
      const result = toResult(reply);
      if (!result.ok) {
        end(result);
      }
    }, fail);
  });
}

function peopleCalls(): Pick<MergeRequestSource, "searchPeople" | "changePeople"> {
  return {
    async searchPeople(text) {
      return converted(toResult(await commands.searchPeople(text)), (reply) =>
        toPeopleSearchReply(reply, uploadedPicture),
      );
    },
    async changePeople(iid, change) {
      return converted(toResult(await commands.changePeople(iid, change)), (reply) =>
        toPeopleChangeReply(reply, uploadedPicture),
      );
    },
  };
}

function descriptionCalls(): Pick<
  MergeRequestSource,
  "readDescription" | "readLinks" | "uploadedImage"
> {
  return {
    async readDescription(iid) {
      return converted(toResult(await commands.readDescription(iid)), toDescriptionReply);
    },
    async readLinks(iid) {
      return converted(toResult(await commands.readLinks(iid)), toLinksReply);
    },
    uploadedImage: uploadedPicture,
  };
}

function threadCalls(): Pick<
  MergeRequestSource,
  | "readDiscussionThread"
  | "replyToDiscussion"
  | "resolveDiscussion"
  | "submitReview"
  | "previewMarkdown"
> {
  return {
    async readDiscussionThread(iid, discussion) {
      return converted(toResult(await commands.readDiscussionThread(iid, discussion)), (reply) =>
        toDiscussionThreadReply(reply, uploadedPicture),
      );
    },
    async replyToDiscussion(iid, discussion, kind, text) {
      return toResult(await commands.replyToDiscussion(iid, discussion, kind, text));
    },
    async resolveDiscussion(iid, discussion, resolve) {
      return toResult(await commands.resolveDiscussion(iid, discussion, resolve));
    },
    async submitReview(iid) {
      return toResult(await commands.submitReview(iid));
    },
    async previewMarkdown(iid, text) {
      return converted(toResult(await commands.previewMarkdown(iid, text)), toMarkdownPreviewReply);
    },
  };
}

export function createTauriMergeRequests(): MergeRequestSource {
  return {
    async findGitLabProject() {
      return { ok: true, value: await commands.findGitlabProject() };
    },
    listMergeRequests: listed,
    async openMergeRequest(iid) {
      return converted(toResult(await commands.openMergeRequest(iid)), toOpenReply);
    },
    async openPage(page) {
      return { ok: true, value: await commands.openPage(page) };
    },
    async resolveMergeRequest(iid) {
      return toResult(await commands.resolveMergeRequest(iid));
    },
    async continueMergeRequest(iid) {
      return toResult(await commands.continueMergeRequest(iid));
    },
    async findLocalMerge() {
      return toResult(await commands.findLocalMerge());
    },
    async rerequestReview(iid, username) {
      return converted(toResult(await commands.rerequestReview(iid, username)), (reply) =>
        toRerequestReply(reply, uploadedPicture),
      );
    },
    async readJobLog(page) {
      return toResult(await commands.readJobLog(page));
    },
    async readDiscussions(iids) {
      return converted(toResult(await commands.readDiscussions([...iids])), (rows) =>
        rows.map((row, at) => toRowDiscussions(row, at, uploadedPicture)),
      );
    },
    ...peopleCalls(),
    ...descriptionCalls(),
    ...threadCalls(),
  };
}
