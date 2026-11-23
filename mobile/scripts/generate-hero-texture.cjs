/**
 * Bakes the home hero's grainy orange backdrop into static PNGs, replacing the live
 * Skia shader (which ran every frame). Run after changing PALETTE.orange/orangeDark:
 *
 *   node scripts/generate-hero-texture.cjs
 *
 * Outputs (assets/images/):
 *   hero-gradient-dark.png / hero-gradient-light.png  smooth colour field, stretched to fit
 *   hero-grain.png                                    seamless grain tile, repeated on top
 *
 * The colour field is the old shader's frame at t = 0 (same colours, brightness, blob
 * layout). Its coordinates were normalised to the canvas, so stretching a small image
 * reproduces it at any size.
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const ORANGE = '#DF7A5E'; // PALETTE.orange
const ORANGE_DARK = '#C9644A'; // PALETTE.orangeDark
const OUT_DIR = path.join(__dirname, '..', 'assets', 'images');

const GRADIENT_SIZE = 128;
const GRAIN_SIZE = 128;
const AMPLITUDE = 0.08;
const GRAIN_INTENSITY = 0.11;

// ---- colour helpers ---------------------------------------------------------------
const hexToRgb = (hex) => [0, 2, 4].map((i) => parseInt(hex.replace('#', '').slice(i, i + 2), 16) / 255);
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const WHITE = [1, 1, 1];
const O = hexToRgb(ORANGE);
const OD = hexToRgb(ORANGE_DARK);

const THEMES = {
  dark: { colors: [O, OD, mix(O, WHITE, 0.08), mix(O, OD, 0.5)], brightness: -0.08 },
  light: { colors: [mix(O, WHITE, 0.1), O, mix(O, WHITE, 0.2), mix(O, OD, 0.25)], brightness: -0.04 },
};

// ---- 3D simplex noise (port of the shader's snoise) -----------------------------
const mod289 = (x) => x - Math.floor(x / 289) * 289;
const permute = (x) => mod289((x * 34 + 1) * x);
function snoise(vx, vy, vz) {
  const C0 = 1 / 6, C1 = 1 / 3;
  const s = (vx + vy + vz) * C1;
  let ix = Math.floor(vx + s), iy = Math.floor(vy + s), iz = Math.floor(vz + s);
  const t0 = (ix + iy + iz) * C0;
  const x0 = [vx - ix + t0, vy - iy + t0, vz - iz + t0];
  const g = [x0[0] >= x0[1] ? 1 : 0, x0[1] >= x0[2] ? 1 : 0, x0[2] >= x0[0] ? 1 : 0];
  const l = g.map((v) => 1 - v);
  const i1 = [Math.min(g[0], l[2]), Math.min(g[1], l[0]), Math.min(g[2], l[1])];
  const i2 = [Math.max(g[0], l[2]), Math.max(g[1], l[0]), Math.max(g[2], l[1])];
  const x1 = x0.map((v, k) => v - i1[k] + C0);
  const x2 = x0.map((v, k) => v - i2[k] + C1);
  const x3 = x0.map((v) => v - 0.5);
  ix = mod289(ix); iy = mod289(iy); iz = mod289(iz);
  const zs = [0, i1[2], i2[2], 1], ys = [0, i1[1], i2[1], 1], xs = [0, i1[0], i2[0], 1];
  const p = [0, 1, 2, 3].map((k) => permute(permute(permute(iz + zs[k]) + iy + ys[k]) + ix + xs[k]));
  const n_ = 0.142857142857;
  const ns = [n_ * 2 - 0, n_ * 0.5 - 1, n_ * 1 - 0];
  const grads = p.map((pk) => {
    const j = pk - 49 * Math.floor(pk * ns[2] * ns[2]);
    const x_ = Math.floor(j * ns[2]);
    const y_ = Math.floor(j - 7 * x_);
    const x = x_ * ns[0] + ns[1];
    const y = y_ * ns[0] + ns[1];
    const h = 1 - Math.abs(x) - Math.abs(y);
    const sh = h <= 0 ? -1 : 0;
    const gx = x + (Math.floor(x) * 2 + 1) * sh;
    const gy = y + (Math.floor(y) * 2 + 1) * sh;
    const norm = 1.79284291400159 - 0.85373472095314 * (gx * gx + gy * gy + h * h);
    return [gx * norm, gy * norm, h * norm];
  });
  const pts = [x0, x1, x2, x3];
  let sum = 0;
  for (let k = 0; k < 4; k++) {
    const d = pts[k];
    let m = Math.max(0.6 - (d[0] * d[0] + d[1] * d[1] + d[2] * d[2]), 0);
    m *= m;
    sum += m * m * (grads[k][0] * d[0] + grads[k][1] * d[1] + grads[k][2] * d[2]);
  }
  return 42 * sum;
}

// ---- colour field (shader main() without grain, t = 0) ----------------------------
function shade(u, v, theme, t = 0) {
  const { colors, brightness } = theme;
  const n = colors.length;
  const acc = [0, 0, 0];
  let total = 0;
  for (let i = 0; i < n; i++) {
    const base = (i * Math.PI * 2) / n;
    const ox = Math.sin(t + base) * AMPLITUDE + snoise(t * 0.3, i, 0) * AMPLITUDE * 0.5;
    const oy = Math.cos(t * 0.8 + base) * AMPLITUDE + snoise(0, t * 0.3, i) * AMPLITUDE * 0.5;
    const r = 0.35 + snoise(i, t * 0.2, 0) * 0.1;
    const px = 0.5 + Math.cos(base) * r + ox;
    const py = 0.5 + Math.sin(base) * r + oy;
    const d2 = (u - px) ** 2 + (v - py) ** 2;
    const w = Math.exp(-d2 * 6) * (1 + snoise(u * 3, v * 3, t * 0.5 + i) * 0.2);
    for (let c = 0; c < 3; c++) acc[c] += colors[i][c] * w;
    total += w;
  }
  return acc.map((c) => Math.min(1, Math.max(0, c / Math.max(total, 0.001) + brightness)));
}

// ---- minimal PNG encoder (RGBA, 8-bit) -------------------------------------------
const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function writePng(file, w, h, pixel) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    for (let x = 0; x < w; x++) {
      const [r, g, b, a] = pixel(x, y);
      const o = y * (w * 4 + 1) + 1 + x * 4;
      raw[o] = r; raw[o + 1] = g; raw[o + 2] = b; raw[o + 3] = a;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
  fs.writeFileSync(file, png);
  console.log(`wrote ${path.relative(process.cwd(), file)} (${png.length} bytes)`);
}

// ---- outputs -------------------------------------------------------------------
const to8 = (v) => Math.round(v * 255);

for (const [name, theme] of Object.entries(THEMES)) {
  writePng(path.join(OUT_DIR, `hero-gradient-${name}.png`), GRADIENT_SIZE, GRADIENT_SIZE, (x, y) => {
    const [r, g, b] = shade((x + 0.5) / GRADIENT_SIZE, (y + 0.5) / GRADIENT_SIZE, theme);
    return [to8(r), to8(g), to8(b), 255];
  });
}

// Grain: the shader added snoise() at ~1.4 dp per cell, i.e. near per-pixel noise.
// Sampling the same noise on a torus (4D-free trick: two offset 3D lookups blended
// across the tile edges) keeps the tile seamless when repeated. Positive grain is
// drawn as translucent white, negative as translucent black.
const GRAIN_FREQ = 1 / 1.4;
function seamlessNoise(x, y) {
  const S = GRAIN_SIZE;
  const f = (px, py) => snoise(px * GRAIN_FREQ, py * GRAIN_FREQ, 0);
  const tx = x / S, ty = y / S;
  return (
    f(x, y) * (1 - tx) * (1 - ty) +
    f(x - S, y) * tx * (1 - ty) +
    f(x, y - S) * (1 - tx) * ty +
    f(x - S, y - S) * tx * ty
  ) / Math.sqrt(((1 - tx) ** 2 + tx ** 2) * ((1 - ty) ** 2 + ty ** 2));
}
// Shader: rgb += grain * (1 - |2c - 1|); for this orange that factor averages ~0.65,
// and a white/black overlay at alpha a shifts a channel by ~a * 0.5, so a ≈ 1.3 * |grain|.
writePng(path.join(OUT_DIR, 'hero-grain.png'), GRAIN_SIZE, GRAIN_SIZE, (x, y) => {
  const g = seamlessNoise(x, y) * GRAIN_INTENSITY;
  const a = Math.min(1, Math.abs(g) * 1.3);
  const c = g >= 0 ? 255 : 0;
  return [c, c, c, to8(a)];
});
