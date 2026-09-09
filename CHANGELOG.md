# Changelog

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) · Versioning: [SemVer](https://semver.org/)

Every released version records the SHA-256 of its package here, so that the archive in the store can be verified against the commit it was built from (design document, section 19.4).

## [1.0.0] — unreleased

The MVP: **code blocks, on every provider in the registry.** No documents, no versions, no attachments — those are v2.0 (`docs/ROADMAP.md`). What this version does, it does on all twelve providers rather than on one.

### Added

- **Downloading code blocks.** A floating control appears on a conversation carrying code; it shows the filename it will produce before you take it. Also `Alt+Shift+D`, and a per-row button in the popup.
- **Twelve providers** — Claude, ChatGPT, Gemini, Perplexity, DeepSeek, Mistral, Grok, Copilot, Kimi, Qwen, Z.ai, T3. A registry row is all a provider needs for code blocks; adapters are only required for documents and versions (`docs/ADDING-A-PROVIDER.md`).
- **Filenames that mean something.** A four-step chain — an explicit name in the block, the preceding heading, the first meaningful identifier in the code, then a numbered fallback — with a template (`{title}` `{version}` `{date}` `{ext}`) and a live preview computed from a real item rather than a placeholder.
- **Rename before downloading.** A heuristic can always be wrong, so the name is editable in place in the popup. The extension is not editable: a wrong extension is a silent error.
- **Copy, as well as download.** Often the text is what you need, and download-open-copy is three steps.
- **A popup that works from the keyboard.** ↑/↓, `Enter` to download, `C` to copy, `E` to rename, `Escape` unwinding one level at a time; `role="listbox"` and a live filter count. This is the accessible path to code blocks, so it is specified rather than assumed.
- **Turkish and English**, through `chrome.i18n`.
- **Copyable diagnostics.** There is no telemetry, so a bug report needs a block the user can paste: provider, counts, what resolved and what did not.
- **Disable per site**, and a registry row can be switched off without touching the permission list.

### Fixed

- **The ZIP writer produced archives no reader would open.** The End of Central Directory record stated a directory size 12 bytes too large — `off` had already advanced past the EOCD's own leading fields when the size was computed — so a reader walking back from the EOCD landed short of the signature. Found by opening a packaged build with an independent reader; the three separate field assertions in the test suite were each correct on their own. Two tests were added: one for the size field, one that walks the directory the way a reader does.

### Notes

- No telemetry, no external requests, no account. CI gate 8 checks that mechanically: no source file may name a host outside the registry origins.
- `chrome.storage.sync`, falling back silently to `storage.local` — losing settings is not a price worth paying for synchronisation.
- Package: run `node tools/pack.mjs`; the SHA-256 it prints belongs in this entry at release.

## [Unreleased — before 1.0.0]

### Added
- Design document and deliverables: store copy in both languages, privacy policy, permission justifications, screenshot list, design screens
- Provider discovery script (`tools/discover.js`) — turns the open items in the capability matrix into one console run
- Contributor documentation: adding a provider, breakage runbook, known limitations, monthly smoke test

### Added (code)
- `src/parse.js` — the pure core: sanitize, extension mapping, filename templates, the code-block naming chain, the version fold and its edge cases, multiset line delta, Item validation
- `src/zip.js` — store-only ZIP writer, byte-denominated, conservative header shape
- `selftest.js` — assertions pinning the decisions the design argues for
