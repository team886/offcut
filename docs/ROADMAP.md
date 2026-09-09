# Roadmap

Each version below is independently publishable and earns its own release note. The order is the implementation order in the design document; the cut lines are where a version stops being worth holding back.

The numbers follow `docs/VERSIONING.md`: the major digit tracks **what the product depends on that it does not own**, not how large the change feels. That is why v2.1 adds four item kinds and is still a minor — every one of them arrives through the adapter and API tier that v2.0 already signed up for — while v2.0 itself is a major for introducing them.

The rule that shapes every cut: **what falls below a line is not hidden, it is not drawn** (§3.4.5). A version never shows a control for something it cannot do.

---

## v1.0 — Code blocks (the MVP)

**Design steps 1–5.** The thing that made this the first version is a measurement, not a preference: across twenty-five conversations there were **zero artifacts and 360 code fences** (`docs/DISCOVERY-claude.md`). Code blocks are where the volume is.

| In | Out |
|---|---|
| Code-block download on every registry provider | Artifacts, canvases, version history |
| Correct extension and a derived name (four-step chain) | Zip, attachments, tool outputs, citations, images |
| The floating control, showing the filename it will produce | Folder saving, drag and drop |
| Touch fallback, keyboard path through the popup | History, transfer, context handoff |
| Rename before download, copy to clipboard | |
| Popup item list, settings, diagnostics, emergency stop | |
| i18n (en + tr), light and dark, RTL | |

Why it is publishable alone: code blocks come out through one code path regardless of provider count (§3.4.4), so v1's maintenance load grows with registry rows rather than providers — and a row is a selector.

**Ships when:** the pre-release gate (§19.5) passes for the registry providers.

---

## v1.1 — Bulk and placement

**minor** — nothing new is depended on; all of it sits on what v1 already extracts.

**Design steps 11 and part of 8.2.1.** The first version people ask for after using v1.

- Conversation-level zip, foldered by kind
- Multi-select with a bulk bar
- Drag and drop into an editor
- Save to a chosen folder, per provider

No new provider knowledge is required — all of it sits on top of what v1 already extracts.

---

## v1.2 — Memory

**minor** — new storage of our own, no new external contract.

**Design step 8c and the spine trio (§2.1.1).**

- Download history, opt-in and off by default
- Persistent, version-aware "already downloaded" with cross-conversation recognition
- The never-taken indicator
- Copy as context

This is the version that changes what the product is for: not downloading, but knowing what you already took.

---

## v2.0 — Documents and versions

**major** — the first release that depends on a provider's internal schema: the conversation tree, the branch fields, the artifact command shape. The number of ways this can break rises here, and that is what the digit is telling the reader.

**Design steps 6–7.** Held until here deliberately: the artifacts schema is still unmeasured (`docs/DISCOVERY-claude.md`), and nothing in v1–v1.2 depends on it.

- Claude adapter: active-branch walk, op-log fold, version menu with line deltas, the three tiers
- ChatGPT adapter where discovery finds canvas versions
- Artifact and canvas download, per-version

**Blocked on:** measuring the `tool_use` schema in a conversation that actually contains an artifact, plus the version-numbering comparison against the panel indicator (§8.2).

---

## v2.1 — The rest of the conversation

**minor** — four new item kinds, all read through the tier v2.0 introduced.

**Design steps 8, 8a, 8b.**

- Tool and MCP outputs, with call parameters
- Citations as their own file (the API already carries them as a field on text blocks — measured)
- Generated images and code-interpreter files
- Conversation Markdown and transfer to another provider

---

## v3.0 — Beyond the browser

**major** — a second surface with its own lifecycle, its own security boundary and its own way of failing.

**Design §4.2.** Only once a library has accumulated, which needs v1.1's folder saving and v1.2's history to be in use.

- A local MCP server over the download library, in FindAgent's tool shape (§2.2)
- Possibly a VS Code bridge, and only with the loopback security design written first

---

## What never ships

Recorded so the question does not reopen every few months: multi-model sidebars, prompt libraries, agent execution, model benchmarking, bulk account backup, and anything requiring an API key or a server (§2.1, §4.4).

The test each of them fails is the same one that admitted everything above: **if it can be done with data already present in the user's own session it is in scope; if it needs a model call, a key or a server it is not.**
