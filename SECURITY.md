# Security

## Reporting

Please do not open a public issue for a vulnerability. Magpie reads users' private conversations, so a flaw needs to be closed quietly before it has an audience.

**team@katatechnology.co** — put `SECURITY` in the subject.

You will get an acknowledgement within 72 hours. Once a fix ships you will be credited in the release notes if you want to be.

## Scope

The surfaces that matter here:

| Surface | Risk |
|---|---|
| Item titles and content written into the DOM | XSS — model output is untrusted data. Rule: `textContent` only, never `innerHTML` |
| Filename generation | Path traversal — `sanitize` strips `/`, `\`, `..` and a leading `~` |
| Network | No requests to any external origin. CI verifies on every release that the source contains no address outside the permitted set |
| Messaging | No `window` message listener, `externally_connectable` undeclared |
| Remote code | None — no CDN, no `eval`, no `new Function` |
| Publisher account | The Web Store account is the real supply chain: hardware-backed 2FA required, and CI is never granted publish rights |

Detail: design document, section 17.

## Out of scope

- Vulnerabilities in the providers' own sites — report those to them
- Someone with physical access to the user's unlocked browser; the browser already has that data
- Social engineering
