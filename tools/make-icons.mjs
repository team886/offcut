/**
 * Magpie — icon rasteriser (design §8.5, mark B)
 *
 *   node tools/make-icons.mjs
 *
 * MV3 action icons must be PNG, so the mark is rasterised here rather than
 * shipped as SVG. Pure Node: zlib is a built-in, no image library.
 *
 * The mark is three filled shapes because filled forms survive 16px where
 * strokes thin out: an ink rounded square, a bone head with a triangular
 * beak, and a gold dot for what it carries.
 */
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";

const INK = [0x17, 0x16, 0x1a], BONE = [0xf2, 0xf0, 0xec], GOLD = [0xe8, 0xb4, 0x4a];
const SS = 4;                                  // supersampling factor

function draw(size) {
  const n = size * SS, px = new Uint8Array(n * n * 4);
  const r = n * 0.20;                           // corner radius
  const inRounded = (x, y) => {
    const cx = Math.min(Math.max(x, r), n - r), cy = Math.min(Math.max(y, r), n - r);
    return (x - cx) ** 2 + (y - cy) ** 2 <= r * r + 0.001 || (x >= r && x <= n - r) || (y >= r && y <= n - r);
  };
  const circle = (x, y, cx, cy, rad) => (x - cx) ** 2 + (y - cy) ** 2 <= rad * rad;
  // beak: triangle from the head's right edge to a point
  const beak = (x, y) => {
    // Tuned against the 16px render, which is the arbiter (§8.5): a longer,
    // blunter wedge survives downsampling where a fine point disappears.
    const x0 = 0.46 * n, x1 = 0.72 * n, yc = 0.46 * n, half = 0.135 * n;
    if (x < x0 || x > x1) return false;
    const tt = (x - x0) / (x1 - x0);
    return Math.abs(y - yc) <= half * (1 - 0.72 * tt);
  };
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      let c = null;
      if (inRounded(x + 0.5, y + 0.5)) c = INK;
      if (c && circle(x, y, 0.345 * n, 0.475 * n, 0.215 * n)) c = BONE;
      if (c && beak(x, y)) c = BONE;
      if (c && circle(x, y, 0.845 * n, 0.455 * n, 0.115 * n)) c = GOLD;
      const i = (y * n + x) * 4;
      if (c) { px[i] = c[0]; px[i + 1] = c[1]; px[i + 2] = c[2]; px[i + 3] = 255; }
    }
  }
  // downsample with a box filter
  const out = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    let a = [0, 0, 0, 0];
    for (let sy = 0; sy < SS; sy++) for (let sx = 0; sx < SS; sx++) {
      const i = (((y * SS + sy) * n) + (x * SS + sx)) * 4;
      a[0] += px[i]; a[1] += px[i + 1]; a[2] += px[i + 2]; a[3] += px[i + 3];
    }
    const j = (y * size + x) * 4, k = SS * SS;
    out[j] = Math.round(a[0] / k); out[j + 1] = Math.round(a[1] / k);
    out[j + 2] = Math.round(a[2] / k); out[j + 3] = Math.round(a[3] / k);
  }
  return out;
}

function png(size, rgba) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;                                  // filter: none
    Buffer.from(rgba.buffer, y * size * 4, size * 4).copy(raw, y * (size * 4 + 1) + 1);
  }
  const crcTable = [...Array(256)].map((_, i) => {
    let c = i; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0;
  });
  const crc = (b) => { let c = 0xffffffff; for (const v of b) c = crcTable[(c ^ v) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
    const c = Buffer.alloc(4); c.writeUInt32BE(crc(td));
    return Buffer.concat([len, td, c]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw, { level: 9 })), chunk("IEND", Buffer.alloc(0)),
  ]);
}

mkdirSync("icons", { recursive: true });
for (const s of [16, 32, 48, 128]) {
  writeFileSync(`icons/icon${s}.png`, png(s, draw(s)));
  console.log(`icons/icon${s}.png`);
}
