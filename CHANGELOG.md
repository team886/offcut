# Changelog

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) · Versioning: [SemVer](https://semver.org/)

Every released version records the SHA-256 of its package here, so that the archive in the store can be verified against the commit it was built from (design document, section 19.4).

## [Unreleased]

### Added
- Design document and deliverables: store copy in both languages, privacy policy, permission justifications, screenshot list, design screens
- Provider discovery script (`tools/discover.js`) — turns the open items in the capability matrix into one console run
- Contributor documentation: adding a provider, breakage runbook, known limitations, monthly smoke test

### Added (code)
- `src/parse.js` — the pure core: sanitize, extension mapping, filename templates, the code-block naming chain, the version fold and its edge cases, multiset line delta, Item validation
- `src/zip.js` — store-only ZIP writer, byte-denominated, conservative header shape
- `selftest.js` — 38 assertions, each pinning a decision the design argues for

### Notes
- Step 2 of the implementation order is done. Steps 3–5 (manifest, content.js core, common-dom.js) are next; MVP is steps 1–5.
