// Gera out/sprites.png (folha de sprites ampliada) e out/walk.html (animação) para conferência visual.
// Sem dependências.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { COLORS } from '../../game/shared/palette.js';
import { SPRITES } from '../../game/shared/sprites.js';
import { buildPlayer } from '../../game/shared/character.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(here, 'out');
fs.mkdirSync(OUT, { recursive: true });
const P = buildPlayer();

// ---------- validação das grades ----------
function check(name, grid) {
  const w = grid[0].length;
  grid.forEach((row, y) => {
    if (row.length !== w) throw new Error(`${name}: linha ${y} tem ${row.length} colunas, esperado ${w}`);
    for (const ch of row) if (ch !== '.' && !COLORS[ch]) throw new Error(`${name}: cor desconhecida '${ch}' na linha ${y}`);
  });
}
const all = { ...SPRITES, idle0: P.idle[0], idle1: P.idle[1], jump: P.jump, fall: P.fall };
P.walk.forEach((f, i) => { all[`walk${i}`] = f; });
for (const [n, g] of Object.entries(all)) check(n, g);

// ---------- tela ----------
const W = 1400, H = 640;
const px = Buffer.alloc(W * H * 3);
const rgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
function rect(x, y, w, h, hex) {
  const [r, g, b] = rgb(hex);
  for (let yy = Math.max(0, y); yy < Math.min(H, y + h); yy++)
    for (let xx = Math.max(0, x); xx < Math.min(W, x + w); xx++) {
      const o = (yy * W + xx) * 3; px[o] = r; px[o + 1] = g; px[o + 2] = b;
    }
}
function draw(grid, x, y, s) {
  grid.forEach((row, gy) => [...row].forEach((ch, gx) => { if (ch !== '.') rect(x + gx * s, y + gy * s, s, s, COLORS[ch]); }));
}
// fundo: céu de fim de tarde em faixas + chão
function backdrop(y0, y1, s) {
  const bands = ['#2b2a6b', '#4a3a8c', '#7a4a9c', '#b8588c', '#e8805c', '#f8b860'];
  const bh = Math.ceil((y1 - y0) / bands.length);
  bands.forEach((c, i) => rect(0, y0 + i * bh, W, bh, c));
  rect(0, y1, W, s, '#7fd858'); rect(0, y1 + s, W, s, '#3f9c3c'); rect(0, y1 + 2 * s, W, 40, '#5a4030');
}
const F1 = 290, F2 = 600; // linhas de chão
backdrop(0, F1, 4);
backdrop(F1 + 20, F2, 4);

// close-up 8x à esquerda
draw(P.idle[0], 10, F2 - P.h * 8 + 8, 8);
// linha de cima: caminhada em 4x
let x = 400;
for (const f of P.walk) { draw(f, x, F1 - P.h * 4 + 4, 4); x += 122; }
// linha de baixo: parado (2 quadros), pulo, queda em 4x; depois tamanho de jogo (2x) e itens
x = 400;
for (const f of [P.idle[0], P.idle[1], P.jump, P.fall]) { draw(f, x, F2 - P.h * 4 + 4, 4); x += 150; }
x += 20;
for (const f of P.walk) { draw(f, x, F2 - P.h * 2 + 2, 2); x += 44; }

// ---------- PNG ----------
const crcT = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = buf => { let c = 0xffffffff; for (const b of buf) c = crcT[(c ^ b) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const c = Buffer.alloc(4); c.writeUInt32BE(crc(td));
  return Buffer.concat([len, td, c]);
}
const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 2;
const raw = Buffer.alloc((W * 3 + 1) * H);
for (let y = 0; y < H; y++) px.copy(raw, y * (W * 3 + 1) + 1, y * W * 3, (y + 1) * W * 3);
const png = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0)),
]);
fs.writeFileSync(path.join(OUT, 'sprites.png'), png);
console.log(path.join(OUT, 'sprites.png'));

// ---------- animação ----------
const html = `<!doctype html><meta charset="utf-8"><title>Carlos Quest — caminhada</title>
<style>body{margin:0;background:#14101a;display:grid;place-items:center;height:100vh}canvas{image-rendering:pixelated;width:960px;height:540px}</style>
<canvas id="c" width="320" height="180"></canvas>
<script>
const COLORS=${JSON.stringify(COLORS)}, P=${JSON.stringify(P)};
const ctx=document.getElementById('c').getContext('2d');
const bands=['#2b2a6b','#4a3a8c','#7a4a9c','#b8588c','#e8805c','#f8b860'];
function draw(g,x,y){g.forEach((r,gy)=>{for(let gx=0;gx<r.length;gx++){const ch=r[gx];if(ch!=='.'){ctx.fillStyle=COLORS[ch];ctx.fillRect(x+gx,y+gy,1,1);}}});}
let t=0;
setInterval(()=>{
  t++;
  bands.forEach((c,i)=>{ctx.fillStyle=c;ctx.fillRect(0,i*26,320,26);});
  ctx.fillStyle='#7fd858';ctx.fillRect(0,156,320,2);ctx.fillStyle='#3f9c3c';ctx.fillRect(0,158,320,2);ctx.fillStyle='#5a4030';ctx.fillRect(0,160,320,20);
  ctx.fillStyle='#4a3020';for(let i=0;i<12;i++)ctx.fillRect(((i*32-t*3)%384+384)%384-32,166,10,3);
  draw(P.walk[t%P.walk.length],80,156-P.floorY);
  draw(P.idle[(t>>3)%2],170,156-P.floorY);
  const j=Math.abs(Math.sin(t/6))*30;draw(Math.cos(t/6)*Math.sin(t/6)>0?P.jump:P.fall,240,156-P.floorY-j);
},90);
</script>`;
fs.writeFileSync(path.join(OUT, 'walk.html'), html);
console.log(path.join(OUT, 'walk.html'));
