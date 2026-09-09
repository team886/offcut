# Magpie — Design Document

**Date:** 2026-09-09
**Status:** Design approved and taken through 30+ audit passes; awaiting an implementation plan. **The `?` cells in the capability matrix are still open** (§3.4.5) — no adapter is written before step one closes them
**Target:** Chrome MV3 extension, to be published on the Chrome Web Store
**Author:** Ömer Faruk Ceylandağ · faruk@katatechnology.co
**Support / issue reports:** team@katatechnology.co
**Scope:** artifacts and canvases, in-message code blocks, tool outputs, citations, generated images and attachments across **Claude, ChatGPT, Gemini, Perplexity** and the other providers in the registry

---

## Where to start

This document has been through more than thirty audit passes and it is long. The reading order depends on who you are:

| If you are | Read |
|---|---|
| **Implementing** | §2.1 (what the product is) → §3.3 (item model) → §3.4 (registry and adapters) → §6 (module contracts) → **Implementation order** (at the end) → §14 (tests). The MVP line is there; do not read below it yet |
| **Reviewing the design** | §3 (op-log), §4.1 (what each tier loses), §7.1–7.2 (races and lifecycle), §11 (failure matrix), §17 (security) |
| **Adding a provider** | §3.4.1 (self-healing root), §3.4.2 (unlisted sites), §12 (DOM layer), `docs/ADDING-A-PROVIDER.md` |
| **Looking for a product decision** | §2.1 (spine and scope test), §2.1.2 (naming), §4.2 (surfaces), §4.4 and §2.2 (what was declined and why) |
| **Preparing a release** | §15 (store), §17.1–17.2 (publisher account, privacy invariants), §19 (all of it) |

**One-sentence summary:** a browser extension that extracts, versions, moves and makes reusable the code, documents and files produced in AI chats; registry-based multi-provider support, zero external requests, zero telemetry.

**The invariant test:** if it can be done with data **already present** in the user's own session it is in scope; if it needs a model call, a key or a server it is not (§2.1).

---

## Contents

