# language-tools-script-setup

- Project: vuejs/language-tools (MIT, https://github.com/vuejs/language-tools/blob/9ce2a7b6bb603cfc067964db29e4845a1f9fb28d/LICENSE)
- Merge commit: 9ce2a7b6bb603cfc067964db29e4845a1f9fb28d (https://github.com/vuejs/language-tools/commit/9ce2a7b6bb603cfc067964db29e4845a1f9fb28d) — parents: ours 4f80be8dcc1944b58dd6b397a388fc1503f97daa, theirs dbcb7de7ad569057fe77d49f1d1b3ac8b4ec53d4; merge base 90f82073b666cce5c7480689eecb398979b973aa
- File: packages/language-core/lib/codegen/script/scriptSetup.ts
- Lines (base/local/remote): 619/613/639
- Why this case: Two conflicts separated by a single unchanged line (`}`), after four local-only changes earlier in the file.

## Compare in PhpStorm

    scripts/golden-repo.sh language-tools-script-setup /tmp/yamt-golden/language-tools-script-setup
    # then open /tmp/yamt-golden/language-tools-script-setup in PhpStorm → Git → Resolve Conflicts → Merge…

or, with the PhpStorm command-line launcher:

    phpstorm merge tests/golden/language-tools-script-setup/local.ts tests/golden/language-tools-script-setup/remote.ts tests/golden/language-tools-script-setup/base.ts /tmp/yamt-language-tools-script-setup-result.ts

## Compare with yamt

    cargo run -q -p yamt-cli -- classify tests/golden/language-tools-script-setup/base.ts tests/golden/language-tools-script-setup/local.ts tests/golden/language-tools-script-setup/remote.ts
