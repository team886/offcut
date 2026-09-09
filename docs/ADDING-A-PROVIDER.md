# Adding a provider

Usually **one line**. An adapter is only needed when the provider offers documents or canvases, version history, attachments, or a conversation API.

## 1. Is it reachable? (precondition, not optional)

Open a conversation on the provider and run the contents of `tools/discover.js` in the DevTools console. These must hold:

- `frames.inIframe: false` — the conversation is in the top frame
- `codeBlocks.count` matches the number of blocks actually on the page (a mismatch suggests a closed shadow root)
- `chatRoot` resolves to a node

If any of those fails, **the provider does not enter the registry**. A content script cannot read a closed shadow tree, and half-support costs the user, the store review and the maintenance burden all at once.

## 2. Registry row

In `src/registry.js`:

```js
{ id: "deepseek",
  host: "chat.deepseek.com",
  name: "DeepSeek",
  newChatUrl: "https://chat.deepseek.com/",
  chatRoot: null,                 // optional — the heuristic root usually suffices
  LAST_VERIFIED: "2026-09-09" }
```

Only write `chatRoot` if the heuristic picks the wrong node (use `chatRoot.tag` / `cls` from the `discover.js` output).

**Text-based selectors are forbidden.** Anything like `[aria-label="Copy"]` or a text comparison fails the CI gate — and even if it slipped through, it would silently stop working for anyone running the interface in another language. Structural markers only: hierarchy, `data-*`, `role`, icon `svg` shape.

## 3. Fixture

Add a redacted sample under `test/fixtures/<id>/`:

- The HTML of a message containing several code blocks
- A block with no declared language
- A block shorter than three lines (must be skipped)

Redaction removes conversation text, usernames, email addresses, UUIDs, and real tool or customer names. A fixture pins **structure**, not content.

## 4. Verify

```
node selftest.js
```

The adapter conformance suite runs against the new fixture too: required `Item` fields present, `kind` valid, `ext` starting with a dot, `title` sanitisable.

Then by hand: download a code block and check its name and extension, download from the popup using only the keyboard, try a touch device if you have one, and confirm the console stays clean.

## 5. Pull request

- Registry row, fixture, and one line in `docs/SMOKE.md`
- Paste the `discover.js` output into the description (structure only, no content)
- Screenshots are not needed

## When an adapter is required

Only if one of these exists: a document or canvas panel, version history, an attachment endpoint, or a conversation API.

Otherwise the baseline already provides code blocks, name and extension derivation, copying, zip, drag and drop, folder saving, history, conversation Markdown and transfer. Twenty registry providers are cheaper than four adapters — maintenance scales with the number of **adapters**, not providers.
