/**
 * Offcut — content script (design §7, §8)
 *
 * v1 scope: code blocks. No provider selector lives here (§12, CI gate 10);
 * everything provider-specific comes from the registry row or an adapter.
 */

/* global OffcutParse, OffcutRegistry, OffcutDom */

(() => {
  const P = OffcutParse, R = OffcutRegistry, D = OffcutDom;

  const DEFAULTS = {
    badge: true, notify: "inpage", autoDownload: false, defaultVersion: "current",
    nameTemplate: "{title}", zipAll: true, saveTo: "downloads",
    kinds: { artifact: true, code: true, attachment: true, conversation: true,
             tool_output: true, citations: true, image: true },
    includeThinking: false, includeCall: true, handoffAt: 40,
    sites: {}, extraHosts: [], history: false, historyMax: 5000, dragEnabled: true,
  };

  const state = {
    row: null, cfg: DEFAULTS, root: null, rootVia: "none",
    items: [], byKey: new Map(), renamed: new Map(), tookThisSession: new Set(),
    host: null, shadow: null, control: null, toastHost: null,
    hoverEl: null, observer: null, rafPending: false, dead: false,
    lastError: null, seenIntro: false, hoverCapable: true,
    includeShort: false, skipped: 0,   // sub-threshold blocks: counted, offered on request
  };

  // ── chrome.* wrapper: an orphaned content script must not spam (§7.2) ──────
  const ORPHAN = "Extension context invalidated";
  function safe(fn, fallback) {
    if (state.dead) return fallback;
    try { return fn(); }
    catch (e) {
      if (String(e && e.message).includes(ORPHAN)) { teardown(true); return fallback; }
      state.lastError = String(e && e.message || e).split("\n")[0];
      return fallback;
    }
  }

  const UPDATED_TEXT = { en: "Offcut was updated — reload the page",
                         tr: "Offcut güncellendi — sayfayı yenile" };

  /** Every user-visible string goes through here (§13). Returns the key itself
   *  if the catalogue is unreachable, which is loud rather than silent: a bare
   *  key on screen says "this string is missing", an empty toast says nothing. */
  function t(key, subs) {
    try {
      return chrome.i18n.getMessage(key, subs) || key;
    } catch {
      return key;                                 // orphaned context (§7.2)
    }
  }

  function teardown(announce) {
    if (state.dead) return;
    state.dead = true;
    if (state.observer) { state.observer.disconnect(); state.observer = null; }
    if (announce && state.shadow) {
      // chrome.i18n may already be dead here: the one deliberate exception to
      // the no-hardcoded-strings rule (§7.2).
      const lang = (navigator.language || "en").slice(0, 2);
      showToast(UPDATED_TEXT[lang] || UPDATED_TEXT.en, "warn", 8000);
      setTimeout(() => { if (state.host) state.host.remove(); }, 8500);
    } else if (state.host) {
      state.host.remove();
    }
  }

  // ── UI shell, entirely inside a shadow root on body (§8.7) ────────────────
  function ensureShell() {
    if (state.host && document.contains(state.host)) return;
    const host = document.createElement("div");
    host.setAttribute("data-oc", "root");
    host.style.cssText = "all:initial;position:fixed;inset:0;pointer-events:none;z-index:2147483000";
    const shadow = host.attachShadow({ mode: "open" });
    shadow.innerHTML = `<style>${SHELL_CSS}</style>
      <div class="oc-layer" part="layer">
        <button class="oc-ctl" hidden type="button"></button>
        <div class="oc-toasts" role="region" aria-live="polite"></div>
      </div>`;
    document.documentElement.appendChild(host);
    state.host = host;
    state.shadow = shadow;
    state.control = shadow.querySelector(".oc-ctl");
    state.toastHost = shadow.querySelector(".oc-toasts");
    state.control.addEventListener("click", onControlClick);
    // Direction is inherited on purpose so the overlay follows the page in RTL.
    shadow.host.style.direction = getComputedStyle(document.body).direction || "ltr";
  }

  const SHELL_CSS = `
:host { all: initial; }
.oc-layer { position:fixed; inset:0; pointer-events:none;
  font:12px/1.4 ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;
  --oc-ink:#17161A; --oc-surface:#201F24; --oc-line:#35333B; --oc-fg:#F2F0EC;
  --oc-dim:#9C99A3; --oc-gold:#E8B44A; --oc-ok:#3F8F5E; --oc-warn:#E0A32E; --oc-err:#C0392B; }
@media (prefers-color-scheme: light) {
  .oc-layer { --oc-surface:#FFFFFF; --oc-line:#E2E0DC; --oc-fg:#1A1A1E; --oc-dim:#6B6870; --oc-gold:#8A6212; } }
.oc-ctl { position:fixed; pointer-events:auto; display:inline-flex; align-items:center; gap:5px;
  padding:4px 9px 4px 7px; border-radius:7px; border:1px solid var(--oc-gold);
  background:var(--oc-surface); color:var(--oc-fg); font:inherit; font-size:11px;
  cursor:pointer; box-shadow:0 6px 18px -6px rgba(0,0,0,.55); max-inline-size:240px; }
.oc-ctl:focus-visible { outline:2px solid var(--oc-gold); outline-offset:2px; }
.oc-ctl b { font-weight:500; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.oc-toasts { position:fixed; inset-block-end:16px; inset-inline-end:16px; display:flex;
  flex-direction:column; gap:6px; align-items:flex-end; pointer-events:none; }
.oc-toast { pointer-events:auto; display:flex; align-items:center; gap:8px; padding:8px 12px;
  border-radius:9px; background:var(--oc-surface); color:var(--oc-fg);
  border:1px solid var(--oc-line); box-shadow:0 8px 24px -8px rgba(0,0,0,.6); font-size:11.5px;
  max-inline-size:340px; animation:oc-in .16s ease-out; }
.oc-toast.ok { border-color:color-mix(in srgb, var(--oc-ok) 55%, transparent); }
.oc-toast.warn { border-color:color-mix(in srgb, var(--oc-warn) 55%, transparent); }
.oc-toast.err { border-color:color-mix(in srgb, var(--oc-err) 60%, transparent); }
.oc-toast button { all:unset; cursor:pointer; color:var(--oc-dim); padding-inline-start:6px; }
@keyframes oc-in { from { opacity:0; transform:translateY(4px); } }
@media (prefers-reduced-motion: reduce) { .oc-toast { animation:none; } }`;

  function showToast(text, level, ms) {
    ensureShell();
    const el = document.createElement("div");
    el.className = "oc-toast " + (level || "ok");
    el.setAttribute("role", level === "err" ? "alert" : "status");
    const span = document.createElement("span");
    span.textContent = text;                      // never innerHTML (§17)
    el.appendChild(span);
    if (level === "err") {
      const close = document.createElement("button");
      close.textContent = "✕";
      close.setAttribute("aria-label", t("dismiss"));
      close.addEventListener("click", () => el.remove());
      el.appendChild(close);
    }
    state.toastHost.appendChild(el);
    if (level !== "err") setTimeout(() => el.remove(), ms || (level === "warn" ? 5000 : 2500));
  }

  // ── the floating control (§8.1.1) ─────────────────────────────────────────
  function itemForNode(node) {
    return state.items.find((i) => i.node === node) || null;
  }

  function positionControl(codeEl) {
    const item = itemForNode(codeEl);
    if (!item) { hideControl(); return; }
    ensureShell();
    const box = (codeEl.closest("pre") || codeEl).getBoundingClientRect();
    const c = state.control;
    c.hidden = false;
    c.replaceChildren();
    const arrow = document.createElement("span"); arrow.textContent = "↓";
    const name = document.createElement("b");
    const full = displayName(item);
    name.textContent = middleTruncate(full, 26);  // the name it will produce (§8.1.1)
    c.append(arrow, name);
    c.title = full;
    c.setAttribute("aria-label", t("downloadNamed", [full]));
    c.dataset.key = item.key;
    const top = Math.max(8, box.top + 8);
    c.style.top = top + "px";
    c.style.left = "";
    c.style.right = Math.max(8, window.innerWidth - box.right + 8) + "px";
    state.hoverEl = codeEl;
  }

  function hideControl() {
    if (state.control) { state.control.hidden = true; state.control.dataset.key = ""; }
    state.hoverEl = null;
  }

  function middleTruncate(s, max) {
    if (s.length <= max) return s;
    const keep = Math.floor((max - 1) / 2);
    return s.slice(0, keep) + "…" + s.slice(-keep);
  }

  function displayName(item, partial) {
    const base = state.renamed.get(item.key) || item.title;
    return P.fmtName(state.cfg.nameTemplate, {
      title: base, version: null, ext: item.ext, kind: item.kind,
      date: P.isoLocalDate(), partial: !!partial,
    });
  }

  /**
   * Completeness is a delivery-time question, not a scan-time one (§4).
   *
   * Counting blocks needs one cheap synchronous read; handing one over needs
   * the proof that what was read is all there is. Doing the proof during a
   * scan would scroll every block on the page on every mutation, so it runs
   * here instead — on one block, at the moment it is actually being taken.
   *
   * Returns { content, complete }. A stale node falls back to the scanned
   * text rather than reading a detached clone as if it were the page.
   */
  async function resolveContent(item) {
    const scanned = item.versions[item.versions.length - 1].content;
    if (!item.node || !document.contains(item.node)) return { content: scanned, complete: true };
    try {
      const r = await D.readCodeTextComplete(item.node);
      return { content: r.text, complete: r.complete };
    } catch {
      // A failed completeness pass must not block the download; the scanned
      // text is what the user could see, so it is what they get.
      return { content: scanned, complete: true };
    }
  }

  // ── download (§8.4: we can only claim what we know) ───────────────────────
  async function download(item) {
    const { content, complete } = await resolveContent(item);
    const name = displayName(item, !complete);
    const blob = new Blob([content], { type: mimeFor(item.ext) });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = name; a.rel = "noopener";
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    a.remove();
    // Released on a delay, never immediately: a consumer may still be reading.
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    state.tookThisSession.add(item.key);
    // An incomplete read is said out loud. The control's preview showed the
    // ordinary name because completeness is only known after the read, so
    // without this the user sees one name and gets another (§8.4).
    if (complete) showToast("↓ " + name, "ok");    // "downloading", not "downloaded"
    else showToast(t("toastPartial"), "warn", 6000);
    safe(() => chrome.runtime.sendMessage({ type: "downloaded" }));
  }

  function mimeFor(ext) {
    if (ext === ".html") return "text/html";
    if (ext === ".svg") return "image/svg+xml";
    if (ext === ".json") return "application/json";
    if (ext === ".md") return "text/markdown";
    return "text/plain;charset=utf-8";
  }

  /**
   * In-page copy (the control's Alt+click). Works because the click is a real
   * user gesture in a focused document — the two things the clipboard API
   * requires. The popup's copy cannot use this path; see the "item:copy"
   * handler for why.
   */
  async function copyItem(item) {
    const { content, complete } = await resolveContent(item);
    try {
      await navigator.clipboard.writeText(content);
      showToast("⧉ " + displayName(item, !complete), "ok");
    } catch (e) { showToast(t("toastCopyBlocked"), "err"); }
  }

  function onControlClick(ev) {
    ev.preventDefault(); ev.stopPropagation();
    const item = state.byKey.get(state.control.dataset.key);
    if (!item) return;
    if (ev.altKey) copyItem(item); else download(item);
  }

  // ── scanning and observation (§7 step 1) ─────────────────────────────────
  function rescan() {
    if (state.dead) return;
    const sel = state.row && state.row.codeBlock;
    const nodes = state.cfg.kinds.code ? D.codeNodes(document, sel) : [];
    const resolved = D.resolveChatRoot(state.row, nodes);
    state.root = resolved.node;
    state.rootVia = resolved.via;
    // The nodes are already resolved; passing them keeps rescan to one walk.
    // They were collected from the document, so when the root came from a
    // registry selector they are narrowed to it — otherwise the first row to
    // define a chatRoot would silently widen what the panel lists. No row
    // defines one today, which is exactly why this would have gone unnoticed.
    const scoped = resolved.via === "selector" && state.root
      ? nodes.filter((n) => state.root.contains(n))
      : nodes;
    state.items = state.cfg.kinds.code
      ? D.collectCodeItems(state.root || document, sel,
                           { includeShort: state.includeShort, nodes: scoped })
      : [];
    state.skipped = state.items.skipped || 0;
    state.byKey = new Map(state.items.map((i) => [i.key, i]));
    if (state.hoverEl && !document.contains(state.hoverEl)) hideControl();
    safe(() => chrome.runtime.sendMessage({
      type: state.items.length ? "items:present" : "items:none",
      docs: 0, code: state.items.length, attachments: 0,
    }));
  }

  function scheduleRescan() {
    if (state.rafPending || state.dead) return;
    state.rafPending = true;
    requestAnimationFrame(() => { state.rafPending = false; rescan(); });
  }

  /** Two-stage observation: body/childList until a container is found, then
   *  narrowed to it. Watching body+subtree during streaming burns CPU (§7). */
  function observe() {
    if (state.observer) state.observer.disconnect();
    const target = state.root && document.contains(state.root) ? state.root : document.body;
    const opts = target === document.body
      ? { childList: true }
      : { childList: true, subtree: true };
    state.observer = new MutationObserver(scheduleRescan);
    state.observer.observe(target, opts);
  }

  // ── pointer and keyboard entry points ────────────────────────────────────
  function nearestCode(target) {
    if (!target || !target.closest) return null;
    const pre = target.closest("pre");
    if (!pre) return null;
    const code = pre.querySelector("code");
    return code && state.byKey.has((itemForNode(code) || {}).key) ? code : null;
  }

  function onPointerOver(ev) {
    if (state.dead || !state.hoverCapable) return;
    const code = nearestCode(ev.target);
    if (code) positionControl(code);
    else if (state.hoverEl && !ev.target.closest("[data-oc]")) hideControl();
  }

  function onFocusIn(ev) {
    const code = nearestCode(ev.target);
    if (code) positionControl(code);
  }

  function onKeyDown(ev) {
    if (ev.key === "Escape" && state.control && !state.control.hidden) hideControl();
  }

  function reposition() { if (state.hoverEl) positionControl(state.hoverEl); }

  // ── messages from the popup and the service worker ───────────────────────
  function serialiseItem(i) {
    return { kind: i.kind, key: i.key, title: state.renamed.get(i.key) || i.title, ext: i.ext,
             language: i.language, lines: i.lines, name: displayName(i),
             short: !!i.short, taken: state.tookThisSession.has(i.key) };
  }

  function onMessage(msg, _sender, reply) {
    if (state.dead) return;
    switch (msg && msg.type) {
      case "items:list":
        // Deliberately no rescan here. The MutationObserver already keeps
        // state.items current, so scanning again on every popup open bought
        // nothing and made the user wait for it: the scan clones and reads
        // every code node on the page, and the popup cannot paint its list
        // until this reply arrives (§7).
        reply({ provider: state.row ? state.row.name : null,
                items: state.items.map(serialiseItem),
                skipped: state.skipped, includeShort: state.includeShort });
        return true;
      case "item:download": {
        const it = state.byKey.get(msg.key);
        if (it) download(it); else showToast(t("toastItemGone"), "warn");
        reply({ ok: !!it }); return true;
      }
      case "short:show":
        state.includeShort = true;
        rescan();
        reply({ ok: true, items: state.items.map(serialiseItem) });
        return true;
      case "item:copy": {
        // The clipboard belongs to whatever document has focus. A request from
        // the popup arrives while the POPUP holds focus, so writeText() here
        // throws NotAllowedError and the user is told the page blocked it —
        // which is not what happened. The page hands the text back instead and
        // the popup, which has both focus and the click, does the writing.
        const it = state.byKey.get(msg.key);
        if (!it) { reply({ ok: false }); return true; }
        resolveContent(it).then(({ content, complete }) => {
          reply({ ok: true, content, name: displayName(it, !complete), complete });
        }, () => reply({ ok: false }));
        return true;
      }
      case "item:rename": {
        const it = state.byKey.get(msg.key);
        if (it) state.renamed.set(msg.key, msg.title);
        reply({ ok: !!it, name: it ? displayName(it) : null }); return true;
      }
      case "cmd:download": {
        const it = state.hoverEl ? itemForNode(state.hoverEl) : state.items[0];
        if (it) download(it);
        else showToast(t("toastNothingHere"), "warn");
        reply({ ok: !!it }); return true;
      }
      case "diag:get":
        reply(diagnostics()); return true;
      case "site:disable":
        teardown(false);
        reply({ ok: true }); return true;
      case "cfg:changed":
        state.cfg = Object.assign({}, DEFAULTS, msg.cfg);
        rescan();
        reply({ ok: true }); return true;
      default:
        return false;
    }
  }

  /** Structure and status only — never conversation data, never tool names
   *  (§8.9, §2.1.3.2). */
  function diagnostics() {
    return {
      version: safe(() => chrome.runtime.getManifest().version, "?"),
      ua: navigator.userAgent.match(/Chrome\/(\d+)/) ? "Chrome " + RegExp.$1 : "unknown",
      lang: (navigator.language || "").slice(0, 5),
      provider: state.row ? state.row.id : "none",
      lastVerified: state.row ? state.row.LAST_VERIFIED : null,
      tier: "3 (DOM)",
      chatRoot: state.rootVia,
      codeBlocks: state.items.length,
      hoverCapable: state.hoverCapable,
      interfaceChanged: state.rootVia === "none" && !!state.row,
      lastError: state.lastError,
    };
  }

  // ── boot ─────────────────────────────────────────────────────────────────
  async function boot() {
    state.row = R.findProvider(location.hostname);
    if (!state.row) return;                        // an unlisted, ungranted host

    const stored = await new Promise((res) =>
      safe(() => chrome.storage.sync.get("cfg", (o) => res((o && o.cfg) || {})), res({})));
    state.cfg = Object.assign({}, DEFAULTS, stored);

    // The first thing we do: a provider switched off must observe nothing and
    // read no DOM (§11.2). The manifest match already loaded us.
    if (state.cfg.sites && state.cfg.sites[state.row.id] === false) return;

    state.hoverCapable = !window.matchMedia || window.matchMedia("(hover: hover)").matches;

    rescan();
    observe();

    document.addEventListener("pointerover", onPointerOver, true);
    document.addEventListener("focusin", onFocusIn, true);
    document.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("resize", reposition, { passive: true });
    window.addEventListener("scroll", reposition, { passive: true, capture: true });
    if (window.visualViewport) window.visualViewport.addEventListener("resize", reposition);
    // SPA route changes reset state (§7 step 1)
    let lastPath = location.pathname;
    setInterval(() => {
      if (state.dead) return;
      if (location.pathname !== lastPath) {
        lastPath = location.pathname;
        state.renamed.clear(); hideControl(); rescan(); observe();
      }
    }, 700);

    safe(() => chrome.runtime.onMessage.addListener(onMessage));
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
