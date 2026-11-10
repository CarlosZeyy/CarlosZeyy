// Full-Stack Quest: jogo de plataforma do perfil. JS puro, sem dependências.
import { buildPlayer } from './shared/character.js';
import { SPRITES, gridRects } from './shared/sprites.js';
import { buildWorld, VIEW_W, VIEW_H, GROUND, ZONE_W, WORLD_W, SPEED, WALK_CYCLE, SKIES, SKY_BANDS, STAR_ALPHA, ZONE_COLORS, BLINK_PERIODS } from './shared/world.js';
import { shadowText, textWidth } from './shared/font.js';
import { ZONES } from './shared/content.js';
import * as ui from './shared/ui.js';

const GRAVITY = 1000, JUMP = 380, TYPE_SPEED = 90;
const COYOTE = 0.09, JUMP_BUFFER = 0.12; // tolerâncias que deixam o pulo mais gentil
const cv = document.getElementById('game');
const ctx = cv.getContext('2d');
ctx.imageSmoothingEnabled = false;
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
const layers = ['far', 'mid', 'main'].map(k => { const l = world.layers[k]; return { ...l, img: bake(l.rects, l.x0, l.w, VIEW_H) }; });
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
const paint = (rects, dx = 0, dy = 0) => { for (const [x, y, w, h, c] of rects) { ctx.fillStyle = c; ctx.fillRect(x + dx, y + dy, w, h); } };
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
function drawSky(pos) {
  const zi = clamp(Math.floor(pos / ZONE_W), 0, 3), local = pos - zi * ZONE_W, E = 60;
  let a = zi, b = zi, k = 0;
  if (local > ZONE_W - E && zi < 3) { b = zi + 1; k = (local - (ZONE_W - E)) / (2 * E); }
  else if (local < E && zi > 0) { a = zi - 1; k = 0.5 + local / (2 * E); }
  let y = 0;
  SKY_BANDS.forEach((h, i) => {
    const ca = skies[a][i], cb = skies[b][i];
    ctx.fillStyle = `rgb(${ca.map((v, j) => Math.round(v + (cb[j] - v) * k)).join(',')})`;
    ctx.fillRect(0, y, VIEW_W, h); y += h;
  });
  const alpha = STAR_ALPHA[a] + (STAR_ALPHA[b] - STAR_ALPHA[a]) * k;
  if (alpha > 0.02) {
    world.stars.forEach(([sx, sy, s, c], i) => {
      ctx.globalAlpha = alpha * (0.6 + 0.4 * Math.sin(S.time * 2 + i));
      ctx.fillStyle = c; ctx.fillRect(sx, sy, s, s);
    });
    ctx.globalAlpha = 1;
  }
}

// ondas saindo da antena no final
function drawSignal(cam) {
  const cx = antenna.x - cam, cy = 47;
  ctx.fillStyle = '#8ac8ff';
  for (let k = 0; k < 3; k++) {
    const r = 8 + ((S.time * 34 + k * 20) % 60);
    ctx.globalAlpha = Math.max(0, 1 - r / 68);
    for (let i = 0; i < 40; i++) { const a = (i / 40) * Math.PI * 2; ctx.fillRect(Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r * 0.8), 2, 2); }
  }
  ctx.globalAlpha = 1;
}

function render() {
  const cam = Math.round(S.cam);
  drawSky(S.cam + 150);
  for (const l of layers) ctx.drawImage(l.img, Math.round(l.x0 - cam * l.parallax), 0);

  for (const [x, y, w, h, c, grp] of world.blinks) {
    if (x - cam < -20 || x - cam > VIEW_W + 20 || (S.time / BLINK_PERIODS[grp]) % 1 >= 0.5) continue;
    ctx.fillStyle = c; ctx.fillRect(x - cam, y, w, h);
  }
  for (const c of cars) {
    const span = c.to - c.from + 84, x = c.from - 42 + ((S.time * c.speed + c.offset) % span) - cam;
    if (x < -44 || x > VIEW_W) continue;
    ctx.save(); ctx.beginPath(); ctx.rect(c.from - cam, 0, c.to - c.from, VIEW_H); ctx.clip();
    ctx.drawImage(c.img, Math.round(x), c.y); ctx.restore();
  }
  if (S.finale > 0) drawSignal(cam);

  world.chips.forEach((c, i) => {
    if (S.got.has(c.name)) return;
    const sx = c.x - cam;
    if (sx > -12 && sx < VIEW_W) ctx.drawImage(chipImg, sx, c.y + Math.round(Math.sin(S.time * 4 + i) * 2));
  });

  let f;
  if (!S.grounded) f = S.vy < 0 ? frames.jump : frames.fall;
  else if (S.moving) f = frames.walk[Math.floor(S.walkT / (WALK_CYCLE / 8)) % 8];
  else if (S.dialog) f = frames.point;
  else if (S.finale > 0.01) f = frames.cheer[Math.floor(S.time / 0.28) % 2];
  else f = frames.idle[Math.floor(S.time / 0.6) % 2];
  const left = S.face < 0;
  ctx.drawImage(f[left ? 1 : 0], Math.round(S.x) - cam - (left ? P.w - 1 - P.footX : P.footX), Math.round(S.y) - P.floorY);

  for (const p of S.pops) {
    if (p.t < 0) continue;
    ctx.globalAlpha = Math.min(1, (1.1 - p.t) * 3);
    paint(shadowText(p.text, Math.round(p.x - cam - textWidth(p.text) / 2), Math.round(p.y - p.t * 22), '#ffd860'));
    ctx.globalAlpha = 1;
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
  const stop = nearStop();
  if (stop) paint(ui.promptRects(stop.x - cam, stop.py + Math.round(Math.sin(S.time * 6) * 2)));
  if (S.finale > 0.01) {
    ctx.globalAlpha = Math.min(1, S.finale * 2.5);
    paint(ui.messageRects('TRANSMISSÃO ENVIADA', 'OBRIGADO POR JOGAR', ZONE_COLORS[3]));
    ctx.globalAlpha = 1;
  } else if (S.banner > 0) {
    ctx.globalAlpha = Math.min(1, S.banner * 2.5); paint(ui.bannerRects(S.zone, ZONE_COLORS[S.zone])); ctx.globalAlpha = 1;
  } else if (S.done && !touch) paint(ui.centerText('R: JOGAR DE NOVO', 203, '#f6f6fa'));
  else if (S.time < 16 && S.seen.size === 0 && !touch) paint(ui.centerText('← → ANDAR   ESPAÇO PULAR   E INTERAGIR', 203, '#f6f6fa'));
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
