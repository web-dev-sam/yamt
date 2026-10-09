# vueuse-use-magic-keys

- Project: vueuse/vueuse (MIT, https://github.com/vueuse/vueuse/blob/26b3eb570b09c104f68246b3d19013ee00c202f9/LICENSE)
- Merge commit: 26b3eb570b09c104f68246b3d19013ee00c202f9 (https://github.com/vueuse/vueuse/commit/26b3eb570b09c104f68246b3d19013ee00c202f9) — parents: ours 1a4e0ad8d42dee1adf519b536ae9148a791537b2, theirs 27fbca9b681031bedc3b053d32c22b62fea2e19b; merge base 428f5027eac25cbc7ef463d22e42d13fe5562c89
- File: packages/core/useMagicKeys/index.ts
- Lines (base/local/remote): 170/168/186
- Why this case: Local and remote changes interleaved 2-3 unchanged lines apart (base lines: local 103/105/107/115, remote 110/111) above one conflict.

## Compare in PhpStorm

    scripts/golden-repo.sh vueuse-use-magic-keys /tmp/yamt-golden/vueuse-use-magic-keys
    # then open /tmp/yamt-golden/vueuse-use-magic-keys in PhpStorm → Git → Resolve Conflicts → Merge…

or, with the PhpStorm command-line launcher:

    phpstorm merge tests/golden/vueuse-use-magic-keys/local.ts tests/golden/vueuse-use-magic-keys/remote.ts tests/golden/vueuse-use-magic-keys/base.ts /tmp/yamt-vueuse-use-magic-keys-result.ts

## Compare with yamt

    cargo run -q -p yamt-cli -- classify tests/golden/vueuse-use-magic-keys/base.ts tests/golden/vueuse-use-magic-keys/local.ts tests/golden/vueuse-use-magic-keys/remote.ts
