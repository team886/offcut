/**
 * Magpie — self tests (design §14)
 *
 *   node selftest.js
 *
 * No framework, assertion-based. Every assertion here pins a decision the
 * design document argues for; the comment names the section.
 */

const assert = require("assert");
const P = require("./src/parse.js");
const Z = require("./src/zip.js");

let passed = 0;
const cases = [];
function test(name, fn) { cases.push([name, fn]); }

// ── sanitize ─────────────────────────────────────────────────────────────────
test("sanitize strips reserved characters and path separators", () => {
  assert.strictEqual(P.sanitize('a/b:c*?"<>|d'), "a-b-c-d");
});

test("sanitize defuses path traversal (§17)", () => {
  const out = P.sanitize("../../etc/passwd");
  assert.ok(!out.includes("/"), "no separators survive: " + out);
  assert.ok(!out.includes(".."), "no traversal survives: " + out);
  assert.strictEqual(P.sanitize("~/x"), "x");
});

test("sanitize turns an XSS-shaped title into harmless text (§17)", () => {
  const out = P.sanitize('<img onerror=alert(1)>');
  assert.ok(!out.includes("<") && !out.includes(">"), out);
});

test("sanitize prefixes Windows reserved names", () => {
  assert.strictEqual(P.sanitize("CON"), "_CON");
  assert.strictEqual(P.sanitize("lpt9"), "_lpt9");
});

test("sanitize caps at 120 code points", () => {
  assert.strictEqual([...P.sanitize("a".repeat(200))].length, 120);
});

test("sanitize truncates by code point, leaving no half surrogate (§6)", () => {
  const out = P.sanitize("🐦".repeat(200));
  assert.ok(!/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/.test(out), "lone high surrogate in: " + out);
  assert.ok(new TextEncoder().encode(out).length <= P.NAME_MAX_BYTES);
});

test("sanitize hits the 200-byte limit before 120 code points on multi-byte input (§6)", () => {
  const out = P.sanitize("ş".repeat(200));           // 2 bytes each
  assert.ok([...out].length < 120, "byte limit should bind first, got " + [...out].length);
  assert.ok(new TextEncoder().encode(out).length <= P.NAME_MAX_BYTES);
});

test("sanitize falls back per kind when nothing survives", () => {
  assert.strictEqual(P.sanitize("...", "code"), "code");
  assert.strictEqual(P.sanitize("...", "artifact"), "document");
});

// ── extension mapping ────────────────────────────────────────────────────────
test("extForLanguage covers aliases and defaults to .txt", () => {
  assert.strictEqual(P.extForLanguage("python"), ".py");
  assert.strictEqual(P.extForLanguage("TypeScript"), ".ts");
  assert.strictEqual(P.extForLanguage("yml"), ".yaml");
  assert.strictEqual(P.extForLanguage(""), ".txt");
  assert.strictEqual(P.extForLanguage("brainfuck"), ".txt");
});

// ── fmtName ──────────────────────────────────────────────────────────────────
test("fmtName substitutes tokens and keeps unknown ones literal (§6)", () => {
  const out = P.fmtName("{title}-v{version}", { title: "Sales Dashboard", version: 3, ext: ".tsx" });
  assert.strictEqual(out, "Sales-Dashboard-v3.tsx");
  assert.ok(P.fmtName("{title}-{foo}", { title: "x", version: 1, ext: ".md" }).includes("{foo}"));
});

test("fmtName uses ISO local date, never a locale format (§6)", () => {
  const d = new Date(2026, 8, 9);                   // 9 September 2026, local
  assert.strictEqual(P.isoLocalDate(d), "2026-09-09");
  const out = P.fmtName("{title}-{date}", { title: "x", version: 1, ext: ".md", date: P.isoLocalDate(d) });
  assert.strictEqual(out, "x-2026-09-09.md");
  assert.ok(!out.includes("/"), "a slash would be rewritten by sanitize");
});

test("fmtName substitutes the date where there is no version (tier 3, §6)", () => {
  const out = P.fmtName("{title}-v{version}", { title: "Dashboard", version: null, ext: ".tsx", date: "2026-09-09" });
  assert.strictEqual(out, "Dashboard-v2026-09-09.tsx");
  assert.ok(!/-v\./.test(out), "no dangling -v");
});

