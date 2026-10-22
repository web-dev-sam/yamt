import ts from "typescript";

type ClipboardViolation = {
  readonly rule: "PM8";
  readonly file: string;
  readonly specifier: string;
  readonly reason: string;
};

const CLIPBOARD_READERS: Record<string, true> = {
  "src/ui/linuxPaste.ts": true,
  "src/ui/linuxPaste.test.ts": true,
};
const CLIPBOARD_DATA = "clipboardData";
const CLIPBOARD = "clipboard";
const CLIPBOARD_READS: Record<string, true> = { read: true, readText: true };

function nameOf(node: ts.Node | undefined): string | undefined {
  if (node !== undefined && (ts.isIdentifier(node) || ts.isStringLiteralLike(node))) {
    return node.text;
  }
  if (node !== undefined && ts.isPropertyAccessExpression(node)) {
    return node.name.text;
  }
  return node !== undefined && ts.isElementAccessExpression(node)
    ? nameOf(node.argumentExpression)
    : undefined;
}

function readsClipboard(name: string | undefined, owner: ts.Node | undefined): boolean {
  return (
    name === CLIPBOARD_DATA ||
    (name !== undefined && Object.hasOwn(CLIPBOARD_READS, name) && nameOf(owner) === CLIPBOARD)
  );
}

function isClipboardRead(node: ts.Node): boolean {
  if (ts.isPropertyAccessExpression(node)) {
    return readsClipboard(node.name.text, node.expression);
  }
  if (ts.isElementAccessExpression(node)) {
    return readsClipboard(nameOf(node.argumentExpression), node.expression);
  }
  if (ts.isBindingElement(node)) {
    const declaration = node.parent.parent;
    const owner = ts.isVariableDeclaration(declaration) ? declaration.initializer : undefined;
    return readsClipboard(nameOf(node.propertyName ?? node.name), owner);
  }
  return false;
}

function clipboardReads(text: string): string[] {
  const source = ts.createSourceFile("script.ts", text, ts.ScriptTarget.Latest, true);
  const reads: string[] = [];
  function visit(node: ts.Node): void {
    if (isClipboardRead(node)) {
      reads.push(node.getText(source));
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  return reads;
}

export function clipboardViolations(path: string, texts: readonly string[]): ClipboardViolation[] {
  if (Object.hasOwn(CLIPBOARD_READERS, path)) {
    return [];
  }
  return texts.flatMap(clipboardReads).map((read) => ({
    rule: "PM8",
    file: path,
    specifier: read,
    reason: "only ui/linuxPaste.ts reads the clipboard through WebKit (plan §2 #99)",
  }));
}
