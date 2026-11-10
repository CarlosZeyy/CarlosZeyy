// Gera out/shot-*.png: quadros estáticos do jogo (uma câmera por arquivo) para conferência visual
// sem precisar abrir o navegador. Uso: node shots.js [camX ...]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildWorld, VIEW_W, VIEW_H, GROUND, ZONE_W, SKIES, SKY_BANDS, STAR_ALPHA, ZONE_COLORS } from '../../game/shared/world.js';
import { buildPlayer } from '../../game/shared/character.js';
import { SPRITES, gridRects } from '../../game/shared/sprites.js';
import * as ui from '../../game/shared/ui.js';
import { createImage, composite, encodePNG } from './raster.js';

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'out');
fs.mkdirSync(OUT, { recursive: true });
const world = buildWorld(), P = buildPlayer();

export function frame(cam, o = {}) {
  const img = createImage(VIEW_W, VIEW_H);
  const px = cam + 130, zone = Math.max(0, Math.min(3, Math.floor(px / ZONE_W)));
  let y = 0;
  SKY_BANDS.forEach((h, i) => { composite(img, [[0, y, VIEW_W, h, SKIES[zone][i]]]); y += h; });
  if (STAR_ALPHA[zone] > 0.5) composite(img, world.stars.map(([sx, sy, s, c]) => [sx, sy, s, s, c]));
  for (const k of ['far', 'mid', 'main']) composite(img, world.layers[k].rects, -Math.round(cam * world.layers[k].parallax), 0);
  composite(img, world.blinks, -cam, 0);
  for (const c of world.cars) if (o.cars !== false) composite(img, c.rects, c.from + 150 - cam, c.y);
  for (const c of world.chips) composite(img, gridRects(SPRITES.chip, c.x - cam, c.y));
  composite(img, gridRects(o.walk ? P.walk[2] : P.idle[0], 130 - P.footX, GROUND - P.floorY));
  if (!o.title) { composite(img, ui.hudZone(zone)); composite(img, ui.hudChips(3, world.chips.length)); }
  const stop = world.stops.find(s => Math.abs(s.x - px) < 24);
  if (stop && o.dialog !== false) {
    const rows = stop.rows;
    composite(img, ui.dialogFrame(stop.title, rows.length, true));
    rows.forEach((r, i) => composite(img, ui.rowRects(r, i)));
    composite(img, ui.hintRects(stop.link ? `[E] ABRIR ${stop.link.label}   [ESPAÇO] FECHAR` : '[E] FECHAR', rows.length));
  } else if (stop) composite(img, ui.promptRects(stop.x - cam, stop.py));
  if (o.title) { composite(img, ui.titleRects()); composite(img, ui.centerText('PRESS START', 150, '#f6f6fa')); }
  if (o.banner) composite(img, ui.bannerRects(zone, ZONE_COLORS[zone]));
  return img;
}

if (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]))) {
  const cams = process.argv.slice(2).map(Number);
  const list = cams.length ? cams.map(c => [c, {}]) : [[-140, { title: true }], [20, {}], [220, { dialog: false }], [628, {}], [800, { walk: true }], [1178, {}], [1500, { banner: true, walk: true }], [1900, { walk: true }], [2048, {}]];
  // imagem de compartilhamento do jogo (og:image)
  if (!cams.length) fs.writeFileSync(path.join(OUT, '../../../game/og.png'), encodePNG(frame(-140, { title: true, dialog: false }), 3));
  for (const [cam, o] of list) {
    const file = path.join(OUT, `shot-${cam}.png`);
    fs.writeFileSync(file, encodePNG(frame(cam, o), 3));
    console.log(file);
  }
}
