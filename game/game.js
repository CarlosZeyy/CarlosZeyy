// Full-Stack Quest: jogo de plataforma do perfil. JS puro, sem dependências.
import { buildPlayer } from './shared/character.js';
import { SPRITES, gridRects } from './shared/sprites.js';
import { buildWorld, VIEW_W, VIEW_H, GROUND, ZONE_W, WORLD_W, SPEED, WALK_CYCLE, SKIES, SKY_BANDS, STAR_ALPHA, ZONE_COLORS, BLINK_PERIODS, AMBIENT } from './shared/world.js';
import { shadowText, textWidth } from './shared/font.js';
import { ZONES } from './shared/content.js';
import * as ui from './shared/ui.js';

const GRAVITY = 1000, JUMP = 380, TYPE_SPEED = 90;
const COYOTE = 0.09, JUMP_BUFFER = 0.12; // tolerâncias que deixam o pulo mais gentil
const cv = document.getElementById('game');
const ctx = cv.getContext('2d');
const touch = matchMedia('(pointer: coarse)').matches;

// ---------- pré-renderização ----------
const world = buildWorld();
const P = buildPlayer();
function bake(rects, x0, w, h, flip) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d');
  if (flip) { g.translate(w, 0); g.scale(-1, 1); }
  for (const [x, y, rw, rh, col] of rects) { g.fillStyle = col; g.fillRect(x - x0, y, rw, rh); }
  return c;
}
const layers = ['far', 'mid', 'main', 'fg'].map(k => { const l = world.layers[k]; return { ...l, img: bake(l.rects, l.x0, l.w, VIEW_H) }; });
const sprite = grid => [bake(gridRects(grid), 0, P.w, P.h), bake(gridRects(grid), 0, P.w, P.h, true)];
const frames = {
  idle: P.idle.map(sprite), walk: P.walk.map(sprite), cheer: P.cheer.map(sprite),
  jump: sprite(P.jump), fall: sprite(P.fall), point: sprite(P.point),
};
const chipImg = bake(gridRects(SPRITES.chip), 0, 12, 12);
const cars = world.cars.map(c => ({ ...c, img: bake(c.rects, 0, 42, 13) }));
const antenna = world.stops.find(s => s.final);
const rgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
const skies = SKIES.map(s => s.map(rgb));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// ---------- estado ----------
const START = { x: 60, y: GROUND, vy: 0, face: 1, grounded: true, moving: false, walkT: 0, air: 0, wantJump: 0, cam: 0, zone: 0, dialog: null, finale: 0, done: false };
const S = { mode: 'title', time: 0, banner: 0, got: new Set(), pops: [], seen: new Set(), ...START };
function restart() {
  Object.assign(S, START, { banner: 2.4 });
  S.got.clear(); S.seen.clear(); S.pops.length = 0;
}

// ---------- entrada ----------
const down = new Set(), hit = new Set();
const KEYS = {
  ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
  Space: 'jump', ArrowUp: 'jump', KeyW: 'jump', KeyE: 'act', Enter: 'act', Escape: 'close', KeyM: 'mute', KeyR: 'restart',
};
function press(k) { if (!down.has(k)) hit.add(k); down.add(k); audioInit(); }
addEventListener('keydown', e => { const k = KEYS[e.code]; if (!k || e.ctrlKey || e.metaKey || e.altKey) return; e.preventDefault(); press(k); });
addEventListener('keyup', e => { const k = KEYS[e.code]; if (k) down.delete(k); });
addEventListener('blur', () => down.clear());
for (const b of document.querySelectorAll('[data-k]')) {
  const k = b.dataset.k;
  b.addEventListener('pointerdown', e => { e.preventDefault(); b.classList.add('on'); press(k); });
  for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) b.addEventListener(ev, () => { b.classList.remove('on'); down.delete(k); });
  b.addEventListener('contextmenu', e => e.preventDefault());
}
cv.addEventListener('pointerdown', () => { press('act'); down.delete('act'); });