test("fmtName appends -partial before the extension, independent of the template (§3)", () => {
  const out = P.fmtName("{title}", { title: "Sales Dashboard", version: 2, ext: ".tsx", partial: true });
  assert.strictEqual(out, "Sales-Dashboard-partial.tsx");
});

// ── code block naming chain (§3.3.1) ─────────────────────────────────────────
test("naming chain step 1: a filename in the fence wins outright", () => {
  const r = P.deriveCodeName({ fenceInfo: "python:app.py", code: "class Foo: pass", index: 1 });
  assert.deepStrictEqual(r, { base: "app", ext: ".py" });
});

test("naming chain step 2: the first meaningful definition, per language", () => {
  assert.strictEqual(P.deriveCodeName({ fenceInfo: "python", code: "\nclass OrderService:\n  pass\n", index: 1 }).base, "order-service");
  assert.strictEqual(P.deriveCodeName({ fenceInfo: "go", code: "func ParseTree() {}", index: 1 }).base, "parse-tree");
  assert.strictEqual(P.deriveCodeName({ fenceInfo: "ts", code: "export function useCart() {}", index: 1 }).base, "use-cart");
  assert.strictEqual(P.deriveCodeName({ fenceInfo: "python", code: "def backfill(s): pass", index: 1 }).ext, ".py");
});

test("naming chain step 2 is skipped for languages with no pattern (§3.3.1)", () => {
  const r = P.deriveCodeName({ fenceInfo: "toml", code: "[table]\nkey = 1", precedingHeading: "Config file", index: 4 });
  assert.strictEqual(r.base, "config-file", "should fall through to the heading, not invent a rule");
  assert.strictEqual(r.ext, ".toml");
});

test("naming chain steps 3 and 4", () => {
  assert.strictEqual(P.deriveCodeName({ fenceInfo: "sql", code: "SELECT 1", precedingHeading: "Migration script", index: 2 }).base, "migration-script");
  assert.strictEqual(P.deriveCodeName({ fenceInfo: "", code: "hello", index: 3 }).base, "code-3");
  assert.strictEqual(P.deriveCodeName({ fenceInfo: "", code: "hello", index: 3 }).ext, ".txt");
});

test("blocks shorter than three non-empty lines get no control (§3.3.1)", () => {
  assert.strictEqual(P.isDownloadableCodeBlock("npm install x"), false);
  assert.strictEqual(P.isDownloadableCodeBlock("a\n\n\nb\n\n"), false, "blank lines must not count");
  assert.strictEqual(P.isDownloadableCodeBlock("a\nb\nc"), true);
});

// ── version fold (§3, §3.0.1) ────────────────────────────────────────────────
const op = (o) => Object.assign({ artifactId: "a1", createdAt: "t" }, o);

test("fold replays create → update → rewrite → update (§3)", () => {
  const vs = P.buildVersions([
    op({ command: "create", content: "line1\nline2\n", title: "T", type: "text/html" }),
    op({ command: "update", oldStr: "line2", newStr: "LINE2" }),
    op({ command: "rewrite", content: "fresh\n" }),
    op({ command: "update", oldStr: "fresh", newStr: "final" }),
  ], "a1");
  assert.strictEqual(vs.length, 4);
  assert.strictEqual(vs[1].content, "line1\nLINE2\n");
  assert.strictEqual(vs[3].content, "final\n");
  assert.ok(vs.every((v) => v.ok));
});

test("a missing old_str marks the version and leaves content intact (§3)", () => {
  const vs = P.buildVersions([
    op({ command: "create", content: "alpha" }),
    op({ command: "update", oldStr: "beta", newStr: "gamma" }),
  ], "a1");
  assert.strictEqual(vs[1].ok, false);
  assert.strictEqual(vs[1].reason, "old_str_not_found");
  assert.strictEqual(vs[1].content, "alpha", "content must not be corrupted");
});

