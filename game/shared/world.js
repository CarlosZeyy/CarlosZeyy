// Cenário do jogo, desenhado só com retângulos [x, y, w, h, cor] para servir tanto ao canvas (jogo)
// quanto ao SVG (README). Três camadas com parallax: far, mid e main (onde o personagem anda).
import { textRects, textWidth } from './font.js';
import { STOPS, CHIPS, ZONES } from './content.js';

export const VIEW_W = 384, VIEW_H = 216;
export const GROUND = 184;            // y do chão (pés do personagem)
export const ZONE_W = 608, WORLD_W = ZONE_W * 4;
export const SPEED = 110;             // px/s da caminhada
export const WALK_CYCLE = 0.42;       // duração de um ciclo de 8 quadros (casa com SPEED para o pé não deslizar)

// céu de cada fase, em faixas de cima para baixo: pôr do sol, crepúsculo, noite, amanhecer
export const SKY_BANDS = [44, 34, 30, 28, 26, 22];
export const SKIES = [
  ['#2b2a6b', '#4a3a8c', '#7a4a9c', '#b8588c', '#e8805c', '#f8b860'],
  ['#10143c', '#1c2058', '#2c2c78', '#4a3a8c', '#7a4a9c', '#a8508c'],
  ['#060818', '#0a0e2a', '#10143c', '#181c50', '#242868', '#34307c'],
  ['#1c2058', '#3a3c8c', '#6a58a8', '#b870a0', '#f09880', '#f8d090'],
];
export const STAR_ALPHA = [0, 0.6, 1, 0.35];
export const ZONE_COLORS = ['#f8b860', '#58f0c0', '#ff7ad0', '#8ac8ff'];

const al = (hex, a) => `rgba(${parseInt(hex.slice(1, 3), 16)},${parseInt(hex.slice(3, 5), 16)},${parseInt(hex.slice(5, 7), 16)},${a})`;
function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

// Luzes que piscam: [x, y, w, h, cor, grupo]. Cada grupo tem um período (BLINK_PERIODS) e fica
// visível na primeira metade dele. São desenhadas por cima da camada main.
export const BLINK_PERIODS = [1.1, 0.7, 1.9];
let blinks = [];
const blink = (x, y, w, h, c, group) => blinks.push([Math.round(x), Math.round(y), w, h, c, group]);

// Carro (30x13) virado para a direita, com o canto superior esquerdo em (0, 0).
export function carRects(body, hi, dark) {
  return [
    [30, 5, 12, 5, 'rgba(255,244,176,0.16)'],
    [6, 0, 16, 6, dark], [7, 1, 14, 1, hi], [8, 2, 5, 3, '#a8e0ff'], [14, 2, 6, 3, '#a8e0ff'], [8, 2, 5, 1, '#e0f8ff'], [14, 2, 6, 1, '#e0f8ff'],
    [0, 5, 30, 6, body], [0, 5, 30, 1, hi], [0, 10, 30, 1, dark], [29, 6, 1, 2, '#fff4b0'], [0, 6, 1, 2, '#ff5a5a'],
    [3, 8, 7, 5, '#14101a'], [20, 8, 7, 5, '#14101a'], [5, 10, 3, 2, '#8a8aa4'], [22, 10, 3, 2, '#8a8aa4'],
  ];
}

function layer(parallax, x0, w) {
  const rects = [];
  return {
    parallax, x0, w, rects,
    r(x, y, rw, rh, c) { if (rw > 0 && rh > 0) rects.push([Math.round(x), Math.round(y), Math.round(rw), Math.round(rh), c]); },
    text(str, x, y, c) { rects.push(...textRects(str, Math.round(x), Math.round(y), c)); },
  };
}

