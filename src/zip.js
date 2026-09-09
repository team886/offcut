/**
 * Magpie — store-only ZIP writer (design §6, zip.js)
 *
 * Pure. No DOM, no chrome.*, no window (CI gate 15).
 *
 * Deliberately store-only (method 0): the compression gain on text is
 * negligible here and deflate would drag in CompressionStream's asynchrony
 * and size bookkeeping.
 *
 * Every length is in BYTES. Using str.length works for ASCII and silently
 * produces a corrupt archive at the first multi-byte character.
 */

const ZIP_LOCAL_SIG = 0x04034b50;
const ZIP_CENTRAL_SIG = 0x02014b50;
const ZIP_EOCD_SIG = 0x06054b50;
const ZIP_VERSION_NEEDED = 20;       // conservative; see §6
const ZIP_UTF8_FLAG = 0x0800;        // general purpose bit 11
const ZIP_MAX_ENTRIES = 65535;       // beyond this, ZIP64 is required
const ZIP_MAX_BYTES = 0xffffffff;    // 4 GB

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[i] = c >>> 0;
  }
  return t;
})();

function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** DOS time/date. Not load-bearing; archives are identified by content. */
function dosDateTime(date) {
  const d = date || new Date();
  const time = ((d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1)) & 0xffff;
  const day = (((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()) & 0xffff;
  return { time, day };
}

/**
 * entries: [{ name, bytes }]  — name is a string, bytes a Uint8Array
 * Returns Uint8Array, or throws RangeError past the ZIP64 thresholds
 * (design §6: we never hand over a broken zip).
 */
function buildZip(entries, opts) {
  const enc = new TextEncoder();
  const { time, day } = dosDateTime(opts && opts.date);

  if (entries.length > ZIP_MAX_ENTRIES) {
    throw new RangeError("zip: more than " + ZIP_MAX_ENTRIES + " entries requires ZIP64");
  }

  const prepared = entries.map((e) => {
    const nameBytes = enc.encode(e.name);
    const data = e.bytes;
    if (data.length > ZIP_MAX_BYTES) throw new RangeError("zip: entry over 4 GB requires ZIP64");
    return { nameBytes, data, crc: crc32(data) };
  });

  const localSize = prepared.reduce((n, p) => n + 30 + p.nameBytes.length + p.data.length, 0);
  const centralSize = prepared.reduce((n, p) => n + 46 + p.nameBytes.length, 0);
  if (localSize + centralSize > ZIP_MAX_BYTES) throw new RangeError("zip: archive over 4 GB requires ZIP64");

  const out = new Uint8Array(localSize + centralSize + 22);
  const view = new DataView(out.buffer);
  let off = 0;

  const u32 = (v) => { view.setUint32(off, v, true); off += 4; };
  const u16 = (v) => { view.setUint16(off, v, true); off += 2; };
  const raw = (b) => { out.set(b, off); off += b.length; };

  const offsets = [];
  for (const p of prepared) {
    offsets.push(off);
    u32(ZIP_LOCAL_SIG);
    u16(ZIP_VERSION_NEEDED);
    u16(ZIP_UTF8_FLAG);          // no data descriptor bit: sizes are known up front
    u16(0);                      // method 0 — stored
    u16(time); u16(day);
    u32(p.crc);
    u32(p.data.length);          // compressed   — byteLength, never str.length
    u32(p.data.length);          // uncompressed
    u16(p.nameBytes.length);
    u16(0);                      // extra field length
    raw(p.nameBytes);
    raw(p.data);
  }

  const centralStart = off;
  prepared.forEach((p, i) => {
    u32(ZIP_CENTRAL_SIG);
    u16(ZIP_VERSION_NEEDED);     // version made by
    u16(ZIP_VERSION_NEEDED);     // version needed
    u16(ZIP_UTF8_FLAG);
    u16(0);
    u16(time); u16(day);
    u32(p.crc);
    u32(p.data.length);
    u32(p.data.length);
    u16(p.nameBytes.length);
    u16(0);                      // extra
    u16(0);                      // comment
    u16(0);                      // disk number
    u16(0);                      // internal attributes
    u32(0);                      // external attributes — 0 keeps archivers neutral
    u32(offsets[i]);
    raw(p.nameBytes);
  });

  u32(ZIP_EOCD_SIG);
  u16(0); u16(0);
  u16(prepared.length); u16(prepared.length);
  u32(off - centralStart);
  u32(centralStart);
  u16(0);                        // comment length

  return out;
}

/**
 * Zip entry path: the kind prefix is applied AFTER sanitize, because
 * sanitize strips "/" and would otherwise flatten the archive (§8.2.1).
 */
function zipEntryPath(prefix, sanitizedName) {
  return prefix ? prefix.replace(/\/+$/, "") + "/" + sanitizedName : sanitizedName;
}

/**
 * Two entries with the same name make an archive corrupt, so collisions are
 * suffixed rather than allowed (§3.3.1). Bounded at -99: a visible failure
 * beats an unbounded loop (§8.7.2).
 */
function dedupeNames(names) {
  const seen = new Map();
  return names.map((name) => {
    if (!seen.has(name)) { seen.set(name, 1); return name; }
    const dot = name.lastIndexOf(".");
    const base = dot > 0 ? name.slice(0, dot) : name;
    const ext = dot > 0 ? name.slice(dot) : "";
    for (let n = 2; n <= 99; n++) {
      const candidate = base + "-" + n + ext;
      if (!seen.has(candidate)) { seen.set(candidate, 1); return candidate; }
    }
    throw new RangeError("zip: more than 99 name collisions for " + name);
  });
}

if (typeof module !== "undefined") {
  module.exports = { crc32, buildZip, zipEntryPath, dedupeNames,
                     ZIP_LOCAL_SIG, ZIP_CENTRAL_SIG, ZIP_EOCD_SIG, ZIP_VERSION_NEEDED, ZIP_UTF8_FLAG };
}
