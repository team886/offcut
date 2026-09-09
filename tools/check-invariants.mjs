/**
 * Magpie — mechanical gates (design §19.3, gates 2–16)
 *
 *   node tools/check-invariants.mjs
 *
 * A rule without a gate rots: the only thing remembering it is having read the
 * document. Every rule below is one this specification argues for, and the
 * failure message names the section so a red build explains itself.
 *
 * No npm dependency — Node built-ins only.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, extname } from "node:path";

const problems = [];
const fail = (gate, msg) => problems.push(`gate ${gate}: ${msg}`);
const read = (p) => readFileSync(p, "utf8");

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".git" || name === "dist" || name === ".superpowers") continue;
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

const all = walk(".");
const srcFiles = all.filter((p) => p.startsWith("src") && extname(p) === ".js");
const shipped = all.filter((p) =>
  (p.startsWith("src") || p.startsWith("_locales") || p.startsWith("icons") || p === "manifest.json"));

const manifest = JSON.parse(read("manifest.json"));

// ── gate 2: permissions against a whitelist ──────────────────────────────────
{
  const allowed = new Set(["storage"]);
  const allowedOptional = new Set(["notifications"]);
  for (const p of manifest.permissions || []) {
    if (!allowed.has(p)) fail(2, `unexpected permission "${p}" — §19.6 justifies each one individually`);
  }
  for (const p of manifest.optional_permissions || []) {
    if (!allowedOptional.has(p)) fail(2, `unexpected optional permission "${p}"`);
  }
  if (manifest.default_locale !== "en") fail(2, `default_locale must be "en" (§5) — it is the fallback for every unsupported language`);
}

// ── gate 3: i18n completeness ────────────────────────────────────────────────
{
  const en = JSON.parse(read("_locales/en/messages.json"));
  const tr = JSON.parse(read("_locales/tr/messages.json"));
  const a = Object.keys(en).sort(), b = Object.keys(tr).sort();
  for (const k of a) if (!(k in tr)) fail(3, `_locales/tr is missing "${k}"`);
  for (const k of b) if (!(k in en)) fail(3, `_locales/en is missing "${k}"`);
}

// ── gate 4: no inline script or handler in an extension page ─────────────────
{
  const html = read("src/panel.html");
  if (/<script(?![^>]*\bsrc=)/i.test(html)) fail(4, "src/panel.html has an inline <script> — MV3's CSP blocks it silently (§17)");
  if (/\son[a-z]+\s*=/i.test(html)) fail(4, "src/panel.html has an inline event handler (§17)");
}

// ── gate 5: forbidden patterns ───────────────────────────────────────
{
  const banned = [
    [/insertAdjacentHTML/g, "insertAdjacentHTML"],
    [/eval\s*\(/g, "eval"],
    [/new\s+Function\s*\(/g, "new Function"],
    [/document\.write\s*\(/g, "document.write"],
    [/addEventListener\(\s*["']message["']/g, 'a window "message" listener'],
  ];
  for (const f of srcFiles) {
    const body = read(f);
    for (const [re, name] of banned) {
      if (re.test(body)) fail(5, `${f} uses ${name} — §17 allows textContent only`);
    }

    // innerHTML is exempted per occurrence, never per file: one file-wide
    // escape hatch and the rule stops catching anything. The only writer
    // allowed is the shadow shell mount, and only because its template
    // interpolates a constant rather than anything item-derived (§17).
    for (const m of body.matchAll(/([\w.]+)\.innerHTML\s*=\s*/g)) {
      if (m[1] !== "shadow") {
        fail(5, `${f} assigns ${m[1]}.innerHTML — §17 allows textContent only`);
        continue;
      }
      const tail = body.slice(m.index + m[0].length);
      if (!tail.startsWith("`")) { fail(5, `${f}: shadow.innerHTML is not a template literal`); continue; }
      const lit = tail.slice(1, tail.indexOf("`", 1));
      for (const sub of lit.matchAll(/\$\{([^}]*)\}/g)) {
        if (sub[1].trim() !== "SHELL_CSS") {
          fail(5, `${f}: shadow.innerHTML interpolates ${sub[1].trim()} — only the constant SHELL_CSS may go in (§17)`);
        }
      }
    }
  }
}

// ── gate 6: package size budget ──────────────────────────────────────────────
{
  const bytes = shipped.reduce((n, p) => n + statSync(p).size, 0);
  if (bytes > 500 * 1024) fail(6, `shipped files are ${Math.round(bytes / 1024)} KB, over the 500 KB budget (§19.2)`);
}

