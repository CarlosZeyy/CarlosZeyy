// Gera assets/game.svg: o jogo "jogando sozinho" em loop, para o README do perfil.
// README do GitHub não roda JavaScript, então tudo aqui é animação CSS dentro do SVG:
// uma linha do tempo única (LOOP segundos) com boot -> título -> caminhada com paradas -> convite para jogar.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildWorld, VIEW_W, VIEW_H, GROUND, ZONE_W, SPEED, WALK_CYCLE, SKIES, SKY_BANDS, STAR_ALPHA, BLINK_PERIODS } from '../../game/shared/world.js';
import { buildPlayer } from '../../game/shared/character.js';
import { SPRITES, gridRects } from '../../game/shared/sprites.js';
import { textRects, shadowText, textWidth, CHAR_W } from '../../game/shared/font.js';
import { COLS } from '../../game/shared/content.js';
import * as ui from '../../game/shared/ui.js';
import { rectsToPaths } from './raster.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const OUT = process.argv[2] ? path.resolve(process.argv[2]) : path.resolve(here, '../../assets/game.svg');
const world = buildWorld({ texture: false }), P = buildPlayer();

// ---------- linha do tempo ----------
const PX = 130;        // x do personagem na tela
const STAND = 26;      // ele para um pouco antes do objeto, para não cobri-lo
const CAM0 = -140;
const T_TITLE = 2.6, T_GAME = 6.4;
const demo = world.stops.filter(s => s.demo).map(s => ({ ...s, rows: s.demoRows || s.rows }));
const ROW_T = 0.55;    // tempo para "digitar" cada linha
const keys = [[0, CAM0], [T_GAME, CAM0]];   // [tempo, câmera]
const walks = [], pauses = [];
{
  let t = T_GAME, cam = CAM0;
  for (const s of demo) {
    const to = s.x - PX - STAND, dur = (to - cam) / SPEED;
    walks.push([t, t + dur]); t += dur; cam = to; keys.push([t, cam]);
    const hold = 0.5 + s.rows.length * ROW_T + (s.final ? 3.4 : 2.3);
    pauses.push([t, t + hold]); t += hold; keys.push([t, cam]);
  }
}
const T_END = keys[keys.length - 1][0];
const LOOP = +(T_END + 3.6).toFixed(2);
keys.push([LOOP, keys[keys.length - 1][1]]);
// instante em que a câmera passa por um valor (durante uma caminhada)
function timeAtCam(c) {
  for (let i = 1; i < keys.length; i++) {
    const [t0, c0] = keys[i - 1], [t1, c1] = keys[i];
    if (c1 > c0 && c >= c0 && c <= c1) return t0 + ((c - c0) / (c1 - c0)) * (t1 - t0);
  }
  throw new Error(`câmera ${c} fora do percurso`);
}

// ---------- CSS ----------
const css = [];
const pct = t => `${+((t / LOOP) * 100).toFixed(3)}%`;
function frames(name, pairs, prop, timing) {
  const body = pairs.map(([t, v, tf]) => `${pct(t)}{${prop}:${v}${tf ? `;animation-timing-function:${tf}` : ''}}`).join('');
  css.push(`@keyframes ${name}{${body}}`, `.${name}{${prop}:${pairs[0][1]};animation:${name} ${LOOP}s ${timing} infinite}`);
  return name;
}
// visível só nos intervalos [a, b] (troca seca)
function visible(name, intervals) {
  const pairs = [];
  for (const [a, b] of intervals) { if (b <= a) continue; pairs.push([a, 1], [b, 0]); }
  if (!pairs.length || pairs[0][0] > 0) pairs.unshift([0, 0]);
  const last = pairs[pairs.length - 1];
  if (last[0] < LOOP) pairs.push([LOOP, last[1]]); else last[0] = LOOP;
  return frames(name, pairs, 'opacity', 'step-end');
}
const g = (cls, inner, extra = '') => `<g class="${cls}"${extra}>${inner}</g>`;
let defs = '';
css.push('@keyframes blink{0%{opacity:1}50%{opacity:0}100%{opacity:0}}', '.blink{animation:blink .9s step-end infinite}');
const P_ = rectsToPaths;

// câmera por camada
for (const k of ['far', 'mid', 'main', 'fg']) {
  const p = world.layers[k].parallax;
  frames(`cam-${k}`, keys.map(([t, c]) => [t, `translateX(${-Math.round(c * p)}px)`]), 'transform', 'linear');
}

