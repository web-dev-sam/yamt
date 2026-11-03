import { fileURLToPath } from "node:url";

import { ESLint } from "eslint";
import { expect, test } from "vitest";

const eslint = new ESLint({
  cwd: fileURLToPath(new URL("..", import.meta.url)),
  overrideConfigFile: fileURLToPath(new URL("../eslint.config.js", import.meta.url)),
});

async function noVHtmlSeverities(template: string): Promise<number[]> {
  const sample = `<script setup lang="ts">
const x = "<b>x</b>";
</script>
<template>${template}</template>
`;
  const results = await eslint.lintText(sample, { filePath: "src/ui/Sample.vue" });
  return results
    .flatMap((result) => result.messages)
    .filter((message) => message.ruleId === "vue/no-v-html")
    .map((message) => message.severity);
}

test("v_html_is_an_error_in_a_vue_file", async () => {
  expect(await noVHtmlSeverities('<div v-html="x" />')).toEqual([2]);
});

test("a_vue_file_without_v_html_reports_no_v_html", async () => {
  expect(await noVHtmlSeverities("<div>{{ x }}</div>")).toEqual([]);
});
