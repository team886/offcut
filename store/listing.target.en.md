# Store listing — EN

> **This is the TARGET listing, not the one to submit.** It describes the product at roughly v2.1 (`docs/ROADMAP.md`). The listing that ships with a release lives in `listing.en.md` / `listing.tr.md` and must describe only what that version does — the Chrome Web Store requires the description to match the functionality, and a user who installs on the strength of a feature that does not exist has been misled whether or not the store notices.

## Name (store name field)
Magpie — AI Chat Downloader

## Short description (132 char limit)
Extract, version, move and reuse the code, documents and files your AI chats produce.

*(84 characters)*

## Long description

**Why these permissions?** Magpie reads the AI conversation you have open — there is no other way to find what can be downloaded. Everything it reads stays in your browser. No requests go to any server, no data is collected, there is no analytics. That is what the "can read and change your data" notice at install refers to, and it covers only the listed chat sites.

**What it does**

What an AI chat produces stays inside the chat. You copy a code block, paste it into an editor, guess the extension. If you want an earlier version of a document there is no way back. If a tool returned two hundred rows, the interface shows you ten.

Magpie turns these into files:

- **Code blocks** — correct extension, a meaningful name derived from the code itself (`backfill.py`, `use-cart.ts`)
- **Documents and canvases** — every version separately, with the line-level difference between them shown
- **Tool and MCP outputs** — the whole result rather than the truncated view, together with the call parameters
- **Citations** — the source list as its own file where the chat searched the web
- **Generated images** — meaningfully named, one at a time or together
- **Files you uploaded and files that were produced** — downloadable again
- **The whole conversation** — as Markdown, and optionally continued on another provider

You can **drag a file straight into your editor**, save to a fixed folder, or take a selection as one zip. Turn on download history and a month later it can answer whether you already took something and whether it has changed since.

**Where it works.** Claude, ChatGPT, Gemini, Perplexity, and other chat interfaces in the registry. If you run your own (Open WebUI, LibreChat), you can grant it access to that too.

**Privacy.** No external requests. No telemetry. No account. Nothing is stored beyond your settings, and download history is only written if you turn it on yourself.

---

Not affiliated with Anthropic, OpenAI, Google or Perplexity; their names are used only to identify the supported services.

Report an issue: team@katatechnology.co