// ---------- céu ----------
const zoneT = [1, 2, 3].map(i => timeAtCam(i * ZONE_W - PX)); // instante em que ele entra em cada fase
// Céu em degradê (as mesmas cores das faixas do jogo), com sol ou lua e nuvens suaves.
// Estes elementos são vetoriais de propósito: é a camada "moderna" por trás do pixel art.
const smooth = inner => `<g shape-rendering="geometricPrecision">${inner}</g>`;
const bandPos = (() => { let y = 0; return SKY_BANDS.map(h => { const c = (y + h / 2) / GROUND; y += h; return c; }); })();
const ORBS = [
  { x: 296, y: 150, r: 19, core: '#ffecaa', halo: '#ff8c46', ha: 0.7 },
  { x: 318, y: 54, r: 5, core: '#e2e2ff', halo: '#968cdc', ha: 0.3 },
  { x: 306, y: 40, r: 9, core: '#f4f4ff', halo: '#96a0ff', ha: 0.42 },
  { x: 88, y: 160, r: 21, core: '#fff4c8', halo: '#ffa06e', ha: 0.75 },
];
const CLOUD_TINT = ['#ffaa78', '#7864b4', '#3c4082', '#ffbea0'];
const CLOUDS = [[60, 34, 60, 0.45], [170, 58, 86, 0.3], [280, 26, 70, 0.4], [370, 70, 96, 0.28]];
const glowIds = new Map();
// elipse com degradê radial que some nas bordas
function glowEl(x, y, rx, ry, color, a, cls = '') {
  let id = glowIds.get(color);
  if (!id) {
    id = `gl${glowIds.size}`; glowIds.set(color, id);
    defs += `<radialGradient id="${id}"><stop offset="0" stop-color="${color}"/><stop offset=".45" stop-color="${color}" stop-opacity=".4"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></radialGradient>`;
  }
  return `<ellipse${cls ? ` class="${cls}"` : ''} cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="url(#${id})" opacity="${+a.toFixed(2)}"/>`;
}
function skyArt(i) {
  defs += `<linearGradient id="skyg${i}" x1="0" y1="0" x2="0" y2="1">${SKIES[i].map((c, j) => `<stop offset="${+bandPos[j].toFixed(3)}" stop-color="${c}"/>`).join('')}</linearGradient>`;
  defs += `<linearGradient id="haze${i}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${SKIES[i][5]}" stop-opacity="0"/><stop offset="1" stop-color="${SKIES[i][5]}"/></linearGradient>`;
  const o = ORBS[i];
  let s = `<rect width="${VIEW_W}" height="${GROUND}" fill="url(#skyg${i})"/><rect y="${GROUND}" width="${VIEW_W}" height="${VIEW_H - GROUND}" fill="${SKIES[i][5]}"/>`;
  s += glowEl(o.x, o.y, o.r * 7, o.r * 5, o.halo, o.ha * 0.6) + glowEl(o.x, o.y, o.r * 2.6, o.r * 2.6, o.halo, o.ha) + `<circle cx="${o.x}" cy="${o.y}" r="${o.r}" fill="${o.core}"/>`;
  for (const [cx, cy, cw, ca] of CLOUDS) s += glowEl(cx, cy, cw, cw * 0.2, CLOUD_TINT[i], ca * 0.55) + glowEl(cx + cw * 0.35, cy - 4, cw * 0.6, cw * 0.16, CLOUD_TINT[i], ca * 0.5);
  return smooth(s);
}
// névoa de profundidade: o que está atrás puxa para a cor do horizonte de cada fase
const haze = (alpha, top) => smooth([0, 1, 2, 3].map(i => `<rect${i ? ` class="sky${i}"` : ''} y="${top}" width="${VIEW_W}" height="${GROUND - top}" fill="url(#haze${i})" fill-opacity="${alpha}"/>`).join(''));
let sky = skyArt(0);
zoneT.forEach((t, i) => {
  const name = frames(`sky${i + 1}`, [[0, 0], [t - 0.7, 0], [t + 0.7, 1], [LOOP, 1]], 'opacity', 'linear');
  sky += g(name, skyArt(i + 1));
});
const starPairs = [[0, STAR_ALPHA[0]]];
zoneT.forEach((t, i) => starPairs.push([t - 0.7, STAR_ALPHA[i]], [t + 0.7, STAR_ALPHA[i + 1]]));
starPairs.push([LOOP, STAR_ALPHA[3]]);
sky += g(frames('stars', starPairs, 'opacity', 'linear'), P_(world.stars.map(([x, y, s, c]) => [x, y, s, s, c])));

