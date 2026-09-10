# Offcut

**Extract, version, move and reuse the code, documents and files your AI chats produce.**

What an AI chat produces stays inside the chat. You copy a code block, paste it into an editor, guess the extension. If you want an earlier version of a document there is no way back. If a tool returned 200 rows, the interface shows you ten.

Offcut turns these into files — on Claude, ChatGPT, Gemini, Perplexity and the other chat interfaces in the registry.

## What it captures

| Kind | Note |
|---|---|
| Code blocks | Correct extension, name derived from the code itself (`backfill.py`) |
| Documents / canvases | Every version separately, with the line difference between them (`+12 −3`) |
| Tool / MCP outputs | The whole result rather than the truncated view, with the call parameters |
| Citations | Source list as its own file where the chat searched the web |
| Generated images | Named from the prompt that produced them |
| Attachments | What you uploaded and what was produced, in separate groups |
| The conversation | As Markdown; optionally continued on another provider |

You can drag a file straight into your editor, save to a fixed folder, or take a selection as one zip.

## With MCP agents

Anything an MCP server produces — Linear, Sentry, GA4, FindAgent agents, one you wrote yourself — lands inside the conversation, which makes it an ordinary item to Offcut. You can download an agent's output in full, with the call parameters that produced it. No integration required.

## Install

Not in the store yet. Development install:

```
chrome://extensions → Developer mode → Load unpacked → this folder
```

## Privacy

No external requests. No telemetry. No account. Everything it reads stays in your browser. Nothing is stored beyond your settings, and download history is **off by default**.

This is not a promise but a constraint verified on every release: CI checks that the source contains no address outside the permitted chat sites and refuses to build the package otherwise. → [store/privacy.en.md](store/privacy.en.md)

## Development

```
node selftest.js            # pure-function tests + adapter conformance suite
node tools/check-spec.mjs   # specification consistency gates
node tools/pack.mjs         # store package
```

No dependencies, no build step, no bundler.

## Documentation

| | |
|---|---|
| [Design document](docs/superpowers/specs/2026-09-09-offcut-design.md) | Decisions and their reasoning. Where to start is at the top |
| [Adding a provider](docs/ADDING-A-PROVIDER.md) | Usually one line |
| [Known limitations](docs/LIMITATIONS.md) | What it cannot do, and why |
| [Breakage runbook](docs/BREAKAGE.md) | Symptom → diagnosis → fix |
| [Provider discovery](docs/DISCOVERY.md) | Step one: replacing assumptions with measurements |
| [Design screens](docs/design/) | Visual evidence for the decisions |

## Licence

MIT — Ömer Faruk Ceylandağ (Kata Technology)

Not affiliated with Anthropic, OpenAI, Google or Perplexity; their names are used only to identify the supported services.

Report an issue: **team@katatechnology.co**