// ---------- fundo ----------
function skyline(L, rnd, o) {
  let x = L.x0;
  while (x < L.x0 + L.w) {
    const w = o.minW + Math.floor(rnd() * (o.maxW - o.minW)), h = o.minH + Math.floor(rnd() * (o.maxH - o.minH));
    const top = GROUND - h;
    L.r(x, top, w, h + 4, o.body); L.r(x, top, 1, h, o.edge); L.r(x, top, w, 1, o.edge);
    if (rnd() < 0.35) { L.r(x + Math.floor(w / 2), top - 9, 1, 9, o.body); L.r(x + Math.floor(w / 2) - 1, top - 3, 3, 3, o.body); }
    else if (rnd() < 0.3) L.r(x + 3, top - 4, Math.floor(w / 3), 4, o.body);
    const s = o.win, step = s + 2;
    for (let wy = top + 5; wy < GROUND - 6; wy += step + 1) {
      if (o.stripe) L.r(x + 2, wy, w - 4, s, o.stripe);
      for (let wx = x + 3; wx < x + w - s - 2; wx += step) if (rnd() < o.lit) L.r(wx, wy, s, s, rnd() < 0.8 ? o.winOn : o.winAlt);
    }
    x += w + Math.floor(rnd() * o.gap);
  }
}

// ---------- chão ----------
function street(L, x0, x1, p) {
  const w = x1 - x0;
  L.r(x0, GROUND, w, 2, p.hi); L.r(x0, GROUND + 2, w, 10, p.walk);
  for (let x = Math.ceil(x0 / 24) * 24; x < x1; x += 24) L.r(x, GROUND + 2, 1, 10, p.joint);
  L.r(x0, GROUND + 12, w, 3, p.curb); L.r(x0, GROUND + 15, w, 17, '#32323e'); L.r(x0, GROUND + 15, w, 1, '#20202a');
  for (let x = Math.ceil(x0 / 28) * 28; x < x1; x += 28) L.r(x, GROUND + 23, 14, 2, '#c8b858');
}
function labFloor(L, x0, x1) {
  const w = x1 - x0;
  L.r(x0, GROUND + 2, w, 30, '#232c40'); L.r(x0, GROUND + 2, w, 1, '#141a28'); L.r(x0, GROUND + 17, w, 1, '#34405c');
  for (let x = Math.ceil(x0 / 32) * 32; x < x1; x += 32) {
    L.r(x, GROUND + 3, 1, 29, '#141a28'); L.r(x + 1, GROUND + 3, 1, 29, '#34405c');
    L.r(x + 5, GROUND + 7, 2, 2, '#4a5878'); L.r(x + 26, GROUND + 7, 2, 2, '#4a5878'); L.r(x + 5, GROUND + 24, 2, 2, '#4a5878');
  }
  L.r(x0, GROUND, w, 2, '#58f0c0'); L.r(x0, GROUND + 2, w, 2, al('#58f0c0', 0.25));
}
function rooftop(L, x0, x1, rnd) {
  const w = x1 - x0;
  L.r(x0, GROUND, w, 2, '#d0d0e0'); L.r(x0, GROUND + 2, w, 6, '#8a8aa4'); L.r(x0, GROUND + 8, w, 2, '#5a5a72');
  L.r(x0, GROUND + 10, w, 22, '#44445a');
  for (let x = Math.ceil(x0 / 16) * 16; x < x1; x += 16) L.r(x, GROUND + 2, 1, 6, '#70708a');
  for (let x = Math.ceil(x0 / 36) * 36; x < x1; x += 36) {
    const lit = rnd() < 0.55;
    L.r(x + 8, GROUND + 15, 14, 12, '#2c2c3e'); L.r(x + 9, GROUND + 16, 12, 10, lit ? '#f8d878' : '#34344a');
    L.r(x + 9, GROUND + 16, 12, 2, lit ? '#fff0b0' : '#44445e'); L.r(x + 14, GROUND + 16, 1, 10, '#2c2c3e');
  }
}

