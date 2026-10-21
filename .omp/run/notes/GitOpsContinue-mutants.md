# Row 8 survivors on changed lines (`47f1f0e` vs `3c13fa1`)

- NoCoverage ConditionalExpression `src/ui/continuing.ts:45:5`: `default: {` → `default:`
- NoCoverage BlockStatement `src/ui/continuing.ts:45:14`: `default: {` → `default: {}`
- Survived ConditionalExpression `src/ui/continuing.ts:58:19`: `const rewords = operation.kind === "Rebase" && operation.editor_steps_ahead;` → `const rewords = true && operation.editor_steps_ahead;`
- Survived ConditionalExpression `src/ui/continuing.ts:118:9`: `if (operation === null || continueState.value !== "ready") {` → `if (false || continueState.value !== "ready") {`
- NoCoverage ConditionalExpression `src/ui/operationText.ts:156:5`: `default: {` → `default:`
- NoCoverage BlockStatement `src/ui/operationText.ts:156:14`: `default: {` → `default: {}`
- Survived ObjectLiteral `src/ui/question.ts:124:36`: `const REWORDS_TEXT: QuestionText = {` → `const REWORDS_TEXT: QuestionText = {};`
- Survived StringLiteral `src/ui/question.ts:128:17`: `list: { kind: "none" },` → `list: { kind: "" },`
- Survived ObjectLiteral `src/ui/question.ts:128:9`: `list: { kind: "none" },` → `list: {},`
- Survived StringLiteral `src/ui/question.ts:125:10`: `title: "Commit Messages",` → `title: "",`
- Survived StringLiteral `src/ui/question.ts:127:5`: `"This step or a later one rewords or squashes a commit. yamt cannot open an editor, so that message stays as g` → `"",`
- Survived StringLiteral `src/ui/question.ts:131:11`: `cancel: "Cancel",` → `cancel: "",`
- Survived StringLiteral `src/ui/question.ts:130:12`: `confirm: "Continue rebase",` → `confirm: "",`
- Survived BooleanLiteral `src/ui/toolbarButtons.ts:60:13`: `continue: false,` → `continue: true,`
