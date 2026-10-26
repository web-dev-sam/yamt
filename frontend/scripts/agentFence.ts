import ts from "typescript";

type AgentViolation = {
  readonly rule: "PM9";
  readonly file: string;
  readonly specifier: string;
  readonly reason: string;
};

const AGENT_BUILDERS: Readonly<Record<string, true>> = {
  createTauriAgentSource: true,
  createFixtureAgentSource: true,
  AgentClient: true,
};
const AGENT_HOME = "src/main.ts";
const TEST_FILE = /\.test\.ts$/;

function agentBuilds(text: string): string[] {
  const builds: string[] = [];
  function visit(node: ts.Node): void {
    const callee = ts.isCallExpression(node) || ts.isNewExpression(node) ? node.expression : null;
    const name = callee !== null && ts.isPropertyAccessExpression(callee) ? callee.name : callee;
    if (name !== null && ts.isIdentifier(name) && Object.hasOwn(AGENT_BUILDERS, name.text)) {
      builds.push(name.text);
    }
    ts.forEachChild(node, visit);
  }
  visit(ts.createSourceFile("script.ts", text, ts.ScriptTarget.Latest, true));
  return builds;
}

export function agentViolations(path: string, texts: readonly string[]): AgentViolation[] {
  if (path === AGENT_HOME || TEST_FILE.test(path)) {
    return [];
  }
  return texts.flatMap(agentBuilds).map((build) => ({
    rule: "PM9",
    file: path,
    specifier: build,
    reason: "the agent source and client are built only in main.ts (plan §2 #108)",
  }));
}