// ---------- som ----------
let ac = null, muted = false;
function audioInit() { if (ac === null) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch { ac = false; } } }
function beep(freq, dur = 0.08, type = 'square', vol = 0.035, when = 0) {
  if (!ac || muted) return;
  const o = ac.createOscillator(), g = ac.createGain(), t = ac.currentTime + when;
  o.type = type; o.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(ac.destination); o.start(t); o.stop(t + dur + 0.02);
}
const jingle = notes => notes.forEach((f, i) => beep(f, 0.1, 'square', 0.035, i * 0.08));

// ---------- lógica ----------
function openLink(url) {
  if (url.startsWith('mailto:')) location.href = url;
  else window.open(url, '_blank', 'noopener');
}
function openDialog(stop) {
  let rows = stop.rows;
  if (stop.final) rows = [...rows, ['SKILLS', `${S.got.size}/${world.chips.length} coletadas`]];
  S.dialog = { stop, rows, chars: 0, total: rows.reduce((n, r) => n + ui.rowLength(r), 0) };
  S.seen.add(stop.id);
  beep(660, 0.06);
}
function closeDialog() {
  const { stop } = S.dialog;
  S.dialog = null;
  if (stop.final && !S.done) { S.done = true; S.finale = 6; jingle([523, 659, 784, 1047, 1319]); }
}
function nearStop() {
  if (!S.grounded) return null;
  let best = null;
  for (const s of world.stops) { const d = Math.abs(s.x - S.x); if (d < 24 && (!best || d < Math.abs(best.x - S.x))) best = s; }
  return best;
}

function update(dt) {
  S.time += dt;
  if (hit.has('mute')) muted = !muted;
  if (S.mode === 'title') {
    if (hit.has('act') || hit.has('jump')) { S.mode = 'play'; S.banner = 2.4; jingle([392, 523, 659]); }
    return;
  }
  if (hit.has('restart') && !S.dialog) { restart(); return; }
  S.banner = Math.max(0, S.banner - dt);
  S.finale = Math.max(0, S.finale - dt);
  for (const p of S.pops) p.t += dt;
  S.pops = S.pops.filter(p => p.t < 1.1);

  if (S.dialog) {
    const d = S.dialog;
    d.chars += dt * TYPE_SPEED;
    if (hit.has('act')) {
      if (d.chars < d.total) d.chars = d.total;
      else if (d.stop.link) openLink(d.stop.link.url);
      else closeDialog();
    } else if (hit.has('jump') || hit.has('close') || hit.has('left') || hit.has('right')) closeDialog();
    S.moving = false;
    return;
  }

  const dir = (down.has('right') ? 1 : 0) - (down.has('left') ? 1 : 0);
  S.moving = dir !== 0;
  if (dir) { S.face = dir; S.x = clamp(S.x + dir * SPEED * dt, 12, WORLD_W - 12); S.walkT += dt; S.finale = Math.min(S.finale, 0.01); } else S.walkT = 0;

  S.air = S.grounded ? 0 : S.air + dt;
  S.wantJump = hit.has('jump') ? JUMP_BUFFER : Math.max(0, S.wantJump - dt);
  if (S.wantJump > 0 && S.air < COYOTE && S.vy >= 0) { S.vy = -JUMP; S.grounded = false; S.air = COYOTE; S.wantJump = 0; beep(440, 0.1, 'square', 0.03); }
  if (S.vy < -140 && !down.has('jump')) S.vy = -140; // soltar o botão encurta o pulo

  const prevY = S.y;
  S.vy += GRAVITY * dt; S.y += S.vy * dt;
  let floor = GROUND;
  if (S.vy >= 0) for (const p of world.platforms) if (S.x > p.x - 5 && S.x < p.x + p.w + 5 && prevY <= p.y && S.y >= p.y) floor = Math.min(floor, p.y);
  if (S.y >= floor) { S.y = floor; S.vy = 0; S.grounded = true; } else S.grounded = false;

  for (const c of world.chips) {
    if (S.got.has(c.name)) continue;
    if (S.x + 9 > c.x && S.x - 9 < c.x + 12 && S.y > c.y && S.y - 58 < c.y + 12) {
      S.got.add(c.name); S.pops.push({ text: `+ ${c.name}`, x: c.x + 6, y: c.y - 4, t: 0 });
      if (S.got.size === world.chips.length) { jingle([659, 784, 988, 1319]); S.pops.push({ text: 'TODAS AS SKILLS!', x: c.x + 6, y: c.y - 16, t: -0.6 }); }
      else beep(880 + S.got.size * 30, 0.09);
    }
  }
  const stop = nearStop();
  if (stop && hit.has('act')) openDialog(stop);

  const zone = clamp(Math.floor(S.x / ZONE_W), 0, 3);
  if (zone !== S.zone) { S.zone = zone; S.banner = 2.4; }
  const target = clamp(S.x - 150, 0, WORLD_W - VIEW_W);
  S.cam += (target - S.cam) * Math.min(1, dt * 8);
}

