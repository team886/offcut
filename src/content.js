/**
 * Magpie — content script (design §7, §8)
 *
 * v1 scope: code blocks. No provider selector lives here (§12, CI gate 10);
 * everything provider-specific comes from the registry row or an adapter.
 */

/* global MagpieParse, MagpieRegistry, MagpieDom */

(() => {
  const P = MagpieParse, R = MagpieRegistry, D = MagpieDom;

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

  const UPDATED_TEXT = { en: "Magpie was updated — reload the page",
                         tr: "Magpie güncellendi — sayfayı yenile" };

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
    host.setAttribute("data-mg", "root");
    host.style.cssText = "all:initial;position:fixed;inset:0;pointer-events:none;z-index:2147483000";
    const shadow = host.attachShadow({ mode: "open" });
    shadow.innerHTML = `<style>${SHELL_CSS}</style>
      <div class="mg-layer" part="layer">
        <button class="mg-ctl" hidden type="button"></button>
        <div class="mg-toasts" role="region" aria-live="polite"></div>
      </div>`;
    document.documentElement.appendChild(host);
    state.host = host;
    state.shadow = shadow;
    state.control = shadow.querySelector(".mg-ctl");
    state.toastHost = shadow.querySelector(".mg-toasts");
    state.control.addEventListener("click", onControlClick);
    // Direction is inherited on purpose so the overlay follows the page in RTL.
    shadow.host.style.direction = getComputedStyle(document.body).direction || "ltr";
  }

  const SHELL_CSS = `
:host { all: initial; }
.mg-layer { position:fixed; inset:0; pointer-events:none;
  font:12px/1.4 ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;
  --mg-ink:#17161A; --mg-surface:#201F24; --mg-line:#35333B; --mg-fg:#F2F0EC;
  --mg-dim:#9C99A3; --mg-gold:#E8B44A; --mg-ok:#3F8F5E; --mg-warn:#E0A32E; --mg-err:#C0392B; }
@media (prefers-color-scheme: light) {
  .mg-layer { --mg-surface:#FFFFFF; --mg-line:#E2E0DC; --mg-fg:#1A1A1E; --mg-dim:#6B6870; --mg-gold:#8A6212; } }
.mg-ctl { position:fixed; pointer-events:auto; display:inline-flex; align-items:center; gap:5px;
  padding:4px 9px 4px 7px; border-radius:7px; border:1px solid var(--mg-gold);
  background:var(--mg-surface); color:var(--mg-fg); font:inherit; font-size:11px;
  cursor:pointer; box-shadow:0 6px 18px -6px rgba(0,0,0,.55); max-inline-size:240px; }
.mg-ctl:focus-visible { outline:2px solid var(--mg-gold); outline-offset:2px; }
.mg-ctl b { font-weight:500; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.mg-toasts { position:fixed; inset-block-end:16px; inset-inline-end:16px; display:flex;
  flex-direction:column; gap:6px; align-items:flex-end; pointer-events:none; }
.mg-toast { pointer-events:auto; display:flex; align-items:center; gap:8px; padding:8px 12px;
  border-radius:9px; background:var(--mg-surface); color:var(--mg-fg);
  border:1px solid var(--mg-line); box-shadow:0 8px 24px -8px rgba(0,0,0,.6); font-size:11.5px;
  max-inline-size:340px; animation:mg-in .16s ease-out; }
.mg-toast.ok { border-color:color-mix(in srgb, var(--mg-ok) 55%, transparent); }
.mg-toast.warn { border-color:color-mix(in srgb, var(--mg-warn) 55%, transparent); }
.mg-toast.err { border-color:color-mix(in srgb, var(--mg-err) 60%, transparent); }
.mg-toast button { all:unset; cursor:pointer; color:var(--mg-dim); padding-inline-start:6px; }
@keyframes mg-in { from { opacity:0; transform:translateY(4px); } }
@media (prefers-reduced-motion: reduce) { .mg-toast { animation:none; } }`;

  function showToast(text, level, ms) {
    ensureShell();
    const el = document.createElement("div");
    el.className = "mg-toast " + (level || "ok");
    el.setAttribute("role", level === "err" ? "alert" : "status");
    const span = document.createElement("span");
    span.textContent = text;                      // never innerHTML (§17)
    el.appendChild(span);
    if (level === "err") {
      const close = document.createElement("button");
      close.textContent = "✕";
      close.setAttribute("aria-label", "Dismiss");
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
    c.setAttribute("aria-label", "Download " + full);
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

  function displayName(item) {
    const base = state.renamed.get(item.key) || item.title;
    return P.fmtName(state.cfg.nameTemplate, {
      title: base, version: null, ext: item.ext, kind: item.kind,
      date: P.isoLocalDate(),
    });
  }

  // ── download (§8.4: we can only claim what we know) ───────────────────────
  function download(item) {
    const version = item.versions[item.versions.length - 1];
    const name = displayName(item);
    const blob = new Blob([version.content], { type: mimeFor(item.ext) });
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
    showToast("↓ " + name, "ok");                  // "downloading", not "downloaded"
    safe(() => chrome.runtime.sendMessage({ type: "downloaded" }));
  }

  function mimeFor(ext) {
    if (ext === ".html") return "text/html";
    if (ext === ".svg") return "image/svg+xml";
    if (ext === ".json") return "application/json";
    if (ext === ".md") return "text/markdown";
    return "text/plain;charset=utf-8";
  }

  async function copyItem(item) {
    const v = item.versions[item.versions.length - 1];
    try { await navigator.clipboard.writeText(v.content); showToast("⧉ " + displayName(item), "ok"); }
    catch (e) { showToast("Could not copy — the page blocked clipboard access", "err"); }
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
    const resolved = D.resolveChatRoot(state.row);
    state.root = resolved.node;
    state.rootVia = resolved.via;
    state.items = state.cfg.kinds.code
      ? D.collectCodeItems(state.root || document, state.row && state.row.codeBlock)
      : [];
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
    else if (state.hoverEl && !ev.target.closest("[data-mg]")) hideControl();
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
             taken: state.tookThisSession.has(i.key) };
  }

  function onMessage(msg, _sender, reply) {
    if (state.dead) return;
    switch (msg && msg.type) {
      case "items:list":
        rescan();
        reply({ provider: state.row ? state.row.name : null, items: state.items.map(serialiseItem) });
        return true;
      case "item:download": {
        const it = state.byKey.get(msg.key);
        if (it) download(it); else showToast("That item is no longer on the page", "warn");
        reply({ ok: !!it }); return true;
      }
      case "item:copy": {
        const it = state.byKey.get(msg.key);
        if (it) copyItem(it);
        reply({ ok: !!it }); return true;
      }
      case "item:rename": {
        const it = state.byKey.get(msg.key);
        if (it) state.renamed.set(msg.key, msg.title);
        reply({ ok: !!it, name: it ? displayName(it) : null }); return true;
      }
      case "cmd:download": {
        const it = state.hoverEl ? itemForNode(state.hoverEl) : state.items[0];
        if (it) download(it);
        else showToast("Nothing to download on this page", "warn");
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
