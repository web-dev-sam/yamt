// Word marks: one block per case of docs/slices/briefs/1.A-line-paired-word-marks.md.
// One-sided cases alternate between local (left) and remote (right); X* and M13/M14 are conflicts.

// C1 renamed property (local)
if (obj.renamed) {

// C2 condition grows (remote)
if(obj.a)

// C3 argument added (local)
foo(a, b, c)

// C4 argument removed (remote)
foo(a, b, c)

// C5 string grows (local)
const label = 'Save changes';

// C6 number changed (remote)
timeout: 300,

// C7 optional chaining (local)
return user.profile?.name;

// C8 await added (remote)
const data = fetchUser(id);

// C9 types added (local)
function load(id: string): Promise<User> {

// C10 value wrapped (remote)
return value;

// C11 condition negated (local)
if (!isReady) {

// C12 operator changed (remote)
if (a === b) {

// C13 variable renamed (local)
const size = list.length;

// C14 import added (remote)
import { ref, computed } from 'vue';

// C15 import removed (local)
import { ref, watch } from 'vue';

// C16 attribute added (remote)
<button @click="save">

// C17 JSX expression changed (local)
<Item key={item.id} label={name} />

// C18 PHP method renamed (remote)
$name = $user->getName();

// C19 PHP parameter added (local)
public function save(array $data, bool $force = false)

// C20 trailing comma added (remote)
  b: 2

// C21 semicolon removed (local)
return x

// C22 comment grows (remote)
// TODO: fix this

// C23 dedented (local)
	let x = 1;

// C24 indented (remote)
	let x = 1;

// C25 spaces to tab (local)
	foo();

// C26 dedented and changed (remote)
		let x = 1;

// C27 indentation removed (local)
foo();

// C28 inner spaces removed (remote)
foo( a )

// C29 single word replaced (local)
return b;

// C30 symbol added to a wordless line (remote)
}

// N1 unrelated statement (local)
const scriptSetup = options.scriptSetup;

// N2 condition sharing only `if` (remote)
if (!options.setupBindings.has(macro)) {

// N3 unrelated call (local)
usedMacros.push({ canonical, alias });

// M1 wrapped in a condition (remote)
a();
b();

// M2 unwrapped from a condition (local)
a();
b();

// M3 line inserted between changed lines (remote)
a(1);
b(1);

// M4 line removed between changed lines (local)
a(2);
c(2);

// M5 line split (remote)
foo(a, b)

// M6 lines joined (local)
foo(a, b)

// M7 lines swapped (remote)
a();
b();

// M8 block rewritten without shared words (local)
one = 1;
two = 2;
three = 3;

// M9 nest dedented (remote)
		x();
		}
	}

// M10 blank line removed after a change (local)
a(2);

// M11 same rename on every line (remote)
user.name;
user.age;
user.id;

// X1 conflict: C8 await added (local) vs C13 variable renamed (remote)
const data = await fetchUser(id);

// X2 conflict: C15 import removed (local) vs C14 import added (remote)
import { ref, watch } from 'vue';

// X3 conflict: C23 dedented (local) vs C29 single word replaced (remote)
	let x = 1;

// X4 conflict: M1 wrapped in a condition (local) vs M3 line inserted (remote)
if (ready) {
	save(1);
	load(1);
}

// X5 conflict: N1 unrelated statement (local) vs C29 single word replaced (remote)
throw new Error('gone');

// X6 conflict: C2 condition grows (local) vs C11 condition negated (remote)
if (obj.renamed && obj.new)

// M13 conflict: M2 unwrapped (local) vs C14 import added + M3 line inserted (remote)
import { ref, computed } from 'vue';
a(1);
b(1);

// M14 conflict: the shape of language-tools-script-setup chunk 3 (vuejs/language-tools, MIT)
	let emitted = false;
	for (const macro of Object.keys(options.vueCompilerOptions.macros)) {
		if (!options.setupBindings.has(macro)) {
			if (!emitted) {
				yield `// @ts-ignore${newLine}import { `;
				emitted = true;
			}
			yield `${macro}, `;
		}
	}
	if (emitted) {
		yield `} from '${options.vueCompilerOptions.lib}'${endOfLine}`;

// end
