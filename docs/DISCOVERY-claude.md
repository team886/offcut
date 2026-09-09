# Step 1 results — Claude

**Measured:** 2026-09-09, on a signed-in claude.ai session, read-only.
**Method:** structural inspection and API shape only. No conversation content was printed or retained — counts, key names and class names only.

## Reachability precondition (§3.4.4.1) — PASS

| Check | Result |
|---|---|
| Top frame | ✓ `inIframe: false` |
| Closed shadow root | ✓ none — zero custom elements on the page |
| `pre > code` present | ✓ |

Claude stays in the registry.

## API tier — CONFIRMED

| Endpoint | Result |
|---|---|
| `GET /api/organizations` | 200, an array; items carry `uuid` |
| `GET /api/organizations/{org}/chat_conversations?limit=N` | 200, array; items carry `uuid`, `name`, `current_leaf_message_uuid`, `project_uuid` |
| `GET /api/organizations/{org}/chat_conversations/{uuid}?tree=True&rendering_mode=messages` | 200 |

**`lastActiveOrg` is readable from JavaScript — it is not `HttpOnly`.** The assumption in §4 holds, so step 1 of org resolution works and the org scan is a fallback rather than the norm.

### Conversation shape

Top-level keys include `uuid`, `name`, `summary`, `model`, `created_at`, `updated_at`, `settings`, **`current_leaf_message_uuid`**, `chat_messages`.

Message keys: `uuid`, `text`, `content`, `sender`, **`index`**, `created_at`, `updated_at`, **`truncated`**, `attachments`, `files`, `sync_sources`, **`parent_message_uuid`**.

Three of these settle open questions:

- **`parent_message_uuid` and `current_leaf_message_uuid` both exist** → the active-branch walk in §3.1 is viable exactly as specified
- **`index` exists on every message** → branch ordering does not have to be derived; §3.1's "order by branch position, never by `created_at`" has a direct field
- **`truncated` exists on messages** → the server tells us when a message was cut, which feeds the completeness question in §4.1

### Content block types

Across 25 conversations only two block types appeared: **`text`** and **`thinking`**.

- `text` block keys: `start_timestamp`, `stop_timestamp`, `type`, `text`, **`citations`** → citations are a first-class field on text blocks, so §2.1.4.1 is served by the API tier rather than by scraping a collapsed list
- `thinking` block keys include `thinking`, `summaries`, `cut_off`, `truncated`, `hidden`, `thinking_hidden` → thinking blocks carry their own truncation and visibility flags

### Attachments and produced files

- `attachments[]`: `id`, `file_name`, **`file_size`**, `file_type`, `extracted_content`, `created_at`
  → **size is readable from metadata**, so §8.6 item 17 shows a real number rather than "size unknown". `extracted_content` means text attachments arrive inline and need no second request
- `files[]`: `file_uuid`, `file_name`, `file_kind`, **`preview_url`**, `thumbnail_url`, `preview_asset`, `thumbnail_asset`
  → a download path exists for produced files; the attachment endpoint question in §3.3.2 is partly closed

## Artifacts — STILL UNVERIFIED, and the reason matters

**Zero `tool_use` blocks and zero `antArtifact` markers across 25 conversations.** The artifacts schema in §4 tier 1 remains unverified because there was nothing to measure — not because the measurement failed.

In the same 25 conversations there were **360 code fences**.

That ratio is the most consequential product finding here. The MVP cut line (§ MVP) put code blocks first and artifacts second on the argument that most code never becomes an artifact. The measurement is far more lopsided than the argument assumed: on this account, artifacts are absent entirely while code blocks are everywhere.

**Consequence:** the ordering stands and is strengthened. Artifact support (steps 6–7) must not block v1.

## DOM shape

| Fact | Value |
|---|---|
| Code block structure | `pre > code` ✓ |
| Language | `class="language-json"` → the `language-*` branch of the precedence in §3.4.4 |
| `pre` class | `code-block__code` (plus Tailwind utilities) |
| `code` attribute | `data-highlight` |
| UI inside `pre` | **none** — the copy button lives outside it, so the §12.1 rule-1 cleanup has nothing to strip here |
| Message containers via `[data-testid*="message"]` | **unreliable** — 2 matched in a 22-message conversation |

Two things follow.

**Message counting cannot be trusted in the DOM tier.** This is exactly the case §2.1.1 anticipated: the handoff threshold falls back to a character total, and where neither is reliable no suggestion appears. The measurement confirms the fallback was necessary rather than defensive.

**The heuristic root has a bug** (§3.4.1). With a single code block on the page, "the nearest common ancestor of all `pre > code`" resolves to the code element itself. Measured directly: `heuristicRoot: { tag: "code" }`. The rule needs a floor — require at least two blocks, or walk up a fixed number of levels from a single one — otherwise event delegation binds to the block rather than the container. Fixed in the specification and in the implementation.

## Not measured

- The `tool_use` / artifacts schema — no artifact existed to measure
- Version numbering against the panel's indicator (§8.2) — same reason
- Byte fidelity of tier 1 against the copy button (§4.1) — needs an artifact
- Windowing on a 200+ message conversation (§4.1) — the largest conversation available had 22
- `showDirectoryPicker` from a content script (§8.7.2) — needs the extension loaded
- Injection crash behaviour (§7 step 2) — needs the extension loaded

These stay open. They do not block v1, which is code blocks.