// ---------- objetos ----------
function lamp(L, x) {
  L.r(x - 15, 114, 32, 24, al('#ffec96', 0.08)); L.r(x - 10, 118, 22, 15, al('#ffec96', 0.12));
  L.r(x - 2, 180, 6, 4, '#22222e'); L.r(x, 124, 2, 58, '#2a2a3a'); L.r(x + 1, 124, 1, 58, '#4e4e66');
  L.r(x - 7, 123, 16, 2, '#2a2a3a'); L.r(x - 9, 125, 6, 3, '#fff4b0'); L.r(x + 5, 125, 6, 3, '#fff4b0');
  L.r(x - 9, 124, 6, 1, '#2a2a3a'); L.r(x + 5, 124, 6, 1, '#2a2a3a');
}
function tree(L, x) {
  L.r(x - 2, 158, 5, 26, '#4a3020'); L.r(x - 2, 158, 1, 26, '#6e4a30'); L.r(x + 2, 158, 1, 26, '#2e1c12');
  L.r(x - 12, 128, 24, 8, '#1e6a3c'); L.r(x - 17, 134, 34, 18, '#1e6a3c'); L.r(x - 13, 150, 26, 8, '#1e6a3c');
  L.r(x - 13, 152, 26, 6, '#124a2c'); L.r(x + 8, 136, 9, 16, '#124a2c');
  L.r(x - 9, 130, 10, 4, '#3c9c50'); L.r(x - 15, 137, 9, 5, '#3c9c50'); L.r(x - 1, 139, 8, 3, '#3c9c50'); L.r(x - 7, 132, 4, 2, '#7fd858');
}
function signBoard(L, s) {
  const tw = textWidth(s.label), w = tw + 14, x0 = Math.round(s.x - w / 2), y = 138;
  L.r(s.x - 2, y + 17, 4, GROUND - y - 17, '#5a3818'); L.r(s.x - 2, y + 17, 1, GROUND - y - 17, '#8a5a28');
  L.r(x0, y, w, 18, '#5a3818'); L.r(x0 + 1, y + 1, w - 2, 16, '#c88838'); L.r(x0 + 1, y + 1, w - 2, 2, '#e8b058');
  L.r(x0 + 1, y + 15, w - 2, 2, '#a06828'); L.r(x0 + 3, y + 3, 1, 1, '#5a3818'); L.r(x0 + w - 4, y + 3, 1, 1, '#5a3818');
  L.text(s.label, x0 + 7, y + 6, '#3a2008');
  s.py = y - 14;
}
const BUILDINGS = {
  systelos: { w: 112, h: 106, wall: '#3c4a78', hi: '#5c6ca0', sh: '#28325a', trim: '#28325a', frame: '#1c2444', win: '#5878b8', winHi: '#7898d8', winLit: '#a8e0ff', winLitHi: '#e0f8ff', door: '#28325a', doorHi: '#5c6ca0', signBg: '#101830', neon: '#8ae8ff', lit: 0.6 },
  estacio: { w: 104, h: 88, wall: '#a85c44', hi: '#c87c5c', sh: '#7a3c2c', trim: '#7a3c2c', frame: '#4a2418', win: '#6a3c34', winHi: '#8a5448', winLit: '#ffe08a', winLitHi: '#fff4c0', door: '#4a2418', doorHi: '#8a5448', signBg: '#f6f6fa', neon: '#b02c2c', lit: 0.5 },
  enfermex: { w: 124, h: 112, wall: '#b8c4d8', hi: '#e0e8f4', sh: '#8894ac', trim: '#6c7890', frame: '#4a5670', win: '#6c88a8', winHi: '#8ca8c8', winLit: '#c8fff0', winLitHi: '#f0fffa', door: '#4a5670', doorHi: '#8ca8c8', signBg: '#0c2c24', neon: '#40f0a8', lit: 0.65 },
  mvvidros: { w: 124, h: 98, wall: '#2c5e80', hi: '#4c82a8', sh: '#1c4260', trim: '#1c4260', frame: '#123048', win: '#4c94b8', winHi: '#7cc0e0', winLit: '#b8f0ff', winLitHi: '#eafcff', door: '#123048', doorHi: '#4c94b8', signBg: '#082030', neon: '#a0e8ff', lit: 0.7 },
  calculadora: { w: 124, h: 118, wall: '#5c3e80', hi: '#7c5ca8', sh: '#402860', trim: '#402860', frame: '#28183e', win: '#4a3270', winHi: '#644890', winLit: '#ffe08a', winLitHi: '#fff4c0', door: '#28183e', doorHi: '#7c5ca8', signBg: '#1c1030', neon: '#ffd860', lit: 0.45 },
  spotify: { w: 124, h: 102, wall: '#24382c', hi: '#3c5644', sh: '#16241c', trim: '#16241c', frame: '#0c1610', win: '#2c4a38', winHi: '#3e644c', winLit: '#a8ffb8', winLitHi: '#e0ffe6', door: '#0c1610', doorHi: '#3c5644', signBg: '#081008', neon: '#58f070', lit: 0.5 },
};
function building(L, s, rnd) {
  const st = BUILDINGS[s.id], cx = s.x, x0 = Math.round(cx - st.w / 2), top = GROUND - st.h, w = st.w;
  L.r(x0 - 2, top - 4, w + 4, 4, st.trim); L.r(x0 - 2, top - 4, w + 4, 1, st.hi);
  L.r(x0, top, w, st.h, st.wall); L.r(x0, top, 2, st.h, st.hi); L.r(x0 + w - 3, top, 3, st.h, st.sh);
  const tw = textWidth(s.label), sx = Math.round(cx - tw / 2);
  L.r(sx - 10, top + 3, tw + 20, 21, al(st.neon, 0.14));
  L.r(sx - 7, top + 6, tw + 14, 15, st.signBg); L.r(sx - 7, top + 6, tw + 14, 1, st.neon); L.r(sx - 7, top + 20, tw + 14, 1, st.neon);
  L.text(s.label, sx, top + 10, st.neon);
  for (let wy = top + 30; wy < GROUND - 52; wy += 18) for (let wx = x0 + 9; wx <= x0 + w - 21; wx += 17) {
    const lit = rnd() < st.lit;
    L.r(wx, wy, 12, 12, st.frame); L.r(wx + 1, wy + 1, 10, 10, lit ? st.winLit : st.win);
    L.r(wx + 1, wy + 1, 10, 2, lit ? st.winLitHi : st.winHi); L.r(wx + 6, wy + 1, 1, 10, st.frame);
  }
  // vitrine, porta e toldo
  L.r(x0 + 8, GROUND - 30, w - 16, 24, st.frame); L.r(x0 + 9, GROUND - 29, w - 18, 22, st.winLit); L.r(x0 + 9, GROUND - 29, w - 18, 3, st.winLitHi);
  for (let wx = x0 + 9 + 16; wx < x0 + w - 12; wx += 17) L.r(wx, GROUND - 29, 1, 22, st.frame);
  L.r(cx - 11, GROUND - 32, 22, 32, st.frame); L.r(cx - 9, GROUND - 30, 18, 30, st.door); L.r(cx - 9, GROUND - 30, 18, 2, st.doorHi);
  L.r(cx, GROUND - 28, 1, 28, st.frame); L.r(cx - 3, GROUND - 15, 2, 4, '#f8d878'); L.r(cx + 2, GROUND - 15, 2, 4, '#f8d878');
  L.r(cx - 16, GROUND - 38, 32, 6, st.neon); for (let i = 0; i < 4; i++) L.r(cx - 16 + i * 8, GROUND - 38, 4, 6, st.signBg);
  L.r(cx - 16, GROUND - 32, 32, 1, st.sh);
  s.py = top - 18;
}
function rack(L, x, rnd) {
  L.r(x, 118, 22, 66, '#161c2c'); L.r(x, 118, 22, 1, '#3a4460'); L.r(x, 118, 1, 66, '#2a3248');
  for (let y = 122; y < 178; y += 7) {
    L.r(x + 2, y, 18, 5, '#232a3e'); L.r(x + 4, y + 2, 1, 1, '#58f090'); L.r(x + 7, y + 2, 1, 1, rnd() < 0.3 ? '#f8b800' : '#58f090');
    if (rnd() < 0.5) L.r(x + 10, y + 2, 1, 1, '#3cbcfc'); L.r(x + 13, y + 1, 5, 1, '#101420'); L.r(x + 13, y + 3, 5, 1, '#101420');
    if (rnd() < 0.45) blink(x + (rnd() < 0.5 ? 4 : 7), y + 2, 1, 1, '#232a3e', rnd() < 0.5 ? 1 : 2);
  }
}
function terminal(L, s) {
  const x = s.x, tw = textWidth(s.label);
  L.r(x - tw / 2 - 5, 126, tw + 10, 15, al('#58f0c0', 0.16)); L.r(x - tw / 2 - 5, 126, tw + 10, 1, '#58f0c0'); L.r(x - tw / 2 - 5, 140, tw + 10, 1, '#58f0c0');
  L.text(s.label, x - tw / 2, 130, '#c8fff0'); L.r(x, 141, 1, 7, '#58f0c0');
  L.r(x - 14, 148, 28, 36, '#3a4258'); L.r(x - 14, 148, 28, 1, '#7a86a4'); L.r(x - 14, 148, 1, 36, '#56607a'); L.r(x + 13, 148, 1, 36, '#22283a');
  L.r(x - 11, 151, 22, 14, '#04140c'); L.r(x - 10, 152, 20, 12, '#0b3c24'); L.r(x - 10, 152, 20, 1, '#16583a');
  L.r(x - 8, 154, 7, 1, '#58f090'); L.r(x - 8, 156, 12, 1, '#58f090'); L.r(x - 8, 158, 9, 1, '#58f090'); L.r(x - 8, 160, 4, 1, '#58f090'); L.r(x - 3, 160, 2, 1, '#e0ffe8');
  L.r(x - 12, 168, 24, 4, '#1a1e2e'); L.r(x - 11, 169, 22, 1, '#6a7690'); L.r(x - 11, 171, 22, 1, '#4a546c');
  L.r(x - 11, 175, 2, 2, '#58f090'); L.r(x - 7, 175, 2, 2, '#f8b800'); L.r(x + 2, 175, 9, 1, '#22283a'); L.r(x + 2, 177, 9, 1, '#22283a'); L.r(x + 2, 179, 9, 1, '#22283a');
  blink(x - 3, 160, 2, 1, '#0b3c24', 1);
  s.py = 110;
}
function platform(L, list, x, y, w) {
  L.r(x + 2, y + 6, w - 4, 3, al('#58f0c0', 0.18));
  L.r(x, y, w, 6, '#4a5672'); L.r(x, y, w, 1, '#9aa8c8'); L.r(x, y + 5, w, 1, '#2a3248'); L.r(x, y, 1, 6, '#6a7896');
  L.r(x + 3, y + 2, 2, 2, '#2a3248'); L.r(x + w - 5, y + 2, 2, 2, '#2a3248'); L.r(x + 2, y + 6, w - 4, 1, '#58f0c0');
  list.push({ x, y, w });
}
function billboard(L, s, color) {
  const x = s.x, tw = textWidth(s.label), w = tw + 14, x0 = Math.round(x - w / 2), y = 134;
  L.r(x - 1, y + 24, 3, GROUND - y - 24, '#3a3a50'); L.r(x - 1, y + 24, 1, GROUND - y - 24, '#5a5a78');
  L.r(x0 - 3, y - 3, w + 6, 30, al(color, 0.12));
  L.r(x0, y, w, 24, color); L.r(x0 + 1, y + 1, w - 2, 22, '#12122a'); L.r(x0 + 1, y + 1, w - 2, 1, '#2a2a50');
  L.text(s.label, x0 + 7, y + 6, color);
  L.r(x0 + 7, y + 17, tw, 2, al(color, 0.5)); L.r(x0 + 7, y + 17, Math.round(tw * 0.6), 2, color);
  s.py = y - 16;
}
function acUnit(L, x) {
  L.r(x, 164, 28, 20, '#8a8aa4'); L.r(x, 164, 28, 1, '#c0c0d8'); L.r(x, 164, 1, 20, '#a4a4c0'); L.r(x + 27, 164, 1, 20, '#5a5a72');
  L.r(x + 3, 167, 14, 14, '#44445a'); L.r(x + 5, 169, 10, 10, '#2c2c3e'); L.r(x + 9, 169, 2, 10, '#5a5a72'); L.r(x + 5, 173, 10, 2, '#5a5a72');
  for (let y = 168; y < 181; y += 3) L.r(x + 19, y, 6, 1, '#5a5a72');
}
function waterTank(L, x) {
  L.r(x + 2, 164, 2, 20, '#5a4030'); L.r(x + 24, 164, 2, 20, '#5a4030'); L.r(x + 2, 172, 24, 1, '#5a4030');
  L.r(x, 132, 28, 32, '#8a5a3c'); L.r(x, 132, 28, 2, '#b07a54'); L.r(x, 132, 2, 32, '#a06c48'); L.r(x + 25, 132, 3, 32, '#5a3824');
  for (let i = 6; i < 26; i += 6) L.r(x + i, 134, 1, 30, '#6e4630'); L.r(x, 144, 28, 1, '#4a2e1c'); L.r(x, 156, 28, 1, '#4a2e1c');
  L.r(x - 2, 128, 32, 4, '#5a3824'); L.r(x + 4, 124, 20, 4, '#6e4630');
}
function antenna(L, s) {
  const x = s.x;
  [[11, 8, 1], [16, 14, 2], [21, 20, 0]].forEach(([d, h, grp]) => { blink(x + d, 48 - h / 2, 1, h, al('#8ac8ff', 0.8), grp); blink(x - d, 48 - h / 2, 1, h, al('#8ac8ff', 0.8), grp); });
  for (let y = 70; y < GROUND; y += 2) {
    const half = Math.round(2 + (y - 70) * 0.1);
    L.r(x - half, y, 2, 2, '#b0b0c8'); L.r(x + half - 1, y, 2, 2, '#6a6a84');
    if ((y - 70) % 14 === 0) L.r(x - half, y, half * 2, 1, '#8a8aa4');
    if ((y - 70) % 14 === 6) L.r(x - half + 2, y, half * 2 - 3, 1, '#5a5a72');
  }
  L.r(x - 1, 50, 2, 20, '#b0b0c8'); L.r(x, 50, 1, 20, '#6a6a84');
  L.r(x - 1, 46, 3, 3, '#8a2c2c');
  blink(x - 7, 40, 15, 15, al('#ff4040', 0.16), 0); blink(x - 4, 43, 9, 9, al('#ff4040', 0.3), 0); blink(x - 1, 46, 3, 3, '#ff6a6a', 0); blink(x, 46, 1, 1, '#ffd0d0', 0);
  L.r(x + 4, 92, 11, 11, '#d0d0e0'); L.r(x + 5, 93, 9, 9, '#9a9ab4'); L.r(x + 7, 95, 5, 5, '#6a6a84'); L.r(x + 9, 97, 1, 1, '#f6f6fa');
  s.py = 100;
}
function gate(L, x, i) {
  const label = `FASE ${i + 1} · ${ZONES[i].name}`, tw = textWidth(label), c = ZONE_COLORS[i];
  L.r(x, 92, 3, GROUND - 92, '#2a2a3a'); L.r(x + 1, 92, 1, GROUND - 92, '#5a5a78'); L.r(x - 1, 89, 5, 3, '#f8d878');
  L.r(x + 3, 96, tw + 12, 17, c); L.r(x + 3, 96, tw + 12, 2, al('#ffffff', 0.35)); L.r(x + 3, 111, tw + 12, 2, al('#000000', 0.25));
  L.text(label, x + 9, 101, '#14101a');
}

