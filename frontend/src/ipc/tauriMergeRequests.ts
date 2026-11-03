import { Channel, convertFileSrc } from "@tauri-apps/api/core";

import { commands, type ListMessage } from "./bindings";
import type { SourceResult } from "./domain";
import {
  toCheckedRow,
  toMergeRequestPage,
  toOpenReply,
  toRerequestReply,
  type CheckedRow,
  type ListEnd,
  type MergeRequestPage,
} from "./mergeRequestDomain";
import type { MergeRequestSource } from "./MergeRequestSource";
import { converted, toResult } from "./tauri";

// Rust's `PICTURE_SCHEME` in src-tauri/src/merge_requests/pictures.rs registers this scheme.
export const PICTURE_SCHEME = "yamt-picture";

function uploadedPicture(username: string): string {
  return convertFileSrc(username, PICTURE_SCHEME);
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
  };
}
