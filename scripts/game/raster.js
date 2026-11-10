// Rasterizador mínimo para listas de retângulos [x, y, w, h, cor]. Sem dependências.
// - composite: pinta os retângulos em ordem num buffer RGBA (com alpha "over")
// - toPaths: converte o buffer em <path> SVG, um por cor, sem sobreposição
// - encodePNG: grava um PNG (para conferência visual)
import zlib from 'node:zlib';

const cache = new Map();
export function parseColor(c) {
  let v = cache.get(c);
  if (v) return v;
  if (c[0] === '#') v = [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16), 1];
  else { const m = c.match(/[\d.]+/g).map(Number); v = [m[0], m[1], m[2], m[3] ?? 1]; }
  cache.set(c, v);
  return v;
}

export function createImage(w, h, x0 = 0, y0 = 0) {
  return { w, h, x0, y0, data: new Float32Array(w * h * 4) };
}

export function composite(img, rects, dx = 0, dy = 0) {
  const { w, h, x0, y0, data } = img;
  for (const [rx, ry, rw, rh, color] of rects) {
    const [r, g, b, a] = parseColor(color);
    const xa = Math.max(0, rx + dx - x0), xb = Math.min(w, rx + dx - x0 + rw);
    const ya = Math.max(0, ry + dy - y0), yb = Math.min(h, ry + dy - y0 + rh);
    for (let y = ya; y < yb; y++) for (let x = xa; x < xb; x++) {
      const o = (y * w + x) * 4, da = data[o + 3];
      if (a >= 1 || da === 0) { data[o] = r; data[o + 1] = g; data[o + 2] = b; data[o + 3] = a; continue; }
      const oa = a + da * (1 - a);
      data[o] = (r * a + data[o] * da * (1 - a)) / oa;
      data[o + 1] = (g * a + data[o + 1] * da * (1 - a)) / oa;
      data[o + 2] = (b * a + data[o + 2] * da * (1 - a)) / oa;
      data[o + 3] = oa;
    }
  }
  return img;
}

export function rasterize(rects) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y, w, h] of rects) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x + w); y1 = Math.max(y1, y + h); }
  if (!rects.length) return createImage(0, 0);
  return composite(createImage(x1 - x0, y1 - y0, x0, y0), rects);
}

const hex2 = v => Math.round(v).toString(16).padStart(2, '0');
// arredonda um canal para múltiplos de q: menos cores distintas, SVG bem menor
const quant = (v, q) => (q > 1 ? Math.min(255, Math.round(v / q) * q) : v);

// Um <path> por cor; sequências horizontais iguais em linhas consecutivas viram um retângulo só.
export function toPaths(img, q = 1) {
  const { w, h, x0, y0, data } = img;
  const col = o => `#${hex2(quant(data[o], q))}${hex2(quant(data[o + 1], q))}${hex2(quant(data[o + 2], q))}`;
  const alpha = o => (q > 1 ? Math.round(data[o + 3] * 10) / 10 : Math.round(data[o + 3] * 100) / 100);
  const byColor = new Map();
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w;) {
      const o = (y * w + x) * 4, a = alpha(o);
      if (a === 0) { x++; continue; }
      const key = `${col(o)}|${a}`;
      let n = 1;
      while (x + n < w) {
        const p = o + n * 4, pa = alpha(p);
        if (pa === 0 || `${col(p)}|${pa}` !== key) break;
        n++;
      }
      let c = byColor.get(key);
      if (!c) byColor.set(key, c = { open: new Map(), rects: [] });
      const id = x * 4096 + n, prev = c.open.get(id);
      if (prev && prev[1] + prev[3] === y) prev[3]++;
      else { const rect = [x, y, n, 1]; c.open.set(id, rect); c.rects.push(rect); }
      x += n;
    }
  }
  let out = '';
  for (const [key, c] of byColor) {
    const [fill, a] = key.split('|');
    const d = c.rects.map(([x, y, n, hh]) => `M${x + x0} ${y + y0}h${n}v${hh}h-${n}z`).join('');
    out += `<path fill="${fill}"${a !== '1' ? ` fill-opacity="${a}"` : ''} d="${d}"/>`;
  }
  return out;
}
export const rectsToPaths = (rects, q = 1) => toPaths(rasterize(rects), q);

// ---------- PNG ----------
const crcT = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = buf => { let c = 0xffffffff; for (const b of buf) c = crcT[(c ^ b) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const c = Buffer.alloc(4); c.writeUInt32BE(crc(td));
  return Buffer.concat([len, td, c]);
}
// img: imagem de composite (o que estiver transparente sai preto); scale amplia por inteiro
export function encodePNG(img, scale = 1) {
  const W = img.w * scale, H = img.h * scale;
  const raw = Buffer.alloc((W * 3 + 1) * H);
  for (let y = 0; y < H; y++) {
    const sy = Math.floor(y / scale), row = y * (W * 3 + 1) + 1;
    for (let x = 0; x < W; x++) {
      const o = (sy * img.w + Math.floor(x / scale)) * 4, a = img.data[o + 3];
      raw[row + x * 3] = img.data[o] * a; raw[row + x * 3 + 1] = img.data[o + 1] * a; raw[row + x * 3 + 2] = img.data[o + 2] * a;
    }
  }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