- [1. Problem](#1-problem)
- [2. Goals / non-goals](#2-goals-non-goals)
- [2.1 What kind of product this is — "downloader" is a narrow description](#21-what-kind-of-product-this-is-downloader-is-a-narrow-description)
  - [2.1.1 Three things that belong to the spine and are not written yet](#211-three-things-that-belong-to-the-spine-and-are-not-written-yet)
  - [2.1.2 Naming — Magpie](#212-naming-magpie)
- [2.1.3 MCP tool outputs — the fifth item kind](#213-mcp-tool-outputs-the-fifth-item-kind)
  - [2.1.3.0 The call is half the result](#2130-the-call-is-half-the-result)
  - [2.1.3.1 This is where the DOM lies most](#2131-this-is-where-the-dom-lies-most)
  - [2.1.3.2 Why this is not merely "one more kind"](#2132-why-this-is-not-merely-one-more-kind)
- [2.1.4 What else is in a conversation — citations and thinking blocks](#214-what-else-is-in-a-conversation-citations-and-thinking-blocks)
  - [2.1.4.1 Citations — on Perplexity this is the product](#2141-citations-on-perplexity-this-is-the-product)
  - [2.1.4.2 Thinking blocks — excluded by default](#2142-thinking-blocks-excluded-by-default)
  - [2.1.4.3 Generated images and code-interpreter files](#2143-generated-images-and-code-interpreter-files)
- [2.2 FindAgent integration — its shape had to be established first](#22-findagent-integration-its-shape-had-to-be-established-first)
  - [2.2.1 Observation: FindAgent is an agent platform, not a chat interface](#221-observation-findagent-is-an-agent-platform-not-a-chat-interface)
  - [2.2.2 Concretely, how it would be used — one of four already works](#222-concretely-how-it-would-be-used-one-of-four-already-works)
- [3. The critical insight — an artifact is an op-log](#3-the-critical-insight-an-artifact-is-an-op-log)
  - [3.0.1 Edge cases in the fold](#301-edge-cases-in-the-fold)
  - [3.1 The conversation tree — the branching trap](#31-the-conversation-tree-the-branching-trap)
  - [3.2 An artifact still being written](#32-an-artifact-still-being-written)
  - [3.3 The downloadable item model](#33-the-downloadable-item-model)
  - [3.3.1 Code blocks](#331-code-blocks)
  - [3.3.2 Attachments](#332-attachments)
  - [3.3.3 Moving a conversation — Markdown and "continue elsewhere"](#333-moving-a-conversation-markdown-and-continue-elsewhere)
  - [3.4 Provider registry and adapters](#34-provider-registry-and-adapters)
  - [3.4.1 A self-healing `chatRoot`](#341-a-self-healing-chatroot)
  - [3.4.2 Unlisted sites — by user permission](#342-unlisted-sites-by-user-permission)
  - [3.4.3 The adapter contract](#343-the-adapter-contract)
  - [3.4.4 The DOM tier is mandatory, the API tier optional](#344-the-dom-tier-is-mandatory-the-api-tier-optional)
  - [3.4.4.1 The DOM tier is not guaranteed either — the reachability precondition](#3441-the-dom-tier-is-not-guaranteed-either-the-reachability-precondition)
  - [3.4.5 Capability matrix](#345-capability-matrix)
  - [3.4.6 Isolation](#346-isolation)
- [4. Data source — three tiers (Claude adapter)](#4-data-source-three-tiers-claude-adapter)
  - [4.1 Tier 1 is not automatically "the truth"](#41-tier-1-is-not-automatically-the-truth)
- [4.2 Surfaces — the extension is one consumer, the core is portable](#42-surfaces-the-extension-is-one-consumer-the-core-is-portable)
- [4.3 Memory across sessions — the download library](#43-memory-across-sessions-the-download-library)
- [4.4 Multi-model sidebar — why this is not that product](#44-multi-model-sidebar-why-this-is-not-that-product)
- [5. Architecture](#5-architecture)
- [6. Module contracts](#6-module-contracts)
  - [parse.js (pure) — core](#parsejs-pure-core)
  - [zip.js (pure)](#zipjs-pure)
- [7. Pipeline](#7-pipeline)
  - [7.1 Concurrency](#71-concurrency)
  - [7.2 Lifecycle](#72-lifecycle)
- [8. UI decisions](#8-ui-decisions)
  - [8.0 Simplicity principles — the arbiter as the design grew](#80-simplicity-principles-the-arbiter-as-the-design-grew)
  - [8.0.1 Colour palette — letting go of Claude's colour](#801-colour-palette-letting-go-of-claudes-colour)
  - [8.1 The download control — a split button](#81-the-download-control-a-split-button)
  - [8.1.1 The code-block control — one floating button, not N injections](#811-the-code-block-control-one-floating-button-not-n-injections)
  - [8.2 Version menu (popover)](#82-version-menu-popover)
  - [8.2.1 Conversation-level zip](#821-conversation-level-zip)
  - [8.3 The pulse pill — bottom right of the panel](#83-the-pulse-pill-bottom-right-of-the-panel)
  - [8.4 Toast](#84-toast)
  - [8.5 Logo](#85-logo)
  - [8.6 Settings panel (popup = options)](#86-settings-panel-popup-options)
  - [8.6.1 Popup interaction model](#861-popup-interaction-model)
  - [8.7 Style isolation, accessibility, file writing](#87-style-isolation-accessibility-file-writing)
  - [8.7.1 Drag and drop](#871-drag-and-drop)
  - [8.7.2 Saving to a folder (File System Access)](#872-saving-to-a-folder-file-system-access)
  - [8.8 First run and empty states](#88-first-run-and-empty-states)
  - [8.8.1 Noticing that it broke](#881-noticing-that-it-broke)
  - [8.9 Diagnostics — a bug report without telemetry](#89-diagnostics-a-bug-report-without-telemetry)
- [9. Settings schema](#9-settings-schema)
- [10. Messaging protocol](#10-messaging-protocol)
- [11. Failure matrix](#11-failure-matrix)
  - [11.1 Which numbers are tunable and which are not](#111-which-numbers-are-tunable-and-which-are-not)
  - [11.2 Interaction semantics — where settings intersect](#112-interaction-semantics-where-settings-intersect)
- [12. The DOM dependency layer](#12-the-dom-dependency-layer)
  - [12.1 Rules for reading text out of the DOM](#121-rules-for-reading-text-out-of-the-dom)
- [13. i18n](#13-i18n)
- [14. Tests](#14-tests)
- [15. Chrome Web Store deliverables](#15-chrome-web-store-deliverables)
- [16. Risks](#16-risks)
- [17. Security](#17-security)
  - [17.1 The publisher account — the real supply chain](#171-the-publisher-account-the-real-supply-chain)
  - [17.2 Privacy commitments — treated as invariants](#172-privacy-commitments-treated-as-invariants)
- [18. Repository deliverables](#18-repository-deliverables)
- [19. Production readiness](#19-production-readiness)
  - [19.1 Browser support](#191-browser-support)
  - [19.2 Performance budgets](#192-performance-budgets)
  - [19.3 Quality gates (CI)](#193-quality-gates-ci)
  - [19.4 Versioning and packaging](#194-versioning-and-packaging)
  - [19.5 Pre-release gate](#195-pre-release-gate)
  - [19.6 Store submission](#196-store-submission)
  - [19.7 Staged rollout and rollback](#197-staged-rollout-and-rollback)
  - [19.8 Post-release monitoring — without telemetry](#198-post-release-monitoring-without-telemetry)
  - [19.9 Support flow](#199-support-flow)
  - [19.10 Definition of done](#1910-definition-of-done)
- [Implementation order (summary)](#implementation-order-summary)
  - [The MVP cut line](#the-mvp-cut-line)

---

## 1. Problem

AI chat interfaces let you copy content but do not let you **save it as a file**. Getting a React component, an HTML page, a Python function in the middle of a message, or the CSV you uploaded three weeks ago onto disk always follows the same path: copy → open an editor → new file → paste → guess the right extension → save. On Claude, if you want an earlier version of an artifact there is no path at all — the panel only shows the current one.

This extension closes that gap: **one click to everything downloadable in a conversation, with the right extension and, where possible, at the version you want.**

**Why a fixed list rather than `<all_urls>`.** The general web-downloader direction was declined deliberately: an `<all_urls>` host permission is the most common reason for store review rejection and the fastest way to lose user trust, and the single-purpose statement (mandatory on the store form) collapses under it. A fixed and defensible list — `claude.ai`, `chatgpt.com`, `gemini.google.com`, `perplexity.ai` and the rest of the registry — preserves that single purpose: *extracting code and documents from AI chat assistants*. There are still no external requests; each provider is reached only in the user's own session, for the user's own data.

**Accepted risk.** Every provider changes its interface on its own schedule, so N providers means N independent breakage timelines. The dominant cost is maintenance rather than code. This is a deliberate decision (§16); the design bounds it three ways: adapter isolation, a provider-independent DOM baseline, and one adapter breaking without affecting the others.

## 2. Goals / non-goals

**Goals**

- Download the open artifact or canvas in one click with the correct extension
- Make **every version** of an artifact separately downloadable
- Download **code blocks inside messages** as files (most code never becomes an artifact)
- Download **tool and MCP call outputs** in full (§2.1.3) — not the view the interface truncates
- Download **citation lists** separately (§2.1.4.1) — on searching interfaces that is half the answer
- Download **generated images** with meaningful names (§2.1.4.3)
- Download back the **files the user uploaded** and the ones that were produced
- Export **the whole conversation as Markdown**, and optionally continue it on another provider (§3.3.3)
- Offer a **context handoff** when a conversation grows long (§2.1.1)
- Show which items in a conversation were **never taken** (§2.1.1)
- Copy a past item into a new chat **as context** (§2.1.1)
- Give all versions of one artifact as a single `.zip`
- Give **every item in a conversation** (documents, code, attachments) as a single `.zip`
- Let a file be **dragged** into an editor or onto the desktop
- Optionally save to a fixed **folder** without asking each time
- Give a visible but non-intrusive signal when a document **completes**
- Make every behaviour switchable off
- Keep user data on the device

**Non-goals**

- Bulk account backup (walking every conversation)
- Multi-model sidebar or multi-model client (§4.4)
- Prompt libraries, agent execution, model benchmarking — reasons in the §2.1 table
- Editing or restoring artifacts
- Sites not in the registry and not granted by the user (§3.4.2)
- Pre-configuration through enterprise policy (`storage.managed`) — added on request, not assumed
- Servers, accounts, synchronisation
- **Producing runnable projects.** A React artifact downloads as a `.tsx` on its own; we generate no `package.json`, no bundler configuration, no HTML wrapper. The user moves the file into their own project. This is a deliberate boundary: producing a "working project" is a separate product and means separate maintenance per framework

**Precondition to verify — per adapter-backed provider.** In step one, check whether each provider has added its own download or export button (artifact download on Claude, canvas export on ChatGPT, export to Docs on Gemini, export on Perplexity). Where one exists, this extension's value shifts from "downloading" to **version history, zip and bulk access**; the product still holds but the store copy and README are written accordingly. Putting a second button beside an existing one looks weak both in review and to the user.

## 2.1 What kind of product this is — "downloader" is a narrow description

"Downloader" names this product's first feature, not the product. Looking at what thirty passes added — version history, conversation transfer, download history, cross-conversation recognition, Markdown export, tool outputs, citations, images — none of that is file downloading.

**The spine:** *owning and reusing the work that comes out of AI chats.* The model produces, you take ownership — extract, version, move, remember, reuse. That is this product's share of "using LLMs well".

**What that description leaves out, and why:**

| Request | Why it is not this product |
|---|---|
| Prompt library / manager | A different product category; unrelated to work coming out of a chat, and it splits the single-purpose statement |
| Multi-model client | §4.4 — credentials, composer automation, framing restrictions |
| Running agents / automation | Needs credentials and a server; breaks §17.2 outright |
| Benchmarking models, scoring prompts | Means calling models — this product sends no request to any model |

The shared test is explicit: **if it can be done with data already present in the user's own session** it is in scope; if it needs a model call, a key or a server it is out. That test has held for thirty passes and it is what keeps the single-purpose statement (§19.6) defensible.

### 2.1.1 Three things that belong to the spine and are not written yet

None need credentials; all work from data already in hand.

**Context handoff.** In a long conversation the model starts forgetting the early parts, and users usually notice late. The threshold measure varies by tier, and **the message count is not always available** — measured on Claude, `[data-testid*="message"]` matched two nodes in a twenty-two message conversation, so the DOM count is not merely unreliable in theory: the API tier reports it directly, while in the DOM tier message nodes may not be countable (virtualisation, §4). Rule: where the message count is unreliable, use the **character total** (code blocks plus visible text); where neither is available, no suggestion appears at all — an uninvited suggestion on a wrong threshold is worse than no suggestion. Once a conversation grows noticeably long, a quiet row appears in the popup: `This conversation is long — move the context to a new chat`. Transfer already exists (§3.3.3); the only addition is a **prepared handoff prompt** at the top of the Markdown: *"Below is my earlier conversation. Summarise it and continue from where we left off."* No model call, only correct formatting of text the user will paste.

**Finding lost work.** This is only possible **with history enabled** (§4.3) — with it off there is no "never taken" information and the indicator is not drawn at all (§3.4.5 rule). With history on, items produced in a long conversation but never downloaded are knowable. Popup: `6 items in this conversation, you never took 2`. The most common loss is the one nobody noticed.

**Reusing a past item as context.** Putting a past item (§4.3) on the clipboard **as context** for a new chat: `⧉ Copy as context` → name, language and content, fenced. The "continue with reference to that component I wrote last month" flow, without downloading, opening and copying. History already holds the hash and the path; the only missing piece is the button.

All three sit inside the same boundary: **from data that exists**, without a model call, on the user's action.

### 2.1.2 Naming — Magpie

**The earlier decision was reversed and the reason has to stay on record.** A previous version argued for keeping "AI Chat Downloader": people type their intent into store search, and "downloader" is that intent. That argument rested on an assumption — **that the name still described the product's main job.**

That assumption no longer holds. After tool outputs (§2.1.3), citations (§2.1.4.1), generated images (§2.1.4.3), conversation transfer (§3.3.3) and download history (§4.3), "downloader" is a small slice of the product. If the name does not describe the job, the discoverability defended in its name gets **the wrong product** discovered.

**Magpie**: the bird that collects what shines and carries it home. That is the story — take what is valuable out of a conversation, keep it, use it later. Not generic, memorable, and nowhere near any provider's brand (§15 trademark rule).

**How discoverability is preserved:** the store name field carries brand plus descriptor — `Magpie — AI Chat Downloader`. The search term stays, the brand leads; the short description carries the spine sentence (§2.1). We neither disappear from search nor describe ourselves incompletely.

**Unverifiable, and therefore on the pre-release gate:** "Magpie" is a common word, so a Web Store name collision and trademark check is required (§19.5).

## 2.1.3 MCP tool outputs — the fifth item kind

The observation drawn from FindAgent (§2.2.2) is **not FindAgent-specific**: anything an MCP server produces lands inside the conversation. Linear, Sentry, Notion, GA4, Postman, Slack, a server someone wrote themselves — dozens of tools get called in a chat and every result becomes part of it.

This is the **fastest-growing share** of "work produced in AI chats", and the only part this product could not see.

**`kind: "tool_output"` is added.** A tool call result becomes a first-class item:

| Field | Source |
|---|---|
| Name | Tool name plus call index: `search_events-2`, `list_agent_runs-1`. The index is **always** included, even for a single call — renumbering when a second call arrives would invalidate the history record (§4.3) |
| Extension | By content shape: object or array → `.json`; flat rows and columns → `.csv`; text → `.md`; binary → the type the server declared |
| Content | The **whole** `tool_result` block — not the shortened view the interface shows |
| Versions | None; each call is its own item (a tool called five times produces five items) |

### 2.1.3.0 The call is half the result

The reason to keep a tool result is usually not the result itself but **being able to reproduce it**: which tool, which parameters, when. If in six months you have a 214-row JSON and do not know which date range it was pulled for, that file is noise rather than data.

The `tool_use` block is already in the same response and **carries the parameters**. Rule: every `tool_output` item carries its call.

- For `.json`: a wrapper object — `{ "_call": { "tool", "params", "at" }, "result": … }`. JSON admits no comments, so wrapping is the only clean option; the fixed `result` key keeps automated parsing trivial
- For `.csv`: two leading `#` comment lines — most tools skip them, and it can be switched off for the ones that do not
- For `.md`: a small front-matter block at the top

The user can turn this off (`includeCall`), but it defaults **on**: a result file without its context is the file that gets deleted six months later.

### 2.1.3.1 This is where the DOM lies most

Interfaces render tool outputs **collapsed by default** and usually truncated — a box saying "500 rows" while showing ten. Every DOM trap from §12.1 applies here at once: collapsed content, virtualisation, and UI elements (expand button, row counter) sitting inside the content node.

Two consequences:

- **The API tier is close to mandatory here.** The `tool_use` and `tool_result` blocks inside `content[]` arrive structured; the boundaries come from the schema rather than from the data (§4). Tool output support is **complete** where a provider has an API tier and **partial at best** otherwise, where the item is marked `⚠ may be truncated`
- A new row in the capability matrix (§3.4.5): **tool output** — dependent on the `api` capability

### 2.1.3.2 Why this is not merely "one more kind"

Lose a code block and you can ask the model for it again. Lose a **tool output** — the scores for forty listings, a week of GA4 anomalies, a 200-row query result — and getting it back means **running the tool again**: time, quota, sometimes money, and if the underlying data moved in the meantime, **the same result never comes back.**

So a tool output is the **most expensive to reproduce** of everything this product carries. It is where ownership is worth the most.

**Privacy note:** tool outputs are typically **more sensitive** than prose (analytics, customer lists, error logs). No new rule is needed — everything in §17 applies unchanged — but the requirement that the diagnostics block (§8.9) carry not even tool names matters especially here: a tool name alone can leak what a business is doing.

## 2.1.4 What else is in a conversation — citations and thinking blocks

The tool-output finding (§2.1.3) surfaced the right question: *what other block types exist inside a conversation, and which of them can we not see?* Two remained.

### 2.1.4.1 Citations — on Perplexity this is the product

On interfaces that search the web (all of Perplexity; Claude and ChatGPT with search on) a **source list** sits under the answer: title, URL, sometimes the quoted passage. Downloading the answer without its sources means **throwing away half the product** on Perplexity — what is valuable there is not the text but its verifiability.

`kind: "citations"` is added:

- Name: `<conversation-title>-sources`
- Extension: `.md` (numbered list of title, URL and passage where present) or `.csv` by setting (`n, title, url, domain`) — one to read, one to process
- In the conversation Markdown (§3.3.3) citations are **embedded**; they can also be downloaded as their own item. Carrying them along in a transfer is correct, because the target model needs them too
- Where absent, nothing is drawn (§3.4.5)

In the DOM tier the source list is usually collapsed ("12 sources ▾") — the same problem as §2.1.3.1 with the same answer: complete with an API, `⚠ may be truncated` without one.

### 2.1.4.2 Thinking blocks — excluded by default

Extended thinking blocks are also part of the conversation. They could be made downloadable, but the default is **no**, for three reasons:

1. What the user wants is the **result**, not the reasoning. Embedding thinking in the conversation Markdown triples the file and makes it unreadable
2. Thinking blocks are the model's intermediate steps; carrying them into another provider as context (§3.3.3) is **harmful** — it anchors the target model to another model's abandoned reasoning
3. They are the user's own data but a different privacy class from prose: approaches tried and dropped, guesses, occasionally phrasing the user would not have sent

It can be enabled (`includeThinking`, default `false`); when on it appears as a separate collapsed section in the conversation Markdown rather than as a listed item. That is the deliberate difference between "download everything" and "download what is useful".

### 2.1.4.3 Generated images and code-interpreter files

Two more kinds, both common:

**Generated images.** ChatGPT and Gemini produce them and the result is an `<img>` inside the conversation. A user can right-click and save, but the name is meaningless (`image_1a2b.png`), which of eight variants it was is lost, and there is no way to take them together. `kind: "image"`:

- Name from the first meaningful part of the **generating prompt**: `izmir-coast-sunset-1.png` — the name should say what the picture is
- Extension from the served content type; **never guessed**
- Binary: `ArrayBuffer`, no text conversion (the same rule as §3.3.2)
- Most images come from a CDN in a separate request → **the same discipline as attachments**: serialised, concurrency one, stop on 429 (§3.3.2). Zipping a conversation with twelve images means twelve rapid requests, which would be the second way to break our own rule

**Code-interpreter output files.** ChatGPT's data analysis and Claude's analysis tool produce files (CSV, XLSX, PNG charts) and the interface shows them as download links. They flow in the opposite direction from a user upload (§3.3.2) but are technically the same thing: binary content fetched separately. They live under the same `kind: "attachment"` with a **`direction: "out"`** distinction — the popup splits the *Attachments* group into `You uploaded` and `Produced`.

Why the distinction is needed: confusing "the CSV I uploaded" with "the CSV the model produced" moves the wrong file into a project. Both are `.csv`, both in the same conversation, and their names can be similar.

**The block enumeration is now complete.** Everything present in a conversation maps to a kind: text (`conversation`), code (`code`), documents (`artifact`), uploaded and produced files (`attachment`), tool results (`tool_output`), citations (`citations`), images (`image`), thinking (excluded by default). If a new provider introduces a new block type, **this list** is what gets updated, not a registry row.

## 2.2 FindAgent integration — its shape had to be established first

How FindAgent fits into this product depends on **what surface it has**. Rather than inventing one, the three possible shapes and their costs were written down; the spec follows whichever turns out to be true.

| FindAgent's surface | Integration | Cost |
|---|---|---|
| **It has a web chat interface** | A registry row (§3.4). `host` + `name` + `newChatUrl`; `chatRoot` comes from the heuristic. Code blocks, downloading, drag, history, transfer — all work **immediately** | One line. Exactly why the registry model exists |
| **It has an API/endpoint** | As a transfer target: `→ send to FindAgent`. But that would be the first path where **we** send data — credentials, a review of §17.2, a change to the store data declaration | High. Needs its own trust design |
| **It has an MCP server** | The same direction as the MCP surface in §4.2: exposing the local download library to FindAgent agents. Does not change the extension, consumes the library | Medium; meaningless before folder saving and history exist |

### 2.2.1 Observation: FindAgent is an agent platform, not a chat interface

**Observed** in this session on 2026-09-09 (not assumed; obtained by querying the platform's own tools):

- FindAgent is an **agent marketplace and publishing platform**: browsing and purchase (`browse_agents`, `buy_agent`, `list_categories`), price and earnings (`edit_price`, `earnings`), a request board (`list_requests`, `vote_request`)
- **A publishing pipeline**: draft → `preflight` → `submit_for_review` → `bump_version` / `rollback_version`; an agent's source is either code (`create_code_draft`, `import_repo`, `connect_github`) or a remote MCP (`create_remote_mcp`)
- **Account-scoped**; the MCP connector acts as a specific account (`whoami`)
- Purchased agents are consumed as **one MCP server per agent** (`mcp.findagent.cloud`), with the platform bot at `bot.findagent.cloud`; agents share a common tool shape: `list_capabilities` → `plan_inputs` → read-only `fetch_*` → deterministic `score_*` / `detect_*` → `run_full` with an LLM narrative

**Consequence: the first branch (a registry row) is eliminated.** There is no chat interface to read — a user does not converse in FindAgent, they build or buy agents. The right branch is MCP, but it now has **two distinct directions** and they are different things:

| Direction | Assessment |
|---|---|
| **Our local MCP server, consumed by FindAgent agents** | Compatible. As long as the v3 surface in §4.2 runs **locally over stdio**, no data leaves the device and §17.2 holds. The library stays local, the agent reads it locally |
| **Sending our data to the FindAgent cloud** | **Incompatible.** `findagent.cloud` is a remote host; sending conversation content or the download library there breaks the no-external-requests invariant (§17.2) and the store data declaration (§19.6) outright. Doing it would need its own consent flow, its own privacy policy, and probably its own product |

### 2.2.2 Concretely, how it would be used — one of four already works

FindAgent is **not a dependency**; this product is complete without it. The question is not whether to use it but where it helps. Four paths, ordered by how real they are:

**1. Already works — zero code.** FindAgent agents are consumed through an MCP client such as Claude or ChatGPT, and the agent's output — a report, a table, code, the narrative `run_full` produces — lands **inside that conversation**. If that conversation is an interface we support, the output is an ordinary item to us: downloadable as a code block, versionable if it is a document, exportable as part of the conversation Markdown. **Today, with no integration at all**, the output of FindAgent agents can be captured by this extension. That is where the two products genuinely meet, and it costs nothing.

The only work: this usage belongs in the store copy and the README as an example — a user does not arrive at it on their own.

**2. Measuring demand — also today, also without code.** FindAgent's request board (`list_requests`, `vote_request`) is a demand signal. Looking there before writing the MCP surface in §4.2 answers "does anyone want an agent that reads my code library" **with data rather than assumption**. Not an integration but product research — and the cheapest thing the platform offers.

**3. Distribution — after the MCP server exists.** FindAgent accepts code and repo-backed agents (`import_repo`, `create_code_draft`). The **local MCP server** in §4.2 is exactly that shape: a small, dependency-free repository that runs on the user's machine. Publishing it there is **distribution, not data sharing** — code goes to users, data goes nowhere. It does not touch the privacy framing.

This is the most natural intersection between the two products: the extension produces the material, the local MCP server exposes it to agents, and FindAgent makes that server **findable**.

**4. Consumption — conditional** (depends on question 1 below).

**Decision:** the integration is designed toward **local MCP**. The work on our side is to write the §4.2 MCP surface **compatible** with FindAgent's tool shape — a server that announces what it offers through `list_capabilities`, gives its input schema through `plan_inputs`, and exposes the library through read-only `fetch_*`. Following the same shape is what lets FindAgent agents consume us without adaptation.

**The prerequisite order does not change:** folder saving (v1) → download history (§4.3) → local MCP server (§4.2, v3) → FindAgent compatibility. There is nothing to expose to an agent until a library has accumulated.

**Two unanswered questions:**

1. Do FindAgent agents run only in the cloud, or can they consume an MCP server on the user's machine? If cloud only, the **consumption** direction is not built — the only way to do it would be sending data out.
2. Does the marketplace allow listing a self-hosted agent that runs on the user's own machine? If it does, the **distribution** direction holds regardless of the answer to the first question.

Both depend on platform rules rather than our design, which is why they stand here as **conditions** rather than decisions.

## 3. The critical insight — an artifact is an op-log

An artifact's "current state" is not stored anywhere as a whole. What the conversation stores is an **operation log**:

| Command | What it carries | Result |
|---|---|---|
| `create` | full body | v1 |
| `update` | `old_str` → `new_str` | vN+1 |
| `rewrite` | full body | vN+1 |

So obtaining vN means starting from v1 and **replaying the updates in order**.

```
ops      = [create(A), update(x→y), rewrite(B), update(p→q)]
versions = [A,         A',          B,          B']        ← fold prefix
```

The naive "take the last block" approach hands the user a five-line diff instead of the whole file whenever the last op is an `update` — **silently corrupt output**. Version selection comes free as a by-product of the fold.

**Replay verification:** if `old_str` cannot be found in the body while applying an `update`, that version's reconstruction is untrustworthy. It is marked `ok:false`, shown as `⚠ partial` in the UI, and `-partial` is added to the filename — **before the extension and after the template is applied**: `Sales-Dashboard-v2-partial.tsx`. It is not embedded in the template, because a user's template may not contain `{version}` and the warning must not disappear. Wrong content is never handed over silently.

**`old_str` must be unique.** If it occurs more than once in the body, which occurrence to replace is undefined — replacing the first and continuing produces a silently wrong file. Rule: **0 matches → `ok:false`; 2+ matches → `ok:false`, `reason:"old_str_ambiguous"`; exactly 1 → apply.** JavaScript's `String.replace` replaces the first match; that behaviour is not relied on, the match count is counted explicitly.

**The most likely cause of an `old_str` mismatch is line endings.** If the body carries `\r\n` while `old_str` uses `\n` (or the reverse) the match fails. Silently normalising and applying would **alter the content** — we do not. The mismatch is reported instead, and `docs/BREAKAGE.md` lists this possibility as its first diagnosis. Likewise an empty-bodied `create` is valid (a zero-byte file downloads) rather than a crash.

**Titles can change between versions.** Claude may rename an artifact in an update. Each `Version` carries its own `title`; the filename is produced from **the downloaded version's** title, not the artifact's current one.

### 3.0.1 Edge cases in the fold

The fold looks simple, but the op stream does not always arrive well-formed. All four of these are real and none may throw:

| Case | Behaviour | Why |
|---|---|---|
| A **second `create`** for the same `artifactId` | Does **not** start a new version chain; treated like a `rewrite` and the counter continues | To the user it is still "a new state of the same artifact". Resetting the counter would show `v1` twice in the menu |
| An `update` arriving with no `create` ever seen | That artifact is `ok:false`, `reason:"no_base"`; shown as `⚠ no base found` with no downloadable version | Happens when a branch was pruned or the API windowed the conversation (§4.1). Applying an update to an empty body and calling it a file is fabricated content |
| **`type` / `language` changed** between ops (html → react) | The extension is computed **per version**; `v2.html` and `v3.tsx` can sit side by side | The type belongs to the version, not the artifact. Forcing the latest type onto all of them would download older versions under the wrong extension |
| An `artifactId` that never appears in the DOM | The item stays in the list, marked `⚠ not in panel` | It may be deleted or from an old branch; describing the state beats cutting off access |

The shared principle is the document's: **ambiguous input never becomes silent output.** The fold never guesses; it either produces a sound version or says why it cannot.

### 3.1 The conversation tree — the branching trap

A conversation is not a flat list, it is a **tree**. Editing a message creates a sibling branch, and the abandoned branch remains in the API response. Reading every message flatly and ordering the ops **mixes ops from the abandoned branch into the replay** — the result is a silently corrupt version history.

Rule: walk the `parent_message_uuid` chain **from leaf to root** to extract the active branch, and collect ops only from it. The active leaf comes from `current_leaf_message_uuid` where that field exists, and otherwise from the leaf with the newest `created_at`.

This is the only correct answer to "which messages are we reading", and the branching test in `selftest.js` protects it.

**Ordering is by branch position, not by timestamp.** A single message can contain several ops carrying the same `created_at`, and timestamps can move backwards across edited branches. Op order is the message index along the branch chain, then the block index within the message. `created_at` is for **display** only (the "14 min ago" in the menu), never for ordering.

### 3.2 An artifact still being written

A user can press the button while Claude is still writing. The last op may have arrived half-formed — truncated `content`, an incomplete `old_str`. Downloading that means a half file.

Rule: if the stream is still running (a stop indicator in the panel or composer, or the last message carrying no `stop_reason`), the newest version is marked `⚠ writing`. The menu opens and earlier **completed** versions download normally; choosing the half version requires the user to see the warning and click anyway. The default selection never lands on it.

### 3.3 The downloadable item model

Reducing every source (artifact, code block, attachment, tool output, citations, image, conversation) to one model is what keeps the pipeline, the UI, the zip writer and the naming on a single code path:

```js
Item = {
  kind: "artifact" | "code" | "attachment" | "conversation" | "tool_output" | "citations" | "image",
  key,               // stable identity within the conversation (see the stability rule below)
  title,             // display name (derived per kind)
  ext,               // ".tsx" | ".py" | ".csv" ...
  versions,          // Version[] — only ever >1 for artifacts
  bytes | fetchBytes // for attachments the content arrives in a separate request
}
```

**`key` must not shift while a response streams.** For an artifact or canvas the identity comes from the provider's own id, so there is no problem. For a code block the natural identity is "message index plus block index"; while Claude writes, **new blocks are appended rather than inserted**, so existing indices stay fixed — rule: a code block's key is computed as `msgIndex:blockIndex` and is never renumbered mid-stream. **In the DOM tier there may be no message index**; there the key is the block's **document order index** among the nodes found by `SEL.codeBlock` under the chat root (`code:<n>`). The same stability rule applies, since new blocks are appended. If a key shifts, an open menu rebinds to a different item and the user downloads something other than what they picked.

**This generalisation is free today and expensive later.** Normally an abstraction with one implementation is YAGNI; but the moment we **know** a second and third implementation will be wanted, the rule inverts. The critical observation: `getConversation` already fetches the whole conversation — artifacts are a subset we filter out of it. Code blocks are in the same response, at **zero additional network cost**. Being an "artifact downloader" was never an architectural boundary, only a filter.

### 3.3.1 Code blocks

Source: where an API tier exists, the text blocks of assistant messages (on Claude the **active branch**, §3.1; on providers with no branching concept the whole visible thread), with fenced code parsed out. Where there is no API tier, `common-dom.js` collects `pre > code` from the DOM. Neither path costs an extra network request.

**A code block has no title.** The name is derived by the following chain, first match wins. The chain produces a **base name**; the extension is determined separately (below):

1. **A filename in the fence** — ```` ```python:app.py ```` → base `app`, extension `.py` (at this step the extension comes from the fence and the language table is not consulted)
2. **The first meaningful definition in the code.** One regex per language, the first match converted to kebab-case:

   ```
   py            ^\s*(?:class|def)\s+(\w+)
   js ts jsx tsx ^\s*(?:export\s+)?(?:default\s+)?(?:async\s+)?(?:function|class|const)\s+(\w+)
   go            ^\s*(?:func|type)\s+(\w+)
   java kt cs    ^\s*(?:public\s+|private\s+)?(?:final\s+)?(?:class|interface|enum)\s+(\w+)
   rs            ^\s*(?:pub\s+)?(?:fn|struct|enum|trait)\s+(\w+)
   rb            ^\s*(?:class|module|def)\s+(\w+)
   php           ^\s*(?:class|function)\s+(\w+)
   sql           ^\s*(?:CREATE|ALTER)\s+(?:TABLE|VIEW|INDEX)\s+(?:IF\s+NOT\s+EXISTS\s+)?[`"]?(\w+)
   sh bash       ^\s*(\w+)\s*\(\)\s*\{
   ```

   Languages with no entry **skip** this step — an invented rule produces confidently wrong names, whereas skipping falls through to the next step. The step is best-effort and never raises.
3. **The markdown heading immediately before the block** (`### Migration script` → `migration-script`)
4. **By position:** `code-3` — the number is the block's order of appearance in the conversation (the same ordering as `key` in §3.3, never renumbered)

**The extension** (where step 1 did not win) comes from the fence language, by this table:

```
py python → .py        js javascript node → .js    ts typescript → .ts
jsx → .jsx             tsx → .tsx                  go golang → .go
rs rust → .rs          rb ruby → .rb               java → .java
kt kotlin → .kt        cs csharp → .cs             cpp c++ cc → .cpp
c → .c                 php → .php                  swift → .swift
sh bash shell zsh → .sh   sql → .sql               yaml yml → .yaml
json → .json           xml → .xml                  html → .html
css → .css             scss sass → .scss           md markdown → .md
toml → .toml           ini → .ini                  diff patch → .diff
dockerfile → .dockerfile   (no language / unrecognised) → .txt
```

This table belongs to the **core** and is shared by all providers; the MIME table in §6 belongs to the Claude adapter alone.

There is no version concept here (`versions` has one element).

**Derived names can collide.** Two blocks in the same conversation can both define `class OrderService`, and both become `order-service.py`. For a single download Chrome appends `(1)`, but **two identical names inside a zip is a corrupt archive**. Rule: while building the zip, name collisions within `code/` are counted and `-2`, `-3` appended from the second onwards. The same rule applies when writing into a chosen folder (§8.7.2).

**Blocks shorter than three lines are skipped.** The measure is **non-empty lines** (blank after `trim()` does not count), so two lines of code plus three blank ones gets no control. A one-line `npm install x` or a variable name is not a file, and putting a control on each turns the interface into clutter. The threshold is defined once as `MIN_CODE_LINES = 3`.

### 3.3.2 Attachments

Source: the file and attachment records in the conversation response. The content is not embedded in the message; a separate download request is needed — making this the **only source with an additional network cost**, and it is only paid when the user actually wants that attachment.

Attachments **may be binary** (PDF, xlsx, png). Rule: the content is never converted to text, it is taken as an `ArrayBuffer` and written verbatim; it never passes through `TextEncoder`/`TextDecoder`, which would produce a corrupt file. Name and extension come from the server-side name, pass through `sanitize`, and are never guessed.

**Bulk downloading could turn us into a crawler.** A zip of a conversation with twenty attachments means twenty consecutive requests — something the page would never do, and a direct violation of our own rule in §16 ("never send a request the page itself would not send"). Bot protection reads it exactly that way, and the consequence can land on the user's **session**; making the user pay for our feature is not acceptable.

Rule: attachment fetches are **serialised** (concurrency one) with a small delay between them (~150 ms), and a bulk operation already shows a progress bar (§8.6) — so the slowness is displayed rather than hidden. If any request returns 429 or 403 the bulk operation **stops**, nothing collected so far is zipped, and the user is told `The provider rate-limited the request — select fewer items and try again`. We produce no partial archives (§11) and we do not push at the limit.

The same discipline is unnecessary for documents and code: they come out of a conversation response that was already fetched.

**To verify (step 1):** the attachment download endpoint and response format. If it cannot be determined, attachments are **removed from scope** — artifacts and code carry the product on their own, and promising nothing beats leaving a feature half-working.

### 3.3.3 Moving a conversation — Markdown and "continue elsewhere"

The whole conversation is already in hand (§4). Turning it into **Markdown** requires no new data, only formatting: message roles as headings, code blocks fenced with their language preserved, documents as `## <title>` plus a fenced body, attachments as a list of names.

**Tool outputs are not embedded in the Markdown.** Putting a 500-row JSON into the conversation text makes the file unreadable and unusable for transfer — and the point of transfer is carrying context, not dumping data. Rule: the tool call is **summarised** (`> 🔧 search_events → 214 results · in a separate file`) and the full content stays a separate `tool_output` item. In a conversation zip both travel together: `conversation.md` carries the summary, `tool-outputs/` the full results. A user pasting context does not paste 500 rows. This is a **third item kind** falling out of data the product already holds: `kind: "conversation"`.

Two actions:

Writing to the clipboard uses `navigator.clipboard.writeText` and requires a **user gesture**; a click in the popup already counts and no separate permission is needed. Verified in step 1 — the `clipboardWrite` permission is added only if required, and not otherwise (permission surface).

**`↓ Download conversation as .md`** — downloads as a file. The same pipeline as everything else; no separate mechanism.

**`→ Continue on another provider`** — pick a target, the conversation Markdown is written to the **clipboard**, and the target's new-chat page opens in a new tab. The user pastes.

**Why we do not auto-fill the composer** — three reasons, all permanent:

1. It means a new selector surface per provider (the composer); it multiplies our breakage surface and undoes the cheapness of the registry model (§3.4)
2. The act of sending data to another company must be **the user's own action**. Clipboard plus paste achieves that; auto-filling leans against our privacy commitment (§17.2)
3. A long conversation silently overflows the target's context limit; when the user pastes, they see how much is going

**Size warning.** If the Markdown exceeds 100 KB, a warning appears before writing to the clipboard: `This conversation is ~N thousand words — the target provider may not accept all of it`, with a `Last 20 messages only` option. We do not truncate silently; we give the user the choice.

**What is lost is stated openly.** Artifacts do not arrive as artifacts, code blocks stay code blocks but without version history, attachments are not carried (the files themselves do not travel, their names are listed). This appears in `docs/LIMITATIONS.md` and on the transfer screen — "continue" is a **context transfer**, not a full copy.

It adds a single field to the registry row: `newChatUrl`. No adapter required; every baseline provider can be both source and target.

### 3.4 Provider registry and adapters

**Why not four.** A previous version assumed one adapter per provider and recorded four providers as an "accepted maintenance risk". That was the wrong accounting: code block extraction is **already provider-independent** (§3.4.4), so supporting a provider at baseline costs a **registry row**, not an adapter. The expensive part is the document, version and attachment layer — and most AI chat interfaces do not have that layer at all.

The right model has two levels:

**1. The registry — baseline support.** A table bundled inside the package (no remote code, §17):

```js
{ id: "deepseek", host: "chat.deepseek.com", chatRoot: "…",
  name: "DeepSeek", newChatUrl: "https://chat.deepseek.com/" }
```

One row buys code block downloading, correct names and extensions, drag and drop, folder saving, zip, filtering and selection. Adding a provider is one line and one fixture in a pull request; no adapter is written.

**2. Adapters — enhanced support.** Only for providers offering documents or canvases, version history, attachments, or an API tier. The contract is below and layers on top of the registry row. Claude (artifacts plus the op-log) and ChatGPT (canvas) belong here; Gemini Canvas and similar are measured in step 1.

**The maintenance accounting corrects itself:** when a baseline provider breaks, the repair is a single `chatRoot` selector, and the `LAST_VERIFIED` mechanism (§19.8) already works per provider. Twenty baseline providers are **cheaper** than four adapters.

### 3.4.1 A self-healing `chatRoot`

The registry row has exactly one fragile field: `chatRoot`. When a provider changes its layout the selector stops matching, and the user waits out **store review time** — days — for a one-line fix. The cheapness of the registry model turns into a liability precisely there.

The solution is to stop making the selector load-bearing: **`chatRoot` is a hint, not a foundation.**

1. If `SEL.chatRoot` exists and matches, it is used (fast path)
2. If not, the heuristic: compute the **nearest common ancestor** of every `pre > code` node on the page. The container holding the code blocks is, by definition, the root we were looking for.

   **With fewer than two blocks the heuristic degenerates and must not be used.** Measured on Claude: with a single code block on the page, "the nearest common ancestor of all of them" resolves to the code element itself, and event delegation would bind to the block rather than to a container. Rule: the ancestor walk requires **at least two** blocks; with exactly one, walk up a fixed four levels from it and stop; with none, stay silent (step 3)
3. If the page has no `pre > code` at all there is nothing to do — stay silent (the same condition as §3.4.2)

The heuristic path costs a few more DOM queries than the selector and **works on every provider**, because it uses no provider-specific knowledge.

The consequences are large:

- When a provider changes its layout, code block downloading **keeps working**; no emergency release is needed
- Writing a `chatRoot` for an unlisted site is **not required** — a user-granted host (§3.4.2) works with no registry row at all
- Adding a new provider is usually just `host` + `name` + `newChatUrl`

The diagnostics block reports which path was used (`chatRoot: selector` / `chatRoot: heuristic`). A provider falling through to the heuristic is a signal that the registry row wants updating — but **planned**, not urgent.

### 3.4.2 Unlisted sites — by user permission

Self-hosted interfaces (Open WebUI, LibreChat, internal deployments) have no fixed host, so the tail cannot be closed with a registry. The answer is **`optional_host_permissions`**: an `Also run on this site` button in the popup calls `chrome.permissions.request({origins:[…]})`, and on approval the baseline script is registered for that host with `chrome.scripting.registerContentScripts`.

Why this is the right answer: the install-time permission list does **not** grow, the decision belongs to the user and is made at the moment they make it, and there is no `<all_urls>`. It is revocable at any time. Granted hosts are kept in `storage` and listed in the popup, each removable individually.

The button only activates on pages that actually contain `pre > code` — asking for permission on an arbitrary site is meaningless and looks bad in review.

### 3.4.3 The adapter contract

The core knows nothing about providers. Each provider implements one contract in one file:

```js
Adapter = {
  id,                    // "claude" | "chatgpt" | "gemini" | "perplexity"
  matches,               // host match
  SEL,                   // every DOM selector for this provider (§12)
  capabilities,          // { versions, api, attachments, panel }
  conversationId(),      // from location; null → the extension stays silent
  fetchConversation(),   // API tier; returns null where unsupported
  parse(raw),            // Item[] — the core knows only Item
  isStreaming(),         // from the DOM or the response
  mountPoints(),         // where the document button is inserted
  conversationTitle(),   // for the zip name; null if unreadable (§8.2.1)
  fetchAttachment(item), // ArrayBuffer when capabilities.attachments (§3.3.2)
  codeBlocks(),          // optional — overrides the common-dom.js default (§3.4.4)
  LAST_VERIFIED,         // "YYYY-MM-DD" — CI freshness gate (§19.3 gate 13)
}
```

The contract has to be **complete**: a feature (attachment download, conversation zip, the freshness gate) needing something from the adapter that the contract does not name turns that feature into a surprise discovered while writing the adapter. The list above satisfies every goal in §2.

**What lives in the core:** the item model, the version fold, zip, `sanitize`, the naming chain, the download paths, drag and drop, folder saving, the UI shell (button, menu, pill, toast), settings, diagnostics. Written once.

### 3.4.4 The DOM tier is mandatory, the API tier optional

Every adapter **must** implement the DOM tier; the API tier is optional. That way, if a provider's internal API cannot be found, changes, or resists, the product keeps working there — just with fewer capabilities.

The observation that makes this possible: **DOM code-block extraction is nearly provider-independent.** All of them render a code block as `pre > code` with the language in a class name. The shared default looks for the language in this order and takes the first hit: a `data-language` / `data-lang` attribute → a `language-*` class → the language class next to `hljs` → the same attributes on the `pre`. If none matches, the language is unknown and the extension is `.txt` — never guessed.

The floating control works through a single `mouseover` / `focusin` delegation on `SEL.chatRoot`; no listener is bound per block, which in a long conversation would mean hundreds of them. The core carries the **shared default implementation**; an adapter overrides it only where it differs. Code blocks — the larger part of the value — run through one code path on every provider.

### 3.4.4.1 The DOM tier is not guaranteed either — the reachability precondition

"The DOM tier always works" (§3.4.4) is an assumption, not a proof. There are two conditions under which it does not work **at all**, and both must be measured in step 1:

**A closed shadow root.** If the provider renders the chat interface with `attachShadow({mode:"closed"})`, a content script cannot read that tree **by any means** — `querySelector` does not enter it and `shadowRoot` returns `null`. Open shadow roots are fine (descend via `element.shadowRoot`, with `SEL` paths written to cross shadow boundaries); closed ones are absolute. It is a real possibility in a modern interface built from web components.

**An iframe.** If the conversation is rendered inside a separate `iframe`, the content script stays in the top frame and cannot see it. The fix is `all_frames: true` plus the frame origin in host permissions — but that widens the permission surface and invites a review question, so it is done only where genuinely needed rather than pre-emptively.

**What happens when a provider is unreachable.** With a closed shadow root and no API tier there is nothing that can be built. Decision: that provider is **removed from scope** — the host permission and `content_scripts` block are deleted from the manifest, its name does not appear in the store listing, and it does not show in the `sites` setting. A half-working provider costs the user, the review and the maintenance burden all at once.

This is the **precondition** for every provider entering the registry: before it is added, check in order whether `chatRoot` resolves, whether code block text is readable, and whether it is in the top frame. All three positive and the provider stays on the list. Store copy is written only after that measurement — listing an unsupported provider is a false claim in review.

### 3.4.5 Capability matrix

| | Claude | ChatGPT | Gemini | Perplexity |
|---|---|---|---|---|
| **DOM reachable** (no closed shadow root / iframe) | **✓ measured** | ? | ? | ? |
| Code blocks (DOM) | **✓ measured** (`pre > code`, `language-*`) | ✓* | ✓* | ✓* |
| **Tool output** (`tool_output`) | api-dependent | api-dependent | api-dependent | api-dependent |
| **Citations** (`citations`) | **✓ measured** — a field on text blocks | with search on | with search on | **always** |
| Panel / canvas document | ✓ artifact | ✓ canvas | — | — |
| **Version history** | ? op-log — **schema unmeasured** (§4.1) | ? canvas versions | ✗ | ✗ |
| Attachments | **✓ measured** — `file_size` and `preview_url` present | ? | ? | ? |
| API tier | **✓ measured** | ? | ? | ? |

Claude's column was filled by measurement on 2026-09-09; the run and its limits are in `docs/DISCOVERY-claude.md`. The remaining `?` in that column is the artifacts schema, which could not be measured because **no artifact existed in 25 conversations** — while the same conversations held 360 code fences. That ratio is why v1 is code blocks (§ MVP).

`✓*` = valid if the first row is positive. `?` = **to be discovered per provider in step 1.** This document claims no knowledge of any provider's internal API schema; even for Claude, schema verification is the first job (§4). The discovery output per adapter: where the conversation id is read from, whether an API exists, the response shape, how streaming is detected, the `SEL` selectors, the attachment endpoint.

**`capabilities` is written statically and may only *narrow* at runtime.** It is fixed in the adapter file from the discovery result; if the API returns 401 during a session, `api` closes for that tab and the UI redraws accordingly (the version menu disappears). There is no widening direction — no runtime probing of "does it support this after all", because probing means both an unnecessary request and bot-protection exposure (§16).

Where a capability cannot be verified it is **switched off** for that provider rather than imitated: no version menu means the button is not split (§8.1), no attachment support means attachments are never mentioned. The user sees what they get on each provider, and a missing capability never appears as a silent failure.

### 3.4.6 Isolation

An error thrown by one adapter affects **only that tab**: the adapter shuts itself down, writes to the diagnostics record, and other providers keep working. The core validates the `Item[]` an adapter returns (required fields, types); if validation fails that adapter is disabled — a broken adapter cannot turn into a broken file.

## 4. Data source — three tiers (Claude adapter)

The tier structure below is the **general pattern**; the concrete fields belong to the Claude adapter. Other adapters fill the same three tiers from their own sources, and tier 3 is mandatory in all of them (§3.4.4).

| # | Source | What it gives | When |
|---|---|---|---|
| 1 | **Structured `tool_use`** — blocks with `name === "artifacts"` inside `chat_messages[].content[]` in the conversation JSON; `input` = `{command, id, type, title, language, content, old_str, new_str}` | The full op-log, no regex | Preferred |
| 2 | **Raw `<antArtifact>` text** — inline blocks in the message text, via regex | The full op-log | When tier 1 comes back empty (older conversations / format change) |
| 3 | **DOM** — the `<code>` text on the panel's Code tab | Only the displayed version | On API 401 / unrecognised schema |

**Tier 2 is vulnerable to its own content.** An artifact's body can contain the text `</antArtifact>` — a document about writing artifacts, this specification itself, or an HTML sample quoting the tag. The regex stops at the first closing tag and hands the user a **silently truncated file**. It is also hard to notice, because the length looks plausible.

Rule: in tier 2, if the extracted body still contains a leftover opening or closing marker, the version is marked `ok:false`, `reason:"tier2_ambiguous"`. Tier 1 (structured JSON) is immune to this by construction — its boundaries come from the schema rather than the data. That is the second reason for the tier ordering.

When we fall to tier 3 the menu shows a single row, `v? (read from page)`, and a yellow toast appears — the user knows why the version history is gone.

**Tier 3's real danger is not missing content but content that looks complete.** Long code views may be **virtualised**: only the lines on screen exist in the DOM, and `textContent` never sees the rest. The result is sixty lines of a four-hundred-line file — and when opened it looks plausible, because it starts at the beginning and the syntax is intact. The worst form of silent truncation.

Rule — a read is **not accepted without proof of completeness**. We do not try to *detect* virtualisation: estimating line count from line height is a fragile heuristic, and landing on the wrong side of it silently produces a truncated file. Instead, **unconditional collection**:

1. If the code node is not scrollable (`scrollHeight <= clientHeight`) the content is already complete and one read suffices
2. If it is scrollable, the content is **always** collected by scrolling: `scrollTop` steps by one viewport height minus one line, the visible lines are accumulated with their positions (`offsetTop` or the line node's identity) at each step, and overlapping lines are not added twice. Where there is no virtualisation the result is identical to a single read — so there is no wrong side to land on, only a few extra milliseconds
3. At the end the scroll position is **restored** (the same principle as tab restoration in §12)
4. If the collected line count keeps growing across two consecutive passes (infinite scroll / lazy loading) it stops at a 3-second bound and the item is marked `⚠ may be incomplete` with `-partial` added to the filename

Removing the heuristic costs a few milliseconds; it eliminates the entire class of **silently truncated files** that appears whenever detection lands the wrong way.

This is the **third** reason to prefer tier 1: an API response knows nothing about virtualisation and returns the full text.

### 4.1 Tier 1 is not automatically "the truth"

The whole design leans on tier 1: it knows nothing about virtualisation, its boundaries come from the schema, it yields the full op-log. **None of that has been verified.** There are two concrete doubts and both must be measured in step 1:

**Byte fidelity.** The endpoint takes a `rendering_mode` parameter — meaning the server may be **processing** the content in some way. Line-ending normalisation, escape resolution, trailing whitespace trimming: all plausible and all silent. The measurement: for a known artifact, compare tier 1 output against what the provider's own copy button yields, **byte for byte**. If they differ, the claim that tier 1 is raw collapses — and it would also explain why `old_str` matches fail (§3).

**Completeness.** Does the conversation endpoint return every message, or a **window**? If the server truncates older messages in long conversations, the active-branch walk runs over a shortened chain and the version history becomes **silently partial** — with no error at all, because what remains is internally consistent. The measurement: on a conversation with 200+ messages, compare the number of messages returned against the number visible in the interface. If windowing exists, apply pagination; where that is impossible, mark the oldest versions `⚠ unreachable`.

**Disagreement between tiers is a signal.** When both sources are available (panel open and API working) the comparison is free: if the lengths of tier 1's current version and the DOM read diverge **noticeably** (>5%), one side is wrong — virtualisation, windowing, a bad artifact match, or schema drift. Rule: a disagreement does **not** block the download (we do not know which side is right), but a yellow toast appears and it is written into the diagnostics block. With no telemetry this is the only mechanism that catches schema drift in the field **before** a user complaint — a canary without telemetry.

**Assumption to verify (the first step of implementation):** for tier 1, the field names inside the `input` object (`id` or `identifier`, `content` or `new_content`); for tier 2, whether `old_str` / `new_str` are attributes or child elements. Before the parser is written, a real conversation JSON is dumped and both schemas verified; the parser is written to tolerate the variants it sees.

**Endpoints** (same-origin `fetch` from the content script, cookies automatic):

```
GET /api/organizations/{orgUuid}/chat_conversations/{convUuid}?tree=True&rendering_mode=messages
```

**Taking the org UUID as "the first org" is wrong.** A user can belong to more than one organisation (a personal account plus a Team or Enterprise workspace). A conversation belongs to **one** of them; with the wrong org the request returns 404 and the extension drops to the DOM fallback for no visible reason — the user loses version history and never learns why. This is a bug that is **completely invisible** when tested on a single-org account.

Resolution order:

1. `lastActiveOrg` from `document.cookie` — **the assumption that it is not `HttpOnly` is verified in step 1.** If it is `HttpOnly` the content script can never see it and this step quietly returns nothing; the code treats that identically to "no cookie" and falls to step 2, so a wrong assumption does not break anything — it only costs an unnecessary org scan per session. The `Org resolution:` line in the diagnostics block reports which step won
2. Otherwise `GET /api/organizations` → the returned orgs are tried **in order**, and the first `200` wins
3. The resolved org is cached with the conversation UUID; the search is not repeated on every click

`convUuid` comes from `location.pathname`. If the pathname yields no conversation UUID (a `/project/<id>` list page, `/new`, an unsaved chat) the extension does **nothing**: no button is injected, no badge is written, no error is shown. Whether project conversations really land on `/chat/<uuid>` is verified in the first step of implementation; if they do, the `/project/*` match is removed from the manifest, since an unused host match is unnecessary surface in review.

## 4.2 Surfaces — the extension is one consumer, the core is portable

This product's real asset is not the extension: the op-log fold, the naming chain, the extension mapping, `sanitize`, the zip writer and the `Item` model. None of them touch the DOM or a Chrome API — they already run under `node selftest.js` (§14). The extension is **one** consumer of that core.

**Decision: keep the core portable today, write no other surface today.** The cost is near zero (it is already true), and the gain is that any future surface becomes a new consumer rather than a rewrite. This is not left as an intention — it is bound to a CI gate (§19.3, gate 15): `parse.js`, `zip.js` and `registry.js` may not contain `chrome.`, `document.` or `window.`.

Surfaces assessed:

| Surface | Status | Why |
|---|---|---|
| **Browser extension** | v1 | The only surface with free access to the user's **session**. Nothing else can read a signed-in conversation without credentials — a physical constraint rather than a preference |
| **Saving to a folder** (§8.7.2) | v1 | It *is already* the editor integration. Point it at the project directory and files land in the workspace. The cheapest integration, needing no extra surface |
| **VS Code bridge** | v2 candidate | The strongest second surface: `↓` puts the file into the open workspace, in the right folder, removing the downloads round trip entirely. **The cost is real**: a loopback listener on the user's machine, requiring a pairing token, binding to `127.0.0.1` only, origin checks and explicit opt-in. Not written before that security design exists |
| **MCP server** | v3 candidate | Its only meaningful form: indexing the **local library** the extension saved and exposing it to agents ("fetch that dashboard I wrote last month"). Reading conversations itself would hit the same credential problem. Meaningless before folder saving is in use |
| **CLI** | No | No session access; asking for a cookie export is both fragile and something a user should never be asked for |
| **Web app** | No | The same reason, worse: it would require moving data to a server and breaks §17.2 outright |

**The ordering is not arbitrary:** each surface builds on what the previous one produces. The extension makes the file → the folder puts it in the project → the bridge puts it in the right place → MCP makes the accumulation searchable. Starting from the other end would mean writing a search interface over nothing.

## 4.3 Memory across sessions — the download library

Today the "downloaded this session" marker (§8.6) disappears when the session ends. But the question that matters is asked the next day: *did I already take this, and has it changed since?*

**Design: a local download index, not content.** One row per download — provider, conversation title, item name, `kind`, version label, date, the **SHA-256** of the content, and (where saved to a folder) the path. Content is not stored; a hash does the same job far more cheaply.

What it buys:

- **`✓ downloaded` becomes persistent** and version-aware: same name and same hash → `you already took this`; same name, different hash → `you took v3, this is v5` (the case users miss most)
- **Prevents duplicate writes** — instead of producing a `-2` when saving to a folder it can say "this file is already here, identical"
- **Cross-conversation recognition:** if the hash matches, an item is recognised even when it was downloaded from a different conversation — `you took this three days ago from another chat`. Producing the same artifact in two conversations is common; downloading the same file twice is unnecessary
- **Searching the past:** a `History` tab in the popup, by name, provider or date. The answer to "I downloaded that dashboard last month"
- It is exactly what a future **MCP surface** (§4.2) would index — which is why this step comes before MCP

**The privacy consequence is stated openly and the feature is off by default.** A conversation title and an item name **are conversation content**; storing them persistently changes the scope of the "content stays in memory only" commitment in §17.2. Therefore:

- The feature is **opt-in**; on first enabling, a single screen shows what is stored
- Storage is `storage.local` (**not** synced — history roaming between devices is an unwelcome surprise)
- `Clear history` is in settings, one click, and never runs without confirmation
- Item 3 of §17.2 names this feature explicitly; with it off, nothing is written
- The row count is capped (5000 by default, configurable); beyond it the oldest entries drop

## 4.4 Multi-model sidebar — why this is not that product

Someone may want a sidebar that sends the same prompt to several models. We are **not** building it, for three concrete reasons:

1. **The credential problem.** Either the user is asked for an API key (an entirely different trust relationship, and storing keys breaks §17.2) or each provider's composer is filled and submitted automatically — which was deliberately rejected in §3.3.3: a new selector surface per provider, and an act that sends data to another company on the user's behalf.
2. **Side-by-side display is technically closed.** Providers block framing with `X-Frame-Options` and CSP; showing their real interfaces inside a sidebar is not possible.
3. **The single-purpose statement collapses** (§19.6). "Downloader" and "multi-model client" cannot be defended under one listing; review would read it as scope explosion, correctly.

**The adjacent capability we already offer:** conversation transfer (§3.3.3) can be applied to N targets — starting the same context in three providers in separate tabs is one click away, with the decision to send staying with the user. And downloading their outputs to compare them side by side is what this product already does. The real core of the need (asking several models the same question) is met; the part that is not met is automation, and that part is deliberately left with the user.

## 5. Architecture

```
magpie/
  manifest.json
  _locales/tr/messages.json
  _locales/en/messages.json
  src/
    adapters/
      claude.js     # op-log, org/tree resolution, artifact panel
      chatgpt.js    # canvas + code blocks
      gemini.js     # DOM only
      perplexity.js # DOM only
      common-dom.js # provider-independent pre > code extraction (§3.4.4)
    registry.js     # baseline provider table (§3.4)
    parse.js        # pure, node-testable — fold, Item validation
    zip.js          # pure, store-only ZIP writer
    content.js      # adapter selection + DOM observation + UI injection + orchestration
    overlay.css     # button, menu, pill, toast — v2+ only; see the note below
    sw.js           # badge, system notification, optional permission
    panel.html
    panel.js        # popup AND options, one file
  icons/icon16.png icon32.png icon48.png icon128.png
  selftest.js       # node selftest.js
  store/            # Web Store deliverables (§15)
  test/fixtures/<provider>/   # redacted samples from real responses (§14)
  tools/pack.mjs tools/check-invariants.mjs tools/check-spec.mjs tools/discover.js
  .github/workflows/ci.yml .github/ISSUE_TEMPLATE/bug.yml
  docs/BREAKAGE.md docs/LIMITATIONS.md docs/SMOKE.md docs/DISCOVERY.md
  docs/design/*.html
  docs/superpowers/specs/
```

**No build step, no npm, no bundler.** `parse.js` and `zip.js` define globals; content scripts share one isolated world, so `content.js` calls them directly. Both end with an `if (typeof module !== "undefined") module.exports = {...}` shim → `node selftest.js` loads the same file.

**manifest.json (excerpt)**

```jsonc
{
  "manifest_version": 3,
  "name": "__MSG_extName__", "default_locale": "en",
  "permissions": ["storage"],
  "optional_permissions": ["notifications"],
  "host_permissions": ["https://claude.ai/*", "https://chatgpt.com/*",
                       "https://gemini.google.com/*", "https://www.perplexity.ai/*"],
  "background": { "service_worker": "src/sw.js" },
  "content_scripts": [{
    // BASELINE: every registry provider in one block — they all load the same
    // files, so separate blocks buy no isolation (§3.4.6 applies to adapter files)
    "matches": ["https://gemini.google.com/app/*", "https://www.perplexity.ai/search/*",
                "https://chat.deepseek.com/*", "https://chat.mistral.ai/*", "…"],
    "js": ["src/parse.js", "src/zip.js", "src/registry.js",
           "src/adapters/common-dom.js", "src/content.js"],
    "css": ["src/overlay.css"], "run_at": "document_idle"
  }, {
    // ADAPTER-BACKED: one block each — an error in one adapter file must bring
    // down only its own provider (§3.4.6)
    "matches": ["https://claude.ai/chat/*", "https://claude.ai/project/*"],
    "js": ["src/parse.js", "src/zip.js", "src/registry.js",
           "src/adapters/common-dom.js", "src/adapters/claude.js", "src/content.js"],
    "css": ["src/overlay.css"], "run_at": "document_idle"
  }],   // one more block in the same shape for chatgpt
  "action": { "default_popup": "src/panel.html" },
  "options_ui": { "page": "src/panel.html", "open_in_tab": true },
  "commands": { "download-current": {
    "suggested_key": { "default": "Alt+Shift+D", "mac": "Alt+Shift+D" },
    "description": "__MSG_cmdDownload__" } }
}
```

**What v1 actually ships.** The tree and the manifest above are the *target* shape, reached at v2.0 when documents and versions arrive (`docs/ROADMAP.md`). v1 has one content-script block and **no `overlay.css`**: every rule the injected UI needs is a `SHELL_CSS` template literal inside `content.js`, mounted into the shadow root along with the markup.

The reason is the same one that put the UI in a shadow root at all (§8.7). A manifest `css` file is injected into the *page's* stylesheet set, so it can only reach the shadow root's contents if the selectors are written to pierce it — which they cannot be — and its rules would apply to the page itself, which is the leakage the shadow root exists to prevent. A second stylesheet also means a second failure mode: the CSS arrives while the JS has not yet mounted, or an adapter block loads one and the baseline block another. With one shell there is one place, and the CSS cannot arrive without the markup it styles. When v2 adds document buttons injected into the page's own DOM, that placement needs page-level CSS and `overlay.css` earns its existence; until then it would be an empty file the manifest points at.


**Each adapter-backed provider gets its own `content_scripts` block and loads only its own adapter.** Loading them all in one block would refute the isolation claim in §3.4.6: a syntax error in `gemini.js` fails not that file but **the entire script load for that tab**, killing the extension on Claude too. Separate blocks make that impossible, at the cost of a few repeated manifest lines.

No `downloads` permission — `Blob` plus `<a download>` is enough. No `tabs` permission — `sw.js` uses `sender.tab.id` from the message it received.

**Why `Alt+Shift+D`:** `Ctrl+Shift+D` is reserved in Chrome for "bookmark all tabs". When an extension's requested shortcut collides with a browser command, Chrome **silently fails to register it** — the user presses it, nothing happens, and there is no visible reason. `Alt+Shift+D` is free. The user can still change it from `chrome://extensions/shortcuts`.

**Why `default_locale` is `en`:** this field sets the **fallback** language used when the browser's language is unsupported, and forms the base language of the store listing. Setting it to `tr` would show a Japanese or German user a Turkish interface. With `en` as fallback, `tr` still activates automatically in Turkish browsers — the Turkish experience is preserved exactly.

## 6. Module contracts

### parse.js (pure) — core

**Boundary:** `parseOps` belongs to **the adapter, not the core**; only an adapter knows a provider's schema (tool_use field names, `antArtifact` shape). The core takes `Op[]` and does the rest. The `parseOps` signature below is therefore **the output contract an adapter must satisfy**, not a core implementation; `buildVersions`, `extFor`, `sanitize` and `fmtName` are core and shared by every provider. No provider-specific field name leaks into `parse.js`.

```js
parseOps(conversationJson) → Op[]   // the ADAPTER implements, the core consumes
// Op: { artifactId, title, type, language, command, content?, oldStr?, newStr?, msgIndex, createdAt }

buildVersions(ops, artifactId) → Version[]
// Version: { v:1..N, content, ok:boolean, reason?, bytes, createdAt }
// fold: create/rewrite → replaces the content; update → replaces oldStr with newStr
// oldStr not found → ok:false, reason:"old_str_not_found", content stays as it was

extFor(type, language) → ".tsx" | ".html" | ...
sanitize(title)        → filesystem-safe name
fmtName(template, ctx) → "Sales-Dashboard-v3.tsx"
lineDelta(a, b)        → { added, removed }   // multiset difference, §8.2
```

**`{date}` is always ISO `YYYY-MM-DD`, in the user's local time.** A localised format cannot be used: `en-US` produces `9/9/2026`, and the `/` in it is a path separator inside a filename — `sanitize` turns it into `-` and the user gets a different name than the template promised. ISO also sorts correctly in a file listing. The timezone is **local**, not UTC: people look for a file by their own calendar day, and a file downloaded near midnight appearing as "yesterday" is confusing.

An unknown token (`{foo}`) is left as-is — silently dropping it lets the user believe their template worked.

**The default template must be `{title}-v{version}`, not `{title}`.** This extension's typical use is downloading the same artifact **repeatedly** as it is revised. A version-less template piles up `Dashboard.tsx`, `Dashboard (1).tsx`, `Dashboard (2).tsx` in the downloads folder with no way to tell which is which — Chrome's collision suffix does not even imply chronological order. With the version in the name the files are self-describing, and a second download of the same version produces the same name, pointing at what is already there.

**In tier 3 (DOM) there is no version number.** `{version}` must not be left empty and produce a dangling `-v`; it is replaced by `{date}`, so the `{title}-v{version}` template yields `Dashboard-2026-09-09.tsx`. The same substitution applies to a user template containing `{version}`.

A zip's own name is produced from **the latest version's** title (the title may have changed between versions, §3).

**Extension table.** The MIME table below belongs to the **Claude adapter** (`vnd.ant.*` appears nowhere else). For code blocks and other providers the core uses a shared **language → extension** table; an adapter only adds its own special types.

```
text/html                       → .html
application/vnd.ant.react       → .tsx  (.jsx where language is "jsx")
text/markdown                   → .md
image/svg+xml                   → .svg
application/vnd.ant.mermaid     → .mmd
application/vnd.ant.code        → by language (~20: py js ts go rs java rb php cs cpp c sh sql yaml json xml css scss kt swift)
unknown                         → .txt
```

**`sanitize` rules:** `<>:"/\|?*` and control characters → `-`; runs of whitespace → a single `-` (these are filenames, not prose — every example in this document assumes it); consecutive `-` collapse to one; leading and trailing `.` and spaces trimmed; Windows reserved names (`CON PRN AUX NUL COM1-9 LPT1-9`) get an `_` prefix; if it ends up empty, a fallback by `kind` (`document` / `code` / `attachment`).

**Truncation is by code point, not by UTF-16 unit.** `slice(0,120)` cutting through an emoji leaves half a surrogate pair — the filename lands on an invalid character and writing fails on some systems. Splitting with `[...str]` truncates by code point. Filesystems also limit names in **bytes** (ext4/APFS: 255), and Turkish or emoji characters take 2–4 bytes each, so the limit is applied as both 120 code points and 200 bytes, whichever fills first.

### zip.js (pure)

A store-only (compression method 0) ZIP writer: CRC32 table, local file headers, central directory, EOCD. Deflate is **deliberately absent** — the compression gain on text is negligible here and it would drag in `CompressionStream`'s asynchrony and size bookkeeping.

```js
buildZip([{name, bytes}]) → Uint8Array
```

**Name collisions inside a zip:** if the user's template has no `{version}` (the default has it, but a user can delete it) every version produces the same name and the zip carries three identical entries. Rule: **in zip mode `-v{n}` is always appended regardless of the template.** The zip's own name comes from the template: `Sales-Dashboard-3-versions.zip`.

For UTF-8 filenames, general purpose bit 11 (the language encoding flag) is set; otherwise names with Turkish characters break in some archivers.

**All lengths are in bytes, not characters.** The `compressed size`, `uncompressed size` and `file name length` fields in ZIP headers count bytes, and CRC32 is computed over bytes. Using `str.length` gives the right answer for ASCII and produces a **silently corrupt archive** at the first Turkish character or emoji — the file downloads and will not open. Rule: content and names are encoded once with `TextEncoder` and every field reads the `byteLength` of that `Uint8Array`. `selftest.js` pins this with a Turkish-named, emoji-content input.

**Our tests verify our arithmetic, not that the archive opens.** A correct CRC32 and consistent offsets do **not** guarantee real tools will read the file: implementations diverge on details such as `version needed to extract`, the external attributes field, and whether a data descriptor is present, and a malformed archive typically opens in *one* tool and fails in another. That is exactly the class we keep hunting: the file downloads, the user double-clicks, nothing happens.

Rule: the writer emits the most conservative shape possible — `version needed = 20`, compression method 0, **no data descriptor** (the sizes are known in advance, we are not streaming), no directory entries (a flat file list, with folders expressed only by `/` inside names). And an **interoperability test** joins the manual checklist: the produced zip is opened with Windows Explorer, macOS Archive Utility, `unzip` and 7-Zip. All four are tried on an archive containing Turkish-named, emoji-content entries — name encoding is exactly where those four diverge.

Limits: more than 65535 entries or over 4 GB requires ZIP64; that cannot arise within this extension's scope, but if it does the archive is not produced and an error toast appears — we do not hand over a broken zip.

## 7. Pipeline

1. A `MutationObserver` watches for the artifact panel. On SPA route changes (the `navigation` API, falling back to `popstate` plus a pathname comparison) state is reset.

   **The observer cannot watch `document.body`.** While Claude generates a response the page mutates hundreds of times a second, token by token. A callback listening on `body` with `subtree:true` burns CPU for the whole stream; the user experiences that not as an extension but as "Claude got slow and the fans spun up", with no way to attribute it. Rule: two-stage observation. (a) Until the panel's **container** is found, `childList` on `body` without subtree — cheap. (b) Once found, the observer narrows to that container and does not listen for `characterData` — only node insertion and removal concern us. The callback is debounced with `requestAnimationFrame` into a single "re-evaluate state" function. When the panel closes the observer returns to (a).

   Acceptance criterion: while a long response streams, the extension's CPU share must not be measurable. This is checked with a Performance profile on the manual verification list.

2. When the panel appears the split button is injected (idempotent via a `data-mg` marker). The pill is shown and an `items:present` message goes to `sw.js`.

   **Worse: we could crash the provider's application.** React (Claude, ChatGPT, Perplexity) removes the children of a container it manages by reference; Angular (Gemini) manages its own view container by index. In both cases inserting a foreign node into that container can throw a `NotFoundError: Failed to execute 'removeChild' on 'Node'` — and that takes down not our button but **the provider's page**. To the user: "ChatGPT broke", with no visible cause, and the blame goes to the provider while the fault is ours. Four providers means this risk repeated across four frameworks.

   This is not an acceptable risk. **Principle: the possibility of breaking the user's chat application outranks our feature.**

   Rules, in order:

   1. The button is appended as the **last child** of the action bar — the position least touched by React's removal and reordering
   2. **No** framework node is removed, moved or reordered; we only append
   3. In step 1 this is **deliberately stressed on every adapter-backed provider** (baseline providers inject nothing, §8.1.1): inject the button, then force repeated re-renders by switching versions, resizing the panel, sending a new message and changing tabs, while watching the console for framework errors
   4. If it fires, plan B: the button never enters the action bar at all; it is drawn as a layer attached to `document.body` and aligned over the action bar with `getBoundingClientRect`. Zero interference with the framework's DOM. The cost is position synchronisation on resize and scroll — visually a little more fragile, but it can never take the page down. For code blocks this path is already the default (§8.1.1)

   The menu, pill and toast already live in a shadow root attached to `body` (§8.7); the risk belongs to the button alone.

   **The framework deletes the injected node.** When the action bar re-renders our button disappears from the DOM. This is the number one breakage cause for extensions injecting into SPAs. Counter-measure: the observer checks not only "did the panel open" but also **whether the button is still connected** (`document.contains(btn)`), re-injecting when it is not. The injection function is written to be cheap and idempotent, and the observer callback is `requestAnimationFrame`-debounced so a render storm does not burn CPU.

3. On click, `getConversation(convUuid)` — an in-memory cache, invalidated when the DOM message count changes or after 60 seconds. There is **no** fetch per mutation.

   **The message count does not change during streaming.** While Claude writes, ops are appended to the **same** message and the message count stays fixed. An invalidation that only watches the count treats a mid-stream snapshot as fresh for sixty seconds, so a user downloading right after generation finishes gets a **half artifact** — and worse, the "writing" warning in §3.2 is computed from that same stale snapshot, so no warning appears either. Rule: a response captured while streaming is **not cached**, only held for that immediate use; when the stream is detected as finished the cache is invalidated unconditionally.

4. `parseOps` → `buildVersions` → the version list.

5. **Matching the open artifact:** panel title → candidate artifacts. Where several share a title, they must be distinguished.

   **The first 200 characters are the worst discriminator.** The beginning of a code file is its least distinctive part: two React artifacts both start with `import { useState } from "react";`, two Python files carry the same import block. This measure fails precisely in the case it exists to resolve.

   The correct order:

   1. Compare the **length** of the visible text against the latest version of each candidate; if an exact match lands on a single candidate, it wins (length is cheap and highly discriminating across code files)
   2. If several candidates share a length, compare a hash of the **whole** visible text
   3. The visible text may be truncated (§4, virtualisation) — in that case the length comparison is invalid and a **sample from the middle** is used (200 characters from the 40–60% range), never the head
   4. If nothing separates them, **both candidates** are shown in the menu with their first differing line beside the title — ambiguity is never resolved silently

6. **The displayed version:** read from the panel's own version indicator; if unreadable, the latest version is assumed.

7. Selection → `Blob` + `<a download>` → result toast.

### 7.1 Concurrency

The pipeline is asynchronous and the user is not obliged to wait. Three races:

**An in-flight request may belong to another conversation.** The user presses `↓`, then switches conversations while the fetch is running. When the response returns we are in a different conversation — applying it means **downloading the wrong artifact**. Rule: every request is stamped with a `requestId` and `convUuid`; before the response is processed, the conversation at `location` is checked to be the same, and otherwise the response is discarded silently. On route change, in-flight requests are cancelled with an `AbortController`.

**A double click is a double download.** While a request for the same artifact is in flight, a second click opens no new fetch; the button takes `aria-busy` and joins the existing request.

**Auto-download fires during streaming.** While Claude writes an artifact each op looks like a new "version"; with `autoDownload` on, dozens of files land for a single artifact. Rule: auto-download **must wait for the stream to end** (the writing detection in §3.2) and then fires once. The same artifact at the same version does not download again in that session.

### 7.2 Lifecycle

**A menu can be orphaned.** If the framework repaints the action bar, the button disappears while an open menu is left floating. Rule: the menu is closed before re-injection. It also closes on: outside click, `Esc`, panel close, route change, and panel scroll.

**An extension update orphans the content script.** When the extension is reloaded or updated, the old content script on the page keeps running but `chrome.runtime.sendMessage` now throws `Extension context invalidated` — the most common source of console noise and dead buttons in MV3. Rule: every `chrome.*` call is wrapped; on seeing that error the content script **shuts itself down**: the observer stops, injected UI is removed, and nothing is retried.

But disappearing silently is also wrong: the user looks for the button, cannot find it, and has no idea why. Before shutting down it shows **one** toast: `Magpie was updated — reload the page`. The text is read from a **pre-cached** bilingual constant because `chrome.i18n` may already be dead (this is the deliberate and only exception to the i18n rule, and its reason is written here). A page reload gives a clean installation.

## 8. UI decisions

### 8.0 Simplicity principles — the arbiter as the design grew

Features accumulated across this document: seven item kinds, a filter, multi-select, history, transfer, version menus. Each was justified on its own. **Their sum can produce unjustified complexity.** The rules below bound that sum; anything new is measured against them.

**1. The real product is the in-page button, not the popup.** Most users will never open the popup: hover → `↓` → a file with the right name. The popup is for bulk operations, history and rare cases. That is also the optimisation order — the in-page flow never becomes dependent on the popup.

**2. It works with zero configuration.** The first download works with no setting, no confirmation and no setup step. Every default must be **the right answer**; "the user can turn it on in settings" is not a design solution, it is a deferral of one.

**3. Progressive disclosure.** The primary action is always visible (`↓`). Secondary actions (copy, versions, transfer) appear **on hover**. Tertiary ones live under `…`. Settings are **not** in the popup but on the options page — a popup is for doing work, not configuring it.

**4. A control exists only when there is a choice.** The rule from §3.4.5 applies everywhere: one version means no `▾`, history off means no tab, a kind absent on the provider means no group, fewer than ten items means no filter. Showing an empty shell promises a capability that does not exist.

**5. Nothing to learn.** Icons are never left alone — the hover tooltip states the filename that will be produced, and rows carry readable labels. One line of hint on first use, then silence. A download button that requires reading documentation is a failed button.

**The test:** if a new feature makes the first download harder for a user who has **learned nothing**, that feature moves to a secondary surface or is not added.

### 8.0.1 Colour palette — letting go of Claude's colour

The previous palette was built on Claude's coral (`#d97757`); reasonable while the product was Claude-specific. It now runs on four providers, and carrying another company's brand colour creates two problems: seeing Claude's colour on ChatGPT implies **a connection that does not exist**, and the trademark rule in §15 ("imply no provider's brand") is contradicted by our own palette.

**The new palette — magpie.** The name already gives the story: a black-and-white bird with something gold in its beak.

| Token | Dark theme | Light theme | Use |
|---|---|---|---|
| `--mg-ink` | `#17161A` | `#FFFFFF` | background |
| `--mg-surface` | `#201F24` | `#F4F3F1` | card, menu, popup surface |
| `--mg-line` | `#35333B` | `#E2E0DC` | borders, dividers |
| `--mg-fg` | `#F2F0EC` | `#1A1A1E` | text |
| `--mg-dim` | `#9C99A3` | `#6B6870` | secondary text |
| `--mg-gold` | `#E8B44A` | `#8A6212` | **accent** — primary action, selection, focus |
| `--mg-ok` | `#3F8F5E` | `#2E6B45` | success |
| `--mg-warn` | `#E0A32E` | `#8A5D0F` | warning |
| `--mg-err` | `#C0392B` | `#A32B1F` | error |

**Why gold:** the meaning comes from the name — the shiny thing in the magpie's beak, which is the product. And it is none of the four providers' brand colour: Claude coral, ChatGPT green, Gemini blue-purple, Perplexity teal. **Teal and green were ruled out deliberately** — the iridescent tones that come to mind first collide with exactly Perplexity and ChatGPT.

**Contrast is a constraint, not a preference.** Gold is unreadable on a light background (`#E8B44A` on white is about 1.9:1). The accent is therefore **two separate tokens**: bright gold in dark mode, deep amber in light mode (`#8A6212`, 4.6:1 on white). Using one colour and "adjusting opacity per theme" would produce an unreadable primary action in light mode.

These tokens do **not** replace the read-colour-from-the-provider rule in §12: background and text still come from the page (injected UI must sit in the page), but **the accent is ours and fixed** — it is the brand's only visible mark.

### 8.1 The download control — a split button

The `↓` half downloads the default version in **one click**; the `▾` half opens the version menu. Reason: most downloads are "the version I am looking at"; a menu-first design makes every user pay the minority's tax every time.

**With only one version the `▾` half is not drawn** — a one-row menu is noise. A control exists only when there is a choice.

**With `defaultVersion: "ask"` the button is not split.** "Ask" means "there is no default", so the `↓` half has nothing to download. In that setting the button is a single unit and clicking opens the menu directly. A split button whose halves do the same thing offers the user a choice that does not exist.

### 8.1.1 The code-block control — one floating button, not N injections

A message can contain dozens of code blocks. Injecting a button into each brings three costs at once: the framework reconciliation crash risk **multiplied by the number of blocks** (§7 step 2), constant re-injection during streaming, and an interface turned into control clutter.

**The button shows the filename it will produce.** The name comes from a four-step chain (§3.3.1) and the user needs to see its result **before** clicking — otherwise they are hunting the downloads folder for something called `code-7.txt`. The button reads `↓ backfill.py`; a long name is middle-truncated (`↓ order-serv…py`) with the full name in the `title` attribute.

The same principle applies to the document button: hovering the `↓` half shows the name it will produce.

Rule: **one** floating download button. Bound to the container by event delegation, aligned with `getBoundingClientRect` to whichever code block the pointer or focus is over, living inside a shadow root attached to `body`. **Nothing** is inserted into the provider's DOM — the framework crash risk disappears entirely for code blocks.

**The keyboard and screen reader path is separate — and should be.** A hover-driven control does **not exist** for a screen reader user. The first answer would be "make the code block focusable", but that means adding `tabindex`, which modifies the provider's DOM — a violation of the same family as the "nothing is inserted" rule (an attribute is also overwritten on re-render, and rewriting it each time is precisely the injection loop we avoid).

The right answer is already in the design: **the popup's item list is the accessible path** (§8.6). Code blocks appear there with name, language and line count, so keyboard and screen reader users can download without any in-page control. The floating button is a **pointer convenience**, not the only route.

The consequence: code-block accessibility depends on the popup's, so full keyboard navigation and `aria` labelling of the popup list is on the pre-release gate (§19.5). Where a block is already focusable (the provider gave it a `tabindex`) the button aligns to it as well — a bonus, not a foundation. `Alt+Shift+D` downloads the focused block.

**There is no hover on touch.** Left as designed, code-block downloading would be **entirely unreachable** on touchscreen laptops and tablets — no mouse, no hover, the button never appears. Rule: under a `(hover: none)` media query the behaviour changes; a small, permanent `↓` sits in the corner of each code block, independent of hover. The same applies to mixed pen and touch devices — the device type is never guessed, the `hover` capability is queried.

This also affects hover prefetching: on touch there is no prefetch trigger, so the first tap shows a brief loading state, and drag and drop is disabled on touch (dragging collides with scrolling anyway).

**Browser zoom.** Every layer aligned with `getBoundingClientRect` (the code-block button, the plan-B button) shifts when zoom changes. Realignment triggers: `resize`, `scroll`, `visualViewport.resize`, and the panel's `ResizeObserver`. 200% zoom is on the manual verification list.

### 8.2 Version menu (popover)

```
SELECT VERSION
v3   2 min ago · 8.4 KB   +12 −3     displayed
v2 ⚠ 14 min ago · 8.1 KB  +180 −164  partial
v1   31 min ago · 6.2 KB  first version
─────────────────────────────
🗜 All versions → .zip
```

The zip row can be turned off in settings.

**A menu cannot ask for a choice without saying what changed.** The decision the user is making is "which version do I want", and the only real input to it is **what changed**. Size and timestamp do not answer that: whether the difference between 8.4 KB and 8.1 KB is one line or an entire section is invisible.

The fold already holds both contents, so a line-level difference is **free**: `+n / −n` per version (`v2 · +12 −3`). We do not produce a full diff, only a count.

**Multiset difference, not set difference.** Putting lines in a set and diffing discards duplicates — a file contains dozens of `}`, `return` and blank lines, and the set approach counts them once. The result: an edit that removed forty lines displays as `−3` and the user picks the wrong version. The correct form is a line-to-count map (`Map<line, count>`): `+n` is the sum of counts in excess on the new side, `−n` the excess on the old side. Still O(n), still no LCS, sub-millisecond on a 500-line file — but correct.

The count is always against **the preceding version**; v1 has nothing to compare with and reads `first version`.

The payoff is disproportionate: seeing the difference between "three lines corrected" and "half of it rewritten" lets the user pick the right version on the first try. Not showing it would mean hiding information we already have.

**Consecutive versions with identical content are labelled.** An `update` may have changed nothing (the same `new_str`, or an edit that lands on the same bytes). In the menu two rows show the same size and the user downloads both looking for the difference. During the fold, consecutive versions' bytes are compared; where identical, the row gets a `no change` label. The row is **not** removed — if Claude took that step the user deserves to see it; they simply do not download it for nothing.

**Our numbers must match the panel's numbers.** The claude.ai artifact panel has its own version indicator ("Version 3"). Our fold numbers by op count and that **may not agree**: Claude might not count a failed op, might start `create` at zero, or might present two consecutive updates as one version. If they drift, a user selecting "v2" from the menu downloads what the panel calls v3 — and **never notices**, because both numbers look plausible. The most insidious form of handing over the wrong file.

Rule: in step 1 our numbers are compared against the panel's indicator. If they match exactly, `v1…vN` is used. If not, **we do not present our numbering as though it were theirs**: menu rows are labelled by position and timestamp instead of `v` (`3rd edit · 14 min ago`), and the displayed one is marked `✓ displayed`. The user is never persuaded of a false correspondence.

**No capability, no control.** On a provider without version support (Gemini, Perplexity) the button is not split at all; the `▾` half is not drawn and no menu opens. An empty menu or a one-row list promises a capability that does not exist. The same rule applies to attachment support and to panels and canvases — a disabled capability is invisible, not a greyed-out control saying "not supported on this provider".

### 8.2.1 Conversation-level zip

The `🗜 All versions` row in the menu covers **one** artifact. There is a separate entry for the whole conversation: `🗜 9 items in this conversation → zip` in the popup.

Contents: the **latest** version of each item, in a folder per `kind`: `artifacts/`, `code/`, `attachments/` (`uploaded/` + `produced/`), `tool-outputs/`, `images/`, `sources/`. Foldering is required: code block names (`code-3.py`) and artifact names mix on the same level and whoever opens the archive cannot tell what is what. Only the **latest** version of each item goes in — four artifacts times five versions is a twenty-file archive nobody wants; version history is meaningful at the level of a single artifact.

**Order matters: `sanitize` first, folder prefix second.** `sanitize` strips `/` from a filename (§6) — prefixing the folder before sanitising would delete it too and flatten the archive into a single list. A zip entry is built as `kind prefix + "/" + sanitize(name)`; the separating `/` never passes through `sanitize`. This rule does not apply when saving to a folder, because no subfolders are created there (§8.6).

The zip name comes from the conversation title: `<conversation-title>-downloads.zip`. If the title is unreadable, `<provider>-downloads-<date>.zip`.

The conversation Markdown (§3.3.3) sits at the archive's **root** as `conversation.md` — whoever opens the archive in six months needs to know which conversation the files came from; a pile of files without context loses half the archive's value.

Artifacts marked `⚠ partial` or `⚠ writing` **do** go into the archive, but carry `-partial` in their names, and the toast says how many are suspect. Silently leaving them out would mean the user never noticing what is missing.

### 8.3 The pulse pill — bottom right of the panel

`● 3 versions available` — pulses twice, disappears after 4 seconds, opens the menu on click. Shown only while `notify === "inpage"`. The position: it does not cover the code and it shares a region with toasts — the user learns one place where "this extension speaks from".

Shown **once per session** for a given artifact; it does not pulse again each time the panel opens and closes.

**The trigger is the artifact completing, not the panel opening.** The panel opens the moment Claude starts writing; saying "you can download this" then is wrong, because the file is still half-written (§3.2). The signal fires when the stream is detected as finished. The same rule governs the badge pulse and the system notification.

**Opening an old conversation produces no signal.** Otherwise every visit to an archived conversation would pulse "you can download this" for an artifact produced months ago — noise rather than notification. The signal fires in two cases: (a) the artifact completed **during this page session**, or (b) the user **opened the panel themselves** and that artifact has not been seen this session. A panel already open at page load produces no signal at all; the button is still there.

The distinction rests on a principle: an uninvited notification is only justified when **something new happened**. Telling a user about something they opened themselves is repetition, not notification.

### 8.4 Toast

| Type | Duration | Example |
|---|---|---|
| started (browser download) | 2.5 s | `↓ Sales-Dashboard-v3.tsx downloading` |
| completed (chosen folder) | 2.5 s | `✓ Sales-Dashboard-v3.tsx · ~/Projects/artifacts` |
| zip | 2.5 s | `↓ Sales-Dashboard-3-versions.zip · 3 files` |
| warning | 5 s | `! Read from the page — no version history` |
| warning | 5 s | `! v2 partial: old_str did not match` |
| error | **until dismissed** | `✕ Could not download — item unreadable` |

An error never disappears on its own; the user has to notice that the file did not arrive.

**A toast can only claim what we know.** The outcome of a download started with `<a download>` is **unknowable**: Chrome reports neither completion nor failure (knowing that requires the `downloads` permission, which we deliberately did not take). So saying "downloaded" is an unverified claim. With a full disk or a policy block the user sees a green tick and there is no file.

Two paths, two different truths:

| Path | What we know | Toast |
|---|---|---|
| `<a download>` (browser downloads) | That the download **started** | `↓ Sales-Dashboard-v3.tsx downloading` |
| File System Access (chosen folder) | That the write **completed** (`write()` resolved) | `✓ Sales-Dashboard-v3.tsx · ~/Projects/artifacts` |

On the folder path, a failing `write()` produces a real error toast. On the browser path, the most honest thing available is saying it started rather than that it finished.

**Toasts are not subject to settings.** They are the result of an action the user took — feedback rather than interruption. The only configurable thing is the *uninvited* signal (§8.3 pill, §8.5 badge).

### 8.5 Logo

The rename reopens the mark, but **the criterion is unchanged: 16px.** A logo lives in the toolbar, not at 128.

**The test was run** (`docs/design/logo-magpie.html`, three candidates at 128/48/16 on light and dark toolbar strips). Result:

- **A — the full magpie** (body, head, beak, long tail, a dot for what it carries): tells the whole story at 128 and **four of its five shapes merge at 16** — the tail fuses into the body, the beak disappears. Eliminated
- **C — the existing mark** (document plus arrow): readable at 16 but stroke-based so it thins out, and it no longer relates to the name. Eliminated
- **B — head, beak and gold dot: selected**

**The selected mark:** an ink (`#17161A`) rounded square, a filled bone (`#F2F0EC`) bird head with a triangular beak, and a **gold** (`#E8B44A`) dot in front of the beak — the shiny thing it carries (§8.0.1).

Three reasons: (1) only three shapes and every one above 3px at 16 — the silhouette holds; (2) **filled forms survive small sizes better than strokes**, which thin out; (3) the gold dot is both brand accent and meaning — the thing in the beak is the product.

**The accepted limit:** B is a bird, not a magpie. What makes a magpie recognisable — the long tail, the pied pattern — is unavailable at 16px however it is drawn. The name carries the story and the mark reminds you of it. The full magpie form can be used in store imagery at 128 and above — **same brand, different detail at different scale** — but the toolbar mark is B.

**Eliminated direction:** a logo resembling Claude's spark mark — Chrome Web Store impersonation policy and trademark risk. Tonal kinship through colour is enough; imitating a mark is unnecessary risk.

**Badge states**

| State | Badge |
|---|---|
| Unsupported site | icon dimmed, no badge |
| No documents in the conversation | no badge |
| Documents present | the **count**, gold background, three pulses via `setIcon` |
| Downloaded | green `✓`, back to previous state after 2 s |
| Error | red `!`, persists |

**The badge counts documents only — not code blocks, and not tool outputs.** A long conversation can hold forty code blocks and thirty tool calls; a badge reading `40` is noise rather than information and devalues the "there is something to download" signal it exists to give. Both are reached on demand — code blocks through the floating control, tool outputs through the popup — and neither produces an uninvited signal.

**An empty badge therefore does not mean "nothing to download".** In a conversation with twelve code blocks the badge is empty, and that is correct. The popup lists everything (§8.6), so the information is not lost, it simply is not carried on the icon.

**Where the count comes from — the DOM, not the network.** There is a contradiction risk here: the pipeline in §7 fetches the conversation **only when the button is pressed**. For the badge to show a count we would have to fetch as soon as the page opens, which means several MB per conversation for a user who never downloads anything — silent, unnecessary, battery-consuming.

Solution: the badge count comes from **counting document cards in the chat thread** (`SEL.docCard`). No network request, zero cost. The network is touched only when the user wants to download.

The consequence: the badge says how many documents exist in this conversation, not how many versions they have — version information is only known after a fetch and is visible in the menu anyway. A cheap signal must not pretend to carry expensive information.

**The badge is per tab.** `chrome.action.setBadgeText({text, tabId})` — without `tabId` the badge is global and five open chat tabs overwrite each other's counts.

**The pulse cannot be done with ImageData in an MV3 service worker** — there is no `document` and no `canvas` there. Solution: `icons/pulse-1.png … pulse-3.png` are pre-rendered and shown in sequence with `setIcon({path})`. No `OffscreenCanvas` code is needed.

**A service worker dies after 30 seconds idle.** If it dies mid-pulse the icon is stranded on an intermediate frame. Counter-measure: the pulse writes the **final** (steady) state first and overlays the animation frames on top of it, so even a dying worker leaves the icon correct. On each wake, the badge state for active tabs is rebuilt from `items:present` messages.

### 8.6 Settings panel (popup = options)

**Action** at the top, settings below. Every `cfg` key (§9) has a counterpart here; no setting exists in the schema without a control in the panel.

1. **Provider strip:** the active provider and what is available on it (`ChatGPT · canvas + code · no versions`). So the user does not mistake a missing capability for a fault.

2. **Item list**, grouped by `kind`. **Only `↓` is always visible** in a row; copy, versions and transfer appear on hover (§8.0, rule 3) — showing four controls permanently would turn the list into a wall of buttons. Groups: *Documents* (artifact/canvas), *Code blocks · N*, ***Tool outputs · N***, *Citations*, *Images · N*, *Attachments · N* (split into `You uploaded` / `Produced`), *Conversation*. A tool-output row shows the tool name and result size (`search_events · 214 rows`) — with the same tool called repeatedly there is no other way to tell the calls apart. Each row: name, short meta (type / lines / size), `↓`. Document rows also carry `▾` (versions) and `🗜`. At the bottom, `🗜 All → zip`.

   This replaced the earlier single "current item" card: there is more than one item now, and the panel does not have to be open (§8.8).

3. **What to show** (`kinds`): seven switches — `artifact` · `code` · `tool_output` · `citations` · `image` · `attachment` · `conversation`. Where a kind does not exist on the provider, its switch is not drawn either (§3.4.5).

   Turning off code blocks is the only way to simplify the list in a long technical conversation, and turning off tool outputs does the same in an automation-heavy one. As the number of kinds grew, these switches stopped being decoration and became a usability condition.

4. **Notification** (`badge`, `notify`): the toolbar badge (on/off) plus the "available" announcement (off / in-page pill / system notification) — **one control**, with no separate "pulse" switch.

5. **Downloading** (`defaultVersion`, `zipAll`, `autoDownload`, `dragEnabled`): default version (displayed / latest / ask) · the zip row in the menu (on/off) · drag and drop (on/off — some people dislike accidental drags) · automatic download (on/off, **off by default**).

6. **Save location** (`saveTo`) — **per provider**: `Save to · Claude: ~/Projects/artifacts` / `· ChatGPT: not chosen`. Since a handle is bound to its origin, a single global choice is impossible (§8.7.2); the panel names it rather than hiding it.

7. **Filename** (`nameTemplate`): a template input, clickable token chips, and a **live preview**. The preview is computed from **the real name of the first item currently in the list** (`Sales-Dashboard-v3.tsx`) rather than a placeholder, falling back to a generic example when the list is empty. A preview that does not match what the user will get defeats its own purpose.

   `/` and `\` in the template are **stripped** and do not create subfolders. Subfolder support multiplies permission, nesting and failure paths, and buys a rare organisational preference in return. The token help says so, so nobody tries.

8. **Sites** (`sites`): on/off per registry provider. The list is long, so it has a **search box** and `Disable all / enable all`; all are enabled by default. Hosts the user added (`extraHosts`, §3.4.2) sit in a separate group, each with a **remove** button — revoking a permission you granted should not require hunting through browser settings. Being able to say "never run on a provider I do not use" narrows behaviour even where it cannot narrow the permission list.

9. **Correcting a name before downloading.** Clicking the name in a row makes it editable in place; `Enter` confirms, `Esc` cancels. The extension is separate and not editable (a wrong extension is a silent source of error).

   Reason: the name comes from a four-step **heuristic** chain (§3.3.1) and a heuristic can always be wrong — `code-7.py`, or `index.ts` where `use-cart.ts` was meant. Without an edit, the only recourse is downloading and renaming on disk. However good the derivation, a name generator that gives the user no final say is incomplete. A corrected name is remembered for that item for the rest of the session.

10. **Copy content to the clipboard.** A copy action next to `↓` in each row. Long-press or the secondary menu gives **`Copy as context`**: name, language and fenced content, ready to paste into a new chat (§2.1.1). For a versioned item, the version copied follows the **same rule** as downloading (`defaultVersion`, §11.2) — two actions choosing different versions would be the hardest inconsistency for a user to notice.

    Often what someone actually needs is the text rather than a file, and download-open-copy is three steps. The provider's own copy button exists only on code blocks and only at the current version; ours can copy **an older version**, **a document**, or **the conversation Markdown**. Same content pipeline, new destination.

11. **Context handoff suggestion.** When the message count passes `handoffAt`, a single dismissible row appears above the list: `This conversation is long — move the context to a new chat`. A row rather than a toast: uninvited but not interrupting. Once per session.

12. **Long-conversation behaviour.** Past ten items a **filter** box appears above the list (by name and language, instant). A forty-block conversation is unusable without one; a filter over three items is noise — hence conditional.

13. **Multi-select.** A checkbox appearing on hover in each row; with at least one selected, the bottom bar becomes `Download selected (4) → zip`. `All → zip` shows only when nothing is selected. In a forty-block conversation, "all or one" is a real constraint.

14. **Downloads are marked** (`history`). With history off the marker is **session-scoped**; with it on it is persistent and version-aware: same hash → `already taken`, different hash → `you took v3, this is v5` (§4.3). Downloading the same file twice is harmless but confusing; mistaking a different version for the same one is a real error.

    With history on, a **`History`** tab is added to the popup: search by name, provider or date, re-download from a row, `Clear history`. With it off the tab does not appear at all — showing the empty shell of a disabled feature would violate the "no capability, no control" rule in §3.4.5. With history on, settings show the record count and the **cap** (`historyMax`), editable; records dropping silently at an invisible limit is exactly the kind of quiet surprise this document rules out.

15. **Thinking blocks** (`includeThinking`): off by default; when on, a separate section in the conversation Markdown (§2.1.4.2).

16. **Call parameters in tool outputs** (`includeCall`): on/off. Turning it off gives the raw result; leaving it on means knowing what the file is six months later.

17. **Attachment size shown before downloading.** Attachment content arrives in a separate request (§3.3.2); where the size is readable from metadata it appears in the row, and where it is not the row says `size unknown` — it is never guessed. On Claude this is settled: `attachments[]` carries `file_size`, and `extracted_content` means text attachments arrive inline and need no second request at all.

18. **Progress, when the work is long.** A conversation zip can hold forty items and attachments; operations exceeding 300 ms show a determinate progress bar in the bottom bar (`12/40`). Short operations show none — a bar for 80 ms is a flicker. The operation is **cancellable**; cancelling produces no partial zip.

19. **Bottom row:** `🔒 Data stays on your device · no external requests` · `⏻ Disable on this site` · `Copy diagnostics` · `Alt ⇧ D` (if the shortcut was changed, the actually assigned key is read with `chrome.commands.getAll()` and shown — displaying the wrong key wastes the user's time).

Reasons: most people opening the popup came to download rather than configure → action on top, settings below. The classic failure of a token input is that the user cannot predict the output → live preview. An irreversible behaviour (automatic download) is never a default. The privacy line is visible, because this extension reads private conversations.

### 8.6.1 Popup interaction model

The popup is the **only accessible path** to code blocks (§8.1.1). That claim only holds if the popup's keyboard and screen reader model is specified — otherwise accessibility has been moved rather than solved.

**Keyboard.** On open, focus lands on the filter box when the list exceeds ten items, otherwise on the first row. `↑`/`↓` move between rows (working from inside the filter too, without leaving the box). `Enter` downloads, `Space` toggles selection, `Shift+↑/↓` extends a range. `E` opens the focused row's name for editing, `C` copies its content, `V` opens the version menu. `Esc` unwinds in order: cancel the edit → clear the filter → close the popup. `Tab` moves between **sections** rather than rows (filter → list → bulk bar → bottom row); putting forty-seven items in the tab order would punish the very users this path exists for.

**Semantics.** The list is `role="listbox"`, rows are `role="option"` with `aria-selected`. Each row's accessible name is `<name>, <kind>, <meta>` (`backfill.py, code block, 14 lines`) — what the icons convey visually also enters the text. Filter results are announced in an `aria-live="polite"` region (`3 matches`), once after 300 ms rather than per keystroke. The progress bar is `role="progressbar"` with `aria-valuenow`.

**Size.** A Chrome popup is capped at 800×600. The list section gets a `max-height` and scrolls **within itself**; the header, provider strip, bulk bar and bottom row stay fixed. Otherwise a forty-seven item list pushes the bulk bar off screen and a selection can be made but never acted on — a silent dead end.

**Theme and direction.** The popup is our own page: light and dark through `prefers-color-scheme`, `dir` from the interface language. Reading colours from the page (§12) applies only to injected UI and not here.

**Screen reader verification is on the pre-release gate** (§19.5): can a code block be downloaded through the popup using **only a keyboard and a screen reader**. That single test is the proof of the claim in §8.1.1.

### 8.7 Style isolation, accessibility, file writing

**Shadow DOM is not full isolation.** A shadow root protects against the page's selectors, but **inherited** properties cross the host: `font-size`, `line-height`, `color`, `direction`, `visibility`, `text-transform`. If one of those is unusual in a provider's root styles, our boxes inherit it. Rule: the shadow host gets `all: initial` and every needed property is **redefined** inside the shadow; `direction` is inherited deliberately, because in RTL we must run the same way as the page.

The pill, toast and version menu are drawn inside that shadow root, attached to a single `<div>` of ours. The provider's global CSS (including Tailwind and Angular Material resets) cannot touch our boxes, and our CSS cannot pollute the page. The exception: the split button has to sit **inside** the provider's action bar to look native and cannot move into the shadow DOM. It therefore uses `mg-` prefixed class names with every needed property written explicitly (inherited values are not relied on).

**Accessibility.** The button is `role="button"` with an `aria-label` (i18n) and a `title`. The menu is `role="menu"` with `role="menuitem"` rows; arrow keys navigate, `Enter` selects, `Esc` closes and returns focus to the button. The focus ring stays visible. Toasts are `role="status"` (errors: `role="alert"`).

**Motion.** Under `@media (prefers-reduced-motion: reduce)` the pulse and pill animations are cancelled; the pill still appears, it simply does not pulse. The badge pulse is likewise fixed to a single frame.

**Writing direction.** Providers run with `dir="rtl"` in Arabic and Hebrew interfaces; a pill or menu pinned with `right: 10px` lands on the wrong side or overflows the panel edge. Positioning uses **logical** rather than physical properties (`inset-inline-end`, `padding-inline`, `margin-inline-start`). It costs nothing now and would mean reviewing every rule individually later.

**File writing.** Content is written **verbatim**: UTF-8, no BOM, no line-ending conversion, no trailing newline added — the user gets the bytes the model produced. The `Blob` MIME type is set from the real type (`text/html`, `image/svg+xml`, `text/plain;charset=utf-8` for code). The created object URL is released with `URL.revokeObjectURL` after the download is triggered.

**Why there is no `tabs` permission.** The shortcut and the popup reach the target tab through `chrome.tabs.sendMessage(tabId, …)`; for the popup, `tabId` comes from `chrome.tabs.query({active:true, currentWindow:true})`. That call returns the tab id without the `tabs` permission — the permission is only needed to read fields such as `url` and `title`, which we do not need. Where no content script is present, `sendMessage` errors, the error is swallowed, and the user sees a `nothing to download on this page` toast.

### 8.7.1 Drag and drop

The `↓` button is `draggable`. Dragging drops the file straight into VS Code, Finder or Explorer — without going through the downloads folder.

```js
e.dataTransfer.setData("DownloadURL", `${mime}:${filename}:${blobUrl}`)
```

**The trap: `dragstart` is synchronous.** The content has to **be ready** at the moment that line runs; there is no `await fetch(...)` there. Dragging is only possible when the versions are already loaded.

The answer is **hover prefetching**: when the pointer enters the button (or it receives keyboard focus) the fetch starts quietly. People almost always rest the pointer on a control for a moment before dragging it, and that moment is enough. If the content is not ready the button is not `draggable` — being unable to drag beats dragging half a file.

**The floating code button is draggable too.** The same `DownloadURL` mechanism and the same hover prefetch — dragging a code block into an editor is as natural a gesture as dragging a document, and it needs no separate code path.

**Dragging a multi-selection produces a zip.** A `DataTransfer` carries one `DownloadURL`; there is no way to drag several files. If a drag starts while a selection exists, the payload is the zip of that selection (the same builder as §8.2.1). Consistent for the user: select and click downloads a zip, select and drag drops the same zip.

**You cannot drag from the popup — and that is a platform limit, not a design decision.** Chrome closes a popup when it loses focus, so the drag would cancel the moment it left. Better not offered than offered and failing every time: popup rows are not `draggable`. Recorded in `docs/LIMITATIONS.md`.

The dragged version is the default version (`defaultVersion`).

**The `blobUrl` cannot be released on `dragend`.** `dragend` fires on our side while the receiving application may **not have read the blob yet**; calling `revokeObjectURL` there makes the file arrive empty or not at all — and it varies by drop target, which is the "works on my machine" kind of bug. Rule: the URL is released **on a delay** (≥60 s) or at page or route change, never on `dragend`. The retained blob is a few hundred KB; the leak risk is smaller than the broken-drop risk.

**Dragging must not swallow the click.** On a `draggable` button, small pointer movements can turn a click into a drag and the download never fires. The primary action is the click: a drag only begins past a movement threshold, `dragstart` calls `stopPropagation` so it does not reach the provider's own drag handlers, and the manual checklist tests **clicking and dragging separately**.

Hover prefetching also removes click latency — the feature's second benefit.

### 8.7.2 Saving to a folder (File System Access)

In settings: `Save to: Browser downloads | Chosen folder`. Choosing the second opens `showDirectoryPicker()` and the returned `FileSystemDirectoryHandle` is stored in IndexedDB.

**To verify (step 1):** whether `showDirectoryPicker` can be called from a content script's isolated world. The secure-context and user-gesture conditions are met, but this API's behaviour in extension contexts can vary by version. If it cannot, the fallback is making the choice on the extension's own options page. This is the feature's **only real assumption**; verified late it becomes expensive.

**Where the handle lives, and what that costs.** A `FileSystemHandle` cannot be serialised into `storage.sync` and does not survive `chrome.runtime` messaging; in practice the only place is IndexedDB reachable from the content script, which is **that provider's origin storage**. Three consequences:

(a) **The folder preference is per provider.** Choosing a folder on Claude does not apply on ChatGPT — different origins, and the handle cannot travel. This is not a shortcoming but the browser's security model; users nevertheless expect "I chose it once, it applies everywhere". So the settings row names the provider (`Save to · ChatGPT: not chosen`) and the first download on each site asks. It is also stated in `docs/LIMITATIONS.md`. We leave no silent surprise.

(b) If the user clears that site's data the folder preference is lost — the setting returns to `downloads` and says so, rather than silently drifting back to the downloads folder.

(c) Because that storage is shared with the page, **only the handle** goes there and no other user data.

**The trap: permission lapses with the session.** After a browser restart the handle survives but write permission does not; `handle.requestPermission({mode:"readwrite"})` needs a fresh **user gesture**. The download click supplies it, but the user may deny or dismiss the prompt.

Rule — three-step behaviour:

1. Permission already granted → written straight to the folder, toast `✓ file · ~/Projects/artifacts`
2. Permission requested and granted → written, same toast
3. Permission denied or dismissed → **falls back to a normal browser download**, yellow toast: `No folder permission, saved to downloads`

In no case is the outcome "nothing happened". The setting is not turned off; the user can grant permission again on the next download.

If a file of that name exists it is not overwritten; `-2`, `-3` are appended (up to `-99`; beyond that an error toast — a visible failure rather than an unbounded loop). Chrome does this for browser downloads; writing into a folder, **we** have to, or it is silent data loss. The existence check uses `getFileHandle(name)` — a `NotFoundError` means the name is **free**; calling it with `create:true` would create the file and make the check meaningless, so the check is always made without `create`.

### 8.8 First run and empty states

Every screen in this design so far shows the **populated** state. What a user actually sees first is an empty one.

**First install.** `chrome.runtime.onInstalled` (`reason === "install"`) opens the settings page in a new tab: what the extension does, where the button will appear (with a screenshot), the shortcut, the privacy line. Once only. On update (`reason === "update"`) nothing opens — nobody wants a tab per update.

Additionally, **the first time a downloadable item is seen**, the pill appears with different text: `● Downloads happen here`, staying for 6 seconds. The trigger is the item, not the panel — Gemini and Perplexity have no panel at all, and tying it to the panel would mean the introduction never appearing there. Once only, with a `seenIntro` flag in storage.

**The popup's empty states.** The item list from §8.6 takes these forms when there is nothing to show:

| State | Card content |
|---|---|
| Not on a supported conversation | `Open a conversation on Claude, ChatGPT, Gemini or Perplexity` + four links |
| Nothing downloadable in the conversation | `There is nothing to download in this conversation` + a short explanation |
| Items exist, panel closed | `2 documents · 5 code blocks found` + a direct `↓` (downloadable without opening the panel; the data comes from the API or the DOM) |
| Read failed | `Could not read` + `Try again` + `Why?` (a short explanation pointing at BREAKAGE.md) |
| Write failed (folder) | The row stays red with `Try again`; the item is **not** removed from the list, so a second attempt is possible |
| Adapter failed validation | `Temporarily disabled on this site` + `Reload the page` (the only way back; it does not vanish silently) |
| The interface appears to have changed | The self-diagnosis message from §8.8.1 + `Report an issue` |

The third row is a design gain: because the data comes from the API rather than the panel, **the panel does not need to be open to download an artifact.** The popup can list artifacts whose panel is closed.

**But that bypasses open-artifact matching.** Step 5 in §7 resolves which artifact to download from the panel title, and with the panel closed there is no such title. The popup flow is therefore defined separately:

1. The popup opens → it asks the content script for the **item titles** in the conversation (document cards, code blocks, attachments; from the DOM, no network)
2. If there is one item it is chosen directly; if several, the popup shows them as a grouped list (§8.6)
3. When the user picks one, fetch and parse happen and the versions are listed inside the same popup
4. Downloading is delegated to the content script (`<a download>` runs in the page context and is not cancelled when the popup closes)

So identity comes **from the panel** when it is open and **from the user's choice** when it is not. Ambiguity is never closed by guessing.

**No empty state is silent.** An empty card always says why it is empty and what to do; the user must be able to tell a broken extension from a working one.

**Emergency stop.** At the bottom of the popup: `⏻ Disable on this tab` and `⏻ Disable on this site`. Pressing either removes all injected UI, stops the observer, and stays silent until the page is reloaded. The per-tab form is temporary state in `storage.local`; the per-site form writes `cfg.sites` (§9) — there is no separate `disabled` flag, because a permanent per-site choice is exactly what that key already means.

Reason: one day something will go wrong on one of the providers and the user will not know whether it came from us. Being able to switch it off in two seconds without uninstalling helps both sides — "I turned it off and it went away" is a diagnosis, "I uninstalled it" is not.

### 8.8.1 Noticing that it broke

The most likely failure in the field is a provider changing its interface and the button disappearing. That failure has **no error message** — for the user the extension works one day and is gone the next, and they most likely assume they turned it off themselves. We do not hear about it either (no telemetry), so it persists until someone complains.

Detection is cheap, though: **we know we are on a conversation page, and if no `SEL` matches anything**, the interface changed. The two conditions matter together — "a selector did not match" alone also happens in an empty conversation.

Rule: after the page loads, if the conversation id resolves (§4) but `SEL.chatRoot`, `SEL.codeBlock` and `SEL.docCard` all find nothing, retry once after 5 seconds; if still empty the state becomes `interface-changed`:

- Red `!` badge
- At the top of the popup: `The interface on this site appears to have changed — Magpie needs an update` + a `Report an issue` link (with the diagnostics block prefilled)
- **Nothing** is injected into the page and no toast fires — the user did not ask for anything, and an uninvited warning is only justified once they open the popup

The gain runs both ways: the user is spared the "is it broken, or is it me" question, and the report flow (§19.9) is routed into the right class. A self-diagnosing failure class, with zero telemetry.

### 8.9 Diagnostics — a bug report without telemetry

There is no telemetry (§17), so when something breaks we learn about it **only if the user can describe it** — and "it doesn't work" is not enough to fix anything.

A **Copy diagnostics** link sits in the popup's bottom row and writes a block of text to the clipboard containing no sensitive data:

```
Magpie 1.0.0 · Chrome 141 · en
Provider: chatgpt · adapter LAST_VERIFIED 2026-09-09
Tier: 3 (DOM)              ← which source was used
Org resolution: cookie ✓   ← adapter-specific lines; each adapter adds its own fields
Conversation request: 404
SEL: panel ✓ · actionBar ✓ · codeBlock ✗ · versionIndicator ✗
Last error: TypeError: … (first line)
```

**What it does not contain:** conversation text, item content, item titles, **tool names** (§2.1.3.2 — a tool name alone leaks what a business does), **history records**, conversation or org UUIDs, usernames, email addresses, URLs. Only which tier ran, which selectors matched, and the error type.

This block can be pasted into a GitHub issue and maps directly onto the diagnosis tables in `docs/BREAKAGE.md`. A real bug report with zero telemetry.

## 9. Settings schema

`chrome.storage.sync`, a single key `cfg`:

```js
{
  badge: true,               // toolbar badge + pulse
  notify: "inpage",          // the "available" announcement: "off" | "inpage" (pill) | "system"
  autoDownload: false,
  defaultVersion: "current", // "current" | "latest" | "ask"
  nameTemplate: "{title}-v{version}",  // {title} {version} {date} {ext}
  zipAll: true,              // the "all versions → zip" row in the menu
  saveTo: "downloads",       // "downloads" | "folder" (§8.7.2)
  kinds: { artifact:true, code:true, attachment:true, conversation:true,
           tool_output:true, citations:true, image:true },
  includeThinking: false,    // include thinking blocks in the conversation Markdown (§2.1.4.2)
  includeCall: true,         // embed call parameters in tool outputs (§2.1.3.0)
  handoffAt: 40,             // suggest a context handoff past this message count (§2.1.1); 0 = off
  sites: { … },              // registry id → bool; a missing id defaults to enabled
  extraHosts: [],            // origins the user granted (§3.4.2)
  history: false,            // download history — opt-in, off (§4.3)
  historyMax: 5000,          // record cap; oldest entries drop beyond it
  dragEnabled: true          // §8.7.1
}
```

Missing fields are filled with defaults at read time (no migration needed for schema evolution).

**State outside `cfg`, deliberately separated.** `seenIntro` (whether the introduction pill has been shown) and per-tab temporary disabling are **not settings** — they are application state rather than user preferences; putting them in `cfg` would require a control in the settings panel (§8.6's rule) and there is nothing to show. They live under separate keys in `storage.local`. Permanent per-site disabling *is* a real preference and lives in `cfg.sites` — the "permanent disable" in §8.8 writes exactly that key, and there is **no** separate `disabled` field.

`storage.sync` may be disabled by enterprise policy or over quota; on a write failure it falls back silently to `storage.local`. Losing settings is not a price worth paying for synchronisation.

When `notify: "system"` is selected, `chrome.permissions.request(["notifications"])` is called **at that moment**. If the user declines, the segment quietly returns to `"inpage"` and an informational toast is shown once.

## 10. Messaging protocol

content → sw:

```js
{ type: "items:present", docs, code, attachments }  // the badge counts docs only (§8.5)
{ type: "items:none" }                              // clear the badge
{ type: "notify", level, title, body }              // system notification (where permitted)
```

sw → content:

```js
{ type: "cmd:download" }                     // Alt+Shift+D — the focused item, else the open document
{ type: "cfg:changed", cfg }
```

panel → content (active tab):

```js
{ type: "items:list" }                        // item titles from the DOM, no network (§8.8)
{ type: "item:versions", key }                // fetch and parse, returns versions
{ type: "item:download", key, version|"zip" } // key is REQUIRED — a version alone does not identify an item
{ type: "zip:conversation" }                  // every item in the conversation (§8.2.1)
{ type: "diag:get" }                          // the diagnostics block (§8.9)
{ type: "site:disable", scope: "tab"|"site" } // emergency stop (§8.8)
```

The shortcut's name does not appear in the protocol; `sw.js` translates the `chrome.commands` event into `cmd:download`. Changing the shortcut does not change the protocol.

## 11. Failure matrix

| Situation | Behaviour |
|---|---|
| `/api/organizations` 401/403 | Tier 3 (DOM) + yellow toast |
| Conversation JSON schema unrecognised | Tier 2 → if empty, tier 3 + yellow toast |
| Nothing parsed at all | Tier 3 |
| `old_str` did not match | Version `⚠ partial`, downloadable, name carries `-partial` |
| Open-artifact match ambiguous | All candidates shown in the menu |
| The DOM could not be read either | Red toast (persistent) + `console.error`, **no download** |
| ZIP > 100 MB | Warning, still attempted; not produced at the 65535-entry / 4 GB limits (§6) |
| Notification permission denied | `notify` → `"inpage"`, informational toast |
| Folder write permission denied or dismissed | Falls back to a browser download + yellow toast (§8.7.2) |
| The chosen folder was deleted or is unreachable | The handle is discarded, the setting returns to `downloads`, and the user is told |
| A file of that name exists in the folder | `-2`, `-3` suffix — never **overwritten** |
| Drag started before the content was ready | The button is not `draggable`; it becomes so once the hover prefetch completes |
| A suspect artifact in a conversation zip | Included, named `-partial`, and the toast says how many are suspect |
| The provider's site data was cleared | That site's folder handle is gone; the setting returns to `downloads` and **the user is told** |
| `showDirectoryPicker` unavailable in the content script | The picker moves to the options page (verified in step 1) |
| A drag swallowed the click | Movement below the threshold counts as a click; dragging begins past it |
| An adapter failed `Item[]` validation | That adapter is disabled and recorded in diagnostics; the others keep working (§3.4.6) |
| The provider lacks a capability | No control is drawn at all — not even a greyed-out one |
| The attachment endpoint could not be found | Attachments are out of scope on that provider and never mentioned in the UI |
| A binary attachment | Written as an `ArrayBuffer`; **never** passed through a text conversion |
| A tool output readable only from the DOM | Item marked `⚠ may be truncated`, name carries `-partial` (§2.1.3.1) |
| Injection crashes the framework | Plan B: the button becomes a body-anchored aligned layer (§7 step 2) |
| A leftover artifact marker in a tier-2 body | Version `ok:false`, `reason:"tier2_ambiguous"` |
| `old_str` fails on a line-ending difference | The mismatch is reported; content is **never normalised**, and this is the first diagnosis in BREAKAGE.md |
| An empty-bodied `create` | Valid; a zero-byte file downloads |
| Our numbers disagree with the panel's indicator | The `v` label is dropped in favour of position plus timestamp (§8.2) |
| Two consecutive versions are byte-identical | Labelled `no change` in the menu; both stay downloadable |
| A zip or bulk download was cancelled | **No** partial archive is produced; nothing downloads, informational toast |
| 429/403 during bulk attachment download | The operation stops, no zip is produced, `select fewer items` — not retried (§3.3.2) |
| Attachment size unreadable from metadata | Shown as `size unknown`, never guessed |
| History exceeded `historyMax` | Oldest records drop silently; the limit is visible in settings |
| `storage.local` quota exhausted | History writing stops with one warning; **downloading is unaffected** — history is a convenience, never a path |
| No file after `<a download>` | Unknowable; this is why the toast says "downloading" rather than "downloaded" |
| `old_str` occurs 2+ times in the body | Version `⚠ partial`, `reason:"old_str_ambiguous"` |
| An `update` arrived with no `create` | Item `⚠ no base found`, no downloadable version (§3.0.1) |
| `type` changed between versions | Extension per version; `v2.html` and `v3.tsx` can coexist |
| The active branch could not be resolved (broken `parent_message_uuid` chain) | The newest `created_at` leaf is chosen + yellow toast |
| Shortcut pressed with no item | `! Nothing to download on this page` toast |
| Shortcut on a tab with no content script | Silent no-op (the error is swallowed) |
| A provider uses a closed shadow root | That provider is **removed from scope** (§3.4.4.1); no half support |
| The conversation is inside an iframe | `all_frames` added if actually required, and not otherwise (permission surface) |

Principle: better no file at all than a broken one.

### 11.1 Which numbers are tunable and which are not

Some thresholds in this document follow from a **principle** and some are **guesses**. Not being able to tell them apart leads an implementer either to change something load-bearing or to live with a genuinely badly chosen value.

**Invariant (follows from a principle, do not touch):**
the exactly-one-match rule for `old_str` · zip fields being byte-denominated · the 120 code point **and** 200 byte name limits (filesystem limits) · the ZIP64 thresholds (65535 / 4 GB) · `version needed = 20` · the toast saying "downloading" (a limit of knowledge, not a preference)

**Tunable (improve by measurement):**
`MIN_CODE_LINES = 3` · `handoffAt = 40` · the 60 s conversation cache TTL · the 4 s pill duration and 6 s introduction · the 2.5 / 5 s toast durations · the 5% cross-tier divergence threshold · the 60 s drag blob release delay · the 90 / 180 day `LAST_VERIFIED` windows · the performance budgets (§19.2) · the 10/50/100% rollout steps and the 48-hour gaps

Tunable numbers are kept as named constants in one place; no bare numbers are scattered through the code. Where a number's origin is unclear it counts as **tunable** — claiming a principle requires evidence.

### 11.2 Interaction semantics — where settings intersect

Each setting was defined alone; what they do **together** was not. Each of these is a real decision:

| Situation | Decision | Reason |
|---|---|---|
| `defaultVersion: "current"` but the panel is closed | There is no "displayed" version → falls back to **the latest** and the menu labels it `latest version` | Better to say which rule was applied than to silently interpret an undefined preference |
| `cfg.sites[adapter] === false` | The **first thing** the content script does is this check; when false no observer is set up, no DOM is read, and it exits immediately | The manifest match already loaded it; disabling can only be enforced in code, and must be enforced at the earliest point |
| `autoDownload` on, `kinds.code` off | Code blocks do not download automatically | A hidden kind arriving in the background is the opposite of the user's intent in hiding it |
| "Download selected" with one item selected | A **plain file**, not a zip | A one-entry archive adds an extraction step for nothing |
| Select-all while a filter is active | Only the **visible** items are selected | What you see is what you get; selecting what the filter hides produces surprises |
| "All → zip" while a selection exists | The bar switches to **the selection**; "all" appears only with nothing selected | Two bulk actions visible at once makes it unclear which will run |
| The shortcut with nothing focused | The open document downloads; failing that, `! Nothing to download on this page` | A silent no-op suggests the shortcut is broken |
| A kind hidden by `kinds`, in a conversation zip | The zip covers **the visible kinds** | The zip is the list in bulk; containing what the list does not show would be inconsistent |

## 12. The DOM dependency layer

**Every** selector belonging to a provider lives in a single `SEL` object in that adapter's file. `content.js` contains no provider selector — if it did, adapter isolation (§3.4.6) would be punctured and one provider's change would mean repairing the core:

```js
// If THIS provider's interface changes, only this is updated.
const SEL = { chatRoot,                                   // event delegation + floating control container
              panel, panelTitle, actionBar, docCard,      // docCard → badge counting (§8.5)
              codeBlock, codeLang,                        // common-dom.js override point
              versionIndicator, codeTab, streamIndicator, // streaming detection (§3.2)
              attachmentChip };                           // where capabilities.attachments
```

This is an anti-corruption layer. Every extension depending on third-party DOM eventually breaks; the question is not whether but whether the repair touches one file or ten.

Every selector tolerates `null`: a selector that finds nothing throws no exception, it drops a tier.

**Selectors may not depend on text.** Provider interfaces are localised; a selector looking for `[aria-label="Copy"]` or the word "Preview" **silently fails** for a user running the interface in Turkish — and the person who wrote the extension, whose interface is in English, will never see it. Rule: only structural, language-independent markers (DOM hierarchy, `data-*`, `role`, icon `svg` shape). Text matching is forbidden. Verification: each provider's interface is switched to another language and the whole flow retried.

**Theme.** Providers have light themes too; injected UI that assumes dark becomes an unreadable smudge in light mode. Colours are not hardcoded: the provider's own computed background and text colours are read into CSS variables (`--mg-bg`, `--mg-fg`, `--mg-line`). Whatever mechanism a provider uses to switch themes (a class, `data-*`, `prefers-color-scheme`) we follow it, and no per-provider colour table is needed. The accent is **not** read from the page — it is ours (§8.0.1): bright gold in dark mode, deep amber in light. Background and text come from the page; the accent comes from the brand.

### 12.1 Rules for reading text out of the DOM

Virtualisation (§4) is not the only trap. The DOM is a **display layer**; everything it does to make code readable is a corruption source for anything reading it as data. All four are real and all four are silent:

**1. UI elements can sit inside the code node.** A line-number gutter, a "Copy" button, a language badge — depending on the provider these can live **inside** the `pre`. `pre.textContent` picks them up and writes `1 2 3 …` at the start of the file or `Copy` into the middle of it. Rule: text is read from the **code node** that `SEL.codeBlock` points at, and UI children beneath it (`button`, `[role="button"]`, the line-number gutter, the language badge) are removed from a **cloned** copy before reading. The page's own DOM is never touched — the work happens on the clone.

**2. `textContent`, never `innerText`.** `innerText` obeys CSS: a theme applying `text-transform: uppercase` would uppercase the code, hidden nodes are skipped, whitespace is normalised. `textContent` gives the raw text. This is a rule, not a preference.

**3. Zero-width characters.** Some interfaces insert `<wbr>` or U+200B for line wrapping; `textContent` carries them along and the code is **invisibly** corrupted — the compiler errors and the user cannot see why. Rule: in the DOM tier, U+200B, U+200C and U+FEFF are stripped. In tiers 1 and 2 they are **not** — there the content arrives raw and those characters may genuinely belong to the code. The cleanup is scoped to where the damage originates.

**4. Collapsed or "show more" blocks.** If the content is clipped by CSS, `textContent` is complete and there is no problem; if it was removed from the DOM this is the same case as virtualisation in §4 and takes the same completeness proof.

These four rules live in a single `readCodeText(node)` in `common-dom.js` — every provider, and both code blocks and tier 3, use the same path. Written separately, one of them ends up missing a rule.

**Reading the DOM in preview mode.** When falling to tier 3 the code only exists on the Code tab. Clicking that tab programmatically changes the user's view — their choice, not ours. Rule: the current tab is recorded, we switch to Code, read the text, and **restore the previous tab**. Ideally the user sees nothing but a brief flicker. If the read fails while starting in Preview, the previous tab is restored anyway (`try/finally`).

## 13. i18n

`_locales/en` (**default**, and required to match `default_locale` in the manifest — §5) plus `_locales/tr`. All user-visible text goes through `chrome.i18n.getMessage()`. Hardcoded strings are forbidden — retrofitting i18n is painful, and the store requires it.

## 14. Tests

`node selftest.js`, no framework, assertion-based.

**Adapter conformance suite.** One suite runs against every adapter's `parse()` output: are the required `Item` fields present, is `kind` valid, does `ext` begin with a dot, is `versions` non-empty, can `title` be sanitised. Adding an adapter means adding a fixture and running the same suite. The adapters differ; the contract is one.

**Fixtures pin the contract.** If every test runs on hand-written input, they all stay green when a provider's real response schema changes and the extension breaks in the field. So `test/fixtures/<provider>/` holds **redacted samples taken from real conversations** (JSON where an API exists, HTML fragments for DOM-only providers): a single artifact, a multi-version artifact, a branched conversation, two artifacts sharing a title, a half-written streaming artifact — and per provider: a message with several code blocks, a block with no declared language, a block shorter than three lines, a block carrying a filename in its fence, an attachment record. Every adapter's `parse()` runs against all of them.

The gain: when a provider changes its schema the work becomes "dump a fresh conversation, replace the fixture, look at where the test broke". A schema change drops from a mystery to **a red test**. Fixtures are not committed unredacted — no conversation text, usernames or org UUIDs remain in them.

**parse.js**

- `parseOps`: the structured `tool_use` form; the raw `<antArtifact>` form; a mixture of both; attributes in arbitrary order; nested backticks and `<` characters in the body
- `toolOutputs`: call parameters wrapped in `.json` / as comment lines in `.csv` / as front-matter in `.md`; raw output with `includeCall:false`; name from the `tool_result` block (tool plus index), extension by shape (object → `.json`, rows and columns → `.csv`, text → `.md`); one tool called five times yields five items; content untruncated
- `activeBranch`: in a tree branched by an edited message only the active branch's ops are collected; an `update` from the abandoned branch **never** enters the replay; falling back to the newest leaf on a broken chain; op order follows branch position even when `created_at` moves backwards
- `readCodeText`: a block containing a gutter or copy button returns only code; U+200B is stripped; case is preserved under a `text-transform` theme
- `sanitize` security arm: `../../etc/passwd` and `~/x` lose their path components; an `<img onerror=x>` title becomes harmless text in a filename
- `buildVersions` edge cases (§3.0.1): a second `create` does not reset the counter; an `update` with no `create` → `no_base`; a `type` change produces per-version extensions
- `buildVersions`: create→update→rewrite→update replay correctness; `ok:false` and unmodified content when `old_str` is not found; `ok:false` plus `old_str_ambiguous` when it occurs twice; a single `create` → one version; a title change between versions reflected in the filename
- `extFor`: react+tsx → `.tsx`; react+jsx → `.jsx`; text/html → `.html`; mermaid → `.mmd`; svg → `.svg`; code+python → `.py`; unknown → `.txt`
- `sanitize`: cleaning `a/b:c*?"<>|`; `CON` → `_CON`; a 200-character title capped at 120; a title of only `...` → the per-kind fallback name; **truncating an emoji title leaves no half surrogate**; a multi-byte title hits the 200-byte limit first
- `fmtName`: every token, a missing token, an unknown token left literal; `-partial` inserted immediately before the extension and independently of the template
- `lineDelta`: multiset difference counts correctly across two versions containing repeated lines (a set-difference implementation **fails** this test); v1 reads `first version`
- zip entry paths: the `code/` prefix is applied after `sanitize` and the separating `/` survives

**zip.js**

- `CRC32("hello") === 0x3610a686`
- local header signature `0x04034b50`, EOCD signature `0x06054b50`
- in a two-entry zip the central directory offset equals the total byte size of the local headers
- **with a Turkish-named, emoji-content entry every size field equals `byteLength` rather than the character count** — without this test, multi-byte content silently produces a corrupt archive
- general purpose bit 11 (UTF-8 flag) set; `version needed = 20`; **no** data descriptor
- interoperability: the produced archive opens in Windows Explorer, macOS Archive Utility, `unzip` and 7-Zip (§6)

**Manual verification list** — run **in full on every adapter-backed provider and by sampling on registry providers**: every adapter each release, plus three registry providers at random, plus any whose `LAST_VERIFIED` exceeds 90 days. Hand-testing twenty providers per release is unsustainable; the freshness mechanism (§19.8) spreads the rest over time. The chosen sample is recorded with its date in `docs/SMOKE.md` so the rotation genuinely covers the list.

Where a provider lacks a capability, that line is marked "not applicable" rather than skipped. Additionally, per provider: the floating code control aligning to the correct block; blocks shorter than three lines receiving no control; all four steps of the naming chain exercised; attachment downloads not corrupting a binary file; the folder preference being asked per provider.

Claude-specific list: a real three-version React artifact; a single-version markdown; SVG; mermaid; very long (>500 line) HTML; two artifacts sharing a title; the fallback while signed out; **a conversation branched by an edited message**; two claude.ai tabs open without their badges interfering; the button still present after a framework re-render; the panel tab restored after a Preview-mode fallback; animation-free operation under `prefers-reduced-motion`; keyboard navigation of the menu; **a Performance profile while a long response streams** (the extension's CPU share must not be measurable); the `{date}` template producing ISO under the `en-US` locale; the diagnostics block containing no conversation data; **downloading while Claude writes and again after the stream ends** (the second file must be complete); downloading from the popup with the panel closed; the popup's selection list in a two-artifact conversation; **dragging the button into VS Code** (with and without hovering first); the first download after choosing a folder and restarting the browser (permission prompt, and the fallback on denial); downloading when a file of that name exists in the folder; a zip of a four-artifact conversation; **the dragged file opening intact at its destination** (the blob must not be released early); clicking and dragging working separately on the same button; the button being a single unit under `defaultVersion:"ask"`; **opening an old conversation producing no signal at all**; **forcing repeated re-renders with the button injected while watching for framework errors** (switch version, resize the panel, send a message, change tabs); an artifact whose body contains `</antArtifact>` downloading in full; disabling from the popup; **downloading a code block on a touchscreen** (is the control reachable without hover); alignment of positioned layers at 200% browser zoom; **comparing the menu's numbers against the panel's "Version N" indicator**; **comparing tier 1 output against the provider's copy button byte for byte**; the API returning every message in a 200+ message conversation; downloading the same artifact twice and the names diverging; the DOM fallback substituting the date for `{version}`; **pressing `↓` then switching conversations before the response arrives** (the wrong file must not download); a fast double click (one file only); auto-download while Claude writes an artifact (nothing must download until the stream ends); the panel closing while a menu is open; **reloading the extension and returning to an old tab** (the console must stay clean and the UI must remove itself); the settings tab opening on first install; the popup's empty state off a supported site.

## 15. Chrome Web Store deliverables

In `store/` — **all written**, as text rather than description:

| File | Contents |
|---|---|
| `listing.tr.md` / `listing.en.md` | Name, the 132-character short description, the long description |
| `privacy.tr.md` / `privacy.en.md` | Privacy policy — **the source for the published URL** |
| `permissions.md` | A justification per permission, the data-use declaration, and its technical basis |
| `screenshots.md` | The list of five images: which shows what, why, and the rules |

Detail:

- **Contact and ownership** — the same information appears in the store record, the privacy policy and the `README`: publisher **Ömer Faruk Ceylandağ**, contact **faruk@katatechnology.co**, user support **team@katatechnology.co**. The Web Store requires **a reachable contact address** in the privacy policy; separating the support address from the personal one keeps the channel open even if the publisher changes
- **Privacy policy** (TR + EN): what is accessed (conversation content on registry providers and user-granted hosts, only within the user's own session), where it goes (**nowhere** — no external requests, no telemetry, no analytics), what is stored (settings only, `storage.sync`).
  **The Web Store wants this as a public URL, not a file.** The markdown in the repository is not sufficient; the policy is published through GitHub Pages (or equivalent) and the URL entered on the store form. This is a separate pre-launch task and the listing is rejected if it is forgotten
- **Listing copy** TR + EN: the short description (132 chars), the long description, the single-purpose statement, and the permission justifications (`storage` → settings; the host permissions → reading conversation content, each justified separately; `notifications` → optional, only if the user enables it).
  The long description's **first paragraph** answers the "can read and change your data on these sites" notice Chrome shows at install: why the permission is needed (nothing downloadable can be found without reading the conversation), where the data does not go, and the single purpose. That notice is unavoidable; unanswered, it is what costs installs and trust
- **Screenshot templates** (1280×800, five): the split button and version menu (Claude), the floating code-block control (ChatGPT), the popup's item list, the zip or folder toast, the settings panel. At least two different providers must appear — if the "multi-provider" claim in the listing is not supported visually, review will ask
- A 128px store icon and a 440×280 small promo tile

Where store review most often catches is the broad host permission and the question "why do you need this data". The single-purpose statement and the absence of external requests answer it directly.

**No real conversation appears in the screenshots.** All five come from a **demo conversation** opened for the purpose. Otherwise you have put your own private data permanently onto a public, indexed store page that cannot be taken back.

**Naming and trademarks — now several brands.** The name starts with no provider's trademark and implies no official product; a neutral name such as `Magpie`, with a line in the description reading "not affiliated with Anthropic, OpenAI, Google or Perplexity". More brands means proportionally more infringement surface. Provider names appear only in a **descriptive** position ("supports Claude, ChatGPT, Gemini and Perplexity"). The logo resembles no provider's mark (§8.5). Imitation in an icon or a name is among the fastest rejection reasons in review.

## 16. Risks

| Risk | Impact | Mitigation |
|---|---|---|
| **Maintaining many providers** — each changes its interface independently | At any moment one or several adapters may be broken | Accepted risk (§1). Bounded by: adapter isolation (one breaking leaves the others working, §3.4.6) · a provider-independent DOM baseline (most of the value on one code path, §3.4.4) · a conformance suite per adapter · a broken capability closing **explicitly** rather than silently · a per-provider entry in `docs/BREAKAGE.md` |
| A provider's internal API cannot be found or changes | Versions and bulk access are lost on that provider | The DOM tier is mandatory; the product survives with fewer capabilities |
| A provider's bot protection blocks the internal API call | A 403, and the user's session may be affected | **Rule: never send a request the page itself would not send** — no pushing at rate limits, no background crawling, requests only on user action and only for the conversation the user is already looking at. Where in doubt, the API tier is not opened on that provider at all and the DOM baseline carries it |
| A provider's DOM changes | The button cannot be injected | The adapter's `SEL` layer — a repair in one file |
| A conversation API schema changes | Version history is lost | Three-tier fallback; the DOM always works |
| The `tool_use` schema assumption is wrong | The parser returns nothing | Schema verification against a real JSON dump is **the first step** of implementation |
| The Web Store questions the broad host permission | Publication is delayed | Single-purpose statement, zero external requests, privacy policy ready |
| A fetch is slow in a very long conversation | The button responds late | Cache plus a loading state on the button |
| A provider objects to use of its internal API | The listing could be removed | Only the user's own session, own data, own browser; no rate pushing, no server (the same rule as the bot-protection row above). Still a product risk — the DOM baseline keeps the extension alive without the API |
| The user belongs to several organisations | Wrong org → 404 → silent fallback | `lastActiveOrg` plus trying each org in turn (§4) |
| The provider interface is in another language | Text-based selectors fail | Text matching is forbidden (§12) |
| The user is on a light theme | Injected UI is unreadable | Colours are read from the page (§12) |
| A provider uses a closed shadow root or an iframe | The DOM tier cannot work at all | That provider is removed from scope; no half support (§3.4.4.1) |

---

## 17. Security

This extension handles two kinds of **untrusted data**: item titles and item contents (artifacts and canvases, code blocks, tool outputs, citations, images, attachments). All of it is model output or an uploaded file; if the user pasted someone else's text into the conversation, it is attacker-influenced.

| Rule | Why |
|---|---|
| No item-derived string is written into the DOM with `innerHTML` / `insertAdjacentHTML` — **`textContent` only** | A title can carry `<img onerror>`. The injection lands in the provider's page DOM, putting XSS next to session cookies. Menu rows, toasts, the pill, the popup header — all `textContent` |
| Item content is **never rendered or evaluated** | Previewing an HTML document is not our job; it is written to disk as bytes |
| **No** `window.addEventListener("message", …)` | The page could drive our privileged calls through `postMessage`. Communication happens only over `chrome.runtime` / `chrome.tabs` |
| `externally_connectable` is **not declared** | The default is nobody. Other sites cannot message the extension |
| **No** remote code: no CDN, no `eval`, no `new Function`, no remotely loaded script | The Web Store rejects remote code outright. All code ships inside the package |
| `panel.html` contains no inline `<script>` or handler | MV3's default CSP blocks inline script; it would fail silently |
| `sanitize` also cuts path traversal: `/`, `\`, `..` and a leading `~` are stripped | An `<a download="../../x">` attempt. Chrome already ignores path components, but the defence belongs on our side too |
| Filter matches are never highlighted with `innerHTML`; highlighting splits the text into separate `textContent` nodes | User input and a model-produced title meet on the same line; this is the single most tempting place in the UI to reach for `innerHTML` |
| The `Report an issue` link is a **navigation**, not a request: it opens a fixed repository address with the diagnostics block as its body, URL-encoded | Nothing happens until the user clicks; the "no external requests" claim holds, and this is written here so it does not become a review question |
| **No** network egress; `fetch` targets are only registry origins and the ones the user granted | So the privacy policy is verifiable; the network scan in CI is its technical basis (§19.3) |

### 17.1 The publisher account — the real supply chain

This project has no dependencies (§5), so the classic supply-chain attack surface is nearly zero. But **the real supply chain is not npm, it is the Web Store publisher account.** Whoever takes that account can push an extension holding permission to read private conversations **to every existing installation, silently**; Chrome applies the update automatically and the user sees nothing. Clean code does not prevent it.

Rules:

- A **passkey or hardware key** on the publisher account; SMS 2FA is not accepted
- Account access to the minimum number of people; a departing person's access is removed the same day
- CI is not granted publish rights. CI builds the package, **a human uploads it** — automated publishing wires a stolen CI token directly to users
- The SHA-256 of every published package goes into `CHANGELOG.md` (§19.4), so third parties can verify the store's archive was built from the repository's commit
- The extension has no update channel of its own; the store is the only distribution path

### 17.2 Privacy commitments — treated as invariants

The following are **load-bearing** for the store declaration and for user trust. A feature that breaks one of them is either rejected or arrives with a new and explicit consent flow; it is never widened silently:

1. No request to any external origin (gate 8 in §19.3 protects this)
2. No telemetry, analytics or error-reporting service
3. Conversation content stays in memory. It leaves the device **only on the user's explicit action**, by three routes: a downloaded file, a file written to a chosen folder, and the Markdown written to the **clipboard** by the transfer feature (§3.3.3). **The exception is the download history the user explicitly enabled** (§4.3): when on, conversation titles and item names are stored locally and persistently — a hash, never the content. With it off, nothing is written. The clipboard has to be counted here as a third destination — leaving it out would make this list wrong
4. Only settings in `storage`; only the folder handle in IndexedDB
5. The diagnostics block carries no conversation data (§8.9)

Requests such as "back it up to the cloud", "search my conversations", "usage statistics" will come. This list fixes today where that conversation starts — because a privacy commitment broken once silently is not regained.

**Abuse note.** "All items in this conversation → zip" makes it easier for someone with brief physical access to collect data quickly from a logged-in browser. We do not treat that as an extension-specific hole — the browser already reaches that data and copy-paste retrieves it too — but recording it in the threat model makes the answer to a future "download all conversations automatically" request straightforward: that feature would **qualitatively** ease bulk extraction, and it stays in the non-goals in §2.

## 18. Repository deliverables

- `LICENSE` — MIT, copyright Ömer Faruk Ceylandağ (Kata Technology)
- `README.md` — what it does, installation (unpacked plus the store link), the settings table, `node selftest.js`
- `docs/BREAKAGE.md` — the **breakage runbook**, with a section per provider: symptom → diagnosis → fix. "No button" → `SEL.actionBar` no longer matches, find the new selector in DevTools, update `SEL`, bump the version. "Versions collapsed to one row" → the API tier dropped, check the conversation request's status in the Network tab (401 → session, 404 → org resolution, 200 but empty → the schema changed, update the `parseOps` fixtures from real JSON). Without this file I could not repair the extension myself in six months
- `CHANGELOG.md` — release notes plus each release's package SHA-256 (§19.4)
- `docs/LIMITATIONS.md` — known limitations, for users (§19.9)
- The **MCP agent output** example in the `README` and the store's long description (§2.2.2, first path): a report or code an MCP agent produced is inside the conversation and therefore an ordinary item — users do not think of it on their own, and unwritten it goes undiscovered
- `docs/design/` — the design screens, with a `README.md` separating **current** from **historical**. `current.html` carries the present palette, mark and English interface; the older screens recorded decisions at the time they were made and predate the rename, so they still show the old accent colour. Where they disagree, `current.html` is right, and the README says so — a design artifact that silently contradicts the specification is worse than none, because it reads as evidence. **Kept in the repository**: the specification references them and they are the visual evidence for its decisions; left in a temporary directory, the spec loses its own references
- `docs/SMOKE.md` — the monthly smoke-test list, with results committed (§19.8)
- `docs/DISCOVERY.md` — step one, the procedure that fills the capability matrix
- `docs/ADDING-A-PROVIDER.md` — how to add a registry row: which fields are required (`host`, `name`), which optional (`chatRoot`, `newChatUrl`), how to extract and redact a fixture, how to run the conformance suite. The registry model aims to be open to contribution; without written instructions that is a hope rather than a plan
- `.github/ISSUE_TEMPLATE/provider.yml` — a new-provider request: host, screenshot, whether `pre > code` is present
- `tools/pack.mjs` — builds the store zip, excluding development files
- `tools/check-invariants.mjs` — the mechanical gates in §19.3 (8–13, 15); no npm dependency
- `tools/check-spec.mjs` — §19.3 gate 14; the specification's own consistency
- `tools/discover.js` — the console script for step one (§4, `docs/DISCOVERY.md`)
- `.github/workflows/ci.yml` — all of the gates in §19.3
- `.github/ISSUE_TEMPLATE/bug.yml` — the diagnostics block as a required field (§19.9); the template also offers **team@katatechnology.co** for people who do not use GitHub
- `SECURITY.md` — vulnerability reports go to **team@katatechnology.co** rather than a public issue; this extension reads private conversations, so a flaw needs a quiet channel
- `.gitignore` — `.superpowers/`, `node_modules/`, `*.zip`

## 19. Production readiness

The sections up to here describe **what will be built**. This section describes what it takes to be **considered publishable**.

### 19.1 Browser support

`minimum_chrome_version` is stated explicitly in the manifest. The floor is computed in step 1 as the highest requirement among the APIs actually used; the starting assumption is **116** (MV3 service worker behaviours, `showDirectoryPicker`, `structuredClone` and `Intl.RelativeTimeFormat` are stable there). A floor set too high cuts users off and one set too low produces silent breakage — so it is determined from the API list rather than by guessing.

Chromium-based Edge, Brave and Opera work but are **not tested and not claimed**. Firefox is out of scope (the maintenance load in §16 is already full with the registry).

### 19.2 Performance budgets

Measurable targets; exceeding one stops the release.

| Metric | Budget | How measured |
|---|---|---|
| First control visible after page load | < 300 ms (p95) | `performance.mark` plus a manual profile |
| A single observer callback | < 2 ms | Performance profile |
| The extension's CPU share during streaming | Not measurable (< 1%) | Profile during a long response (§7) |
| Fetch plus parse of a 200-message conversation | < 500 ms, parse under 150 ms | `console.time` on a fixture |
| Peak memory (adapter plus all versions) | < 50 MB | Heap snapshot |
| Package size (icons included) | < 500 KB | CI check |

### 19.3 Quality gates (CI)

**Principle: a rule without a gate rots.** This document contains nineteen "Rule" statements; one without a gate quietly breaks within six months, because the only thing remembering it is having read the document. Every mechanically checkable rule is bound to a gate (`tools/check-invariants.mjs`); the rest fall to the manual pre-release gate (§19.5).

GitHub Actions, **with no npm dependency**, using only Node built-ins. If they are not all green, no package is produced. When a new rule is added, adding a gate for it — where it is mechanically checkable — is **part of the rule**, not separate work:

1. `node selftest.js` — pure-function tests plus the adapter conformance suite (§14)
2. `manifest.json` JSON validation plus schema checks (permissions against a whitelist: an unexpected permission is **red**)
3. **i18n completeness**: are the key sets of `_locales/tr` and `_locales/en` identical; does any user-visible string exist in code outside `getMessage` (scan)
4. `panel.html` contains no inline script or handler (MV3 CSP, §17)
5. Forbidden-pattern scan across the source: `innerHTML`, `insertAdjacentHTML`, `eval`, `new Function`, `document.write`, `window.addEventListener("message"` (§17). A violation is red, with no exceptions
6. Package size budget
7. Does `manifest.version` match the top entry of `CHANGELOG.md`
8. **Network target scan:** every `http(s)://` literal in the source stays within the registry origins (user-granted hosts arrive at runtime and are not written in the source). This gate is the technical basis for the "collects no data" declaration in §19.6 — a mismatch between the declaration and the code is a takedown reason
9. **Selector text scan:** no natural-language string in selector position inside `adapters/` — patterns such as `[aria-label="Copy"]`, `:has(:contains(…))` or `textContent === "Preview"` are red (§12). CI sees the bug an author running an English interface never could
10. **Layer violation:** `content.js` contains no provider selector; `SEL` exists only under `adapters/` (§3.4.6, §12). This gate is the only thing protecting adapter isolation
11. **Settings coverage:** every key in the `cfg` schema has a control in the panel, and the panel has no control absent from the schema (§8.6). Adding a setting and forgetting the UI becomes impossible
12. **Logical CSS:** the injected CSS — `SHELL_CSS` in `content.js` at v1, `overlay.css` once it exists — contains no physical direction property (`left:`, `right:`, `margin-left`, `padding-right`); only `inset-inline-*` and `margin-inline-*` (§8.7). Prevents RTL breakage at writing time rather than hunting for it later
13. **Registry and adapter freshness:** every registry row and every adapter carries `LAST_VERIFIED`; older than 90 days is a **warning**, older than 180 is **red** (§19.8). No release ships on an unverified adapter
14. **Specification consistency** (`tools/check-spec.mjs`): no broken `§` reference (**including inside code blocks** — one broken reference was hiding exactly there) · section numbers ascending · two-way agreement between the `cfg` schema and the settings panel · every file named in the spec present in the architecture tree or the deliverables list · `SEL.*` and `cfg.*` references defined · numeric thresholds stated more than once are reported (for a human to compare)

    This gate's justification is this document's own history: the majority of its defects came from **the same value written in two places with only one updated**. Prose has no compiler; this gate stands in for one. A specification needs maintenance like code, and anything needing maintenance deserves a gate

15. **Core portability:** `parse.js`, `zip.js` and `registry.js` contain **no** `chrome.`, `document.` or `window.` (§4.2). Without this gate the core gets nailed to the browser unnoticed and a second surface becomes a rewrite

16. **Source files are text:** no source file contains a raw control byte, and every one uses a single line ending. Added after `sanitize`'s character class turned out to hold **literal** control bytes rather than the ` -` escape sequence it appears to contain. The code behaved correctly, which is why nothing caught it; the cost was that git classified the file as binary, so it had no reviewable diff. A defect that removes the ability to review the file is worse than one the tests can see

    The gate also fixes the line ending, because a repository with both kinds shows every normalisation as a whole-file diff and buries the real change

### 19.4 Versioning and packaging

Semver. `node tools/pack.mjs` → `dist/magpie-<version>.zip`. The tool packs a **whitelist** — `manifest.json`, `LICENSE`, `src/`, `_locales/`, `icons/` — rather than excluding a list of directories: the failure mode of a blacklist is publishing a file nobody meant to ship, and it fails silently. The archive is written by `src/zip.js`, the same writer that ships to users, so every release exercises it; that is how the End of Central Directory defect in §6 was found. The zip's SHA-256 is written into `CHANGELOG.md` so the store's package can be verified against the repository's commit.

Every release gets a git tag: `v1.0.0`.

### 19.5 Pre-release gate

Nothing is submitted until **all** of these are ticked:

- [ ] CI green (**all** of §19.3 — the count is not repeated here, counts drift)
- [ ] The manual verification list (§14) run per the sampling rule, with the sample recorded in `SMOKE.md`
- [ ] Performance budgets (§19.2) measured and not exceeded
- [ ] The injection crash test (§7 step 2) clean on every adapter-backed provider
- [ ] Accessibility: the full flow by keyboard, toast and menu announcements with a screen reader, `prefers-reduced-motion`, and **a code block downloaded from the popup using only a keyboard and a screen reader** (§8.6.1 — the only accessible path to code blocks, §8.1.1)
- [ ] Light and dark themes, TR and EN interface, RTL check
- [ ] Code-block downloading reachable on a touch device (§8.1.1) · alignment at 200% zoom
- [ ] Hardware key or passkey active on the publisher account, and CI without publish rights (§17.1)
- [ ] Every adapter's `LAST_VERIFIED` current · the package SHA-256 written into CHANGELOG (§19.4)
- [ ] The diagnostics block (§8.9) contains no conversation data — output inspected by eye
- [ ] `history` defaults to **off**, and nothing persistent is written while off (§4.3)
- [ ] Permission list minimal: `storage` plus the host permissions plus optional `notifications`. Nothing more
- [ ] The privacy policy published and its URL reachable
- [ ] Screenshots from a **demo** conversation
- [ ] Trademark disclaimer covering **every** registry provider in the description
- [ ] **The name "Magpie" checked for store and trademark collisions** — §2.1.2
- [ ] Logo: the selected mark produced at 16px (`icons/icon16.png`) and verified in the toolbar (§8.5)
- [ ] `docs/BREAKAGE.md` complete for adapter-backed providers, with a shared section for the baseline
- [ ] The previous release's zip retained (§19.7)

### 19.6 Store submission

- **Single-purpose statement:** "Extracting, versioning and making reusable the code, documents and files produced in AI chat assistants." — word for word the spine sentence in §2.1; a product described two different ways in two places reads as an inconsistency in review
- **Permission justifications**, one sentence each: `storage` → user settings; host permissions → reading conversation content (only in the user's own session); `notifications` → optional, only if the user enables it
- **Data-use form:** Chrome asks per category. The answer is **not collected** in every category; the "not sold or transferred" and "not used for creditworthiness" declarations are ticked. A declaration inconsistent with the code is a takedown reason — which is why the network scan in §19.3 is this declaration's technical basis
- Imagery (§15), the privacy URL, TR and EN listing copy
- A developer account plus the one-time registration fee; first review can take a few days, longer for submissions with broad host permissions

### 19.7 Staged rollout and rollback

Release goes **10% → 50% → 100%**, with at least 48 hours between stages.

**There is no rollback in the Web Store.** If a broken version ships, the only route is publishing a fix under a higher version number. So: before every release the previous package's zip is retained and matched to a `git tag`; in an emergency the `version` is bumped from that tree and repackaged. A rollback prepared **before** the release beats code written in a panic.

The user-side emergency exit already exists: per-site disabling (§8.8).

### 19.8 Post-release monitoring — without telemetry

There is no telemetry (§17), so monitoring has to be **planned and manual**:

- `LAST_VERIFIED = "2026-09-09"` at the top of every adapter file. Older than 90 days and that provider is re-verified
- **Monthly smoke test:** a short checklist for adapter-backed providers plus three baseline samples (does the button appear, does downloading work, is the console clean). Kept as `docs/SMOKE.md`; the result is committed with a date and provider
- Store reviews and GitHub issues reviewed weekly. Provider interface changes usually surface there first
- When a provider breaks, the user-visible behaviour is that the capability closes on that provider and the diagnostics block carries the reason — no silent failure

### 19.9 Support flow

The GitHub issue template makes **the diagnostics block (§8.9) a required field**. The first reply to an issue opened without it is "popup → Copy diagnostics". That way a bug report lands on the diagnosis table (§18, `BREAKAGE.md`) on the first round.

A user-facing **known limitations** list (`docs/LIMITATIONS.md`), linked from the README: browser download completion cannot be confirmed (§8.4) · version history is certain on Claude and depends on the capability matrix elsewhere (§3.4.5) · only the displayed version in the DOM tier · attachments vary by provider · a provider redesign can cause temporary breakage. Saying the limits up front is cheaper than learning them back as complaints.

### 19.10 Definition of done

A provider is **done** only when: the adapter either implements or explicitly closes every row of the capability matrix · the conformance suite passes · its fixtures are committed · `SEL` is in one object and free of text matching · the injection crash test is clean · the manual list has been run on that provider · its `BREAKAGE.md` section is written · `LAST_VERIFIED` is current.

The product is **ready to release** only when every item in the §19.5 gate is ticked.

## Implementation order (summary)

1. **Provider discovery** (full for adapter candidates, reachability and `chatRoot` only for baseline candidates): where the conversation id is read from, whether an API exists and what shape its response has, how streaming is detected, the `SEL` selectors, the attachment endpoint, and whether injection crashes the framework (§7 step 2). For Claude additionally the `tool_use` schema **and** the tree fields (`parent_message_uuid`, `current_leaf_message_uuid`). The discovery output fills the capability matrix (§3.4.5); any capability that cannot be verified is switched off on that provider
2. The pure core layer: the `Item` model, `parse.js` (fold plus `Item` validation), the naming chain, `zip.js` — all TDD through `selftest.js`
3. The `manifest.json` skeleton (a separate `content_scripts` block per adapter-backed provider, §5) plus the i18n scaffolding
4. The `content.js` core: adapter selection, the observer, the UI shell (button, menu, pill, toast). It contains **no provider selector** (§12)
5. `common-dom.js` — provider-independent code block extraction plus the floating control (§8.1.1); verified on every registry provider. This step alone yields a product that works on **every provider in the registry**
6. `claude.js`: active branch extraction → op collection → versions → the version menu plus the three tiers
7. `chatgpt.js` and any other adapters where discovery found documents or versions — per the capability matrix; unverified capabilities stay closed. Baseline providers get no adapter and make do with a registry row
8. Attachments: endpoint discovery, binary writing, removed from scope if absent (§3.3.2)
   - 8a. Tool outputs (§2.1.3) and citations (§2.1.4.1): `tool_use` / `tool_result` blocks → `kind:"tool_output"`, name and extension derivation, `⚠ may be truncated` on providers without an API
   - 8b. Conversation Markdown plus transfer (§3.3.3): `kind:"conversation"`, clipboard, `newChatUrl`, the size warning
   - 8c. Download history (§4.3): opt-in, the hash index, the `History` tab, cross-conversation recognition
   - 8d. The spine trio (§2.1.1): the context handoff suggestion, the never-taken indicator, `Copy as context` — all three depend on 8c or become cheap once it exists
9. `sw.js`: badge, pulse, shortcut, system notification
10. `panel.html/js`: item list, settings, live preview, diagnostics, emergency stop
11. Drag and drop plus folder saving (§8.7.1, §8.7.2)
12. Icons (16/48/128 plus the pulse frames)
13. CI gates plus `tools/check-invariants.mjs`, `tools/check-spec.mjs` and `tools/pack.mjs` (§19.3, §19.4)
14. The manual verification list — per the sampling rule (§14)
15. Measuring the performance budgets (§19.2)
16. `store/` deliverables plus publishing the privacy policy
17. The pre-release gate (§19.5) → staged rollout (§19.7)

### The MVP cut line

Scope grew over this document's life (artifacts → seven item kinds → a provider registry plus user-granted hosts). In a one-person project the real risk of that is not the code but **none of it shipping**. So the cut line is written down in advance:

**MVP = steps 1–5.** That is: the core, `common-dom.js` and the floating control — code-block downloading on **every provider in the registry**, with correct names and extensions, single-file downloads, name correction and copying. No versions, no zip, no attachments, no folder, no drag. (Tool outputs are step 8a and sit outside the MVP, since they need an API tier and would not work on baseline providers anyway.)

Why that is a publishable product: code blocks come out through **a single code path regardless of how many providers there are** (§3.4.4), so the MVP's maintenance load grows with registry rows rather than providers — and a row is a selector. And most downloaded code was never an artifact (§2) — the user's most frequent need is right here.

**Then, in order:** 6–7 (artifacts and canvases plus versions, starting with Claude) → 11 (drag and drop, folders) → 8 (attachments). Each is independently publishable and each earns its own release note.

**What falls below the line is not deferred but switched off:** in the MVP the version menu is not *hidden*, it is never drawn (the "no capability, no control" rule in §3.4.5). The user sees nothing missing and expects nothing that does not exist.

**Why this order:** step 5 comes deliberately before the adapters — because code blocks run through one code path on every provider, a build that reaches that point is already a publishable product. The artifact and version layer (6–7) stacks on top of it, not underneath.