test("an old_str occurring twice is ambiguous, not first-match (§3)", () => {
  const vs = P.buildVersions([
    op({ command: "create", content: "x\nx\n" }),
    op({ command: "update", oldStr: "x", newStr: "y" }),
  ], "a1");
  assert.strictEqual(vs[1].ok, false);
  assert.strictEqual(vs[1].reason, "old_str_ambiguous");
  assert.strictEqual(vs[1].content, "x\nx\n");
});

test("a second create does not reset the counter (§3.0.1)", () => {
  const vs = P.buildVersions([
    op({ command: "create", content: "one" }),
    op({ command: "create", content: "two" }),
  ], "a1");
  assert.deepStrictEqual(vs.map((v) => v.v), [1, 2], "no second v1 in the menu");
  assert.strictEqual(vs[1].content, "two");
});

test("an update with no create reports no_base rather than fabricating (§3.0.1)", () => {
  const vs = P.buildVersions([op({ command: "update", oldStr: "a", newStr: "b" })], "a1");
  assert.strictEqual(vs[0].ok, false);
  assert.strictEqual(vs[0].reason, "no_base");
});

test("a type change produces per-version extensions (§3.0.1)", () => {
  const vs = P.buildVersions([
    op({ command: "create", content: "<p>", type: "text/html" }),
    op({ command: "rewrite", content: "export default 1", type: "application/vnd.ant.react", language: "tsx" }),
  ], "a1");
  assert.strictEqual(vs[0].type, "text/html");
  assert.strictEqual(vs[1].type, "application/vnd.ant.react");
});

test("a title change follows the version it belongs to (§3)", () => {
  const vs = P.buildVersions([
    op({ command: "create", content: "x", title: "Old name" }),
    op({ command: "rewrite", content: "y", title: "New name" }),
  ], "a1");
  assert.strictEqual(vs[0].title, "Old name");
  assert.strictEqual(vs[1].title, "New name");
});

test("byte-identical consecutive versions are flagged rather than dropped (§8.2)", () => {
  const vs = P.buildVersions([
    op({ command: "create", content: "same" }),
    op({ command: "rewrite", content: "same" }),
  ], "a1");
  assert.strictEqual(vs.length, 2, "the row is kept");
  assert.strictEqual(vs[1].unchanged, true);
});

test("version bytes are byte lengths, not character counts", () => {
  const vs = P.buildVersions([op({ command: "create", content: "şğü" })], "a1");
  assert.strictEqual(vs[0].bytes, 6);
});

// ── lineDelta (§8.2) ─────────────────────────────────────────────────────────
test("lineDelta counts a multiset difference, where a set would fail (§8.2)", () => {
  const before = ["a", "}", "}", "}", "}", "b"].join("\n");
  const after = ["a", "}", "b"].join("\n");
  const d = P.lineDelta(before, after);
  assert.strictEqual(d.removed, 3, "set difference would report 0 here");
  assert.strictEqual(d.added, 0);
});

test("lineDelta returns null for the first version", () => {
  assert.strictEqual(P.lineDelta(null, "x"), null);
});

// ── Item validation (§3.4.6) ─────────────────────────────────────────────────
test("validateItem rejects a malformed adapter result", () => {
  const good = { kind: "code", key: "code:1", title: "backfill", ext: ".py", versions: [{ v: 1 }] };
  assert.deepStrictEqual(P.validateItem(good), []);
  assert.ok(P.validateItem(Object.assign({}, good, { kind: "nope" })).length);
  assert.ok(P.validateItem(Object.assign({}, good, { ext: "py" })).length, "ext must start with a dot");
  assert.ok(P.validateItem(Object.assign({}, good, { versions: [] })).length);
});

// ── zip (§6) ─────────────────────────────────────────────────────────────────
const enc = new TextEncoder();
const u32at = (b, o) => new DataView(b.buffer, b.byteOffset).getUint32(o, true);
const u16at = (b, o) => new DataView(b.buffer, b.byteOffset).getUint16(o, true);

test("CRC32 of a known string", () => {
  assert.strictEqual(Z.crc32(enc.encode("hello")), 0x3610a686);
});

test("local header and EOCD signatures", () => {
  const zip = Z.buildZip([{ name: "a.txt", bytes: enc.encode("A") }]);
  assert.strictEqual(u32at(zip, 0), Z.ZIP_LOCAL_SIG);
  assert.strictEqual(u32at(zip, zip.length - 22), Z.ZIP_EOCD_SIG);
});

