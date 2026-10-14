# Survivors on lines changed by 2ed501d (just mutants 3277bf0)

[Survived] ConditionalExpression src/lsp/index.ts:153:59
-           this.#retired = this.#retired.filter((retired) => retired !== server);
+           this.#retired = this.#retired.filter((retired) => true);
Tests ran:
    rule 2: a user stop survives setSpecs, even with startOnOpen, until start
    haltAll stops every run without a user stop; Start on open starts them again
    haltAll shows a crashed server as stopped and tells onChange listeners
  and 16 more tests!

[Survived] BlockStatement src/lsp/index.ts:152:37
-         void server.halt().then(() => {
-           this.#retired = this.#retired.filter((retired) => retired !== server);
-         });
+         void server.halt().then(() => {});
Tests ran:
    rule 2: a user stop survives setSpecs, even with startOnOpen, until start
    haltAll stops every run without a user stop; Start on open starts them again
    haltAll shows a crashed server as stopped and tells onChange listeners
  and 16 more tests!

[Survived] MethodExpression src/lsp/index.ts:153:25
-           this.#retired = this.#retired.filter((retired) => retired !== server);
+           this.#retired = this.#retired;
Tests ran:
    rule 2: a user stop survives setSpecs, even with startOnOpen, until start
    haltAll stops every run without a user stop; Start on open starts them again
    haltAll shows a crashed server as stopped and tells onChange listeners
  and 16 more tests!

[Survived] StringLiteral src/ui/serverSetup.ts:43:8
-     yes: "start",
+     yes: "",
Ran all tests for this mutant.

[Survived] StringLiteral src/ui/serverSetup.ts:44:7
-     no: "dontStart",
+     no: "",
Ran all tests for this mutant.

[Survived] ObjectLiteral src/ui/serverSetup.ts:42:74
-   const STORED_REPLIES: Readonly<Record<Reply, RepositoryAnswer | null>> = {
-     yes: "start",
-     no: "dontStart",
-     dismissed: null,
-   };
+   const STORED_REPLIES: Readonly<Record<Reply, RepositoryAnswer | null>> = {};
Ran all tests for this mutant.

[Survived] StringLiteral src/ui/serverText.ts:36:30
-   export const NOT_INSTALLED = "Not installed";
+   export const NOT_INSTALLED = "";
Ran all tests for this mutant.
