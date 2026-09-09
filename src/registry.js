/**
 * Magpie — provider registry (design §3.4)
 *
 * Pure data. No DOM, no chrome.*, no window (CI gate 15).
 *
 * A row buys baseline support: code-block download with correct names and
 * extensions, copy, rename, and later zip, drag and folder saving. Adapters
 * exist only for providers offering documents, versions, attachments or an
 * API tier — most chat interfaces have none of those.
 *
 * chatRoot is a HINT, not a foundation (§3.4.1). Where it is null or stops
 * matching, the heuristic root takes over and the provider keeps working
 * through a redesign. LAST_VERIFIED gates releases (§19.3 gate 13).
 */

const REGISTRY = [
  {
    id: "claude",
    host: "claude.ai",
    name: "Claude",
    newChatUrl: "https://claude.ai/new",
    // Measured 2026-09-09: pre.code-block__code > code.language-* in the top
    // frame, no custom elements. See docs/DISCOVERY-claude.md.
    chatRoot: null,
    codeBlock: "pre.code-block__code > code, pre > code",
    LAST_VERIFIED: "2026-09-09",
  },
  {
    id: "chatgpt",
    host: "chatgpt.com",
    name: "ChatGPT",
    newChatUrl: "https://chatgpt.com/",
    chatRoot: null,
    LAST_VERIFIED: "2026-09-09",
  },
  {
    id: "gemini",
    host: "gemini.google.com",
    name: "Gemini",
    newChatUrl: "https://gemini.google.com/app",
    chatRoot: null,
    LAST_VERIFIED: "2026-09-09",
  },
  {
    id: "perplexity",
    host: "www.perplexity.ai",
    name: "Perplexity",
    newChatUrl: "https://www.perplexity.ai/",
    chatRoot: null,
    LAST_VERIFIED: "2026-09-09",
  },
  {
    id: "deepseek",
    host: "chat.deepseek.com",
    name: "DeepSeek",
    newChatUrl: "https://chat.deepseek.com/",
    chatRoot: null,
    LAST_VERIFIED: "2026-09-09",
  },
  {
    id: "mistral",
    host: "chat.mistral.ai",
    name: "Le Chat",
    newChatUrl: "https://chat.mistral.ai/chat",
    chatRoot: null,
    LAST_VERIFIED: "2026-09-09",
  },
  {
    id: "grok",
    host: "grok.com",
    name: "Grok",
    newChatUrl: "https://grok.com/",
    chatRoot: null,
    LAST_VERIFIED: "2026-09-09",
  },
  {
    id: "copilot",
    host: "copilot.microsoft.com",
    name: "Copilot",
    newChatUrl: "https://copilot.microsoft.com/",
    chatRoot: null,
    LAST_VERIFIED: "2026-09-09",
  },
  {
    id: "kimi",
    host: "www.kimi.com",
    name: "Kimi",
    newChatUrl: "https://www.kimi.com/",
    chatRoot: null,
    LAST_VERIFIED: "2026-09-09",
  },
  {
    id: "qwen",
    host: "chat.qwen.ai",
    name: "Qwen",
    newChatUrl: "https://chat.qwen.ai/",
    chatRoot: null,
    LAST_VERIFIED: "2026-09-09",
  },
  {
    id: "zai",
    host: "chat.z.ai",
    name: "Z.ai",
    newChatUrl: "https://chat.z.ai/",
    chatRoot: null,
    LAST_VERIFIED: "2026-09-09",
  },
  {
    id: "t3",
    host: "t3.chat",
    name: "T3 Chat",
    newChatUrl: "https://t3.chat/",
    chatRoot: null,
    LAST_VERIFIED: "2026-09-09",
  },
];

/** Rows whose reachability has not been measured yet are still usable: the
 *  DOM baseline degrades to silence where nothing matches (§3.4.2 step 3). */
function findProvider(hostname, registry) {
  const rows = registry || REGISTRY;
  const h = String(hostname || "").toLowerCase();
  return rows.find((r) => h === r.host || h.endsWith("." + r.host)) || null;
}

/** Staleness for the CI freshness gate (§19.3 gate 13). */
function stalenessDays(row, today) {
  const now = today ? new Date(today) : new Date();
  const then = new Date(row.LAST_VERIFIED + "T00:00:00Z");
  return Math.floor((now - then) / 86400000);
}

const MagpieRegistry = { REGISTRY, findProvider, stalenessDays };
if (typeof globalThis !== "undefined") globalThis.MagpieRegistry = MagpieRegistry;

if (typeof module !== "undefined") {
  module.exports = { REGISTRY, findProvider, stalenessDays };
}