// ---------- desenho ----------
// A cena em pixel art é desenhada em baixa resolução (384x216) e ampliada sem suavização.
// Por cima e por baixo dela entram, em alta resolução, os efeitos "modernos": céu em degradê,
// névoa de profundidade, brilho das luzes, reflexos no chão, clima, bloom e vinheta.
const offscreen = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const lo = offscreen(VIEW_W, VIEW_H), L = lo.getContext('2d');       // mundo + sprites
const uiC = offscreen(VIEW_W, VIEW_H), U = uiC.getContext('2d');     // HUD e painéis
const small = offscreen(128, 72), B = small.getContext('2d');        // bloom
let K = 3;
function resize() {
  const r = cv.parentElement.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = clamp(Math.round(r.width * dpr), VIEW_W, 1920);
  cv.width = w; cv.height = Math.round((w * VIEW_H) / VIEW_W); K = cv.width / VIEW_W;
}
addEventListener('resize', resize); resize();

const lerp = (a, b, k) => a + (b - a) * k;
const mixRgb = (ca, cb, k) => ca.map((v, j) => Math.round(lerp(v, cb[j], k)));
const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
const hexCache = new Map();
const hexRgb = h => { let v = hexCache.get(h); if (!v) hexCache.set(h, v = rgb(h)); return v; };
// mistura entre fases perto das fronteiras: { a, b, k } (k = 0 só a, k = 1 só b)
function zoneMix(pos) {
  const zi = clamp(Math.floor(pos / ZONE_W), 0, 3), local = pos - zi * ZONE_W, E = 70;
  if (local > ZONE_W - E && zi < 3) return { a: zi, b: zi + 1, k: (local - (ZONE_W - E)) / (2 * E) };
  if (local < E && zi > 0) return { a: zi - 1, b: zi, k: 0.5 + local / (2 * E) };
  return { a: zi, b: zi, k: 0 };
}
const weight = (m, z) => (m.a === z ? 1 - m.k : 0) + (m.b === z ? m.k : 0);

// brilho suave em elipse (somado à cena)
function glow(x, y, rx, ry, c, a) {
  if (a <= 0.01) return;
  ctx.save(); ctx.translate(x, y); ctx.scale(1, ry / rx);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
  g.addColorStop(0, rgba(c, a)); g.addColorStop(0.45, rgba(c, a * 0.4)); g.addColorStop(1, rgba(c, 0));
  ctx.fillStyle = g; ctx.fillRect(-rx, -rx, rx * 2, rx * 2); ctx.restore();
}

const BAND_POS = (() => { let y = 0; return SKY_BANDS.map(h => { const c = (y + h / 2) / GROUND; y += h; return c; }); })();
// sol e lua de cada fase
const ORBS = [
  { x: 296, y: 150, r: 19, core: [255, 236, 170], halo: [255, 140, 70], ha: 0.7 },
  { x: 318, y: 54, r: 5, core: [226, 226, 255], halo: [150, 140, 220], ha: 0.3 },
  { x: 306, y: 40, r: 9, core: [244, 244, 255], halo: [150, 160, 255], ha: 0.42 },
  { x: 88, y: 160, r: 21, core: [255, 244, 200], halo: [255, 160, 110], ha: 0.75 },
];
const CLOUD_TINT = [[255, 170, 120], [120, 100, 180], [60, 64, 130], [255, 190, 160]];
const CLOUDS = [[40, 34, 60, 0.45], [150, 58, 86, 0.3], [260, 26, 70, 0.4], [350, 70, 96, 0.28], [470, 44, 64, 0.38]];

