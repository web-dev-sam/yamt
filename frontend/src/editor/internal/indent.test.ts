import { expect, test } from "vitest";

import { indentUnitOf } from "./indent";

const TS_TWO = `import { a } from "./a";

export function f(x: number): number {
  if (x > 0) {
    return a(x);
  }
  return 0;
}
`;

const PHP_DOC = `<?php

/**
 * A greeter.
 */
class Greeter
{
    /**
     * @var string
     */
    private $name;
    /**
     * @var int
     */
    private $count;
    /**
     * @param string $name
     */
    public function greet($name)
    {
        if ($name) {
            return "hi " . $name;
        }
        return "hi";
    }
}
`;

const TABS = "func f() {\n\tif x {\n\t\treturn 1\n\t}\n\treturn 0\n}\n";

const TABS_WITH_JSDOC = `/**
 * Returns one.
 *
 * Used by tests.
 */
func f() {
\treturn 1
}
`;

const TWO_WITH_BLANKS = `function f() {
  if (x) {
    a();

    b();

    c();
    
    d();

    e();
  }
}
`;

const MOSTLY_FOUR = `class A:
    def f(self):
        call(a,
          b)
        if x:
            return 1
        return [
          2,
        ]
`;

test("a two-space TypeScript text indents by two spaces", () => {
  expect(indentUnitOf(TS_TWO)).toBe("  ");
});

test("a four-space PHP text whose doc comments step by one space indents by four spaces", () => {
  expect(indentUnitOf(PHP_DOC)).toBe("    ");
});

test("a tab-indented text indents with a tab", () => {
  expect(indentUnitOf(TABS)).toBe("\t");
});

test("a tab-indented text whose doc comment has more lines than its tab-led lines indents with a tab", () => {
  expect(indentUnitOf(TABS_WITH_JSDOC)).toBe("\t");
});

test("blank and whitespace-only lines between deeper statements do not count as steps", () => {
  expect(indentUnitOf(TWO_WITH_BLANKS)).toBe("  ");
});

test("a text without indentation indents by two spaces", () => {
  expect(indentUnitOf("a\nb\nc\n")).toBe("  ");
});

test("the most common step wins over a few smaller ones", () => {
  expect(indentUnitOf(MOSTLY_FOUR)).toBe("    ");
});
