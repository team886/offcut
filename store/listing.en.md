# Store listing — EN — **v1.0**

> Describes v1.0 and nothing else. Every release updates this file; the eventual shape of the product is in `listing.target.en.md`. See §19.5's pre-release gate: the description must match what the submitted version actually does.

## Name (store name field)
Offcut — AI Chat Downloader

## Short description (132 char limit)
Save the code blocks in your AI chats as real files, with the right extension and a name that means something.

*(108 characters)*

## Long description

**What it does**

A code block in an AI chat is text on a page. To use it you select it, copy it, make a new file, guess the extension and invent a name. Offcut makes it a file.

- **The right extension**, from the language of the block — `.py`, `.ts`, `.sql`, `.sh` and the rest.
- **A name derived from the code itself.** A filename inside the fence wins; otherwise the first real definition in the code (`parseInvoice` → `parse-invoice.ts`), otherwise the heading above the block, otherwise a numbered fallback. Where it cannot tell, it says so with a plain `code-4.js` rather than inventing something that looks deliberate.
- **Rename before you download.** The name comes from a heuristic and a heuristic can be wrong, so click it and fix it. The extension stays fixed — a wrong extension fails silently.
- **Copy instead**, when the text is what you actually wanted.
- **A control on the block itself**, showing the filename it will produce before you commit to it, plus `Alt+Shift+D` for the most recent block.

**Where it works**

Claude, ChatGPT, Gemini, Perplexity, DeepSeek, Mistral, Grok, Copilot, Kimi, Qwen, Z.ai and T3 — twelve chat interfaces, on their conversation pages.

**What this version does not do**

Said plainly, because a downloader that quietly ignores half of what a chat produces is worse than one that tells you where its edges are:

- Documents, artifacts and canvases, and their version history — **not yet**
- Attachments, tool outputs, citations and generated images — **not yet**
- Whole-conversation export, folder saving, drag and drop, bulk zip, download history — **not yet**

Those are the next versions, in that order.

**Privacy**

No external requests. No telemetry. No account. No server. Offcut reads the conversation page you have open — there is no other way to find what can be downloaded — and everything it reads stays in the tab. The only thing it stores is your settings.

That is what the "read and change your data" notice at install refers to, and it applies only to the twelve sites listed above.

---

Not affiliated with Anthropic, OpenAI, Google, Perplexity, DeepSeek, Mistral, xAI, Microsoft, Moonshot, Alibaba, Z.ai or T3; their names are used only to identify the supported services.

Report an issue: team@katatechnology.co