function drawSky(m) {
  const g = ctx.createLinearGradient(0, 0, 0, GROUND);
  BAND_POS.forEach((p, i) => g.addColorStop(p, rgba(mixRgb(skies[m.a][i], skies[m.b][i], m.k), 1)));
  ctx.fillStyle = g; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  const sa = lerp(STAR_ALPHA[m.a], STAR_ALPHA[m.b], m.k);
  if (sa > 0.02) world.stars.forEach(([sx, sy, s, c], i) => {
    const tw = sa * (0.55 + 0.45 * Math.sin(S.time * 2 + i * 1.7));
    ctx.globalAlpha = tw; ctx.fillStyle = c; ctx.fillRect(sx, sy, s * 0.7, s * 0.7);
    if (s > 1) { ctx.globalAlpha = 1; glow(sx + 0.5, sy + 0.5, 5, 5, hexRgb(c), tw * 0.35); }
  });
  ctx.globalAlpha = 1;
  for (const z of new Set([m.a, m.b])) {
    const w = weight(m, z), o = ORBS[z], x = o.x - S.cam * 0.02;
    glow(x, o.y, o.r * 7, o.r * 5, o.halo, o.ha * w * 0.6); glow(x, o.y, o.r * 2.6, o.r * 2.6, o.halo, o.ha * w);
    ctx.globalAlpha = w; ctx.fillStyle = rgba(o.core, 1); ctx.beginPath(); ctx.arc(x, o.y, o.r, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
  }
  const tint = mixRgb(CLOUD_TINT[m.a], CLOUD_TINT[m.b], m.k);
  for (const [cx, cy, cw, ca] of CLOUDS) {
    const x = ((cx - S.cam * 0.06 + S.time * 1.4) % 520 + 520) % 520 - 70;
    glow(x, cy, cw, cw * 0.2, tint, ca * 0.55); glow(x + cw * 0.35, cy - 4, cw * 0.6, cw * 0.16, tint, ca * 0.5); glow(x - cw * 0.3, cy + 3, cw * 0.5, cw * 0.13, tint, ca * 0.45);
  }
}
// névoa: o que está longe puxa para a cor do horizonte
function haze(m, alpha, top) {
  const c = mixRgb(skies[m.a][5], skies[m.b][5], m.k), g = ctx.createLinearGradient(0, top, 0, GROUND);
  g.addColorStop(0, rgba(c, 0)); g.addColorStop(1, rgba(c, alpha));
  ctx.fillStyle = g; ctx.fillRect(0, top, VIEW_W, GROUND - top);
}

// pisos que refletem: [início, fim, linha do espelho, altura do reflexo, intensidade]
const MIRRORS = [
  [world.layers.main.x0, ZONE_W, GROUND + 15, 17, 0.26],
  [ZONE_W, ZONE_W * 2, GROUND + 3, 29, 0.2],
  [ZONE_W * 2, ZONE_W * 3, GROUND + 15, 17, 0.42],
];
function drawReflections(cam) {
  ctx.imageSmoothingEnabled = true; ctx.globalCompositeOperation = 'lighter';
  for (const [from, to, line, h, a] of MIRRORS) {
    const x0 = Math.max(0, from - cam), x1 = Math.min(VIEW_W, to - cam);
    if (x1 <= x0) continue;
    const src = line - 66;
    ctx.save(); ctx.beginPath(); ctx.rect(x0, line, x1 - x0, h); ctx.clip();
    ctx.globalAlpha = a; ctx.translate(0, line); ctx.scale(1, -h / src); ctx.translate(0, -line);
    ctx.drawImage(lo, 0, 66, VIEW_W, src, 0, 66, VIEW_W, src);
    ctx.restore();
  }
  ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
}

const seeded = n => { let s = 1234567; const r = () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; return Array.from({ length: n }, () => [r(), r(), r()]); };
const DROPS = seeded(110), MOTES = seeded(34), FOG = seeded(6);
function drawWeather(m, cam) {
  const rain = weight(m, 2), motes = weight(m, 1), fog = weight(m, 3), warm = weight(m, 0);
  if (warm > 0.02) glow(296 - cam * 0.02, 150, 260, 150, [255, 150, 80], 0.1 * warm); // luz dourada do pôr do sol
  if (motes > 0.02) for (const [a, b, c] of MOTES) {        // partículas de dados subindo
    const x = ((a * 460 - cam * 0.8) % 460 + 460) % 460 - 30, y = 180 - ((b * 150 + S.time * (8 + c * 14)) % 150);
    const al = motes * (0.25 + 0.5 * Math.abs(Math.sin(S.time * 1.3 + a * 20)));
    ctx.fillStyle = rgba([120, 255, 210], al); ctx.fillRect(x, y, 1, 1); glow(x + 0.5, y + 0.5, 4, 4, [88, 240, 192], al * 0.5);
  }
  if (rain > 0.02) {                                        // chuva fina
    ctx.strokeStyle = rgba([190, 205, 255], 0.3 * rain); ctx.lineWidth = 0.5; ctx.beginPath();
    for (const [a, b, c] of DROPS) {
      const sp = 260 + c * 120, y = (b * 230 + S.time * sp) % 230 - 12, x = ((a * 440 - cam * 1.1 - S.time * sp * 0.22) % 440 + 440) % 440 - 20;
      ctx.moveTo(x, y); ctx.lineTo(x - 2.2, y + 9);
    }
    ctx.stroke();
    ctx.fillStyle = rgba([210, 220, 255], 0.35 * rain);
    for (const [a, b] of DROPS.slice(0, 26)) {              // respingos no chão
      const ph = (S.time * 2.4 + b * 7) % 1, x = ((a * 440 - cam) % 440 + 440) % 440 - 20, y = GROUND + 3 + Math.floor(b * 26);
      if (ph < 0.3) { ctx.fillRect(x - ph * 5, y, 1, 0.6); ctx.fillRect(x + ph * 5, y, 1, 0.6); }
    }
  }
  if (fog > 0.02) for (const [a, b, c] of FOG) {             // neblina do amanhecer
    const x = ((a * 560 + S.time * (3 + c * 4) - cam * 0.9) % 560 + 560) % 560 - 90;
    glow(x, 168 + b * 26, 110 + c * 50, 14 + b * 8, [255, 214, 200], 0.16 * fog);
  }
}

function drawLights(cam) {
  ctx.globalCompositeOperation = 'lighter';
  for (const l of world.lights) {
    const x = l.x - cam;
    if (x < -l.rx || x > VIEW_W + l.rx) continue;
    if (l.blink >= 0 && (S.time / BLINK_PERIODS[l.blink]) % 1 >= 0.5) continue;
    glow(x, l.y, l.rx, l.ry, hexRgb(l.color), l.a * 0.66 * (0.93 + 0.07 * Math.sin(S.time * 7 + l.x)));
  }
  world.chips.forEach((c, i) => { if (!S.got.has(c.name)) glow(c.x + 6 - cam, c.y + 6 + Math.round(Math.sin(S.time * 4 + i) * 2), 13, 13, [88, 240, 120], 0.34); });
  for (const c of cars) if (c.sx > -60 && c.sx < VIEW_W + 20) { glow(c.sx + 44, c.y + 8, 30, 7, [255, 240, 180], 0.42); glow(c.sx - 2, c.y + 7, 9, 5, [255, 70, 70], 0.4); }
  if (S.finale > 0.01) glow(antenna.x - cam, 47, 70, 56, [138, 200, 255], 0.3 * Math.min(1, S.finale));
  ctx.globalCompositeOperation = 'source-over';
}

function drawWorld(cam) {
  L.clearRect(0, 0, VIEW_W, VIEW_H);
  const main = layers[2];
  L.drawImage(main.img, main.x0 - cam, 0);
  for (const [x, y, w, h, c, grp] of world.blinks) {
    if (x - cam < -20 || x - cam > VIEW_W + 20 || (S.time / BLINK_PERIODS[grp]) % 1 >= 0.5) continue;
    L.fillStyle = c; L.fillRect(x - cam, y, w, h);
  }
  for (const c of cars) {
    const span = c.to - c.from + 84;
    c.sx = Math.round(c.from - 42 + ((S.time * c.speed + c.offset) % span) - cam);
    if (c.sx < -44 || c.sx > VIEW_W) continue;
    L.save(); L.beginPath(); L.rect(c.from - cam, 0, c.to - c.from, VIEW_H); L.clip();
    L.drawImage(c.img, c.sx, c.y); L.restore();
  }
  if (S.finale > 0.01) {                                    // ondas saindo da antena
    const cx = antenna.x - cam, cy = 47;
    L.fillStyle = '#8ac8ff';
    for (let k = 0; k < 3; k++) {
      const r = 8 + ((S.time * 34 + k * 20) % 60);
      L.globalAlpha = Math.max(0, 1 - r / 68);
      for (let i = 0; i < 40; i++) { const a = (i / 40) * Math.PI * 2; L.fillRect(Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r * 0.8), 2, 2); }
    }
    L.globalAlpha = 1;
  }
  world.chips.forEach((c, i) => {
    if (S.got.has(c.name)) return;
    const sx = c.x - cam;
    if (sx > -12 && sx < VIEW_W) L.drawImage(chipImg, sx, c.y + Math.round(Math.sin(S.time * 4 + i) * 2));
  });

  // sombra no chão (ou na plataforma) logo abaixo do personagem
  let floor = GROUND;
  for (const p of world.platforms) if (S.x > p.x - 5 && S.x < p.x + p.w + 5 && p.y >= S.y - 0.5) floor = Math.min(floor, p.y);
  const px = Math.round(S.x) - cam, shrink = Math.round(clamp((floor - S.y) / 14, 0, 4));
  L.fillStyle = 'rgba(8,4,20,0.34)';
  L.fillRect(px - 10 + shrink, floor, 20 - shrink * 2, 1); L.fillRect(px - 8 + shrink, floor + 1, 16 - shrink * 2, 1);

  let f;
  if (!S.grounded) f = S.vy < 0 ? frames.jump : frames.fall;
  else if (S.moving) f = frames.walk[Math.floor(S.walkT / (WALK_CYCLE / 8)) % 8];
  else if (S.dialog) f = frames.point;
  else if (S.finale > 0.01) f = frames.cheer[Math.floor(S.time / 0.28) % 2];
  else f = frames.idle[Math.floor(S.time / 0.6) % 2];
  const left = S.face < 0;
  L.drawImage(f[left ? 1 : 0], px - (left ? P.w - 1 - P.footX : P.footX), Math.round(S.y) - P.floorY);
}