test("central directory offset equals the total size of the local headers", () => {
  const entries = [
    { name: "one.txt", bytes: enc.encode("hello") },
    { name: "two.txt", bytes: enc.encode("world!") },
  ];
  const zip = Z.buildZip(entries);
  const expected = entries.reduce((n, e) => n + 30 + enc.encode(e.name).length + e.bytes.length, 0);
  assert.strictEqual(u32at(zip, zip.length - 6), expected);
  assert.strictEqual(u16at(zip, zip.length - 14), 2, "entry count");
});

test("the EOCD's directory-size field is the directory's real size (§6)", () => {
  // The offset field was checked above and the size field was not, which is
  // how a directory size 12 bytes too large shipped: `off` had already been
  // advanced by the EOCD's own leading fields when the size was computed.
  const entries = [
    { name: "one.txt", bytes: enc.encode("hello") },
    { name: "two.txt", bytes: enc.encode("world!") },
  ];
  const zip = Z.buildZip(entries);
  const expected = entries.reduce((n, e) => n + 46 + enc.encode(e.name).length, 0);
  assert.strictEqual(u32at(zip, zip.length - 10), expected, "size of the central directory");
});

test("an archive can be walked the way a reader walks it (§6)", () => {
  // The three fields above can each be right on their own while the archive
  // still does not open. This asserts what a reader actually does: find the
  // EOCD, derive where the directory starts, and expect a signature there.
  const entries = [
    { name: "a.txt", bytes: enc.encode("A") },
    { name: "klasör/çıktı.txt", bytes: enc.encode("üğş") },
  ];
  const zip = Z.buildZip(entries);
  const eocd = zip.length - 22;
  const sizeCD = u32at(zip, eocd + 12);
  const offCD = u32at(zip, eocd + 16);

  assert.strictEqual(offCD + sizeCD, eocd, "directory must end exactly where the EOCD begins");
  assert.strictEqual(u32at(zip, offCD), Z.ZIP_CENTRAL_SIG, "no central header at the stated offset");

  // Walk every directory entry and land exactly on the EOCD.
  let p = offCD;
  for (let i = 0; i < entries.length; i++) {
    assert.strictEqual(u32at(zip, p), Z.ZIP_CENTRAL_SIG, `entry ${i} signature`);
    const local = u32at(zip, p + 42);
    assert.strictEqual(u32at(zip, local), Z.ZIP_LOCAL_SIG, `entry ${i} local header offset`);
    p += 46 + u16at(zip, p + 28) + u16at(zip, p + 30) + u16at(zip, p + 32);
  }
  assert.strictEqual(p, eocd, "walking the directory did not end at the EOCD");
});

test("size fields are byteLength, not character count (§6)", () => {
  const name = "şğü-🐦.txt";
  const body = enc.encode("içerik 🐦");
  const zip = Z.buildZip([{ name, bytes: body }]);
  assert.strictEqual(u16at(zip, 26), enc.encode(name).length, "filename length in bytes");
  assert.notStrictEqual(enc.encode(name).length, name.length, "the test input must actually be multi-byte");
  assert.strictEqual(u32at(zip, 18), body.length);
  assert.strictEqual(u32at(zip, 22), body.length);
});

test("UTF-8 flag and conservative version-needed are set (§6)", () => {
  const zip = Z.buildZip([{ name: "a.txt", bytes: enc.encode("A") }]);
  assert.strictEqual(u16at(zip, 4), Z.ZIP_VERSION_NEEDED);
  assert.strictEqual(u16at(zip, 6) & Z.ZIP_UTF8_FLAG, Z.ZIP_UTF8_FLAG);
  assert.strictEqual(u16at(zip, 8), 0, "stored, not deflated");
});

