import { Channel } from "@tauri-apps/api/core";

import { commands, type ListMessage } from "./bindings";
import type { SourceResult } from "./domain";
import {
  toMergeRequestPage,
  toOpenReply,
  type ListEnd,
  type MergeRequestPage,
} from "./mergeRequestDomain";
import type { MergeRequestSource } from "./MergeRequestSource";
import { converted, toResult } from "./tauri";

function listed(onPage: (page: MergeRequestPage) => void): Promise<SourceResult<ListEnd>> {
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
      if (settled) {
        return;
      }
      if (message.kind === "end") {
        end({ ok: true, value: message.end });
        return;
      }
      try {
        onPage(toMergeRequestPage(message.page));
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
  };
}