// ---------- mundo ----------
const groundChips = world.chips.filter(c => c.y >= 140).map(c => ({ ...c, t: timeAtCam(c.x - 6 - PX) }));
let chips = '';
world.chips.forEach((c, i) => {
  const gc = groundChips.find(k => k.name === c.name);
  const cls = gc ? ` class="${visible(`chip${i}`, [[0, gc.t]])}"` : '';
  chips += `<use href="#chip" xlink:href="#chip" x="${c.x}" y="${c.y}"${cls}/>`;
});
css.push('@keyframes bob{0%{transform:translateY(0)}50%{transform:translateY(-3px)}100%{transform:translateY(0)}}', '.bob{animation:bob 1.2s steps(6) infinite}');
let extras = '';
BLINK_PERIODS.forEach((period, i) => {
  css.push(`.bl${i}{animation:blink ${period}s step-end infinite}`);
  extras += g(`bl${i}`, P_(world.blinks.filter(b => b[5] === i)));
});
world.cars.forEach((c, i) => {
  const span = c.to - c.from + 84, dur = span / c.speed;
  css.push(`@keyframes car${i}{0%{transform:translateX(${c.from - 42}px)}100%{transform:translateX(${c.to + 42}px)}}`, `.car${i}{animation:car${i} ${+dur.toFixed(2)}s linear ${-(c.offset / c.speed).toFixed(2)}s infinite}`);
  defs += `<clipPath id="road${i}"><rect x="${c.from}" y="0" width="${c.to - c.from}" height="${VIEW_H}"/></clipPath>`;
  extras += `<g clip-path="url(#road${i})"><g class="car${i}"><g transform="translate(0,${c.y})">${P_(c.rects)}</g></g></g>`;
});
// luzes: brilho suave por cima do cenário (mesmas fontes de luz do jogo)
const LIGHT_GAIN = 0.62;
const lightsSvg = smooth(world.lights.map(l => glowEl(l.x, l.y, l.rx, l.ry, l.color, l.a * LIGHT_GAIN, l.blink >= 0 ? `bl${l.blink}` : '')).join(''));
const layerSvg = k => g(`cam-${k}`, P_(world.layers[k].rects, 12) + (k === 'main' ? extras + g('bob', chips) + lightsSvg : ''));

// chuva na fase 3: um padrão de riscos que desliza na diagonal
const RAIN = { w: 96, h: 120 };
{
  let s = 99; const r = () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
  const drops = Array.from({ length: 16 }, () => { const x = 4 + r() * (RAIN.w - 8), y = r() * (RAIN.h - 10); return `M${x.toFixed(1)} ${y.toFixed(1)}l-2.2 9`; }).join('');
  defs += `<pattern id="rain" width="${RAIN.w}" height="${RAIN.h}" patternUnits="userSpaceOnUse"><path d="${drops}" stroke="#becdff" stroke-width=".5" stroke-opacity=".34" fill="none"/></pattern>`;
  css.push(`@keyframes rainfall{0%{transform:translate(0,0)}100%{transform:translate(${-RAIN.w}px,${RAIN.h * 3}px)}}`, '.rainfall{animation:rainfall .95s linear infinite}');
}
const rainVis = frames('rain-vis', [[0, 0], [zoneT[1] - 0.7, 0], [zoneT[1] + 0.7, 1], [zoneT[2] - 0.7, 1], [zoneT[2] + 0.7, 0], [LOOP, 0]], 'opacity', 'linear');
const rain = g(rainVis, smooth(`<rect class="rainfall" x="0" y="${-RAIN.h * 3}" width="${VIEW_W + RAIN.w}" height="${VIEW_H + RAIN.h * 3}" fill="url(#rain)"/>`));
defs += `<radialGradient id="vig" gradientUnits="userSpaceOnUse" cx="${VIEW_W / 2}" cy="${VIEW_H / 2}" r="236"><stop offset=".4" stop-color="#060214" stop-opacity="0"/><stop offset="1" stop-color="#060214" stop-opacity=".55"/></radialGradient>`;
const vignette = `<rect width="${VIEW_W}" height="${VIEW_H}" fill="url(#vig)"/>`;

