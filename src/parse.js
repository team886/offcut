/**
 * Offcut — core pure layer (design §6, parse.js)
 *
 * Pure. No DOM, no chrome.*, no window (CI gate 15).
 * parseOps is the ADAPTER's job; this file consumes Op[] and knows no
 * provider-specific field name (§6, boundary).
 */

// ── Tunable constants (§11.1) ────────────────────────────────────────────────
const MIN_CODE_LINES = 3;          // non-empty lines below which a block gets no control
const NAME_MAX_CODEPOINTS = 120;
const NAME_MAX_BYTES = 200;        // filesystems cap names in bytes, not characters

// ── Language → extension (core; shared by every provider, §3.3.1) ────────────
const LANG_EXT = {
  py: ".py", python: ".py",
  js: ".js", javascript: ".js", node: ".js",
  ts: ".ts", typescript: ".ts", jsx: ".jsx", tsx: ".tsx",
  go: ".go", golang: ".go", rs: ".rs", rust: ".rs",
  rb: ".rb", ruby: ".rb", java: ".java", kt: ".kt", kotlin: ".kt",
  cs: ".cs", csharp: ".cs", cpp: ".cpp", "c++": ".cpp", cc: ".cpp", c: ".c",
  php: ".php", swift: ".swift",
  sh: ".sh", bash: ".sh", shell: ".sh", zsh: ".sh",
  sql: ".sql", yaml: ".yaml", yml: ".yaml", json: ".json", xml: ".xml",
  html: ".html", css: ".css", scss: ".scss", sass: ".scss",
  md: ".md", markdown: ".md", toml: ".toml", ini: ".ini",
  diff: ".diff", patch: ".diff", dockerfile: ".dockerfile",
};

/** First meaningful definition, per language. Languages without an entry skip
 *  this step — an invented rule produces confidently wrong names (§3.3.1). */
