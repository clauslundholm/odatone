/* Generates placeholder cover art: one abstract image per track, playlist
 * and mood, written to assets/covers/ as JPEG, plus src/data/covers.ts so
 * Metro can resolve them.
 *
 *   node tools/generate-covers.mjs          same images every run (seeded by id)
 *   node tools/generate-covers.mjs --random  a fresh set
 *
 * No dependencies: pixels are drawn here, written as PNG with node:zlib,
 * then converted to JPEG with macOS `sips`.
 */

import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "assets/covers");
const SIZE = 600;
const SALT = process.argv.includes("--random") ? String(Date.now()) : "";

/* ---- ids, read from the data files rather than imported (they are TS) ---- */

const ids = [];
const tracksSrc = readFileSync(join(ROOT, "src/data/tracks.ts"), "utf8");
for (const m of tracksSrc.matchAll(/^    id: "([^"]+)"/gm)) ids.push(m[1]);
const catalogSrc = readFileSync(join(ROOT, "src/data/catalog.ts"), "utf8");
const moodsBlock = catalogSrc.slice(catalogSrc.indexOf("export const MOODS"), catalogSrc.indexOf("export const moodById"));
for (const m of moodsBlock.matchAll(/id: "([^"]+)"/g)) ids.push(`mood-${m[1]}`);
const listsBlock = catalogSrc.slice(catalogSrc.indexOf("export const PLAYLISTS"), catalogSrc.indexOf("export const playlistById"));
for (const m of listsBlock.matchAll(/id: "([^"]+)"/g)) ids.push(m[1]);

/* ---- randomness ---- */