function drawUI(cam) {
  U.clearRect(0, 0, VIEW_W, VIEW_H);
  const paint = (rects, dx = 0, dy = 0) => { for (const [x, y, w, h, c] of rects) { U.fillStyle = c; U.fillRect(x + dx, y + dy, w, h); } };
  for (const p of S.pops) {
    if (p.t < 0) continue;
    U.globalAlpha = Math.min(1, (1.1 - p.t) * 3);
    paint(shadowText(p.text, Math.round(p.x - cam - textWidth(p.text) / 2), Math.round(p.y - p.t * 22), '#ffd860'));
    U.globalAlpha = 1;
  }
  if (S.mode === 'title') {
    paint(ui.titleRects());
    if (Math.floor(S.time * 2) % 2 === 0) paint(ui.centerText(touch ? 'TOQUE PARA COMEÇAR' : 'PRESSIONE ENTER', 150, '#f6f6fa'));
    return;
  }
  paint(ui.hudZone(S.zone));
  paint(ui.hudChips(S.got.size, world.chips.length));
  if (muted) paint(shadowText('SOM OFF', VIEW_W - 8 - textWidth('SOM OFF'), 20, '#a8b0ff'));
  if (S.dialog) {
    const d = S.dialog, full = d.chars >= d.total;
    paint(ui.dialogFrame(d.stop.title, d.rows.length, true));
    let left = Math.floor(d.chars);
    d.rows.forEach((r, i) => { if (left > 0) paint(ui.rowRects(r, i, left)); left -= ui.rowLength(r); });
    const close = touch ? '[▲] FECHAR' : '[ESPAÇO] FECHAR';
    if (full) paint(ui.hintRects(d.stop.link ? `[E] ABRIR ${d.stop.link.label}   ${close}` : '[E] FECHAR', d.rows.length));
    return;
  }
  if (S.finale > 0.01) {
    U.globalAlpha = Math.min(1, S.finale * 2.5);
    paint(ui.messageRects('TRANSMISSÃO ENVIADA', 'OBRIGADO POR JOGAR', ZONE_COLORS[3]));
    U.globalAlpha = 1;
    return;
  }
  const stop = nearStop();
  if (stop) paint(ui.promptRects(stop.x - cam, stop.py + Math.round(Math.sin(S.time * 6) * 2)));
  if (S.banner > 0) { U.globalAlpha = Math.min(1, S.banner * 2.5); paint(ui.bannerRects(S.zone, ZONE_COLORS[S.zone])); U.globalAlpha = 1; }
  else if (S.done && !touch) paint(ui.centerText('R: JOGAR DE NOVO', 203, '#f6f6fa'));
  else if (S.time < 16 && S.seen.size === 0 && !touch) paint(ui.centerText('← → ANDAR   ESPAÇO PULAR   E INTERAGIR', 203, '#f6f6fa'));
}

