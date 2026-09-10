/**
 * Offcut — popup and options, one file (design §8.6, §8.6.1)
 *
 * The popup is the ONLY accessible path to code blocks (§8.1.1), so its
 * keyboard and screen reader model is load-bearing rather than polish.
 */

/* global OffcutParse, OffcutRegistry */

(() => {
  const P = OffcutParse, R = OffcutRegistry;
  const isOptions = new URLSearchParams(location.search).get("options") === "1"
                 || (chrome.extension && chrome.extension.getViews
                     && !chrome.extension.getViews({ type: "popup" }).includes(window));

  const DEFAULTS = {
    badge: true, notify: "inpage", autoDownload: false, defaultVersion: "current",
    nameTemplate: "{title}", zipAll: true, saveTo: "downloads",
    kinds: { artifact: true, code: true, attachment: true, conversation: true,
             tool_output: true, citations: true, image: true },
    includeThinking: false, includeCall: true, handoffAt: 40,
    sites: {}, extraHosts: [], history: false, historyMax: 5000, dragEnabled: true,
  };

  const el = (id) => document.getElementById(id);
  const t = (key, fallback) => {
    const s = chrome.i18n && chrome.i18n.getMessage ? chrome.i18n.getMessage(key) : "";
    return s || fallback || key;
  };

  let cfg = DEFAULTS;
  let items = [];
  let tabId = null;
  let needsReload = false;      // supported host, but no content script answered
  let skipped = 0;              // blocks below MIN_CODE_LINES, counted not hidden
  let wrongPage = false;        // right provider, but not a page we are injected into
  let urlRow = null;
  let focusIndex = 0;

  // ── i18n: every visible string comes from _locales (§13) ─────────────────
  function localise() {
    document.querySelectorAll("[data-i18n]").forEach((n) => {
      n.textContent = t(n.dataset.i18n, n.textContent);
    });
    document.querySelectorAll("[data-i18n-ph]").forEach((n) => {
      n.placeholder = t(n.dataset.i18nPh, "Filter");
    });
    document.querySelectorAll("[data-i18n-aria]").forEach((n) => {
      n.setAttribute("aria-label", t(n.dataset.i18nAria));
    });
    el("ver").textContent = "v" + chrome.runtime.getManifest().version;
  }

  function send(msg) {
    return new Promise((res) => {
      if (tabId == null) return res(null);
      chrome.tabs.sendMessage(tabId, msg, (r) => { void chrome.runtime.lastError; res(r || null); });
    });
  }

  /**
   * Chrome match pattern → RegExp, read from our own manifest.
   *
   * A registry row matches a HOST; the manifest injects on specific PATHS.
   * Conflating them told a user on claude.ai/code/artifact/… to reload the
   * page, which could never have helped: the content script is not injected
   * there at all. Reading content_scripts is the only answer that cannot
   * drift from what Chrome actually does (§8.4).
   */
  function matchPatternToRegExp(pattern) {
    const m = /^(\*|https?):\/\/([^/]+)(\/.*)$/.exec(pattern);
    if (!m) return null;
    const esc = (x) => x.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
    const scheme = m[1] === "*" ? "https?" : m[1];
    const host = m[2] === "*" ? "[^/]+"
      : m[2].indexOf("*.") === 0 ? "(?:[^/]+\\.)?" + esc(m[2].slice(2))
      : esc(m[2]);
    return new RegExp("^" + scheme + "://" + host + esc(m[3]) + "$");
  }

  function isInjectedInto(url) {
    const blocks = chrome.runtime.getManifest().content_scripts || [];
    return blocks.some((b) => (b.matches || []).some((p) => {
      const re = matchPatternToRegExp(p);
      return re && re.test(url);
    }));
  }

  // ── rendering ────────────────────────────────────────────────────────────
  const KIND_LABEL = { code: "codeBlocks", artifact: "documents", attachment: "attachments",
                       tool_output: "toolOutputs", citations: "citations",
                       image: "images", conversation: "conversation" };

  function visible() {
    const q = (el("filter").value || "").trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) =>
      i.name.toLowerCase().includes(q) || String(i.language || "").toLowerCase().includes(q));
  }

  function render() {
    const list = el("list");
    list.replaceChildren();
    const shown = visible();

    el("filterWrap").classList.toggle("hidden", items.length <= 10);   // §8.6 item 12
    el("count").textContent = el("filter").value
      ? t("matches", "$1 matches").replace("$1", shown.length) : "";

    if (!shown.length) { list.appendChild(emptyState()); return; }

    let lastKind = null;
    shown.forEach((item, i) => {
      if (item.kind !== lastKind) {
        lastKind = item.kind;
        const g = document.createElement("div");
        g.className = "grp";
        const n = shown.filter((x) => x.kind === item.kind).length;
        g.textContent = t(KIND_LABEL[item.kind] || "items", item.kind) + " · " + n;
        list.appendChild(g);
      }
      list.appendChild(rowFor(item, i));
    });
    setFocus(Math.min(focusIndex, shown.length - 1));
  }

  function emptyState() {
    const d = document.createElement("div");
    d.className = "empty";
    if (wrongPage) {
      d.textContent = t("emptyNotAConversation", "This page is not a conversation.");
      const p = document.createElement("div");
      const a = document.createElement("a");
      a.href = urlRow.newChatUrl; a.target = "_blank"; a.rel = "noopener";
      a.textContent = t("openAConversation", "Open a conversation");
      p.appendChild(a);
      d.appendChild(document.createElement("br"));
      d.appendChild(p);
    } else if (needsReload) {
      // The one empty state with a fix the user can perform from here.
      d.textContent = t("emptyReload", "Reload the page.");
      const b = document.createElement("button");
      b.className = "reload";
      b.textContent = t("reloadPage", "Reload the page");
      b.addEventListener("click", () => {
        if (tabId != null) chrome.tabs.reload(tabId);
        window.close();
      });
      d.appendChild(document.createElement("br"));
      d.appendChild(b);
    } else if (tabId == null || !items.provider) {
      d.textContent = t("emptyUnsupported", "Open a conversation on a supported AI chat.");
      const p = document.createElement("div");
      R.REGISTRY.slice(0, 4).forEach((row, i) => {
        if (i) p.appendChild(document.createTextNode(" · "));
        const a = document.createElement("a");
        a.href = row.newChatUrl; a.target = "_blank"; a.rel = "noopener";
        a.textContent = row.name;
        p.appendChild(a);
      });
      d.appendChild(document.createElement("br"));
      d.appendChild(p);
    } else if (skipped > 0) {
      // "Nothing to download" on a page that visibly contains fenced code reads
      // as a fault. Saying how many were held back, and why, turns an invisible
      // threshold into a stated one the user can overrule (§8.4).
      d.textContent = t("shortSkipped", "$1 short blocks were not offered.")
        .replace("$1", skipped);
      const b = document.createElement("button");
      b.className = "reload";
      b.textContent = t("showShort", "Show them anyway");
      b.addEventListener("click", async () => {
        const provider = items.provider;          // read before items is replaced
        const r = await send({ type: "short:show" });
        if (!r || !r.items) return;
        items = r.items;
        items.provider = provider;
        skipped = 0;
        render();
      });
      d.appendChild(document.createElement("br"));
      d.appendChild(b);
    } else {
      d.textContent = t("emptyNoItems", "Nothing to download in this conversation.");
    }
    return d;
  }

  function rowFor(item, index) {
    const row = document.createElement("div");
    row.className = "row";
    row.setAttribute("role", "option");
    row.setAttribute("aria-selected", "false");
    row.tabIndex = -1;
    row.dataset.key = item.key;
    row.dataset.index = String(index);
    row.id = "oc-row-" + index;              // aria-activedescendant needs a target

    const ic = document.createElement("span");
    ic.className = "ic";
    ic.textContent = (item.ext || ".txt").replace(".", "").slice(0, 4);
    ic.setAttribute("aria-hidden", "true");

    const nm = document.createElement("span");
    nm.className = "nm";
    nm.textContent = item.name;                    // textContent only (§17)

    const meta = document.createElement("span");
    meta.className = "meta";
    meta.textContent = (item.taken ? "✓ " : "") +
      (item.lines != null ? t("lines", "$1 lines").replace("$1", item.lines) : "") +
      (item.short ? " · " + t("shortBadge", "short") : "");

    // The accessible name carries what the icons convey visually (§8.6.1)
    row.setAttribute("aria-label",
      item.name + ", " + t(KIND_LABEL[item.kind] || "items", item.kind) +
      (item.lines != null ? ", " + t("lines", "$1 lines").replace("$1", item.lines) : ""));

    const act = document.createElement("span");
    act.className = "act";
    act.appendChild(iconButton("⧉", t("copy", "Copy"), () => copyToClipboard(item)));
    const dl = iconButton("↓", t("download", "Download"), () => send({ type: "item:download", key: item.key }));
    dl.className = "pri";
    act.appendChild(dl);

    row.append(ic, nm, meta, act);
    row.addEventListener("click", (e) => { if (!e.target.closest("button")) setFocus(index); });
    row.addEventListener("dblclick", () => beginRename(row, item));
    return row;
  }

  function iconButton(glyph, label, onClick) {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = glyph;
    b.title = label;
    b.setAttribute("aria-label", label);
    b.addEventListener("click", (e) => { e.stopPropagation(); onClick(); });
    return b;
  }

  /** Rename in place. The extension is separate and not editable — a wrong
   *  extension is a silent source of error (§8.6 item 9). */
  function beginRename(row, item) {
    const nm = row.querySelector(".nm");
    const dot = item.name.lastIndexOf(".");
    const base = dot > 0 ? item.name.slice(0, dot) : item.name;
    const ext = dot > 0 ? item.name.slice(dot) : "";
    nm.textContent = base;
    nm.contentEditable = "plaintext-only";
    nm.focus();
    document.getSelection().selectAllChildren(nm);
    const finish = async (commit) => {
      nm.contentEditable = "false";
      if (commit) {
        const r = await send({ type: "item:rename", key: item.key, title: nm.textContent.trim() });
        if (r && r.name) item.name = r.name;
      }
      nm.textContent = item.name;
    };
    nm.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); finish(true); }
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); finish(false); }
    });
    nm.addEventListener("blur", () => finish(true), { once: true });
  }

  // ── keyboard model (§8.6.1) ──────────────────────────────────────────────
  function rows() { return [...el("list").querySelectorAll(".row")]; }

  function setFocus(i) {
    const rs = rows();
    if (!rs.length) return;
    focusIndex = Math.max(0, Math.min(i, rs.length - 1));
    rs.forEach((r, n) => r.setAttribute("aria-selected", n === focusIndex ? "true" : "false"));
    // Focus stays on the listbox and the active option is named. Without this
    // a screen reader announces the list and then nothing at all as the arrow
    // keys move — on the path §8.1.1 calls the ONLY accessible route to a
    // code block, which makes it the one place this cannot be missing.
    el("list").setAttribute("aria-activedescendant", rs[focusIndex].id);
    rs[focusIndex].scrollIntoView({ block: "nearest" });
  }

  function currentItem() {
    const rs = rows();
    const r = rs[focusIndex];
    return r ? items.find((i) => i.key === r.dataset.key) : null;
  }

  function onKey(e) {
    const editing = document.activeElement && document.activeElement.isContentEditable;
    if (editing) return;
    const it = currentItem();
    switch (e.key) {
      case "ArrowDown": e.preventDefault(); setFocus(focusIndex + 1); break;
      case "ArrowUp": e.preventDefault(); setFocus(focusIndex - 1); break;
      case "Enter": if (it) { e.preventDefault(); send({ type: "item:download", key: it.key }); } break;
      case "c": case "C": if (it && !e.metaKey && !e.ctrlKey) { e.preventDefault(); copyToClipboard(it); } break;
      case "e": case "E": {
        if (!it || e.metaKey || e.ctrlKey) break;
        e.preventDefault();
        const r = rows()[focusIndex];
        if (r) beginRename(r, it);
        break;
      }
      case "Escape":
        // unwinds in order: clear the filter, then let the popup close
        if (el("filter").value) { e.preventDefault(); el("filter").value = ""; render(); }
        break;
    }
  }

  // ── settings (§8.6; every cfg key has a control, CI gate 11) ─────────────
  function settingsUI() {
    const s = el("settings");
    s.replaceChildren();
    const section = (key, fallback) => {
      const h = document.createElement("h2");
      h.textContent = t(key, fallback);
      s.appendChild(h);
    };
    const rowEl = (labelKey, labelFallback, hintKey, hintFallback, control) => {
      const d = document.createElement("div"); d.className = "set";
      const wrap = document.createElement("div");
      const l = document.createElement("label"); l.textContent = t(labelKey, labelFallback);
      wrap.appendChild(l);
      if (hintFallback) { const sm = document.createElement("small"); sm.textContent = t(hintKey, hintFallback); wrap.appendChild(sm); }
      const c = document.createElement("span"); c.className = "ctl"; c.appendChild(control);
      d.append(wrap, c); s.appendChild(d);
      l.htmlFor = control.id || "";
      return d;
    };
    const toggle = (id, checked, onChange) => {
      const i = document.createElement("input");
      i.type = "checkbox"; i.id = id; i.checked = !!checked;
      i.addEventListener("change", () => onChange(i.checked));
      return i;
    };

    section("secWhatToShow", "What to show");
    Object.keys(DEFAULTS.kinds).forEach((k) => {
      // v1 only produces code; the rest are drawn once their version ships,
      // because a control for a capability that does not exist promises it.
      if (k !== "code") return;
      rowEl("kind_" + k, k, null, null, toggle("kind_" + k, cfg.kinds[k], (v) => {
        cfg.kinds[k] = v; save();
      }));
    });

    section("secNotification", "Notification");
    rowEl("optBadge", "Toolbar badge", "optBadgeHint", "Count and pulse on the icon",
      toggle("optBadge", cfg.badge, (v) => { cfg.badge = v; save(); }));

    section("secDownload", "Downloading");
    const tmpl = document.createElement("input");
    tmpl.type = "text"; tmpl.id = "tmpl"; tmpl.value = cfg.nameTemplate;
    tmpl.addEventListener("input", () => { cfg.nameTemplate = tmpl.value; preview(); });
    tmpl.addEventListener("change", save);
    rowEl("optTemplate", "Filename", "optTemplateHint", "{title} {version} {date}", tmpl);
    const pv = document.createElement("div"); pv.className = "preview"; pv.id = "preview";
    s.appendChild(pv);

    section("secSites", "Sites");
    const box = document.createElement("div"); box.className = "sites";
    R.REGISTRY.forEach((row) => {
      const d = document.createElement("div"); d.className = "set";
      const l = document.createElement("label"); l.textContent = row.name; l.htmlFor = "site_" + row.id;
      const c = document.createElement("span"); c.className = "ctl";
      c.appendChild(toggle("site_" + row.id, cfg.sites[row.id] !== false, (v) => {
        cfg.sites[row.id] = v; save();
      }));
      d.append(l, c); box.appendChild(d);
    });
    s.appendChild(box);
    preview();
  }

  /** Computed from the first real item, never a placeholder: a preview that
   *  does not match what you get defeats its purpose (§8.6 item 7). */
  function preview() {
    const pv = el("preview"); if (!pv) return;
    const first = items[0];
    const sample = first
      ? { title: first.name.replace(/\.[^.]+$/, ""), ext: first.ext, kind: first.kind }
      : { title: "Sales Dashboard", ext: ".tsx", kind: "code" };
    pv.textContent = P.fmtName(cfg.nameTemplate, {
      title: sample.title, version: 3, ext: sample.ext, kind: sample.kind, date: P.isoLocalDate(),
    });
  }

  function save() {
    chrome.storage.sync.set({ cfg }, () => {
      void chrome.runtime.lastError;
      if (tabId != null) send({ type: "cfg:changed", cfg });
      render();
    });
  }

  // ── footer actions ───────────────────────────────────────────────────────
  /**
   * Copy runs HERE, not in the page. While this popup is open the page is not
   * the focused document, and navigator.clipboard.writeText() rejects on an
   * unfocused document — which surfaced to the user as "the page blocked
   * clipboard access", blaming the site for the extension's own mistake.
   * The page resolves the text; the popup, which has focus and the click,
   * writes it (§8.6 item 10).
   */
  async function copyToClipboard(item, feedbackEl) {
    const r = await send({ type: "item:copy", key: item.key });
    if (!r || !r.ok) return flash(feedbackEl, t("toastItemGone", "That item is no longer on the page"));
    try {
      await navigator.clipboard.writeText(r.content);
      flash(feedbackEl, t("copied", "Copied"));
    } catch {
      flash(feedbackEl, t("toastCopyBlocked", "Could not copy"));
    }
  }

  /** Feedback in the popup's live region, so a screen reader hears it too. */
  function flash(_el, text) {
    const c = el("count");
    const prev = c.textContent;
    c.textContent = text;
    setTimeout(() => { if (c.textContent === text) c.textContent = prev; }, 1500);
  }

  async function copyDiagnostics() {
    const d = await send({ type: "diag:get" });
    const lines = d
      ? ["Offcut " + d.version + " · " + d.ua + " · " + d.lang,
         "Provider: " + d.provider + " · adapter LAST_VERIFIED " + d.lastVerified,
         "Tier: " + d.tier,
         "chatRoot: " + d.chatRoot,
         "Code blocks: " + d.codeBlocks + " · hover: " + d.hoverCapable,
         "Interface changed: " + d.interfaceChanged,
         "Last error: " + (d.lastError || "none")]
      : ["Offcut " + chrome.runtime.getManifest().version, "No content script on this tab"];
    await navigator.clipboard.writeText(lines.join("\n"));
    el("diag").textContent = t("copied", "Copied");
    setTimeout(() => { el("diag").textContent = t("copyDiagnostics", "Diagnostics"); }, 1500);
  }

  // ── boot ─────────────────────────────────────────────────────────────────
  async function boot() {
    if (isOptions) document.body.classList.add("options");
    localise();

    // These two are independent, so they go together. Serially they cost two
    // round trips before anything below can start (§8.6.1).
    const [storedCfg, tabs] = await Promise.all([
      new Promise((res) => chrome.storage.sync.get("cfg", (o) => res((o && o.cfg) || {}))),
      new Promise((res) => chrome.tabs.query({ active: true, currentWindow: true }, res)),
    ]);
    cfg = Object.assign({}, DEFAULTS, storedCfg);
    tabId = tabs && tabs[0] ? tabs[0].id : null;

    // The tab's URL is readable without the "tabs" permission for any origin
    // we already hold a host permission for — which is exactly the registry's
    // origins, and the only ones this answer needs (§19.6).
    let tabUrl = null;
    try {
      tabUrl = (tabs && tabs[0] && tabs[0].url) || null;
      if (tabUrl) urlRow = R.findProvider(new URL(tabUrl).hostname);
    } catch { urlRow = null; }

    const resp = await send({ type: "items:list" });
    items = (resp && resp.items) || [];
    items.provider = resp && resp.provider;
    skipped = (resp && resp.skipped) || 0;

    // Three states, not two. Silence from the content script is not evidence
    // that the site is unsupported — Chrome does not inject into tabs that
    // were already open when the extension was loaded or updated, and saying
    // "not a supported chat" on a supported chat sends the user to fix the
    // wrong thing (§8.4: we can only claim what we know).
    // Four states, not three. A supported HOST on a page we do not inject into
    // is not a reload problem — reloading claude.ai/code/artifact/… would have
    // sent the user round the same loop forever.
    const injected = !!tabUrl && isInjectedInto(tabUrl);
    wrongPage = !items.provider && !!urlRow && !injected;
    needsReload = !items.provider && !!urlRow && injected;

    el("dot").classList.toggle("off", !items.provider);
    el("strip").textContent = items.provider
      ? items.provider + " · " + t("codeOnly", "code blocks")
      : needsReload ? t("notRunningHere", "Loaded, but not running on this tab")
      : wrongPage ? urlRow.name + " · " + t("notAConversation", "Not a conversation page")
      : t("unsupportedSite", "Not a supported chat");

    el("filter").addEventListener("input", render);
    el("list").addEventListener("keydown", onKey);
    document.addEventListener("keydown", (e) => {
      if (e.target === el("filter") && (e.key === "ArrowDown" || e.key === "ArrowUp")) { onKey(e); }
    });
    el("toggleSettings").addEventListener("click", () => {
      const s = el("settings");
      const showing = s.classList.toggle("hidden");
      if (!showing) settingsUI();
    });
    el("diag").addEventListener("click", copyDiagnostics);
    el("disable").addEventListener("click", async () => {
      const row = items.provider && R.REGISTRY.find((r) => r.name === items.provider);
      if (row) { cfg.sites[row.id] = false; save(); }
      await send({ type: "site:disable", scope: "site" });
      window.close();
    });

    render();
    // Focus lands on the filter for long lists, the first row otherwise (§8.6.1)
    // Focusing an empty list rings the empty state, which reads as an error
    // rather than as a focus position. With rows, the ring is the affordance.
    if (items.length > 10) el("filter").focus();
    else if (items.length) el("list").focus();
    else el("list").removeAttribute("aria-activedescendant");
    if (isOptions) { el("settings").classList.remove("hidden"); settingsUI(); }
  }

  boot();
})();
