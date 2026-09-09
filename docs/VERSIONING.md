# Versioning

## Why the usual definition does not apply

Semver's contract is written for a consumer who chooses when to upgrade. An extension user has no such choice: Chrome updates silently, everyone is on the newest version within hours, and there is no way to pin one. "Breaking change" in the dependency sense therefore has nobody to warn.

Two readers remain, and the scheme is designed for them:

- **The person reading the changelog or the store's "What's new".** They want to know whether this release changes what the product *is*, or only what it does better.
- **The person deciding what a release is allowed to contain.** A version number that means something constrains scope; one that increments arbitrarily does not.

## The axis: what the product depends on

The dominant risk in this product is not our own code. It is that a provider changes its interface and a tier drops out (§12). So the major number tracks **the number of things outside our control that we depend on**.

### MAJOR — the product takes on a new dependency it does not own

A new provider-internal contract, or a new surface with its own runtime.

- **v2.0** introduces adapters, the API tier and the op-log fold. Before it, the only assumption is `pre > code`; after it we depend on Claude's conversation schema, its branch fields and its artifact command shape. The number of ways this can break rises sharply, and that is what the user is being told.
- **v3.0** leaves the browser. A local MCP server has its own lifecycle, its own security surface and its own way of failing.

### MINOR — new capability on machinery already present

The user gains something; nothing they knew stops working, and no new external contract is signed.

- v1.1 (bulk, folder saving), v1.2 (history), v2.1 (tool outputs, citations, images, transfer). v2.1 adds four item kinds and is still a minor, because every one of them is read through the adapter and API tier that v2.0 already brought in.
- **A new registry provider is a minor.** A row is a selector, and it buys the whole baseline (§3.4).

### PATCH — repairs and adjustments

A provider changed a class name and the row was updated. A bug. A translation. A tunable threshold moved (§11.1). Nothing the user has to learn.

## What forces a MAJOR regardless of diff size

Three changes can hurt a user who never asked for anything. Any of them is a major, even if the code change is four lines:

1. **A new permission.** Chrome **disables the extension** until the user re-approves it. Nothing else in a release can do that much damage, and a silent auto-update turning the extension off is the worst outcome this product has. Optional permissions requested at the moment of use (`notifications`, extra hosts) do not count — they are asked for in context and a refusal is handled.
2. **A `cfg` schema change that drops or reinterprets a key.** Missing fields are filled from defaults (§9), so *adding* is free. Changing what an existing key means is not: the user's settings silently start doing something else.
3. **Removing a registry provider, or a filename template token changing meaning.** Someone's files stop landing where they expect, with no message.

## What Chrome requires, which overrides taste

The store validates `version` before anything else:

- One to four dot-separated integers, each `0`–`65535`, no leading zeros.
- **No prerelease suffix.** `1.1.0-beta` is rejected outright — semver's `-` syntax does not exist here.
- Strictly increasing, forever. A version number, once published, can never be reused, even if that release is taken down.

The fourth component cannot serve as a prerelease marker, because `1.1.0.1` sorts *after* `1.1.0` rather than before it — a candidate numbered that way would have to be published after the release it precedes. Release candidates therefore go to a **separate unlisted store item**, and this repository's numbers stay linear: every version here is a version that shipped.

`version_name` carries the human label (`"1.1.0 beta 2"`) while `version` stays numeric. Use it for anything a person should read; never encode meaning in `version` itself.

## The release, mechanically

`node tools/release.mjs <major|minor|patch>` does the whole thing and refuses if any part is not ready:

1. Working tree must be clean, and `CHANGELOG.md` must have an `## [Unreleased]` section with something in it. A release with nothing to say is not a release.
2. Bumps `manifest.json`, renames the `Unreleased` heading to the new version and today's date.
3. Runs every gate — self-test, invariants, spec.
4. Packs, opens the archive to prove it opens, and writes the SHA-256 into the entry.
5. Commits and tags `vX.Y.Z`.

Gate 7 already pins `manifest.version` to the top changelog entry, and gate 17 checks the number is Chrome-legal and greater than the newest tag. The policy above is a decision; these two are what stop it drifting.

## Deciding the bump

One question, in order, and the first "yes" wins:

1. Does this release add a permission, drop a provider, or change what a `cfg` key means? → **major**
2. Does it depend on something outside our control that we did not depend on before? → **major**
3. Can the user do something they could not do before? → **minor**
4. Otherwise → **patch**
