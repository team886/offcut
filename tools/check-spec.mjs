/**
 * Magpie — specification consistency (design §19.3, gate 14)
 *
 *   node tools/check-spec.mjs
 *
 * The document is long enough that nobody re-reads it whole, which is exactly
 * when a § reference starts pointing at a section that was renumbered and a
 * threshold quietly disagrees with itself two hundred lines away.
 *
 * Code blocks are checked too. One broken reference was hiding in one.
 */
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const SPEC = "docs/superpowers/specs/2026-09-09-magpie-design.md";
const spec = readFileSync(SPEC, "utf8");
const lines = spec.split("\n");
const problems = [];
const notes = [];
const fail = (m) => problems.push(m);

// ── the sections this document actually defines ──────────────────────────────
const sections = [];                       // { num: "8.6.1", tuple: [8,6,1], line }
for (let i = 0; i < lines.length; i++) {
  const m = /^#{2,6}\s+(\d+(?:\.\d+)*)\.?\s+/.exec(lines[i]);
  if (m) sections.push({ num: m[1], tuple: m[1].split(".").map(Number), line: i + 1 });
}
const defined = new Set(sections.map((s) => s.num));

// ── check 1: no broken § reference, code blocks included ─────────────────────
{
  const seen = new Map();                  // num → first line it is cited on
  for (let i = 0; i < lines.length; i++) {
    for (const m of lines[i].matchAll(/§\s*(\d+(?:\.\d+)*)/g)) {
      if (!seen.has(m[1])) seen.set(m[1], i + 1);
    }
  }
  for (const [num, line] of seen) {
    if (!defined.has(num)) fail(`${SPEC}:${line}  §${num} is referenced but no section defines it`);
  }
}

// ── check 2: section numbers ascend ──────────────────────────────────────────
{
  const cmp = (a, b) => {
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
      const x = a[i] ?? -1, y = b[i] ?? -1;
      if (x !== y) return x - y;
    }
    return 0;
  };
  for (let i = 1; i < sections.length; i++) {
    if (cmp(sections[i - 1].tuple, sections[i].tuple) >= 0) {
      fail(`${SPEC}:${sections[i].line}  §${sections[i].num} does not follow §${sections[i - 1].num} in order`);
    }
  }
}

// ── the cfg schema, read out of §9 ───────────────────────────────────────────
const schemaKeys = (() => {
  const start = spec.indexOf("## 9. Settings schema");
  if (start < 0) { fail("§9 (settings schema) not found — every other cfg check is vacuous"); return new Set(); }
  const open = spec.indexOf("```js", start);
  const block = spec.slice(open, spec.indexOf("```", open + 5));
  return new Set([...block.matchAll(/^\s{2}(\w+):/gm)].map((m) => m[1]));
})();

// ── check 3: schema ↔ panel, both directions ─────────────────────────────────
{
  const start = spec.indexOf("### 8.6 Settings panel");
  const panel = spec.slice(start, spec.indexOf("### 8.6.1", start));
  const inPanel = new Set([...panel.matchAll(/`(\w+)`/g)].map((m) => m[1]));
  for (const k of schemaKeys) {
    if (!inPanel.has(k)) fail(`cfg.${k} is in the §9 schema with no control in §8.6 — §8.6 states the rule that this may not happen`);
  }
  // The other direction: a panel naming a key the schema does not have.
  for (const k of inPanel) {
    if (/^(badge|notify|autoDownload|defaultVersion|nameTemplate|zipAll|saveTo|kinds|includeThinking|includeCall|handoffAt|sites|extraHosts|history|historyMax|dragEnabled)$/.test(k)
        && !schemaKeys.has(k)) {
      fail(`§8.6 draws a control for cfg.${k}, which the §9 schema does not define`);
    }
  }
}

// ── check 4: cfg.* references resolve ────────────────────────────────────────
{
  for (let i = 0; i < lines.length; i++) {
    for (const m of lines[i].matchAll(/\bcfg\.(\w+)/g)) {
      if (!schemaKeys.has(m[1])) fail(`${SPEC}:${i + 1}  cfg.${m[1]} is referenced but not defined in §9`);
    }
  }
}

// ── check 5: SEL.* references resolve ────────────────────────────────
{
  // §12 declares the keys as bare identifiers inside `const SEL = { … }`,
  // which is the single place a provider's selectors are allowed to live.
  const decl = spec.indexOf("const SEL = {");
  if (decl < 0) fail("§12 does not declare `const SEL = {` — the SEL check is vacuous without it");
  const body = spec.slice(decl, spec.indexOf("};", decl));
  const selDefs = new Set(
    body.replace(/\/\/[^\n]*/g, "")
        .replace(/^const SEL = \{/, "")
        .split(/[,\n]/)
        .map((t) => t.trim())
        .filter((t) => /^\w+$/.test(t))
  );
  const bad = new Set();
  for (const m of spec.matchAll(/SEL\.(\w+)/g)) {
    if (!selDefs.has(m[1])) bad.add(m[1]);
  }
  for (const k of [...bad].sort()) fail(`SEL.${k} is referenced but §12 does not declare it`);
}

// ── check 6: files named in the spec exist on disk ───────────────────────────
{
  const listed = new Set();
  for (const m of spec.matchAll(/`((?:src|tools|docs|store|_locales|icons)\/[\w./-]+\.\w+)`/g)) listed.add(m[1]);
  for (const m of spec.matchAll(/`(manifest\.json|README\.md|CHANGELOG\.md|LICENSE|SECURITY\.md|selftest\.js)`/g)) listed.add(m[1]);
  for (const f of [...listed].sort()) {
    if (!existsSync(f)) notes.push(`${f} is named in the specification but does not exist yet`);
  }
}

// ── check 7: repeated numeric thresholds, for a human to compare ─────────────
{
  const kinds = [
    [/(\d+)\s*ms\b/g, "ms"],
    [/(\d+)\s*s\b(?!\w)/g, "s"],
    [/(\d+)\s*KB\b/g, "KB"],
    [/(\d+)\s*MB\b/g, "MB"],
    [/(\d+)\s*days?\b/g, "days"],
  ];
  const seen = new Map();                  // "300 ms" → [lines]
  for (let i = 0; i < lines.length; i++) {
    for (const [re, unit] of kinds) {
      for (const m of lines[i].matchAll(re)) {
        const key = `${m[1]} ${unit}`;
        if (!seen.has(key)) seen.set(key, []);
        seen.get(key).push(i + 1);
      }
    }
  }
  const repeated = [...seen].filter(([, ls]) => ls.length > 1);
  if (repeated.length) {
    notes.push("thresholds stated more than once (compare them by eye — the gate cannot know which is authoritative):");
    for (const [k, ls] of repeated.sort()) notes.push(`    ${k.padEnd(9)} lines ${ls.join(", ")}`);
  }
}

// ── report ───────────────────────────────────────────────────────────────────
if (notes.length) console.log(notes.map((n) => (n.startsWith("    ") ? n : "note  " + n)).join("\n"));
if (problems.length) {
  console.error("\n" + problems.map((p) => "FAIL  " + p).join("\n"));
  console.error(`\n${problems.length} specification inconsistency(ies)`);
  process.exit(1);
}
console.log(`spec ok — ${sections.length} numbered sections, ${schemaKeys.size} cfg keys`);
