// Converte a foto em uma grade de pixels ligados/desligados (dithering) com fundo removido.
// Gera duas máscaras: "rows" (tema escuro: áreas claras viram pontos) e
// "rowsLight" (tema claro: áreas escuras viram pontos, como tinta no papel).
const { PNG } = require('pngjs');
const fs = require('fs');

const PHOTO = process.argv[2];
const OUT = process.argv[3] || 'mask.json';
const GW = 310, GH = 406;               // grade final (colunas x linhas)

const src = PNG.sync.read(fs.readFileSync(PHOTO));
const W = src.width, H = src.height;
const lum = new Float32Array(W * H);
const sat = new Float32Array(W * H);
for (let i = 0; i < W * H; i++) {
  const r = src.data[i * 4], g = src.data[i * 4 + 1], b = src.data[i * 4 + 2];
  lum[i] = 0.299 * r + 0.587 * g + 0.114 * b;
  sat[i] = Math.max(r, g, b) - Math.min(r, g, b);
}

// 1) Remoção de fundo: crescimento de região a partir das bordas (fundo cinza liso).
const TOL = +(process.env.TOL || 4.5);      // diferença máxima de luminância entre vizinhos
const SATMAX = +(process.env.SATMAX || 14); // fundo é cinza -> saturação baixa
const bg = new Uint8Array(W * H);
const queue = [];
const seed = (x, y) => { const i = y * W + x; if (!bg[i] && sat[i] < SATMAX) { bg[i] = 1; queue.push(i); } };
for (let x = 0; x < W; x++) { seed(x, 0); seed(x, 1); }
for (let y = 0; y < H * 0.55; y++) { seed(0, y); seed(1, y); seed(W - 1, y); seed(W - 2, y); }
while (queue.length) {
  const i = queue.pop();
  const x = i % W, y = (i / W) | 0;
  const nb = [];
  if (x > 0) nb.push(i - 1); if (x < W - 1) nb.push(i + 1); if (y > 0) nb.push(i - W); if (y < H - 1) nb.push(i + W);
  for (const j of nb) {
    if (bg[j]) continue;
    if (sat[j] >= SATMAX) continue;
    if (Math.abs(lum[j] - lum[i]) > TOL) continue;
    bg[j] = 1; queue.push(j);
  }
}
// dilata a máscara de fundo 2px para comer o halo da borda
const bg2 = new Uint8Array(bg);
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  if (bg[y * W + x]) continue;
  let hit = false;
  for (let dy = -2; dy <= 2 && !hit; dy++) for (let dx = -2; dx <= 2; dx++) {
    const xx = x + dx, yy = y + dy;
    if (xx >= 0 && yy >= 0 && xx < W && yy < H && bg[yy * W + xx]) { hit = true; break; }
  }
  if (hit) bg2[y * W + x] = 1;
}
let bgCount = 0; for (let i = 0; i < W * H; i++) bgCount += bg2[i];
console.log(`fundo removido: ${(100 * bgCount / (W * H)).toFixed(1)}% da foto`);

// 2) Recorte com a proporção da grade e reamostragem por média de área.
const aspect = GW / GH;
let cw = Math.round(H * aspect), ch = H, cx0 = Math.round((W - cw) / 2), cy0 = 0;
if (cw > W) { cw = W; ch = Math.round(W / aspect); cx0 = 0; cy0 = Math.round((H - ch) / 2); }
const grid = new Float32Array(GW * GH);   // luminância média do sujeito (fundo = 0)
const alpha = new Float32Array(GW * GH);  // fração de pixels que são sujeito
for (let gy = 0; gy < GH; gy++) for (let gx = 0; gx < GW; gx++) {
  const x0 = cx0 + Math.floor(gx * cw / GW), x1 = cx0 + Math.max(x0 - cx0 + 1, Math.floor((gx + 1) * cw / GW));
  const y0 = cy0 + Math.floor(gy * ch / GH), y1 = cy0 + Math.max(y0 - cy0 + 1, Math.floor((gy + 1) * ch / GH));
  let s = 0, n = 0, a = 0;
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    const i = y * W + x; n++;
    if (!bg2[i]) { s += lum[i]; a++; }
  }
  grid[gy * GW + gx] = a ? s / a : 0;
  alpha[gy * GW + gx] = a / n;
}