function render() {
  const cam = Math.round(S.cam), m = zoneMix(S.cam + 150);
  ctx.setTransform(K, 0, 0, K, 0, 0);
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';

  ctx.imageSmoothingEnabled = true;                         // fundo distante: suave, fora de foco
  drawSky(m);
  ctx.drawImage(layers[0].img, layers[0].x0 - S.cam * layers[0].parallax, 0);
  haze(m, 0.5, 40);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(layers[1].img, Math.round(layers[1].x0 - S.cam * layers[1].parallax), 0);
  haze(m, 0.24, 90);

  drawWorld(cam);
  const amb = AMBIENT[m.a].map((v, i) => lerp(v, AMBIENT[m.b][i], m.k));
  L.globalCompositeOperation = 'source-atop'; L.fillStyle = rgba(amb.slice(0, 3).map(Math.round), amb[3]); L.fillRect(0, 0, VIEW_W, VIEW_H); L.globalCompositeOperation = 'source-over';
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(lo, 0, 0);
  drawReflections(cam);
  drawLights(cam);
  ctx.imageSmoothingEnabled = true; ctx.globalAlpha = 0.94;        // primeiro plano: silhuetas fora de foco
  ctx.drawImage(layers[3].img, layers[3].x0 - S.cam * layers[3].parallax, 0); ctx.globalAlpha = 1;
  drawWeather(m, cam);

  // bloom: o que é claro vaza um pouco de luz
  B.globalCompositeOperation = 'copy'; B.imageSmoothingEnabled = true; B.drawImage(cv, 0, 0, small.width, small.height);
  B.globalCompositeOperation = 'multiply'; B.drawImage(small, 0, 0);
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.imageSmoothingEnabled = true;
  ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.3; ctx.drawImage(small, 0, 0, cv.width, cv.height);
  ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
  ctx.setTransform(K, 0, 0, K, 0, 0);

  const v = ctx.createRadialGradient(VIEW_W / 2, VIEW_H / 2, 96, VIEW_W / 2, VIEW_H / 2, 236);   // vinheta
  v.addColorStop(0, 'rgba(6,2,20,0)'); v.addColorStop(1, 'rgba(6,2,20,0.55)');
  ctx.fillStyle = v; ctx.fillRect(0, 0, VIEW_W, VIEW_H);

  drawUI(cam);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(uiC, 0, 0);
}

// ---------- versão em texto (leitores de tela e buscadores) ----------
const info = document.getElementById('info');
if (info) {
  const esc = t => t.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  info.innerHTML = ZONES.map((z, i) => `<h2>Fase ${i + 1}: ${esc(z.name)}</h2><ul>${world.stops.filter(s => s.zone === i).map(s =>
    `<li><strong>${esc(s.label)}</strong>: ${s.rows.map(([a, b]) => esc(a ? `${a}: ${b}` : b)).join('; ')}${s.link ? ` — <a href="${esc(s.link.url)}">${esc(s.link.label)}</a>` : ''}</li>`).join('')}</ul>`).join('')
    + `<h2>Skills</h2><p>${world.chips.map(c => esc(c.name)).join(', ')}</p>`;
}

// ---------- laço ----------
let last = performance.now();
function tick(now) {
  const dt = clamp((now - last) / 1000, 0, 0.05); last = now;
  update(dt); hit.clear(); render();
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);
window.__quest = { S, world }; // para depuração e testes
