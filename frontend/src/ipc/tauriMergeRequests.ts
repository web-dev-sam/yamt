import { Channel } from "@tauri-apps/api/core";

import { commands, type MergeRequestPage as MergeRequestPageDto } from "./bindings";
import { toMergeRequestPage, toOpenReply } from "./mergeRequestDomain";
import type { MergeRequestSource } from "./MergeRequestSource";
import { converted, toResult } from "./tauri";

export function createTauriMergeRequests(): MergeRequestSource {
  return {
    async findGitLabProject() {
      return { ok: true, value: await commands.findGitlabProject() };
    },
    async listMergeRequests(onPage) {
      const unreadable: unknown[] = [];
      const pages = new Channel<MergeRequestPageDto>((raw) => {
        try {
          onPage(toMergeRequestPage(raw));
        } catch (error) {
          unreadable.push(error);
        }
      });
      const reply = toResult(await commands.listMergeRequests(pages));
      if (unreadable.length > 0) {
        throw unreadable[0];
      }
      return reply;
    },
    async openMergeRequest(iid) {
      return converted(toResult(await commands.openMergeRequest(iid)), toOpenReply);
    },
    async openJobPage(page) {
      return { ok: true, value: await commands.openJobPage(page) };
    },
  };
}