export function buildWorld() {
  const rnd = rng(20261109);
  blinks = [];
  const far = layer(0.25, -80, 1010), mid = layer(0.5, -100, 1530), main = layer(1, -160, WORLD_W + 160);
  skyline(far, rnd, { minW: 18, maxW: 44, minH: 30, maxH: 92, gap: 14, body: '#241e4a', edge: '#30285c', win: 2, lit: 0.14, winOn: '#f8d878', winAlt: '#ff9a6a' });
  skyline(mid, rnd, { minW: 36, maxW: 76, minH: 26, maxH: 78, gap: 46, body: '#352c62', edge: '#4c4284', stripe: '#2a2250', win: 3, lit: 0.2, winOn: '#ffe08a', winAlt: '#8ae8ff' });

  const stops = STOPS.map(s => ({ ...s, x: s.zone * ZONE_W + s.dx }));
  const byId = Object.fromEntries(stops.map(s => [s.id, s]));
  const platforms = [];
  const Z = i => i * ZONE_W;

  // chão
  street(main, main.x0, Z(1), { hi: '#c4c4d4', walk: '#8c8ca0', joint: '#6c6c80', curb: '#5a5a6c' });
  labFloor(main, Z(1), Z(2));
  street(main, Z(2), Z(3), { hi: '#e0a888', walk: '#a8705c', joint: '#844c3c', curb: '#5e3428' });
  rooftop(main, Z(3), Z(4), rnd);

  // fase 1: origem
  building(main, byId.systelos, rnd); building(main, byId.estacio, rnd);
  tree(main, -70); lamp(main, -120); gate(main, 20, 0); lamp(main, 96); signBoard(main, byId.sobre);
  tree(main, 222); lamp(main, 276); tree(main, 428); lamp(main, 574);

  // fase 2: skills
  for (const dx of [44, 228, 254, 424, 450, 586]) rack(main, Z(1) + dx, rnd);
  gate(main, Z(1) + 18, 1);
  for (const id of ['code', 'data', 'tools']) terminal(main, byId[id]);
  platform(main, platforms, Z(1) + 196, 122, 44);
  platform(main, platforms, Z(1) + 254, 84, 44);
  platform(main, platforms, Z(1) + 400, 122, 58);

  // fase 3: projetos
  for (const id of ['enfermex', 'mvvidros', 'calculadora', 'spotify']) building(main, byId[id], rnd);
  gate(main, Z(2) + 14, 2);
  for (const dx of [162, 302, 442, 586]) lamp(main, Z(2) + dx);

  // fase 4: contato
  gate(main, Z(3) + 10, 3);
  ['linkedin', 'portfolio', 'github', 'email'].forEach((id, i) => billboard(main, byId[id], ['#8ac8ff', '#ffd860', '#f6f6fa', '#ff7ad0'][i]));
  antenna(main, byId.antena);
  acUnit(main, Z(3) + 404); acUnit(main, Z(3) + 438); waterTank(main, Z(3) + 500); acUnit(main, Z(3) + 560);

  const chips = CHIPS.map(c => ({ ...c, x: Z(1) + c.dx }));
  const srnd = rng(77);
  const stars = Array.from({ length: 70 }, () => [Math.floor(srnd() * VIEW_W), Math.floor(srnd() * 120), srnd() < 0.2 ? 2 : 1, srnd() < 0.5 ? '#f6f6fa' : '#a8b0ff']);
  // carros nas duas ruas (fases 1 e 3): andam para a direita e reaparecem no começo do trecho
  const cars = [
    { from: main.x0, to: Z(1), y: GROUND + 18, speed: 150, offset: 0, rects: carRects('#d83c3c', '#ff7a6a', '#8a1c24') },
    { from: Z(2), to: Z(3), y: GROUND + 18, speed: 120, offset: 200, rects: carRects('#f8b800', '#ffe08a', '#a86c00') },
    { from: Z(2), to: Z(3), y: GROUND + 19, speed: 185, offset: 520, rects: carRects('#3c7cd8', '#8ac8ff', '#1c3c8a') },
  ];
  return { layers: { far, mid, main }, stops, chips, platforms, stars, blinks, cars };
}