const NAME_PATTERNS = {
  py: [/^\s*(?:class|def)\s+(\w+)/gm],
  // Declarations in priority order. A `const` is tried only after function and
  // class, because measurement on a live conversation named a file `el.js`
  // from `const el = ...` — a throwaway local, and a worse name than the
  // positional fallback it displaced (§3.3.1).
  js: [/^\s*(?:export\s+)?(?:default\s+)?(?:async\s+)?(?:function|class)\s+(\w+)/gm,
       /^\s*(?:export\s+)?(?:default\s+)?const\s+(\w+)/gm],
  go: [/^\s*(?:func|type)\s+(\w+)/gm],
  java: [/^\s*(?:public\s+|private\s+)?(?:final\s+)?(?:class|interface|enum)\s+(\w+)/gm],
  rs: [/^\s*(?:pub\s+)?(?:fn|struct|enum|trait)\s+(\w+)/gm],
  rb: [/^\s*(?:class|module|def)\s+(\w+)/gm],
  php: [/^\s*(?:class|function)\s+(\w+)/gm],
  sql: [/^\s*(?:CREATE|ALTER)\s+(?:TABLE|VIEW|INDEX)\s+(?:IF\s+NOT\s+EXISTS\s+)?[`"]?(\w+)/gim],
  sh: [/^\s*(\w+)\s*\(\)\s*\{/gm],
};

/**
 * An identifier only earns the filename if it would still mean something on
 * disk six months later. Two characters never does, and neither does the
 * handful of names every codebase uses for a throwaway. Rejecting one sends
 * the chain to the next step rather than to a confidently wrong name.
 */
const NAME_MIN_IDENT = 3;
const GENERIC_IDENTS = new Set([
  "app", "data", "res", "req", "tmp", "temp", "test", "main", "init", "run",
  "obj", "arr", "val", "var", "out", "src", "foo", "bar", "baz", "item", "self",
  "result", "response", "options", "config", "value", "index", "handler", "cb",
]);
function isMeaningfulIdent(name) {
  if (!name) return false;
  const s = String(name);
  if ([...s].length < NAME_MIN_IDENT) return false;
  return !GENERIC_IDENTS.has(s.toLowerCase());
}const PATTERN_ALIAS = {
  python: "py", javascript: "js", node: "js", ts: "js", typescript: "js", jsx: "js", tsx: "js",
  golang: "go", kt: "java", kotlin: "java", cs: "java", ruby: "rb", rust: "rs",
  bash: "sh", shell: "sh", zsh: "sh",
};

const WIN_RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;
const KIND_FALLBACK = { artifact: "document", code: "code", attachment: "attachment",
                        conversation: "conversation", tool_output: "tool-output",
                        citations: "sources", image: "image" };

// ── sanitize ─────────────────────────────────────────────────────────────────
function sanitize(title, kind) {
  let s = String(title == null ? "" : title);
  s = s.replace(/[\x00-\x1f\x7f]/g, "-");   // control characters
  s = s.replace(/[<>:"/\\|?*]/g, "-");            // reserved on Windows, path separators
  s = s.replace(/\.{2,}/g, "-");                  // ".." traversal
  s = s.replace(/\s+/g, "-");                     // whitespace runs → one dash (filenames, not prose)
  s = s.replace(/^~+/, "");                       // leading ~ (home expansion)
  s = s.replace(/-{2,}/g, "-");
  s = s.replace(/^[.\s-]+|[.\s-]+$/g, "");        // leading/trailing dots, spaces, dashes

  // Truncate by CODE POINT, never by UTF-16 unit: slicing through an emoji
  // leaves half a surrogate pair and the write fails on some systems (§6).
  const points = [...s];
  if (points.length > NAME_MAX_CODEPOINTS) s = points.slice(0, NAME_MAX_CODEPOINTS).join("");
  const enc = new TextEncoder();
  while (enc.encode(s).length > NAME_MAX_BYTES) s = [...s].slice(0, -1).join("");

  s = s.replace(/[.\s-]+$/g, "");
  if (!s) s = KIND_FALLBACK[kind] || "file";
  if (WIN_RESERVED.test(s)) s = "_" + s;
  return s;
}

// ── extension ────────────────────────────────────────────────────────────────
function extForLanguage(language) {
  if (!language) return ".txt";
  return LANG_EXT[String(language).toLowerCase().trim()] || ".txt";
}

// ── filename template ────────────────────────────────────────────────────────
/** {date} is always ISO YYYY-MM-DD in LOCAL time: a localised format yields
 *  "9/9/2026" under en-US and sanitize would rewrite the slashes (§6). */
function isoLocalDate(d) {
  const t = d || new Date();
  const p = (n) => String(n).padStart(2, "0");
  return t.getFullYear() + "-" + p(t.getMonth() + 1) + "-" + p(t.getDate());
}

function fmtName(template, ctx) {
  const date = ctx.date || isoLocalDate();
  // Tier 3 has no version number: substitute the date rather than leaving a
  // dangling "-v" (§6).
  const version = ctx.version == null ? date : String(ctx.version);
  let name = String(template).replace(/\{(\w+)\}/g, (whole, token) => {
    if (token === "title") return ctx.title;
    if (token === "version") return version;
    if (token === "date") return date;
    if (token === "ext") return "";              // the extension is appended, never inlined
    return whole;                                 // unknown tokens stay literal
  });
  name = sanitize(name, ctx.kind);
  if (ctx.partial) name += "-partial";            // before the extension, after the template
  return name + (ctx.ext || "");
}

// ── code block naming chain (§3.3.1) ─────────────────────────────────────────
function kebab(s) {
  return String(s)
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/[_\s]+/g, "-")
    .toLowerCase();
}

/** Returns { base, ext }. Best-effort; never throws. */
function deriveCodeName(block) {
  const { fenceInfo, code, precedingHeading, index } = block;
  const info = String(fenceInfo || "").trim();

  // 1. filename in the fence: ```python:app.py
  const colon = info.indexOf(":");
  if (colon > -1) {
    const file = info.slice(colon + 1).trim();
    const dot = file.lastIndexOf(".");
    if (dot > 0) return { base: kebab(file.slice(0, dot)), ext: file.slice(dot) };
  }

  const lang = (colon > -1 ? info.slice(0, colon) : info).toLowerCase();
  const ext = extForLanguage(lang);

  // 2. first meaningful definition — "meaningful" is enforced, not assumed
  const patternKey = NAME_PATTERNS[lang] ? lang : PATTERN_ALIAS[lang];
  const patterns = patternKey && NAME_PATTERNS[patternKey];
  if (patterns) {
    for (const pattern of patterns) {
      pattern.lastIndex = 0;                      // these are /g and hold state
      let m;
      while ((m = pattern.exec(code || "")) !== null) {
        if (isMeaningfulIdent(m[1])) return { base: kebab(m[1]), ext };
      }
    }
  }

  // 3. the markdown heading immediately before the block
  if (precedingHeading) return { base: kebab(precedingHeading), ext };

  // 4. by position
  return { base: "code-" + index, ext };
}

/** Non-empty lines, so two lines of code plus blanks still gets no control. */
function countCodeLines(code) {
  return String(code || "").split("\n").filter((l) => l.trim() !== "").length;
}
function isDownloadableCodeBlock(code) {
  return countCodeLines(code) >= MIN_CODE_LINES;
}


/**
 * Heuristic chat root (§3.4.1). Measured on Claude: with a single code block
 * the nearest common ancestor of "all of them" is the block itself, so event
 * delegation would bind to the block rather than a container. Requires two.
 */
function heuristicRoot(codeNodes, opts) {
  const climb = (opts && opts.singleBlockClimb) || 4;
  if (!codeNodes || codeNodes.length === 0) return null;
  if (codeNodes.length === 1) {
    let n = codeNodes[0];
    for (let i = 0; i < climb && n && n.parentElement; i++) n = n.parentElement;
    return n;
  }
  let n = codeNodes[0];
  while (n && !codeNodes.every((c) => n.contains(c))) n = n.parentElement;
  return n;
}

// ── version fold (§3, §3.0.1) ────────────────────────────────────────────────
function countOccurrences(haystack, needle) {
  if (!needle) return 0;
  let n = 0, i = 0;
  for (;;) {
    const at = haystack.indexOf(needle, i);
    if (at === -1) return n;
    n++; i = at + needle.length;
  }
}

/**
 * ops: Op[] already restricted to the active branch and ordered by branch
 * position (§3.1) — ordering is the adapter's responsibility.
 */
function buildVersions(ops, artifactId) {
  const mine = ops.filter((o) => o.artifactId === artifactId);
  const versions = [];
  let content = null;
  let title = null, type = null, language = null;

  for (const op of mine) {
    if (op.title != null) title = op.title;
    if (op.type != null) type = op.type;
    if (op.language != null) language = op.language;

    let ok = true, reason;

    if (op.command === "create" || op.command === "rewrite") {
      // A second create does not restart the chain: to the user it is still a
      // new state of the same artifact, and resetting would show v1 twice.
      content = op.content == null ? "" : op.content;
    } else if (op.command === "update") {
      if (content == null) {
        ok = false; reason = "no_base";           // branch pruned or API windowed
      } else {
        const hits = countOccurrences(content, op.oldStr || "");
        if (hits === 0) { ok = false; reason = "old_str_not_found"; }
        else if (hits > 1) { ok = false; reason = "old_str_ambiguous"; }
        else content = content.replace(op.oldStr, op.newStr == null ? "" : op.newStr);
      }
    } else {
      continue;
    }

    const prev = versions.length ? versions[versions.length - 1] : null;
    const bytes = content == null ? 0 : new TextEncoder().encode(content).length;
    const v = {
      v: versions.length + 1,
      content: content,
      ok, reason,
      bytes,
      title, type, language,
      createdAt: op.createdAt,
      unchanged: !!(prev && prev.content === content),
    };
    versions.push(v);
  }
  return versions;
}

/**
 * Line counts between two versions. MULTISET difference, not set difference:
 * a file is full of repeated "}" and blank lines, and a set would report a
 * forty-line deletion as -3 (§8.2).
 */
function lineDelta(prev, next) {
  if (prev == null) return null;                  // v1 — nothing to compare against
  const count = (text) => {
    const m = new Map();
    for (const line of String(text).split("\n")) m.set(line, (m.get(line) || 0) + 1);
    return m;
  };
  const a = count(prev), b = count(next);
  let added = 0, removed = 0;
  for (const [line, n] of b) added += Math.max(0, n - (a.get(line) || 0));
  for (const [line, n] of a) removed += Math.max(0, n - (b.get(line) || 0));
  return { added, removed };
}

// ── Item validation (§3.4.6 — a broken adapter cannot become a broken file) ──
const ITEM_KINDS = ["artifact", "code", "attachment", "conversation", "tool_output", "citations", "image"];

function validateItem(item) {
  const errors = [];
  if (!item || typeof item !== "object") return ["item is not an object"];
  if (!ITEM_KINDS.includes(item.kind)) errors.push("invalid kind: " + item.kind);
  if (!item.key) errors.push("missing key");
  if (!item.title) errors.push("missing title");
  if (!item.ext || item.ext[0] !== ".") errors.push("ext must start with a dot: " + item.ext);
  if (!Array.isArray(item.versions) || item.versions.length === 0) errors.push("versions must be a non-empty array");
  if (item.title && !sanitize(item.title, item.kind)) errors.push("title does not survive sanitize");
  return errors;
}

const OffcutParse = {
  MIN_CODE_LINES, NAME_MAX_CODEPOINTS, NAME_MAX_BYTES, ITEM_KINDS, NAME_MIN_IDENT,
  isMeaningfulIdent,
  sanitize, extForLanguage, isoLocalDate, fmtName,
  deriveCodeName, countCodeLines, isDownloadableCodeBlock, heuristicRoot,
  buildVersions, lineDelta, validateItem,
};
if (typeof globalThis !== "undefined") globalThis.OffcutParse = OffcutParse;

if (typeof module !== "undefined") {
  module.exports = {
    MIN_CODE_LINES, NAME_MAX_CODEPOINTS, NAME_MAX_BYTES, ITEM_KINDS, NAME_MIN_IDENT,
  isMeaningfulIdent,
    sanitize, extForLanguage, isoLocalDate, fmtName,
    deriveCodeName, countCodeLines, isDownloadableCodeBlock, heuristicRoot,
    buildVersions, lineDelta, validateItem,
  };
}
