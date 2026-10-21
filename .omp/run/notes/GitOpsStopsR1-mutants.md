# Row 6 fix round 1 survivors on changed lines (`e4b1730` vs `2223eaa`)

- Survived StringLiteral `src/ui/operationText.ts:150:12`: `return "";` → `return "Stryker was here!";`
- NoCoverage StringLiteral `src/ui/question.ts:66:10`: `case "clash":` → `case "":`
- NoCoverage StringLiteral `src/ui/question.ts:67:10`: `case "servers":` → `case "":`
- NoCoverage ConditionalExpression `src/ui/question.ts:69:5`: `default: {` → `default:`
- NoCoverage BlockStatement `src/ui/question.ts:69:14`: `default: {` → `default: {}`
- Survived StringLiteral `src/ui/question.ts:62:10`: `case "unprocessed":` → `case "":`
- Survived StringLiteral `src/ui/question.ts:63:10`: `case "abort":` → `case "":`
- Survived BooleanLiteral `src/ui/saving.ts:60:12`: `return false;` → `return true;`
- Survived CallExpression `src/ui/saving.ts:88:5`: `clearProblemAbout(target, path);` → `;`
- Survived BooleanLiteral `src/ui/saving.ts:187:14`: `return false;` → `return true;`
- Survived BooleanLiteral `src/ui/saving.ts:194:14`: `return false;` → `return true;`
- Survived ObjectLiteral `src/ui/store.ts:129:11`: `stop: { dropped: false },` → `stop: {},`
