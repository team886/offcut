# Step one — provider discovery

Every `?` in the design document closes here. The purpose is to **replace assumptions with measurements**.

## How

Open a conversation on the provider — ideally one containing at least two code blocks, a document or canvas, and a tool call. Run the contents of `tools/discover.js` in the DevTools console and transfer the output into the table below.

The script **reads no content**: it prints counts, key names and structural facts only. Its single network call goes to the origin you already have open, read-only.

## Matrix to fill

| Provider | DOM reachable | Code blocks | Panel / canvas | Versions | Attachments | API tier | `chatRoot` |
|---|---|---|---|---|---|---|---|
| Claude | ? | ? | ? | ? | ? | ? | ? |
| ChatGPT | ? | ? | ? | ? | ? | ? | ? |
| Gemini | ? | ? | ? | ? | ? | ? | ? |
| Perplexity | ? | ? | ? | ? | ? | ? | ? |

## Additional checks for Claude

The deepest part of the design rests on Claude's op-log. None of the parser gets written before these are measured:

1. **`tool_use` schema** — the field names inside `input` (`id` or `identifier`, `content` or `new_content`)
2. **Tree fields** — is `parent_message_uuid` present, is `current_leaf_message_uuid` present
3. **Byte fidelity** — is tier 1 output identical **byte for byte** to what the provider's own copy button yields (design §4.1). If not, the claim that tier 1 is raw collapses, and it would also explain `old_str` mismatches
4. **Completeness** — on a 200-message conversation, does the API return every message or a window (design §4.1)
5. **Version numbering** — does our fold counter agree with the panel's "Version N" (design §8.2)

## Other checks

6. **`showDirectoryPicker`** — can it be called from a content script's isolated world (design §8.7.2). If not, the picker moves to the options page
7. **`lastActiveOrg` cookie** — is it `HttpOnly` (design §4). If it is, the try-each-org path always carries the work
8. **Injection crash test** — with the button injected, force repeated re-renders (switch version, resize the panel, send a message, change tabs) and watch the console for `NotFoundError` (design §7 step 2). If it fires, plan B is a body-anchored aligned layer

## Output

When this step is done the capability matrix has no `?` left, and any capability that could not be verified is **switched off** for that provider. Only then does an adapter get written.