test("the folder prefix is applied after sanitize, so the separator survives (§8.2.1)", () => {
  const path = Z.zipEntryPath("code", P.sanitize("order/service.py"));
  assert.strictEqual(path, "code/order-service.py");
  assert.strictEqual((path.match(/\//g) || []).length, 1);
});

test("duplicate entry names are suffixed, never repeated (§3.3.1)", () => {
  assert.deepStrictEqual(
    Z.dedupeNames(["order-service.py", "order-service.py", "other.py", "order-service.py"]),
    ["order-service.py", "order-service-2.py", "other.py", "order-service-3.py"]
  );
});

test("a throwaway identifier does not become the filename (§3.3.1)", () => {
  // Measured on a live conversation: `const el = document.querySelector(...)`
  // produced el.js. A two-letter local is a worse name than the positional
  // fallback, because it looks deliberate.
  const n = P.deriveCodeName({
    fenceInfo: "js",
    code: "const el = document.querySelector('.x');\nel.addEventListener('click', wireUp);\nfunction wireUp() {}",
    index: 4,
  });
  assert.strictEqual(n.base, "wire-up", "should skip `el` and take the function");
});

test("a generic identifier is skipped even at full length (§3.3.1)", () => {
  const n = P.deriveCodeName({
    fenceInfo: "js",
    code: "const config = {};\nconst parseInvoice = (x) => x;\n",
    index: 7,
  });
  assert.strictEqual(n.base, "parse-invoice");
});

test("function and class outrank const, whatever the order in the file", () => {
  const n = P.deriveCodeName({
    fenceInfo: "js",
    code: "const cartTotals = 1;\nfunction renderCart() {}\n",
    index: 2,
  });
  assert.strictEqual(n.base, "render-cart", "a declaration beats a binding");
});

test("with nothing meaningful to find, the positional fallback wins", () => {
  const n = P.deriveCodeName({ fenceInfo: "js", code: "const el = 1;\nconst x = 2;\n", index: 9 });
  assert.strictEqual(n.base, "code-9");
});

test("the /g patterns do not carry lastIndex between calls", () => {
  // A stateful regex reused across blocks silently starts mid-file and names
  // the second block after something in the middle of it.
  const block = { fenceInfo: "py", code: "class Ledger:\n    pass\n", index: 1 };
  const a = P.deriveCodeName(block);
  const b = P.deriveCodeName(block);
  assert.strictEqual(a.base, "ledger");
  assert.strictEqual(b.base, a.base, "second call must match the first");
});

test("ZIP64 thresholds refuse rather than emit a broken archive (§6)", () => {
  const many = new Array(65536).fill(0).map((_, i) => ({ name: "f" + i, bytes: new Uint8Array(0) }));
  assert.throws(() => Z.buildZip(many), RangeError);
});


// ── heuristic chat root (§3.4.1, bug found by measurement) ───────────────────
function fakeTree() {
  // minimal parentElement/contains shims — no DOM needed
  const mk = (name) => ({ name, children: [], parentElement: null,
    contains(n){ if(n===this) return true; return this.children.some(c=>c.contains(n)); } });
  const root = mk("root"), mid = mk("mid"), a = mk("a"), b = mk("b");
  root.children = [mid]; mid.parentElement = root;
  mid.children = [a, b]; a.parentElement = mid; b.parentElement = mid;
  return { root, mid, a, b };
}

test("heuristic root finds the common container with two blocks (§3.4.1)", () => {
  const t = fakeTree();
  assert.strictEqual(P.heuristicRoot([t.a, t.b]), t.mid);
});

test("heuristic root does not return the block itself when there is only one (§3.4.1)", () => {
  const t = fakeTree();
  const r = P.heuristicRoot([t.a], { singleBlockClimb: 1 });
  assert.notStrictEqual(r, t.a, "measured on Claude: this returned the code element");
  assert.strictEqual(r, t.mid);
});

test("heuristic root stays silent with no blocks", () => {
  assert.strictEqual(P.heuristicRoot([]), null);
});

// ── run ──────────────────────────────────────────────────────────────────────
const failures = [];
for (const [name, fn] of cases) {
  try { fn(); passed++; }
  catch (e) { failures.push([name, e]); }
}

for (const [name, e] of failures) {
  console.error("FAIL  " + name + "\n      " + (e && e.message ? e.message.split("\n")[0] : e));
}
console.log((failures.length ? "\n" : "") + passed + "/" + cases.length + " passed");
process.exit(failures.length ? 1 : 0);