function rng(seedText) {
  let h = 2166136261;
  for (const ch of seedText) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return () => {
    h += 0x6d2b79f5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PALETTES = [
  ["#db00ff", "#7a3aff", "#3d7aff", "#0f0b2e", "#ffd6fb"], // brand
  ["#ff6b4a", "#ffb547", "#ffe3b3", "#3a1f5c", "#c2185b"], // dusk
  ["#0b3d3a", "#1f7a6c", "#8fd6c0", "#f4efe6", "#e8a33d"], // pine
  ["#101828", "#2e3a8c", "#6c8cff", "#c9d6ff", "#ff7a59"], // night
  ["#f2e8dc", "#d9a47a", "#a0522d", "#3b2a20", "#7d8f69"], // clay
  ["#ffcad4", "#f4acb7", "#9d8189", "#2b2d42", "#ffe5d9"], // blush
  ["#00171f", "#003459", "#007ea7", "#00a8e8", "#f5f3bb"], // deep sea
  ["#1b1b1b", "#f94144", "#f3722c", "#f9c74f", "#f1faee"], // heat
  ["#e9f5db", "#b5c99a", "#718355", "#283618", "#f6bd60"], // meadow
  ["#240046", "#5a189a", "#9d4edd", "#ff9e00", "#ffd8a8"], // violet sun
];

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const clamp = (v, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));
const smooth = (e0, e1, x) => {
  const t = clamp((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};
const AA = 1.2 / SIZE; // edge softness, about one pixel

/* ---- styles: each returns (x, y) -> [r, g, b], x and y in 0..1 ---- */

function mesh(r, pal) {
  const base = pal[Math.floor(r() * pal.length)];
  const blobs = Array.from({ length: 4 + Math.floor(r() * 3) }, () => ({
    x: r(), y: r(), s: 0.18 + r() * 0.3, c: pal[Math.floor(r() * pal.length)],
  }));
  return (x, y) => {
    let c = base;
    for (const b of blobs) {
      const d2 = (x - b.x) ** 2 + (y - b.y) ** 2;
      c = mix(c, b.c, Math.exp(-d2 / (2 * b.s * b.s)) * 0.9);
    }
    return c;
  };
}

function horizon(r, pal) {
  const [sky1, sky2, sun, ground, band] = [...pal].sort(() => r() - 0.5);
  const line = 0.55 + r() * 0.2;
  const sx = 0.3 + r() * 0.4;
  const sr = 0.16 + r() * 0.12;
  const bands = 3 + Math.floor(r() * 4);
  return (x, y) => {
    let c = mix(sky1, sky2, y / line);
    const d = Math.hypot(x - sx, y - line);
    c = mix(c, sun, 1 - smooth(sr - AA, sr + AA, d));
    if (y > line) {
      const k = (y - line) / (1 - line);
      const stripe = Math.floor(k * bands) % 2 === 0;
      c = mix(ground, band, stripe ? 0.18 : 0);
      c = mix(c, sun, (1 - smooth(sr - AA, sr + AA, Math.hypot(x - sx, (y - line) * 3))) * 0.35);
    }
    return c;
  };
}

function waves(r, pal) {
  const layers = 4 + Math.floor(r() * 3);
  const spec = Array.from({ length: layers }, (_, i) => ({
    y: 0.15 + (i / layers) * 0.85,
    a: 0.03 + r() * 0.07,
    f: 1 + r() * 3,
    p: r() * Math.PI * 2,
    c: pal[(i + Math.floor(r() * 2)) % pal.length],
  }));
  const bg = pal[Math.floor(r() * pal.length)];
  return (x, y) => {
    let c = bg;
    for (const s of spec) {
      const edge = s.y + s.a * Math.sin(x * Math.PI * 2 * s.f + s.p);
      c = mix(c, s.c, smooth(edge - AA, edge + AA, y));
    }
    return c;
  };
}

function rings(r, pal) {
  const cx = r();
  const cy = r();
  const width = 0.05 + r() * 0.07;
  const order = [...pal].sort(() => r() - 0.5);
  return (x, y) => {
    const d = Math.hypot(x - cx, y - cy) / width;
    const i = Math.floor(d);
    const f = d - i;
    const a = order[i % order.length];
    const b = order[(i + 1) % order.length];
    return mix(a, b, smooth(1 - AA / width, 1, f));
  };
}

function stripes(r, pal) {
  const angle = r() * Math.PI;
  const [ca, sa] = [Math.cos(angle), Math.sin(angle)];
  const n = 5 + Math.floor(r() * 8);
  const order = [...pal].sort(() => r() - 0.5).slice(0, 2 + Math.floor(r() * 3));
  const glow = pal[Math.floor(r() * pal.length)];
  const gx = r();
  const gy = r();
  return (x, y) => {
    const t = ((x - 0.5) * ca + (y - 0.5) * sa + 1) * n;
    const i = Math.floor(t);
    const f = t - i;
    let c = mix(order[i % order.length], order[(i + 1) % order.length], smooth(1 - AA * n, 1, f));
    c = mix(c, glow, Math.exp(-((x - gx) ** 2 + (y - gy) ** 2) / 0.08) * 0.55);
    return c;
  };
}

const STYLES = [mesh, horizon, waves, rings, stripes];

/* ---- PNG ---- */

const CRC = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
function png(width, height, rgb) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // RGB
  const raw = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (width * 3 + 1)] = 0;
    rgb.copy(raw, y * (width * 3 + 1) + 1, y * width * 3, (y + 1) * width * 3);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/* ---- render ---- */

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

for (const id of ids) {
  const r = rng(id + SALT);
  const pal = PALETTES[Math.floor(r() * PALETTES.length)].map(hex);
  const style = STYLES[Math.floor(r() * STYLES.length)];
  const paint = style(r, pal);
  const grain = rng(`grain-${id}`);
  const px = Buffer.alloc(SIZE * SIZE * 3);
  for (let y = 0; y < SIZE; y += 1) {
    for (let x = 0; x < SIZE; x += 1) {
      const c = paint((x + 0.5) / SIZE, (y + 0.5) / SIZE);
      const n = (grain() - 0.5) * 14; // a little film grain
      const o = (y * SIZE + x) * 3;
      px[o] = clamp(c[0] + n, 0, 255);
      px[o + 1] = clamp(c[1] + n, 0, 255);
      px[o + 2] = clamp(c[2] + n, 0, 255);
    }
  }
  const pngPath = join(OUT, `${id}.png`);
  writeFileSync(pngPath, png(SIZE, SIZE, px));
  execFileSync("sips", ["-s", "format", "jpeg", "-s", "formatOptions", "82", pngPath, "--out", join(OUT, `${id}.jpg`)], {
    stdio: "ignore",
  });
  rmSync(pngPath);
  console.log(`${style.name.padEnd(8)} ${id}`);
}

const lines = ids.map((id) => `  "${id}": require("../../assets/covers/${id}.jpg"),`);
writeFileSync(
  join(ROOT, "src/data/covers.ts"),
  `/* GENERATED by tools/generate-covers.mjs — do not edit by hand.
 * Placeholder art: abstract images, one per track, playlist and mood.
 * Metro resolves require() at build time, so every file is named literally. */

export const COVERS: Record<string, number> = {
${lines.join("\n")}
};
`,
);
console.log(`\n${ids.length} covers → assets/covers/`);
