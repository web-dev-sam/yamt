import { Channel } from "@tauri-apps/api/core";

import { commands, type SendProgress } from "./bindings";
import type { SourceResult } from "./domain";
import { toGitLabCheck, toSendReply, toThreadAdded, toThreadList } from "./reviewDomain";
import type { ReviewSource } from "./ReviewSource";
import { toResult } from "./tauri";
import { fromThreadLine } from "./threadLine";

function converted<T, U>(result: SourceResult<T>, to: (raw: T) => U): SourceResult<U> {
  return result.ok ? { ok: true, value: to(result.value) } : result;
}

export function createTauriReview(): ReviewSource {
  return {
    async listThreads() {
      return converted(toResult(await commands.listThreads()), toThreadList);
    },
    async addThread(file, line, text) {
      const reply = await commands.addThread(file, fromThreadLine(line), text);
      return converted(toResult(reply), toThreadAdded);
    },
    async addNote(thread, text) {
      return converted(toResult(await commands.addNote(thread, text)), toThreadList);
    },
    async queueMessage(message, text) {
      return converted(toResult(await commands.queueMessage(message, text)), toThreadList);
    },
    async unqueueMessage(message) {
      return converted(toResult(await commands.unqueueMessage(message)), toThreadList);
    },
    async checkGitLab() {
      return converted(toResult(await commands.checkGitlab()), toGitLabCheck);
    },
    async sendQueue(onProgress) {
      const progress = new Channel<SendProgress>(onProgress);
      return converted(toResult(await commands.sendQueue(progress)), toSendReply);
    },
  };
}