// 3) Níveis automáticos + gama -> "base" (0 = escuro, 1 = claro), só onde há sujeito.
const vals = []; for (let i = 0; i < GW * GH; i++) if (alpha[i] > 0.5) vals.push(grid[i]);
vals.sort((a, b) => a - b);
const lo = vals[Math.floor(vals.length * 0.03)], hi = vals[Math.floor(vals.length * 0.985)];
const GAMMA = +(process.env.GAMMA || 1.4);
const FADE = +(process.env.FADE || 0.16);
const SHARP = +(process.env.SHARP || 0.8);
const base = new Float32Array(GW * GH);
const weight = new Float32Array(GW * GH);   // alpha * fade da base
for (let gy = 0; gy < GH; gy++) for (let gx = 0; gx < GW; gx++) {
  const i = gy * GW + gx;
  let v = (grid[i] - lo) / (hi - lo); v = Math.min(1, Math.max(0, v));
  base[i] = Math.pow(v, GAMMA);
  let w = alpha[i];
  const fadeStart = GH * (1 - FADE);
  if (gy > fadeStart) w *= Math.max(0, 1 - (gy - fadeStart) / (GH - fadeStart)) ** 1.5;
  weight[i] = w;
}
// 3b) Realce local (unsharp mask) para destacar óculos, olhos e barba.
if (SHARP > 0) {
  const R = 3, blur = new Float32Array(GW * GH);
  for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
    let s = 0, n = 0;
    for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
      const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= GW || yy >= GH) continue;
      s += base[yy * GW + xx]; n++;
    }
    blur[y * GW + x] = s / n;
  }
  for (let i = 0; i < GW * GH; i++) if (alpha[i] > 0) base[i] = Math.min(1, Math.max(0, base[i] + SHARP * (base[i] - blur[i])));
}

// 4) Dithering Floyd–Steinberg.
function dither(tone) {
  const on = new Uint8Array(GW * GH);
  const err = Float32Array.from(tone);
  for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
    const i = y * GW + x;
    const old = err[i];
    const nw = old >= 0.5 ? 1 : 0;
    on[i] = nw;
    const e = old - nw;
    if (x + 1 < GW) err[i + 1] += e * 7 / 16;
    if (y + 1 < GH) {
      if (x > 0) err[i + GW - 1] += e * 3 / 16;
      err[i + GW] += e * 5 / 16;
      if (x + 1 < GW) err[i + GW + 1] += e * 1 / 16;
    }
  }
  return on;
}
// piso de 6%: até as partes mais escuras (ou mais claras, no tema claro) recebem alguns pontos
const toneDark = base.map((b, i) => (0.06 + 0.94 * b) * weight[i]);
const toneLight = base.map((b, i) => (0.06 + 0.94 * (1 - b)) * weight[i]);
const onDark = dither(toneDark), onLight = dither(toneLight);
const count = a => a.reduce((s, v) => s + v, 0);
console.log(`grade ${GW}x${GH}, pixels acesos: dark ${count(onDark)}, light ${count(onLight)}`);

// Saída: máscaras + prévias PNG (2x)
const toRows = on => Array.from({ length: GH }, (_, y) => Array.from(on.subarray(y * GW, (y + 1) * GW)).join(''));
fs.writeFileSync(OUT, JSON.stringify({ GW, GH, rows: toRows(onDark), rowsLight: toRows(onLight) }));
function preview(on, file, fg, bgc) {
  const SC = 2, p = new PNG({ width: GW * SC, height: GH * SC });
  for (let y = 0; y < GH * SC; y++) for (let x = 0; x < GW * SC; x++) {
    const v = on[((y / SC) | 0) * GW + ((x / SC) | 0)], o = (y * GW * SC + x) * 4, c = v ? fg : bgc;
    p.data[o] = c[0]; p.data[o + 1] = c[1]; p.data[o + 2] = c[2]; p.data[o + 3] = 255;
  }
  fs.writeFileSync(file, PNG.sync.write(p));
}
preview(onDark, OUT.replace(/\.json$/, '-dark.png'), [0xE5, 0xE5, 0xE5], [0x0A, 0x0A, 0x0A]);
preview(onLight, OUT.replace(/\.json$/, '-light.png'), [0x17, 0x17, 0x17], [0xFF, 0xFF, 0xFF]);
