/**
 * Offcut — provider discovery script
 *
 * USAGE: open a conversation on a candidate provider (ideally with at least one
 * code block and, if possible, a tool call), open the DevTools console, paste
 * this whole file and run it. Transfer the output into the capability matrix
 * (design document §3.4.5).
 *
 * WHAT IT DOES: measures DOM structure and the SHAPE of an API response.
 * WHAT IT DOES NOT: read conversation content, send anything anywhere, or write.
 *   - Text content is never printed; only counts, lengths and key names.
 *   - The only request goes to the origin you already have open, read-only.
 *   - Nothing is inserted into the page.
 */
(async () => {
  const out = { host: location.host, path: location.pathname, at: new Date().toISOString() };
  const keys = (o, n = 12) => (o && typeof o === 'object' ? Object.keys(o).slice(0, n) : typeof o);

  // -- 1. Reachability precondition (design 3.4.4.1) -------------------------
  // A closed shadow root or an iframe means the DOM tier cannot work at all.
  out.frames = { inIframe: window.top !== window.self, childFrames: document.querySelectorAll('iframe').length };
  let closedShadowSuspect = 0;
  for (const el of document.querySelectorAll('*')) {
    // Custom elements without an open root are closed-root suspects.
    if (el.tagName.includes('-') && !el.shadowRoot) closedShadowSuspect++;
  }
  out.shadow = { customElementsWithoutOpenRoot: closedShadowSuspect };

  // -- 2. Code blocks: baseline support depends on these (design 3.4.2) ------
  const deep = (root, sel, acc = []) => {
    acc.push(...root.querySelectorAll(sel));
    for (const el of root.querySelectorAll('*')) if (el.shadowRoot) deep(el.shadowRoot, sel, acc);
    return acc;
  };
  const codes = deep(document, 'pre > code');
  out.codeBlocks = {
    count: codes.length,
    // Where does the language come from? (precedence in design 3.4.2)
    langSources: codes.slice(0, 20).map(c => {
      const p = c.parentElement;
      if (c.dataset.language || c.dataset.lang) return 'data-*';
      if ([...c.classList].some(x => x.startsWith('language-'))) return 'language-*';
      if ([...c.classList].some(x => x === 'hljs')) return 'hljs';
      if (p && (p.dataset.language || p.dataset.lang)) return 'pre[data-*]';
      return 'none';
    }).reduce((a, k) => ((a[k] = (a[k] || 0) + 1), a), {}),
    // Is there UI inside the code node? (design 12.1 rule 1)
    withInnerUI: codes.filter(c => c.querySelector('button,[role="button"]')).length,
    // Scrollable? -> virtualisation suspicion (design 4)
    scrollable: codes.filter(c => {
      const box = c.closest('pre') || c;
      return box.scrollHeight > box.clientHeight + 4;
    }).length,
  };

  // -- 3. chatRoot: does the heuristic root actually find it? (design 3.4.1) -
  if (codes.length > 1) {
    let node = codes[0];
    while (node && !codes.every(c => node.contains(c))) node = node.parentElement;
    out.chatRoot = node
      ? { tag: node.tagName.toLowerCase(), cls: (node.className || '').toString().slice(0, 60), depth: (() => { let d = 0, n = node; while ((n = n.parentElement)) d++; return d; })() }
      : 'no common ancestor';
  } else out.chatRoot = 'not enough code blocks (need at least 2)';

  // -- 4. Is the conversation id in the URL? (design 4) ----------------------
  const uuid = location.pathname.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  const slug = location.pathname.split('/').filter(Boolean).pop();
  out.conversationId = uuid ? 'uuid' : (slug && slug.length > 8 ? `slug(${slug.length} chars)` : 'none');

  // -- 5. Streaming indicator (design 3.2) ----------------------------------
  out.streamHint = {
    stopButtons: document.querySelectorAll('[aria-label*="top" i],[data-testid*="stop" i]').length,
    note: 'text-based selectors are FORBIDDEN (design 12) - discovery only',
  };

  // -- 6. API tier: SHAPE only, never content (design 4.1) ------------------
  // Candidate endpoints per provider. Only the top-level keys of a 200
  // response are printed.
  const candidates = {
    'claude.ai': ['/api/organizations'],
    'chatgpt.com': ['/backend-api/models'],
    'gemini.google.com': [],
    'www.perplexity.ai': [],
  }[location.host] || [];
  out.api = [];
  for (const url of candidates) {
    try {
      const r = await fetch(url, { credentials: 'include' });
      const body = r.ok ? await r.json().catch(() => null) : null;
      out.api.push({ url, status: r.status, topKeys: Array.isArray(body) ? `array(${body.length})` : keys(body) });
    } catch (e) { out.api.push({ url, error: String(e).slice(0, 80) }); }
  }

  // -- 7. Theme and direction (design 12) -----------------------------------
  const cs = getComputedStyle(document.body);
  out.theme = { bg: cs.backgroundColor, fg: cs.color, dir: cs.direction, lang: document.documentElement.lang };

  console.log('%cOffcut discovery output', 'font-weight:bold;color:#E8B44A');
  console.log(JSON.stringify(out, null, 2));
  console.log('%cNo content was printed. Transfer this into the design 3.4.5 matrix.', 'color:#9C99A3');
  return out;
})();