// ---------- personagem ----------
css.push('@keyframes wf{0%{opacity:1}12.5%{opacity:0}100%{opacity:0}}', `.wf{opacity:0;animation:wf ${WALK_CYCLE}s step-end infinite}`);
css.push('@keyframes idf{0%{opacity:1}50%{opacity:0}100%{opacity:0}}', '.idf{opacity:0;animation:idf 1.2s step-end infinite}');
const sprite = grid => P_(gridRects(grid));
const walkSvg = P.walk.map((f, i) => `<g class="wf" style="animation-delay:${+(i * WALK_CYCLE / 8).toFixed(4)}s">${sprite(f)}</g>`).join('');
const idleSvg = P.idle.map((f, i) => `<g class="idf" style="animation-delay:${i * 0.6}s">${sprite(f)}</g>`).join('');
const lastPause = pauses[pauses.length - 1];
const idleTimes = [[0, walks[0][0]], [lastPause[1] - 1.6, LOOP]];
const pointTimes = pauses.map(([a, b], i) => [a, i === pauses.length - 1 ? b - 1.6 : b]);
const player = `<g transform="translate(${PX - P.footX},${GROUND - P.floorY})">${g(visible('v-walk', walks), walkSvg)}${g(visible('v-idle', idleTimes), idleSvg)}${g(visible('v-point', pointTimes), sprite(P.point))}</g>`;

// ---------- HUD ----------
let hud = '';
const zoneEdges = [T_GAME, ...zoneT, T_END];
for (let i = 0; i < 4; i++) hud += g(visible(`hz${i}`, [[zoneEdges[i], zoneEdges[i + 1]]]), P_(ui.hudZone(i)));
const total = world.chips.length;
const countEdges = [T_GAME, ...groundChips.map(c => c.t), T_END];
for (let i = 0; i <= groundChips.length; i++) hud += g(visible(`hc${i}`, [[countEdges[i], countEdges[i + 1]]]), P_(ui.hudChips(i, total)));
groundChips.forEach((c, i) => {
  const until = Math.min(c.t + 0.9, groundChips[i + 1] ? groundChips[i + 1].t : Infinity);
  const text = `+ ${c.name}`;
  hud += g(visible(`pop${i}`, [[c.t, until]]), P_(shadowText(text, PX - Math.round(textWidth(text) / 2), 106, '#ffd860')));
});
const cta = '▶ CLIQUE PARA JOGAR';
hud += g(visible('cta', [[T_GAME + 1, T_END]]), P_(shadowText(cta, VIEW_W - 8 - textWidth(cta), 204, '#ffd860')));

// ---------- painéis SYSTEM.INFO ----------
let dialogs = '';
demo.forEach((s, i) => {
  const [a, b] = pauses[i];
  let inner = P_(ui.dialogFrame(s.title, s.rows.length, false)), covers = '';
  s.rows.forEach((row, j) => {
    const t0 = a + 0.45 + j * ROW_T, [cx, cy, cw, ch, bg] = ui.rowCover(j);
    const name = frames(`cv${i}-${j}`, [[0, 'translateX(0)', 'step-end'], [t0, 'translateX(0)', `steps(${COLS},end)`], [t0 + ROW_T - 0.05, `translateX(${cw}px)`], [LOOP, `translateX(${cw}px)`]], 'transform', 'linear');
    inner += P_(ui.rowRects(row, j)); covers += `<rect class="${name}" x="${cx}" y="${cy}" width="${cw}" height="${ch}" fill="${bg}"/>`;
  });
  dialogs += g(visible(`dlg${i}`, [[a + 0.2, b - 0.15]]), inner + `<g clip-path="url(#dlgclip)">${covers}</g>`);
});

// ---------- boot, título e convite ----------
const BOOT_BG = '#06060e';
const bootLines = [
  ['CZ-OS 16-BIT · PROFILE CARTRIDGE', 0.15, '#8ae8ff'],
  ['CARLOSZEYY@GITHUB:~ % ./PROFILE.SH --PLAY', 0.5, '#f6f6fa', true],
  ['LOADING WORLD ............ OK', 1.7, '#58f090'],
  ['LOADING SKILLS ........... OK', 1.95, '#58f090'],
  ['LOADING PLAYER ........... OK', 2.2, '#58f090'],
];
let boot = `<rect x="-1" y="-1" width="${VIEW_W + 2}" height="${VIEW_H + 2}" fill="${BOOT_BG}"/>`;
bootLines.forEach(([text, t, color, typed], i) => {
  const y = 62 + i * 14, x = 40;
  let inner = P_(textRects(text, x, y, color));
  if (typed) {
    const from = 22 * CHAR_W, w = textWidth(text) + 1 - from; // digita só o comando, depois do prompt
    const name = frames('boot-type', [[0, 'translateX(0)', 'step-end'], [t + 0.1, 'translateX(0)', 'steps(19,end)'], [t + 1.0, `translateX(${w}px)`], [LOOP, `translateX(${w}px)`]], 'transform', 'linear');
    inner += `<rect class="${name}" x="${x + from}" y="${y - 2}" width="${VIEW_W}" height="11" fill="${BOOT_BG}"/>`;
  }
  boot += g(visible(`boot${i}`, [[t, T_TITLE]]), inner);
});
boot = g(visible('v-boot', [[0, T_TITLE]]), boot);

