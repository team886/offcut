/**
 * Offcut — icon rasteriser (design §8.5)
 *
 *   node tools/make-icons.mjs
 *
 * MV3 action icons must be PNG, so the mark is rasterised here rather than
 * shipped as SVG. Pure Node: zlib is a built-in, no image library.
 *
 * The mark is the name. A workpiece with a corner cut away, and the piece
 * that came off sitting just clear of it in gold — the part you keep. Three
 * filled shapes and no strokes, because a stroke thins to nothing at 16px,
 * and colour rather than a gap carries the separation for the same reason.
 */
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";

const INK = [0x17, 0x16, 0x1a], BONE = [0xf2, 0xf0, 0xec], GOLD = [0xe8, 0xb4, 0x4a];
const SS = 4;                                  // supersampling factor

function draw(size) {
  const n = size * SS, px = new Uint8Array(n * n * 4);

  const rounded = (x, y, x0, y0, x1, y1, r) => {
    if (x < x0 || x > x1 || y < y0 || y > y1) return false;
    const cx = Math.min(Math.max(x, x0 + r), x1 - r);
    const cy = Math.min(Math.max(y, y0 + r), y1 - r);
    return (x - cx) ** 2 + (y - cy) ** 2 <= r * r + 0.001;
  };

  // The cut: a diagonal across the workpiece's top-right corner. Everything
  // on its far side is the offcut. Tuned against the 16px render, which is
  // the arbiter (§8.5) — a shallower angle loses the triangle to rounding.
  const A = [0.32 * n, 0.13 * n];               // where the cut meets the top edge
  const B = [0.87 * n, 0.68 * n];               // where it meets the right edge
  const side = (x, y) => (x - A[0]) * (B[1] - A[1]) - (y - A[1]) * (B[0] - A[0]);

  const i0 = 0.13 * n, i1 = 0.87 * n, rb = 0.15 * n;
  const inBody = (x, y) => rounded(x, y, i0, i0, i1, i1, rb);

  // The offcut, shifted clear along the cut's normal so a seam of tile shows
  // between the two even after downsampling.
  const d = 0.10 * n, off = [d * 0.72, -d * 0.72];

  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const fx = x + 0.5, fy = y + 0.5;
      let c = null;
      if (rounded(fx, fy, 0, 0, n, n, 0.20 * n)) c = INK;
      // body: inside the workpiece, on the near side of the cut
      if (c && inBody(fx, fy) && side(fx, fy) < 0) c = BONE;
      // offcut: the far side of the cut, translated away from the body
      const ox = fx - off[0], oy = fy - off[1];
      if (c && inBody(ox, oy) && side(ox, oy) >= 0) c = GOLD;
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
