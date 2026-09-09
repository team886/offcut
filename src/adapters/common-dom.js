/**
 * Magpie — provider-independent DOM extraction (design §3.4.4)
 *
 * This file is why twenty registry providers cost less than four adapters:
 * every one of them renders a code block as `pre > code` with the language in
 * a class, so the largest slice of the product runs through one code path.
 *
 * Runs in the content script's isolated world. Reads the page, never writes to
 * it — the only DOM this file creates is a detached clone.
 */

/* global MagpieParse */

const MagpieDom = (() => {
  const P = typeof MagpieParse !== "undefined" ? MagpieParse
          : (typeof require !== "undefined" ? require("../parse.js") : null);

  const ZERO_WIDTH = /[​‌﻿]/g;
  const UI_INSIDE_CODE = 'button,[role="button"],[data-testid*="copy" i],.line-number,.linenumber,.gutter,[aria-hidden="true"][class*="line"]';

  /** Descend through OPEN shadow roots. A closed root is unreachable by
   *  design and disqualifies the provider entirely (§3.4.4.1). */
  function queryDeep(root, selector, acc) {
    const out = acc || [];
    out.push(...root.querySelectorAll(selector));
    for (const el of root.querySelectorAll("*")) {
      if (el.shadowRoot) queryDeep(el.shadowRoot, selector, out);
    }
    return out;
  }

  function codeNodes(root, selector) {
    return queryDeep(root || document, selector || "pre > code");
  }

  /**
   * Language, by the precedence in §3.4.4. Never guessed: where nothing
   * matches, the language is unknown and the extension becomes .txt.
   */
  function languageOf(codeEl) {
    if (codeEl.dataset && (codeEl.dataset.language || codeEl.dataset.lang)) {
      return codeEl.dataset.language || codeEl.dataset.lang;
    }
    const cls = [...codeEl.classList];
    const langClass = cls.find((c) => c.startsWith("language-"));
    if (langClass) return langClass.slice("language-".length);
    if (cls.includes("hljs")) {
      const beside = cls.find((c) => c !== "hljs" && !c.includes("-"));
      if (beside) return beside;
    }
    const pre = codeEl.parentElement;
    if (pre && pre.dataset && (pre.dataset.language || pre.dataset.lang)) {
      return pre.dataset.language || pre.dataset.lang;
    }
    return "";
  }

  /**
   * Read text out of a code node (design §12.1). Four rules, one place:
   *   1. UI inside the code node is stripped — from a CLONE, never the page
   *   2. textContent, never innerText: innerText obeys CSS, and a
   *      text-transform theme would uppercase the code
   *   3. zero-width characters inserted for wrapping are removed — DOM tier
   *      only, because in the API tiers they may belong to the code
   *   4. a scrollable node is collected by scrolling rather than trusted
   */
  function readCodeText(codeEl) {
    const clone = codeEl.cloneNode(true);
    clone.querySelectorAll(UI_INSIDE_CODE).forEach((n) => n.remove());
    return clone.textContent.replace(ZERO_WIDTH, "");
  }

  /**
   * Completeness (§4). We do not try to DETECT virtualisation — estimating a
   * line count from a height is fragile and lands on the wrong side silently.
   * If the node scrolls, always collect by scrolling; where there is no
   * virtualisation the result is identical to a single read.
   *
   * Returns { text, complete }.
   */
  async function readCodeTextComplete(codeEl, opts) {
    const box = codeEl.closest("pre") || codeEl;
    const budgetMs = (opts && opts.budgetMs) || 3000;

    if (box.scrollHeight <= box.clientHeight + 4) {
      return { text: readCodeText(codeEl), complete: true };
    }

    const restore = box.scrollTop;
    const seen = new Map();                       // key: line position → text
    const started = Date.now();
    let lastCount = -1, stalled = 0;
    try {
      const step = Math.max(40, box.clientHeight - 24);
      for (let y = 0; y <= box.scrollHeight; y += step) {
        box.scrollTop = y;
        await new Promise((r) => setTimeout(r, 16));
        const lines = codeEl.querySelectorAll("[data-line-number],.line,span[class*='line']");
        if (lines.length) {
          for (const l of lines) {
            const k = l.dataset && l.dataset.lineNumber != null ? l.dataset.lineNumber : l.offsetTop;
            if (!seen.has(k)) seen.set(k, l.textContent);
          }
        } else {
          // no per-line nodes: the whole node is present, one read is enough
          return { text: readCodeText(codeEl), complete: true };
        }
        if (seen.size === lastCount) { if (++stalled >= 2) break; } else { stalled = 0; }
        lastCount = seen.size;
        if (Date.now() - started > budgetMs) {
          return { text: [...seen.values()].join("\n").replace(ZERO_WIDTH, ""), complete: false };
        }
      }
    } finally {
      box.scrollTop = restore;                    // the user's view is their choice (§12)
    }
    return { text: [...seen.values()].join("\n").replace(ZERO_WIDTH, ""), complete: true };
  }

  /** The markdown heading immediately before a block — naming chain step 3. */
  function precedingHeading(codeEl) {
    const pre = codeEl.closest("pre") || codeEl;
    let n = pre.previousElementSibling;
    for (let i = 0; i < 3 && n; i++) {
      if (/^H[1-6]$/.test(n.tagName)) return n.textContent.trim().slice(0, 80);
      n = n.previousElementSibling;
    }
    return null;
  }

  /**
   * Collect downloadable code blocks. Keys are document-order indices and are
   * never renumbered mid-stream: new blocks append, so existing keys hold
   * (§3.3). A shifting key would rebind an open menu to another item.
   */
  function collectCodeItems(root, selector) {
    const nodes = codeNodes(root, selector);
    const items = [];
    nodes.forEach((el, i) => {
      const text = readCodeText(el);
      if (!P.isDownloadableCodeBlock(text)) return;      // §3.3.1, MIN_CODE_LINES
      const lang = languageOf(el);
      const { base, ext } = P.deriveCodeName({
        fenceInfo: lang,
        code: text,
        precedingHeading: precedingHeading(el),
        index: i + 1,
      });
      items.push({
        kind: "code",
        key: "code:" + i,
        title: base,
        ext,
        language: lang || null,
        lines: P.countCodeLines(text),
        node: el,
        versions: [{ v: 1, content: text, ok: true, bytes: new TextEncoder().encode(text).length }],
      });
    });
    return items;
  }

  /** The chat root: the registry hint when it matches, the heuristic when it
   *  does not, so a provider redesign is not an emergency (§3.4.1). */
  function resolveChatRoot(row) {
    if (row && row.chatRoot) {
      const el = document.querySelector(row.chatRoot);
      if (el) return { node: el, via: "selector" };
    }
    const nodes = codeNodes(document, (row && row.codeBlock) || "pre > code");
    const el = P.heuristicRoot(nodes);
    return el ? { node: el, via: "heuristic" } : { node: null, via: "none" };
  }

  return { queryDeep, codeNodes, languageOf, readCodeText, readCodeTextComplete,
           precedingHeading, collectCodeItems, resolveChatRoot, UI_INSIDE_CODE };
})();

if (typeof globalThis !== "undefined") globalThis.MagpieDom = MagpieDom;
if (typeof module !== "undefined") module.exports = MagpieDom;
