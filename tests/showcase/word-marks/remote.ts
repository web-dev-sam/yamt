// Word marks: one block per case of docs/slices/briefs/1.A-line-paired-word-marks.md.
// One-sided cases alternate between local (left) and remote (right); X* and M13/M14 are conflicts.

// C1 renamed property (local)
if (obj.a) {

// C2 condition grows (remote)
if (obj.renamed && obj.new)

// C3 argument added (local)
foo(a, b)

// C4 argument removed (remote)
foo(a, c)

// C5 string grows (local)
const label = 'Save';

// C6 number changed (remote)
timeout: 3000,

// C7 optional chaining (local)
return user.profile.name;

// C8 await added (remote)
const data = await fetchUser(id);

// C9 types added (local)
function load(id) {

// C10 value wrapped (remote)
return ref(value);

// C11 condition negated (local)
if (isReady) {

// C12 operator changed (remote)
if (a !== b) {

// C13 variable renamed (local)
const count = list.length;

// C14 import added (remote)
import { ref, computed, watch } from 'vue';

// C15 import removed (local)
import { ref, computed, watch } from 'vue';

// C16 attribute added (remote)
<button :disabled="busy" @click="save">

// C17 JSX expression changed (local)
<Item key={id} label={name} />

// C18 PHP method renamed (remote)
$name = $user->getFullName();

// C19 PHP parameter added (local)
public function save(array $data)

// C20 trailing comma added (remote)
  b: 2,

// C21 semicolon removed (local)
return x;

// C22 comment grows (remote)
// TODO: fix this before release

// C23 dedented (local)
		let x = 1;

// C24 indented (remote)
		let x = 1;

// C25 spaces to tab (local)
    foo();

// C26 dedented and changed (remote)
	let x = 2;

// C27 indentation removed (local)
	foo();

// C28 inner spaces removed (remote)
foo(a)

// C29 single word replaced (local)
return a;

// C30 symbol added to a wordless line (remote)
};

// C31 else added after a closing brace (local)
}

// C32 options added before a closing call (remote)
}, { passive });

// N1 unrelated statement (local)
let emitted = false;

// N2 condition sharing only `if` (remote)
if (scriptSetupRanges.defineModel.length) {

// N3 unrelated call (local)
yield `${macro}, `;

// N4 call sharing only closing symbols (remote)
foo(a, b);

// M1 wrapped in a condition (remote)
if (ok) {
	a();
	b();
}

// M2 unwrapped from a condition (local)
if (ok) {
	a();
	b();
}

// M3 line inserted between changed lines (remote)
a(2);
log();
b(2);

// M4 line removed between changed lines (local)
a(1);
b();
c(1);

// M5 line split (remote)
foo(a,
	b)

// M6 lines joined (local)
foo(a,
	b)

// M7 lines swapped (remote)
b();
a();

// M8 block rewritten without shared words (local)
alpha();
beta();
gamma();

// M9 nest dedented (remote)
	x();
	}
}

// M10 blank line removed after a change (local)
a(1);


// M11 same rename on every line (remote)
account.name;
account.age;
account.id;

// X1 conflict: C8 await added (local) vs C13 variable renamed (remote)
const user = fetchUser(id);

// X2 conflict: C15 import removed (local) vs C14 import added (remote)
import { ref, computed, watch, onMounted } from 'vue';

// X3 conflict: C23 dedented (local) vs C29 single word replaced (remote)
		let x = 2;

// X4 conflict: M1 wrapped in a condition (local) vs M3 line inserted (remote)
save(2);
notify();
load(2);

// X5 conflict: N1 unrelated statement (local) vs C29 single word replaced (remote)
return b;

// X6 conflict: C2 condition grows (local) vs C11 condition negated (remote)
if(!obj.a)

// M13 conflict: M2 unwrapped (local) vs C14 import added + M3 line inserted (remote)
import { ref, computed, watch } from 'vue';
if (ok) {
	a(2);
	log();
	b(2);
}

// M14 conflict: the shape of language-tools-script-setup chunk 3 (vuejs/language-tools, MIT)
	if (options.vueCompilerOptions.target >= 3.3) {
		const scriptSetup = options.scriptSetup;
		const scriptSetupRanges = options.scriptSetupRanges;
		if (!scriptSetup || !scriptSetupRanges) {
			return;
		}

		const usedMacros: { canonical: string; alias: string }[] = [];
		const add = (canonical: string, exp: TextRange | undefined) => {
			if (exp) {
				usedMacros.push({ canonical, alias: getRangeText(scriptSetup, exp) });
			}
		};
		add('defineProps', scriptSetupRanges.defineProps?.exp);
		add('defineEmits', scriptSetupRanges.defineEmits?.exp);
		add('defineSlots', scriptSetupRanges.defineSlots?.exp);
		add('defineExpose', scriptSetupRanges.defineExpose?.exp);
		add('withDefaults', scriptSetupRanges.withDefaults?.exp);
		if (scriptSetupRanges.defineModel.length) {
			usedMacros.push({ canonical: 'defineModel', alias: 'defineModel' });
		}
		if (scriptSetupRanges.defineOptions) {
			usedMacros.push({ canonical: 'defineOptions', alias: 'defineOptions' });
		}

		const toImport = usedMacros.filter(({ alias }) => !options.setupBindings.has(alias));

		if (toImport.length) {
			yield `import { `;
			for (const { canonical, alias } of toImport) {
				yield alias === canonical ? `${canonical}, ` : `${canonical} as ${alias}, `;
			}
			yield `} from '${options.vueCompilerOptions.lib}'${endOfLine}`;
		}

// end