const title = g(visible('v-title', [[T_TITLE, T_GAME]]), P_(ui.titleRects()) + g('blink', P_(ui.centerText('PRESS START', 150, '#f6f6fa'))));
const flashAt = t => [[t - 0.02, 0], [t, 0.85], [t + 0.35, 0]];
const flash = `<rect class="${frames('flash', [[0, 0], ...flashAt(T_TITLE), ...flashAt(T_GAME), [LOOP, 0]], 'opacity', 'linear')}" width="${VIEW_W}" height="${VIEW_H}" fill="#f6f6fa"/>`;

const end = g(visible('v-end', [[T_END, LOOP]]), P_([
  [0, 0, VIEW_W, VIEW_H, 'rgba(8,6,24,0.8)'], [0, 66, VIEW_W, 1, '#ffd860'], [0, 148, VIEW_W, 1, '#ffd860'],
  ...ui.centerText(cta, 80, '#ffd860', 2),
  ...ui.centerText('CARLOSZEYY.GITHUB.IO/CARLOSZEYY', 108, '#8ae8ff'),
  ...ui.centerText(`${groundChips.length} DE ${total} SKILLS · AS OUTRAS PEDEM PULO`, 126, '#f6f6fa'),
]));

// ---------- montagem ----------
const SX = 8, SY = 22, W = VIEW_W + SX * 2, H = VIEW_H + SY + 8;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W * 3}" height="${H * 3}" viewBox="0 0 ${W} ${H}" shape-rendering="crispEdges" role="img" aria-label="Carlos Moises — Full-Stack Quest: jogo 16-bit do perfil">
<title>Carlos Moises — Full-Stack Quest</title>
<desc>Animação em pixel art: o personagem anda por quatro fases (origem, skills, projetos e contato) mostrando o perfil de Carlos Moises, desenvolvedor full stack. Clique para jogar.</desc>
<style>${css.join('')}</style>
<defs>
<clipPath id="screen"><rect width="${VIEW_W}" height="${VIEW_H}"/></clipPath>
<clipPath id="dlgclip"><rect x="${ui.DLG.x + ui.DLG.pad}" y="0" width="${COLS * CHAR_W}" height="${VIEW_H}"/></clipPath>
<g id="chip">${P_(gridRects(SPRITES.chip))}</g>
${defs}
<pattern id="scan" width="2" height="2" patternUnits="userSpaceOnUse"><rect y="1" width="2" height="1" fill="#000" fill-opacity=".1"/></pattern>
</defs>
<rect x=".5" y=".5" width="${W - 1}" height="${H - 1}" rx="7" fill="#0a0816" stroke="#3a3470" shape-rendering="geometricPrecision"/>
<g shape-rendering="geometricPrecision"><circle cx="14" cy="11" r="2.6" fill="#ff5a5a"/><circle cx="23" cy="11" r="2.6" fill="#ffd860"/><circle cx="32" cy="11" r="2.6" fill="#58f090"/>
<text x="${W / 2}" y="13.5" text-anchor="middle" font-family="ui-monospace,SFMono-Regular,Menlo,Consolas,'Liberation Mono',monospace" font-size="6.5" fill="#8a84c0">carloszeyy@github:~ % ./profile.sh --play</text></g>
<g transform="translate(${SX},${SY})" clip-path="url(#screen)">
${sky}
${layerSvg('far')}
${haze(0.5, 40)}
${layerSvg('mid')}
${haze(0.24, 90)}
${layerSvg('main')}
${player}
${layerSvg('fg')}
${rain}
${vignette}
${g(visible('v-hud', [[T_GAME, T_END]]), hud)}
${dialogs}
${end}
${title}
${boot}
${flash}
<rect width="${VIEW_W}" height="${VIEW_H}" fill="url(#scan)"/>
</g>
</svg>
`;
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, svg);
console.log(`${OUT}: ${(svg.length / 1024).toFixed(0)} KB, loop de ${LOOP}s`);
console.log(`paradas: ${demo.map((s, i) => `${s.id} ${pauses[i][0].toFixed(1)}s`).join(', ')}; fim ${T_END.toFixed(1)}s`);
