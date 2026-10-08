import { globSync, readFileSync } from "node:fs";

import { parse } from "@vue/compiler-sfc";
import ts from "typescript";

const SECTIONS = [
  "import",
  "type",
  "macro",
  "state",
  "computed",
  "watch",
  "lifecycle",
  "function",
] as const;

type Section = (typeof SECTIONS)[number];

const CALLEE_SECTIONS: Record<string, Section> = {
  defineProps: "macro",
  defineEmits: "macro",
  defineModel: "macro",
  withDefaults: "macro",
  ref: "state",
  reactive: "state",
  shallowRef: "state",
  useTemplateRef: "state",
  computed: "computed",
  watch: "watch",
  watchEffect: "watch",
  onMounted: "lifecycle",
  onBeforeMount: "lifecycle",
  onUpdated: "lifecycle",
  onBeforeUpdate: "lifecycle",
  onUnmounted: "lifecycle",
  onBeforeUnmount: "lifecycle",
};

function calleeSection(expression: ts.Expression | undefined): Section | undefined {
  if (expression === undefined || !ts.isCallExpression(expression)) {
    return undefined;
  }
  if (!ts.isIdentifier(expression.expression)) {
    return undefined;
  }
  const name = expression.expression.text;
  return Object.hasOwn(CALLEE_SECTIONS, name) ? CALLEE_SECTIONS[name] : undefined;
}

function classify(statement: ts.Statement): Section | undefined {
  if (ts.isImportDeclaration(statement)) {
    return "import";
  }
  if (ts.isTypeAliasDeclaration(statement) || ts.isInterfaceDeclaration(statement)) {
    return "type";
  }
  if (ts.isFunctionDeclaration(statement)) {
    return "function";
  }
  if (ts.isExpressionStatement(statement)) {
    return calleeSection(statement.expression);
  }
  if (ts.isVariableStatement(statement)) {
    return calleeSection(statement.declarationList.declarations[0]?.initializer);
  }
  return undefined;
}

function firstViolation(file: string): string | undefined {
  const { descriptor } = parse(readFileSync(file, "utf8"), { filename: file });
  const script = descriptor.scriptSetup;
  if (script === null) {
    return undefined;
  }
  const source = ts.createSourceFile(file, script.content, ts.ScriptTarget.Latest, true);
  let previous: Section = "import";
  for (const statement of source.statements) {
    const section = classify(statement);
    if (section === undefined) {
      continue;
    }
    if (SECTIONS.indexOf(section) < SECTIONS.indexOf(previous)) {
      const { line } = source.getLineAndCharacterOfPosition(statement.getStart(source));
      return `${file}:${script.loc.start.line + line}: ${section} after ${previous} (order: ${SECTIONS.join(" → ")})`;
    }
    previous = section;
  }
  return undefined;
}

for (const file of globSync("src/**/*.vue").toSorted()) {
  const violation = firstViolation(file);
  if (violation !== undefined) {
    process.stderr.write(`${violation}\n`);
    process.exit(1);
  }
}