// ── gate 7: manifest version matches the changelog ───────────────────────────
{
  const log = read("CHANGELOG.md");
  const first = (log.match(/^##\s*\[([^\]]+)\]/m) || [])[1];
  if (first && first !== "Unreleased" && first !== manifest.version) {
    fail(7, `manifest.version ${manifest.version} does not match the top CHANGELOG entry ${first} (§19.4)`);
  }
}

// ── gate 8: network targets stay inside the registry origins ─────────────────
{
  const hosts = new Set((manifest.host_permissions || []).map((h) => new URL(h.replace("/*", "/")).host));
  const allowedExtra = /^(https:\/\/(github\.com|keepachangelog\.com|semver\.org|developer\.chrome\.com))/;
  for (const f of srcFiles) {
    for (const m of read(f).matchAll(/https?:\/\/[^\s"'`)]+/g)) {
      const url = m[0];
      if (allowedExtra.test(url)) continue;
      let host; try { host = new URL(url).host; } catch { continue; }
      if (!hosts.has(host)) {
        fail(8, `${f} references ${host}, which is outside the registry origins — this gate is what backs the store's data declaration (§19.6)`);
      }
    }
  }
}

// ── gate 9: selectors may not match on text ──────────────────────────────────
{
  const textish = [
    /\[aria-label\s*[~^$*|]?=\s*["'][A-Za-z]{3,}/,
    /:contains\(/,
    /textContent\s*===\s*["']/,
  ];
  for (const f of srcFiles.filter((p) => p.includes("adapters") || p.endsWith("registry.js"))) {
    const body = read(f);
    for (const re of textish) {
      if (re.test(body)) {
        fail(9, `${f} selects on natural-language text — invisible to an author running an English interface (§12)`);
      }
    }
  }
}

// ── the registry, loaded once ────────────────────────────────────────────────
// registry.js is CJS (it also has to run as a classic content script). Node's
// lexer picks its named exports out anyway. Assert that, because a gate that
// silently iterates an empty list is worse than no gate at all.
const { REGISTRY, stalenessDays } = await import("../src/registry.js");
if (!Array.isArray(REGISTRY) || REGISTRY.length === 0) {
  console.error("FAIL  could not load REGISTRY from src/registry.js — gates 10 and 13 would pass vacuously");
  process.exit(1);
}

// ── gate 10: no provider selector in the core ────────────────────────────────
{
  const core = read("src/content.js");
  for (const row of REGISTRY) {
    if (core.includes(row.host)) fail(10, `src/content.js names ${row.host} — provider knowledge belongs to the registry or an adapter (§12)`);
  }
  if (/const\s+SEL\s*=/.test(core)) fail(10, "src/content.js defines SEL — it belongs under adapters/ (§3.4.6)");
}

// ── gate 11: every cfg key has a control, and vice versa ─────────────────────
{
  const content = read("src/content.js");
  const panel = read("src/panel.js");
  const block = content.slice(content.indexOf("const DEFAULTS"), content.indexOf("};", content.indexOf("const DEFAULTS")));
  const keys = [...block.matchAll(/^\s*(\w+):/gm)].map((m) => m[1]);
  if (keys.length === 0) fail(11, "could not find the DEFAULTS block in src/content.js — this gate cannot check anything");
  for (const k of keys) {
    if (!panel.includes(k)) fail(11, `cfg.${k} has no counterpart in the settings panel (§8.6)`);
  }
}

// ── gate 12: logical CSS only in injected styles ─────────────────────────────
{
  const content = read("src/content.js");
  const css = content.slice(content.indexOf("const SHELL_CSS"), content.indexOf("`;", content.indexOf("const SHELL_CSS")));
  const physical = /(^|[;{\s])(left|right|margin-left|margin-right|padding-left|padding-right)\s*:/;
  if (physical.test(css)) {
    fail(12, "injected CSS uses a physical direction property — RTL breaks (§8.7); use inset-inline-*/margin-inline-*");
  }
}

// ── gate 13: registry freshness ──────────────────────────────────────────────
{
  for (const row of REGISTRY) {
    if (!row.LAST_VERIFIED) { fail(13, `${row.id} has no LAST_VERIFIED (§19.8)`); continue; }
    const days = stalenessDays(row);
    if (days > 180) fail(13, `${row.id} was last verified ${days} days ago — over the 180-day limit (§19.8)`);
    else if (days > 90) console.warn(`  warn  ${row.id} last verified ${days} days ago (§19.8)`);
  }
}

// ── gate 15: core portability ────────────────────────────────────────────────
{
  for (const f of ["src/parse.js", "src/zip.js", "src/registry.js"]) {
    const body = read(f).replace(/^\s*\/\*[\s\S]*?\*\//m, "");
    for (const token of ["chrome.", "document.", "window."]) {
      // globalThis is the portable form and is allowed
      if (body.includes(token)) {
        fail(15, `${f} references ${token} — the core must stay portable or a second surface becomes a rewrite (§4.2)`);
      }
    }
  }
}

// ── gate 16: source files are text ──────────────────────────────────
// A raw control byte in a source file is invisible in every editor and turns
// the file binary as far as git is concerned — no diff, so no review. This
// shipped once: sanitize's character class was written with literal control
// bytes instead of the escape sequences it appears to contain. One line ending
// too, or every normalisation shows up as a whole-file diff.
{
  for (const f of [...srcFiles, "selftest.js"]) {
    const buf = readFileSync(f);
    for (let i = 0; i < buf.length; i++) {
      const c = buf[i];
      if ((c < 0x20 && c !== 0x09 && c !== 0x0a) || c === 0x7f) {
        const line = buf.subarray(0, i).toString("utf8").split("\n").length;
        fail(16, `${f}:${line} contains a raw control byte (0x${c.toString(16).padStart(2, "0")}) — write it as an escape sequence`);
        break;
      }
    }
  }
}

// ── report ───────────────────────────────────────────────────────────────────
if (problems.length) {
  console.error(problems.map((p) => "FAIL  " + p).join("\n"));
  console.error(`\n${problems.length} invariant(s) violated`);
  process.exit(1);
}
console.log("invariants ok");
