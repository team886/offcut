/**
 * Offcut — provider-independent DOM extraction (design §3.4.4)
 *
 * This file is why twenty registry providers cost less than four adapters:
 * every one of them renders a code block as `pre > code` with the language in
 * a class, so the largest slice of the product runs through one code path.
 *
 * Runs in the content script's isolated world. Reads the page, never writes to
 * it — the only DOM this file creates is a detached clone.
 */

/* global OffcutParse */

const OffcutDom = (() => {
  const P = typeof OffcutParse !== "undefined" ? OffcutParse
          : (typeof require !== "undefined" ? require("../parse.js") : null);

  const ZERO_WIDTH = /[​‌﻿]/g;
  const UI_INSIDE_CODE = 'button,[role="button"],[data-testid*="copy" i],.line-number,.linenumber,.gutter,[aria-hidden="true"][class*="line"]';

  /** Descend through OPEN shadow roots. A closed root is unreachable by
   *  design and disqualifies the provider entirely (§3.4.4.1). */
  function queryDeep(root, selector, acc) {
    const out = acc || [];
    out.push(...root.querySelectorAll(selector));
    // Only custom elements are searched for an open shadow root. The naive
    // version iterated querySelectorAll("*") — every element on the page,
    // twice per scan, on a scan that reruns on every mutation while a reply
    // streams (§7). A shadow root can technically hang off a plain <div>,
    // but in practice it hangs off a custom element, and paying an O(all
    // elements) walk on every frame to cover the theoretical case is the
    // wrong trade for a UI that must not slow the page down.
    for (const el of root.querySelectorAll("*")) {
      if (el.tagName.indexOf("-") === -1) continue;
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
  function collectCodeItems(root, selector, opts) {
    // A caller that has already resolved the nodes passes them in: rescan()
    // needs the same list twice (once to find the chat root, once to build
    // items) and computing it twice doubled a walk that reruns on every
    // mutation during streaming (§7).
    const nodes = (opts && opts.nodes) || codeNodes(root, selector);
    const items = [];
    let skipped = 0;
    nodes.forEach((el, i) => {
      const text = readCodeText(el);
      // Below MIN_CODE_LINES a block is a command or a one-liner, not a file
      // (§3.3.1). Dropping those silently was wrong: on a page that visibly
      // contains fenced code the panel then said "nothing to download", which
      // reads as a fault rather than a threshold. They are counted, and the
      // count is offered, so the rule is visible instead of invisible.
      if (!P.isDownloadableCodeBlock(text)) {
        skipped++;
        if (!(opts && opts.includeShort)) return;
      }
      const lang = languageOf(el);
      const { base, ext } = P.deriveCodeName({
        fenceInfo: lang,
        code: text,
        precedingHeading: precedingHeading(el),
        index: i + 1,
      });
      items.push({
        kind: "code",
        short: !P.isDownloadableCodeBlock(text),
        key: "code:" + i,
        title: base,
        ext,
        language: lang || null,
        lines: P.countCodeLines(text),
        node: el,
        versions: [{ v: 1, content: text, ok: true, bytes: new TextEncoder().encode(text).length }],
      });
    });
    items.skipped = skipped;
    return items;
  }

  /** The chat root: the registry hint when it matches, the heuristic when it
   *  does not, so a provider redesign is not an emergency (§3.4.1). */
  function resolveChatRoot(row, nodes) {
    if (row && row.chatRoot) {
      const el = document.querySelector(row.chatRoot);
      if (el) return { node: el, via: "selector", nodes: nodes || null };
    }
    const found = nodes || codeNodes(document, (row && row.codeBlock) || "pre > code");
    const el = P.heuristicRoot(found);
    return el ? { node: el, via: "heuristic", nodes: found }
              : { node: null, via: "none", nodes: found };
  }

  return { queryDeep, codeNodes, languageOf, readCodeText, readCodeTextComplete,
           precedingHeading, collectCodeItems, resolveChatRoot, UI_INSIDE_CODE };
})();

if (typeof globalThis !== "undefined") globalThis.OffcutDom = OffcutDom;
if (typeof module !== "undefined") module.exports = OffcutDom;
