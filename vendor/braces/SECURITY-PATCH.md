# Local security patch

This directory vendors the MIT-licensed `braces` 3.0.3 package from
`micromatch/braces` and adds a parser limit of 100 nested braces. The package
version is marked `3.0.4` locally so npm can resolve the override; it is not an
upstream release. The guard addresses recursive stack exhaustion in
brace-expansion inputs while preserving existing expansion behavior below the
limit.

When upstream publishes a patched compatible release, remove the
`braces` override from the root `package.json`, remove this directory and the
direct `fill-range` dev dependency if nothing else needs it, then regenerate
the lockfile, rerun the dependency audit and security regression suite, and
update this note.
