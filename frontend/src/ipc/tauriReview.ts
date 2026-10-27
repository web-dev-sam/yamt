import { Channel } from "@tauri-apps/api/core";

import { commands, type SendProgress } from "./bindings";
import { toGitLabCheck, toSendReply, toThreadAdded, toThreadList } from "./reviewDomain";
import type { ReviewSource } from "./ReviewSource";
import { converted, toResult } from "./tauri";
import { fromThreadLine } from "./threadLine";

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
    async editNote(message, text) {
      return converted(toResult(await commands.editNote(message, text)), toThreadList);
    },
    async deleteMessage(message) {
      return converted(toResult(await commands.deleteMessage(message)), toThreadList);
    },
    async setThreadSession(thread, session) {
      return converted(toResult(await commands.setThreadSession(thread, session)), toThreadList);
    },
    async addAiAnswer(thread, session) {
      return converted(toResult(await commands.addAiAnswer(thread, session)), toThreadList);
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
